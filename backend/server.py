from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import base64
import httpx
import json
import re
import io
import shutil
import time
import asyncio
# OCR dependencies
from PIL import Image
import pytesseract
from pdf2image import convert_from_bytes

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="OCR Resume Scanner API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

ANALYSES_CACHE_TTL_SECONDS = float(os.environ.get("ANALYSES_CACHE_TTL_SECONDS", "2"))
_analyses_cache_payload: List[Dict[str, Any]] = []
_analyses_cache_expires_at: float = 0.0
_analyses_cache_lock = asyncio.Lock()

def _invalidate_analyses_cache() -> None:
    global _analyses_cache_payload, _analyses_cache_expires_at
    _analyses_cache_payload = []
    _analyses_cache_expires_at = 0.0

def _resolve_tesseract_cmd() -> Optional[str]:
    env_candidates = [
        os.environ.get("TESSERACT_CMD"),
        os.environ.get("TESSERACT_PATH"),
    ]

    windows_candidates = [
        r"C:\Program Files\Tesseract-OCR\tesseract.exe",
        r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    ]

    for candidate in env_candidates + windows_candidates:
        if candidate and Path(candidate).exists():
            return candidate

    in_path = shutil.which("tesseract")
    if in_path:
        return in_path

    return None

def _resolve_poppler_path() -> Optional[str]:
    env_candidates = [
        os.environ.get("POPPLER_PATH"),
    ]

    windows_candidates = [
        r"C:\Program Files\poppler\Library\bin",
        r"C:\Program Files\poppler-25.12.0\Library\bin",
    ]

    for candidate in env_candidates + windows_candidates:
        if candidate and Path(candidate).exists():
            return candidate

    return None

def _parse_cors_origins() -> List[str]:
    cors_raw = os.environ.get("CORS_ORIGINS", "*")
    origins = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]
    return origins or ["*"]

# ============ Models ============

class SkillAnalysis(BaseModel):
    skill: str
    proficiency: str
    category: str

class SectionScore(BaseModel):
    name: str
    score: int
    feedback: str

class ResumeAnalysisResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    overall_score: float
    structure_score: int
    content_score: int
    skills_score: int
    ats_score: int
    format_score: int
    candidate_name: Optional[str] = "Unknown"
    email: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    portfolio: Optional[str] = None
    availability: Optional[str] = None
    summary: str
    strengths: List[str]
    improvements: List[str]
    recommendations: List[str]
    skills: List[SkillAnalysis]
    skills_categories: Optional[List[Dict[str, Any]]] = None
    sections: List[SectionScore]
    experience: Optional[List[Dict[str, Any]]] = None
    languages: Optional[List[Dict[str, str]]] = None
    education: Optional[List[Dict[str, Any]]] = None
    keywords_found: List[str]
    keywords_missing: List[str]
    feedback: Optional[List[str]] = None
    raw_text: str
    document_type: str = "resume"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DocumentAnalysisRequest(BaseModel):
    text: str
    analysis_type: str = "resume"  # resume, document, general

class DocumentExplanationRequest(BaseModel):
    text: str
    question: Optional[str] = None

class DocumentExplanationResponse(BaseModel):
    explanation: str
    key_points: List[str]
    document_type: str

