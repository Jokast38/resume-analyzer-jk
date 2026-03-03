import { useCallback, useState } from "react";
import { createWorker } from "tesseract.js";
import { Upload, FileText, Image, X, Loader2 } from "lucide-react";
import axios from "axios";
import { Button } from "../components/ui/button";
import { getTranslator } from "../lib/i18n";

export const FileUploader = ({ onTextExtracted, onAnalyze, language = "en" }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
  const t = getTranslator(language);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const fileToBase64 = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const processFile = useCallback(async (selectedFile) => {
    setFile(selectedFile);
    setError("");
    setExtractedText("");

    // Create preview for images
    if (selectedFile.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }

    // Process the file
    setIsProcessing(true);
    setProgress(0);

    try {
      let text = "";

      if (selectedFile.type.startsWith("image/")) {
        // Use Tesseract for image OCR
        const worker = await createWorker("eng", 1, {
          logger: (m) => {
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });

        const imageData = await fileToBase64(selectedFile);
        const { data: { text: ocrText } } = await worker.recognize(imageData);
        await worker.terminate();
        text = ocrText;
      } else if (selectedFile.type === "application/pdf") {
        setProgress(20);
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("analysis_type", "resume");

        const response = await axios.post(`${API}/analyze/file`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        setProgress(100);
        text = response?.data?.raw_text || "";
        if (!text.trim()) {
          console.warn("PDF analyzed but raw_text is empty", response?.data);
          text = response?.data?.summary || "";
        }
        if (!text.trim()) {
          throw new Error("No text extracted from PDF");
        }
      } else if (selectedFile.type === "text/plain") {
        // Plain text file
        text = await selectedFile.text();
      } else {
        throw new Error(t("unsupportedFileType"));
      }

      if (text.trim()) {
        setExtractedText(text);
        onTextExtracted?.(text);
      } else {
        setError(t("noTextDetected"));
      }
    } catch (err) {
      console.error("File processing error:", err);
      const backendDetail = err?.response?.data?.detail;
      const backendMessage = Array.isArray(backendDetail)
        ? backendDetail.map((d) => d?.msg || JSON.stringify(d)).join(" | ")
        : (typeof backendDetail === "string" ? backendDetail : JSON.stringify(backendDetail || ""));
      const finalMessage = backendMessage || err?.message || t("genericFileError");
      setError(String(finalMessage));
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [API, fileToBase64, onTextExtracted, t]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [processFile]);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setExtractedText("");
    setError("");
  };

  const handleAnalyze = () => {
    if (extractedText && onAnalyze) {
      onAnalyze(extractedText);
    }
  };

  return (
    <div className="space-y-6" data-testid="file-uploader">
      {/* Upload Zone */}
      {!file && (
        <div
          className={`upload-zone p-8 md:p-12 text-center cursor-pointer transition-all ${
            isDragging ? "drag-active border-cyber-purple bg-cyber-purple/10" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input").click()}
          data-testid="upload-zone"
        >
          <input
            type="file"
            id="file-input"
            className="hidden"
            accept="image/*,.pdf,.txt"
            onChange={handleFileSelect}
            data-testid="file-input"
          />
          
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-cyber-purple/20 flex items-center justify-center mb-6">
              <Upload className="w-10 h-10 text-cyber-purple" />
            </div>
            
            <h3 className="text-xl font-heading font-semibold text-foreground mb-2">
              {t("fileDropTitle")}
            </h3>
            <p className="text-muted-foreground mb-4">
              {t("fileDropSubtitle")}
            </p>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <Image className="w-4 h-4" />
                PNG, JPG
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                PDF, TXT
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <div className="glass-card rounded-xl p-8 border border-cyber-purple/30">
          <div className="flex flex-col items-center">
            <Loader2 className="w-16 h-16 text-cyber-purple animate-spin mb-4" />
            <p className="text-lg font-heading text-foreground mb-2">
              {t("extracting")} {progress}%
            </p>
            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyber-purple to-neon-cyan transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* File Preview */}
      {file && !isProcessing && (
        <div className="glass-card rounded-xl p-6 border border-cyber-purple/30 fade-in-up">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {preview ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-cyber-purple/30">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-lg bg-cyber-purple/20 flex items-center justify-center">
                  <FileText className="w-8 h-8 text-cyber-purple" />
                </div>
              )}
              <div>
                <p className="font-medium text-foreground">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFile}
              className="text-muted-foreground hover:text-destructive"
              data-testid="clear-file-btn"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Image Preview */}
          {preview && (
            <div className="mb-4 rounded-lg overflow-hidden border border-cyber-purple/20">
              <img
                src={preview}
                alt="Document preview"
                className="w-full max-h-64 object-contain bg-void/50"
              />
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          {error}
        </div>
      )}

      {/* Extracted Text */}
      {extractedText && (
        <div className="glass-card rounded-xl p-6 border border-cyber-purple/30 fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-heading font-semibold text-foreground">
              {t("extractedText")}
            </h4>
            <Button
              onClick={handleAnalyze}
              className="bg-cyber-purple hover:bg-cyber-purple/90 shadow-glow-purple"
              data-testid="analyze-file-text-btn"
            >
              {t("analyzeResume")}
            </Button>
          </div>
          <div className="bg-void/50 rounded-lg p-4 max-h-60 overflow-y-auto">
            <pre className="ocr-text text-muted-foreground whitespace-pre-wrap">
              {extractedText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