class AnalyzedDocument(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    raw_text: str
    analysis: Dict[str, Any]
    document_type: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============ Lifespan Event ============

def lifespan(app: FastAPI):
    yield
    client.close()

# ============ Helper Functions ============

def extract_json_from_response(text: str) -> dict:
    """Extract JSON from potentially malformed response"""
    # Remove markdown code blocks
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    
    text = text.strip()
    
    # Find first { and last }
    start_idx = text.find('{')
    end_idx = text.rfind('}')
    
    if start_idx >= 0 and end_idx > start_idx:
        text = text[start_idx:end_idx+1]
    
    return json.loads(text)

def calculate_basic_scores(text: str) -> dict:
    """Calculate basic resume scores based on text analysis"""
    text_lower = text.lower()
    
    # ATS Score - Check for common ATS-friendly elements
    ats_factors = {
        "email": bool(re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)),
        "phone": bool(re.search(r'[\+\d\s\-\(\)]{10,}', text)),
        "education": any(word in text_lower for word in ['education', 'degree', 'university', 'college', 'bachelor', 'master', 'phd']),
        "experience": any(word in text_lower for word in ['experience', 'work history', 'employment']),
        "skills": any(word in text_lower for word in ['skills', 'technologies', 'proficiencies']),
    }
    ats_score = int(sum(ats_factors.values()) / len(ats_factors) * 100)
    
    # Format Score
    format_factors = {
        "length": 500 < len(text) < 5000,
        "sections": sum(1 for word in ['education', 'experience', 'skills', 'summary', 'objective'] if word in text_lower) >= 3,
        "bullet_points": text.count('•') > 3 or text.count('-') > 5,
        "dates": bool(re.search(r'\d{4}', text)),
    }
    format_score = int(sum(format_factors.values()) / len(format_factors) * 100)
    
    # Content Score
    action_verbs = ['developed', 'managed', 'created', 'implemented', 'designed', 'led', 'built', 'improved', 'increased', 'reduced']
    action_count = sum(1 for verb in action_verbs if verb in text_lower)
    content_score = min(100, 50 + action_count * 10)
    
    # Skills Score
    tech_skills = ['python', 'javascript', 'java', 'react', 'node', 'sql', 'aws', 'docker', 'kubernetes', 'git', 
                   'html', 'css', 'typescript', 'mongodb', 'postgresql', 'azure', 'machine learning', 'ai']
    soft_skills = ['leadership', 'communication', 'teamwork', 'problem-solving', 'analytical', 'creative']
    
    tech_found = [s for s in tech_skills if s in text_lower]
    soft_found = [s for s in soft_skills if s in text_lower]
    skills_score = min(100, len(tech_found) * 8 + len(soft_found) * 10)
    
    # Extract contact info
    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    phone_match = re.search(r'[\+\d\s\-\(\)]{10,}', text)
    
    # Try to extract name (usually at the start)
    lines = text.strip().split('\n')
    name = lines[0].strip() if lines else "Unknown"
    if len(name) > 50 or '@' in name:
        name = "Unknown"
    
    overall_score = int((ats_score + format_score + content_score + skills_score) / 4)
    
    return {
        "overall_score": overall_score,
        "ats_score": ats_score,
        "format_score": format_score,
        "content_score": content_score,
        "skills_score": skills_score,
        "candidate_name": name,
        "email": email_match.group() if email_match else None,
        "phone": phone_match.group().strip() if phone_match else None,
        "keywords_found": tech_found + soft_found,
        "keywords_missing": [s for s in tech_skills[:5] if s not in text_lower],
    }

async def analyze_with_ollama(text: str, analysis_type: str = "resume") -> dict:
    """Try to analyze with Ollama, fall back to basic analysis if unavailable"""
    
    # First try local Ollama
    ollama_urls = [
        "https://ollama.com",
    ]
    
    prompt = f"""You are an expert HR analyst. Analyze this {analysis_type} and provide a detailed assessment.

TEXT TO ANALYZE:
{text[:4000]}

Respond with ONLY valid JSON in this exact format:
{{
    "summary": "2-3 sentence summary of the document",
    "strengths": ["strength 1", "strength 2", "strength 3"],
    "improvements": ["improvement 1", "improvement 2", "improvement 3"],
    "skills": [
        {{"skill": "skill name", "proficiency": "expert/intermediate/beginner", "category": "technical/soft/domain"}}
    ],
    "sections": [
        {{"name": "section name", "score": 85, "feedback": "brief feedback"}}
    ],
    "recommendation": "Brief hiring recommendation"
}}"""

    for ollama_url in ollama_urls:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": "mistral",
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.3}
                    }
                )
                if response.status_code == 200:
                    result = response.json()
                    return extract_json_from_response(result.get("response", "{}"))
        except Exception as e:
            logger.warning(f"Ollama at {ollama_url} unavailable: {e}")
            continue
    
    # Fall back to basic analysis
    logger.info("Using basic analysis (Ollama unavailable)")
    return generate_basic_analysis(text, analysis_type)

def generate_basic_analysis(text: str, analysis_type: str) -> dict:
    """Generate analysis without AI when Ollama is unavailable"""
    text_lower = text.lower()
    
    # Detect skills
    skills = []
    skill_keywords = {
        "Python": ("python", "technical"),
        "JavaScript": ("javascript", "technical"),
        "React": ("react", "technical"),
        "Node.js": ("node", "technical"),
        "SQL": ("sql", "technical"),
        "AWS": ("aws", "technical"),
        "Docker": ("docker", "technical"),
        "Git": ("git", "technical"),
        "Machine Learning": ("machine learning", "technical"),
        "Leadership": ("leadership", "soft"),
        "Communication": ("communication", "soft"),
        "Problem Solving": ("problem solving", "soft"),
        "Project Management": ("project management", "domain"),
    }
    
    for skill_name, (keyword, category) in skill_keywords.items():
        if keyword in text_lower:
            skills.append({
                "skill": skill_name,
                "proficiency": "intermediate",
                "category": category
            })
    
    # Detect sections
    sections = []
    section_keywords = {
        "Contact Information": ["email", "phone", "address"],
        "Professional Summary": ["summary", "objective", "profile"],
        "Work Experience": ["experience", "employment", "work history"],
        "Education": ["education", "degree", "university"],
        "Skills": ["skills", "technologies", "competencies"],
        "Certifications": ["certification", "certified", "license"],
    }
    
    for section_name, keywords in section_keywords.items():
        found = any(kw in text_lower for kw in keywords)
        sections.append({
            "name": section_name,
            "score": 85 if found else 40,
            "feedback": f"{'Well documented' if found else 'Consider adding this section'}"
        })
    
    # Generate summary
    word_count = len(text.split())
    summary = f"This {analysis_type} contains approximately {word_count} words. "
    if skills:
        summary += f"Key skills identified include {', '.join([s['skill'] for s in skills[:3]])}. "
    
    # Generate strengths and improvements
    strengths = []
    improvements = []
    
    if any(kw in text_lower for kw in ["experience", "years"]):
        strengths.append("Relevant work experience documented")
    if skills:
        strengths.append(f"Clear technical skills: {', '.join([s['skill'] for s in skills[:3]])}")
    if any(kw in text_lower for kw in ["led", "managed", "achieved"]):
        strengths.append("Strong action verbs and achievements")
    
    if not any(kw in text_lower for kw in ["achieved", "increased", "reduced", "improved"]):
        improvements.append("Add quantifiable achievements and metrics")
    if word_count < 300:
        improvements.append("Consider adding more detail to experience sections")
    if not any(kw in text_lower for kw in ["certification", "certified"]):
        improvements.append("Include relevant certifications if available")
    
    return {
        "summary": summary,
        "strengths": strengths or ["Document structure is clear", "Information is well-organized"],
        "improvements": improvements or ["Consider adding more specific achievements"],
        "skills": skills[:10],
        "sections": sections,
        "recommendation": "Review the suggested improvements to strengthen your resume."
    }

def _normalize_ai_analysis(ai_analysis: Any) -> Dict[str, Any]:
    if not isinstance(ai_analysis, dict):
        ai_analysis = {}

    skills = ai_analysis.get("skills", [])
    if not isinstance(skills, list):
        skills = []

    sections = ai_analysis.get("sections", [])
    if not isinstance(sections, list):
        sections = []

    strengths = ai_analysis.get("strengths", [])
    if not isinstance(strengths, list):
        strengths = []

    improvements = ai_analysis.get("improvements", [])
    if not isinstance(improvements, list):
        improvements = []

    recommendations = ai_analysis.get("recommendations")
    if isinstance(recommendations, str):
        recommendations = [recommendations]
    elif not isinstance(recommendations, list):
        fallback_rec = ai_analysis.get("recommendation", "Review the suggested improvements to strengthen your resume.")
        recommendations = [fallback_rec]

    recommendations = [str(item).strip() for item in recommendations if str(item).strip()]
    if not recommendations:
        recommendations = ["Review the suggested improvements to strengthen your resume."]

    try:
        structure_score = int(ai_analysis.get("structure_score", 0) or 0)
    except (TypeError, ValueError):
        structure_score = 0

    return {
        "summary": ai_analysis.get("summary", "Analysis complete."),
        "strengths": strengths,
        "improvements": improvements,
        "skills": skills,
        "sections": sections,
        "recommendations": recommendations,
        "structure_score": structure_score,
    }

def _normalize_saved_analysis(analysis: Dict[str, Any]) -> Dict[str, Any]:
    analysis.setdefault("structure_score", 0)
    if "recommendations" not in analysis:
        fallback_rec = analysis.get("recommendation", "Review the suggested improvements to strengthen your resume.")
        analysis["recommendations"] = [fallback_rec]
    if not isinstance(analysis.get("recommendations"), list):
        analysis["recommendations"] = [str(analysis.get("recommendations"))]
    return analysis

def _safe_skill_models(skills_data: Any) -> List[SkillAnalysis]:
    if not isinstance(skills_data, list):
        return []
    safe_skills: List[SkillAnalysis] = []
    for item in skills_data:
        if not isinstance(item, dict):
            continue
        try:
            safe_skills.append(SkillAnalysis(**item))
        except Exception:
            continue
    return safe_skills

def _safe_section_models(sections_data: Any) -> List[SectionScore]:
    if not isinstance(sections_data, list):
        return []
    safe_sections: List[SectionScore] = []
    for item in sections_data:
        if not isinstance(item, dict):
            continue
        try:
            safe_sections.append(SectionScore(**item))
        except Exception:
            continue
    return safe_sections

async def explain_document_with_ollama(text: str, question: Optional[str] = None) -> dict:
    """Explain a document using Ollama or fall back to basic explanation"""
    
    ollama_urls = [
        "http://localhost:11434",
        "http://host.docker.internal:11434"
    ]
    
    question_part = f"\nUser's specific question: {question}" if question else ""
    prompt = f"""Analyze and explain this document in simple terms.{question_part}

DOCUMENT:
{text[:4000]}

Respond with ONLY valid JSON in this exact format:
{{
    "explanation": "Clear explanation of the document",
    "key_points": ["point 1", "point 2", "point 3"],
    "document_type": "resume/invoice/contract/report/document"
}}"""

    for ollama_url in ollama_urls:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": "mistral",
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.3}
                    }
                )
                if response.status_code == 200:
                    result = response.json()
                    return extract_json_from_response(result.get("response", "{}"))
        except Exception as e:
            logger.warning(f"Ollama at {ollama_url} unavailable: {e}")
            continue
    
    # Fall back to basic explanation
    return generate_basic_explanation(text, question)

def generate_basic_explanation(text: str, question: Optional[str] = None) -> dict:
    """Generate basic document explanation without AI"""
    text_lower = text.lower()
    word_count = len(text.split())
    
    # Detect document type
    doc_type = "document"
    if any(kw in text_lower for kw in ["resume", "cv", "experience", "education", "skills"]):
        doc_type = "resume"
    elif any(kw in text_lower for kw in ["invoice", "total", "payment", "due"]):
        doc_type = "invoice"
    elif any(kw in text_lower for kw in ["contract", "agreement", "parties", "terms"]):
        doc_type = "contract"
    elif any(kw in text_lower for kw in ["report", "findings", "analysis", "conclusion"]):
        doc_type = "report"
    
    # Generate explanation
    explanation = f"This appears to be a {doc_type} containing approximately {word_count} words. "
    
    if doc_type == "resume":
        explanation += "It contains professional information about a candidate including their work history, skills, and qualifications. "
        explanation += "The document is structured to highlight the candidate's experience and suitability for employment."
    elif doc_type == "invoice":
        explanation += "It contains billing information including items, quantities, and payment details. "
        explanation += "Review the line items and total amount carefully before processing."
    elif doc_type == "contract":
        explanation += "It outlines terms and conditions between parties. "
        explanation += "Pay attention to obligations, deadlines, and any clauses that may affect your interests."
    else:
        explanation += "Review the content carefully to understand its purpose and key information."
    
    # Extract key points
    sentences = text.split('.')
    key_points = []
    for sentence in sentences[:10]:
        sentence = sentence.strip()
        if 20 < len(sentence) < 200:
            key_points.append(sentence[:150] + "..." if len(sentence) > 150 else sentence)
        if len(key_points) >= 5:
            break
    
    if not key_points:
        key_points = [
            f"Document type: {doc_type}",
            f"Approximate word count: {word_count}",
            "Review the full text for detailed information"
        ]
    
    return {
        "explanation": explanation,
        "key_points": key_points,
        "document_type": doc_type
    }


# ============ OCR Helper ============
def extract_text_from_file(file: UploadFile) -> str:
    """Extract text from image or PDF using OCR, with preprocessing and French language support"""
    try:
        content = file.file.read()
        lang = 'fra'  # Langue préférée
        file_name = (file.filename or "").lower()
        content_type = (file.content_type or "").lower()
        is_pdf = content_type in {"application/pdf", "application/x-pdf", "binary/octet-stream", "application/octet-stream"} or file_name.endswith(".pdf")

        print(f"[DEBUG] Uploaded file name={file.filename}, content_type={file.content_type}, is_pdf={is_pdf}")

        resolved_tesseract_cmd = _resolve_tesseract_cmd()
        if resolved_tesseract_cmd:
            pytesseract.pytesseract.tesseract_cmd = resolved_tesseract_cmd
            print(f"[DEBUG] Using tesseract_cmd: {resolved_tesseract_cmd}")

            try:
                available_langs = pytesseract.get_languages(config="")
            except Exception:
                available_langs = []

            if "fra" in available_langs:
                lang = "fra"
            elif "eng" in available_langs:
                lang = "eng"
            elif "osd" in available_langs:
                lang = "osd"

            print(f"[DEBUG] OCR language selected: {lang}; available={available_langs}")
        else:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Tesseract executable not found. Install Tesseract OCR and set TESSERACT_CMD in backend/.env "
                    "(example: C:\\Program Files\\Tesseract-OCR\\tesseract.exe)."
                ),
            )

        if is_pdf:
            poppler_bin_path = _resolve_poppler_path()
            print(f"[DEBUG] Using poppler_path for pdf2image: {poppler_bin_path}")
            try:
                convert_kwargs = {"dpi": 300}
                if poppler_bin_path:
                    convert_kwargs["poppler_path"] = poppler_bin_path
                images = convert_from_bytes(content, **convert_kwargs)
                print(f"[DEBUG] PDF converted to {len(images)} image(s) using poppler.")
            except Exception as e:
                print(f"[ERROR] PDF conversion failed: {e}")
                raise

            ocr_chunks = []
            for index, img in enumerate(images, start=1):
                page_text = ocr_preprocess_and_extract(img, lang)
                if page_text and page_text.strip():
                    ocr_chunks.append(page_text)
                else:
                    logger.warning(f"OCR returned empty text for PDF page {index}")

            text = "\n".join(ocr_chunks)
        elif content_type.startswith("image/"):
            img = Image.open(io.BytesIO(content))
            text = ocr_preprocess_and_extract(img, lang)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type. Please upload a PDF or image.")

        print(f"[DEBUG] OCR extracted {len(text.strip()) if text else 0} character(s)")
        return text
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"OCR extraction failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {e}")

# Prétraitement et OCR sur image
def ocr_preprocess_and_extract(img: Image.Image, lang: str = 'fra') -> str:
    from PIL import ImageOps, ImageFilter
    # Convertir en niveaux de gris
    img = img.convert('L')
    # Améliorer le contraste
    img = ImageOps.autocontrast(img)
    # Appliquer un léger flou pour réduire le bruit
    img = img.filter(ImageFilter.MedianFilter(size=3))
    # Binarisation
    img = img.point(lambda x: 0 if x < 140 else 255, '1')
    # OCR avec tesseract français
    try:
        text = pytesseract.image_to_string(img, lang=lang)
    except Exception as primary_error:
        logger.warning(f"OCR with language '{lang}' failed, retrying default OCR: {primary_error}")
        try:
            text = pytesseract.image_to_string(img)
        except Exception as fallback_error:
            logger.error(f"OCR failed on image after fallback: {fallback_error}")
            return ""
    return text

# ============ API Routes ============
# Analyse d'un fichier PDF ou image avec OCR
@api_router.post("/analyze/file", response_model=ResumeAnalysisResult)
async def analyze_resume_file(file: UploadFile = File(...), analysis_type: str = Form("resume")):
    """Analyse un fichier PDF ou image en extrayant le texte via OCR"""
    text = ""
    try:
        text = extract_text_from_file(file)
        if len(text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Texte extrait trop court pour analyse (minimum 20 caractères)")
        basic_scores = calculate_basic_scores(text)
        try:
            ai_analysis = _normalize_ai_analysis(await analyze_with_ollama(text, analysis_type))
        except Exception as analysis_error:
            logger.warning(f"AI analysis failed, fallback to basic analysis: {analysis_error}")
            ai_analysis = _normalize_ai_analysis(generate_basic_analysis(text, analysis_type))

        skills_models = _safe_skill_models(ai_analysis["skills"])
        sections_models = _safe_section_models(ai_analysis["sections"])

        if not sections_models:
            sections_models = _safe_section_models(generate_basic_analysis(text, analysis_type).get("sections", []))

        result = ResumeAnalysisResult(
            overall_score=basic_scores["overall_score"],
            structure_score=ai_analysis["structure_score"],
            ats_score=basic_scores["ats_score"],
            format_score=basic_scores["format_score"],
            content_score=basic_scores["content_score"],
            skills_score=basic_scores["skills_score"],
            candidate_name=basic_scores["candidate_name"],
            email=basic_scores["email"],
            phone=basic_scores["phone"],
            summary=ai_analysis["summary"],
            strengths=ai_analysis["strengths"],
            improvements=ai_analysis["improvements"],
            recommendations=ai_analysis["recommendations"],
            skills=skills_models,
            sections=sections_models,
            keywords_found=basic_scores["keywords_found"],
            keywords_missing=basic_scores["keywords_missing"],
            raw_text=text[:5000],
            document_type=analysis_type
        )
        doc = result.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        try:
            await db.analyses.insert_one(doc)
            _invalidate_analyses_cache()
        except Exception as db_error:
            logger.warning(f"Failed to save analysis in MongoDB (continuing response): {db_error}")
        return result
    except HTTPException as http_err:
        logger.warning(f"HTTP error analyzing file: {http_err.detail}")
        raise
    except Exception as e:
        logger.exception(f"Error analyzing file: {e}")
        if text.strip():
            basic_scores = calculate_basic_scores(text)
            fallback_ai = _normalize_ai_analysis(generate_basic_analysis(text, analysis_type))
            fallback_result = ResumeAnalysisResult(
                overall_score=basic_scores["overall_score"],
                structure_score=fallback_ai["structure_score"],
                ats_score=basic_scores["ats_score"],
                format_score=basic_scores["format_score"],
                content_score=basic_scores["content_score"],
                skills_score=basic_scores["skills_score"],
                candidate_name=basic_scores["candidate_name"],
                email=basic_scores["email"],
                phone=basic_scores["phone"],
                summary=fallback_ai["summary"],
                strengths=fallback_ai["strengths"],
                improvements=fallback_ai["improvements"],
                recommendations=fallback_ai["recommendations"],
                skills=_safe_skill_models(fallback_ai["skills"]),
                sections=_safe_section_models(fallback_ai["sections"]),
                keywords_found=basic_scores["keywords_found"],
                keywords_missing=basic_scores["keywords_missing"],
                raw_text=text[:5000],
                document_type=analysis_type,
            )
            logger.warning("Returning fallback analysis result after internal error.")
            return fallback_result
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/")
async def root():
    return {"message": "OCR Resume Scanner API", "status": "online"}

@api_router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "OCR Resume Scanner"
    }

@api_router.post("/analyze/text", response_model=ResumeAnalysisResult)
async def analyze_resume_text(request: DocumentAnalysisRequest):
    """Analyze resume text and return detailed scoring"""
    text = request.text
    try:
        if len(request.text.strip()) < 50:
            raise HTTPException(status_code=400, detail="Text too short for analysis (minimum 50 characters)")
        
        # Calculate basic scores
        basic_scores = calculate_basic_scores(request.text)
        
        # Get AI analysis (or fall back to basic)
        try:
            ai_analysis = _normalize_ai_analysis(await analyze_with_ollama(request.text, request.analysis_type))
        except Exception as analysis_error:
            logger.warning(f"AI analysis failed, fallback to basic analysis: {analysis_error}")
            ai_analysis = _normalize_ai_analysis(generate_basic_analysis(request.text, request.analysis_type))

        skills_models = _safe_skill_models(ai_analysis["skills"])
        sections_models = _safe_section_models(ai_analysis["sections"])

        if not sections_models:
            sections_models = _safe_section_models(generate_basic_analysis(request.text, request.analysis_type).get("sections", []))
        
        # Combine results
        result = ResumeAnalysisResult(
            overall_score=basic_scores["overall_score"],
            structure_score=ai_analysis["structure_score"],
            ats_score=basic_scores["ats_score"],
            format_score=basic_scores["format_score"],
            content_score=basic_scores["content_score"],
            skills_score=basic_scores["skills_score"],
            candidate_name=basic_scores["candidate_name"],
            email=basic_scores["email"],
            phone=basic_scores["phone"],
            summary=ai_analysis["summary"],
            strengths=ai_analysis["strengths"],
            improvements=ai_analysis["improvements"],
            recommendations=ai_analysis["recommendations"],
            skills=skills_models,
            sections=sections_models,
            keywords_found=basic_scores["keywords_found"],
            keywords_missing=basic_scores["keywords_missing"],
            raw_text=request.text[:5000],
            document_type=request.analysis_type
        )
        
        # Store in database
        doc = result.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        try:
            await db.analyses.insert_one(doc)
            _invalidate_analyses_cache()
        except Exception as db_error:
            logger.warning(f"Failed to save analysis in MongoDB (continuing response): {db_error}")
        
        return result
        
    except HTTPException as http_err:
        logger.warning(f"HTTP error analyzing text: {http_err.detail}")
        raise
    except Exception as e:
        logger.exception(f"Error analyzing text: {e}")
        if text.strip():
            basic_scores = calculate_basic_scores(text)
            fallback_ai = _normalize_ai_analysis(generate_basic_analysis(text, request.analysis_type))
            fallback_result = ResumeAnalysisResult(
                overall_score=basic_scores["overall_score"],
                structure_score=fallback_ai["structure_score"],
                ats_score=basic_scores["ats_score"],
                format_score=basic_scores["format_score"],
                content_score=basic_scores["content_score"],
                skills_score=basic_scores["skills_score"],
                candidate_name=basic_scores["candidate_name"],
                email=basic_scores["email"],
                phone=basic_scores["phone"],
                summary=fallback_ai["summary"],
                strengths=fallback_ai["strengths"],
                improvements=fallback_ai["improvements"],
                recommendations=fallback_ai["recommendations"],
                skills=_safe_skill_models(fallback_ai["skills"]),
                sections=_safe_section_models(fallback_ai["sections"]),
                keywords_found=basic_scores["keywords_found"],
                keywords_missing=basic_scores["keywords_missing"],
                raw_text=text[:5000],
                document_type=request.analysis_type,
            )
            logger.warning("Returning fallback text analysis result after internal error.")
            return fallback_result
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/explain", response_model=DocumentExplanationResponse)
async def explain_document(request: DocumentExplanationRequest):
    """Explain a document in simple terms"""
    try:
        if len(request.text.strip()) < 20:
            raise HTTPException(status_code=400, detail="Text too short for explanation")
        
        result = await explain_document_with_ollama(request.text, request.question)
        
        return DocumentExplanationResponse(
            explanation=result.get("explanation", "Unable to generate explanation."),
            key_points=result.get("key_points", []),
            document_type=result.get("document_type", "document")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error explaining document: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analyses", response_model=List[ResumeAnalysisResult])
async def get_analyses():
    """Get recent analyses"""
    try:
        global _analyses_cache_payload, _analyses_cache_expires_at
        now = time.monotonic()
        if now < _analyses_cache_expires_at and _analyses_cache_payload:
            return _analyses_cache_payload

        async with _analyses_cache_lock:
            now = time.monotonic()
            if now < _analyses_cache_expires_at and _analyses_cache_payload:
                return _analyses_cache_payload

            analyses = await db.analyses.find({}, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
        
            for analysis in analyses:
                _normalize_saved_analysis(analysis)
                if isinstance(analysis.get('created_at'), str):
                    analysis['created_at'] = datetime.fromisoformat(analysis['created_at'])

            _analyses_cache_payload = analyses
            _analyses_cache_expires_at = time.monotonic() + ANALYSES_CACHE_TTL_SECONDS
            return analyses
    except Exception as e:
        logger.error(f"Error fetching analyses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/analyses/{analysis_id}", response_model=ResumeAnalysisResult)
async def get_analysis(analysis_id: str):
    """Get a specific analysis by ID"""
    try:
        analysis = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")
        _normalize_saved_analysis(analysis)
        
        if isinstance(analysis.get('created_at'), str):
            analysis['created_at'] = datetime.fromisoformat(analysis['created_at'])
        
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str):
    """Delete an analysis"""
    try:
        result = await db.analyses.delete_one({"id": analysis_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Analysis not found")
        _invalidate_analyses_cache()
        return {"message": "Analysis deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

cors_origins = _parse_cors_origins()
allow_all_origins = cors_origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=not allow_all_origins,
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app = FastAPI(title="OCR Resume Scanner API", lifespan=lifespan)
