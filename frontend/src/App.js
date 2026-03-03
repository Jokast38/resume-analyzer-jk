import { useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  ScanLine, 
  FileText, 
  Camera, 
  Upload, 
  Loader2,
  History,
  BookOpen,
  ChevronLeft,
  Menu,
  X
} from "lucide-react";
import { Button } from "./components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Sheet, SheetContent, SheetTrigger } from "./components/ui/sheet";
import { CameraScanner } from "./components/CameraScanner";
import { FileUploader } from "./components/FileUploader";
import { AnalysisResults } from "./components/AnalysisResults";
import { DocumentExplainer } from "./components/DocumentExplainer";
import { HistoryPanel } from "./components/HistoryPanel";
import { getTranslator } from "./lib/i18n";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Header Component
const Header = ({ onMenuClick, showBackButton, onBack, language, onLanguageToggle, t }) => {
  return (
    <header className="sticky top-0 z-50 bg-void/80 backdrop-blur-lg border-b border-cyber-purple/20">
      <div className="container-responsive py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBackButton ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            ) : null}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-cyber-purple/20 flex items-center justify-center">
                <ScanLine className="w-6 h-6 text-cyber-purple" />
              </div>
              <div>
                <h1 className="font-heading font-bold text-lg text-foreground tracking-tight">
                  ResumeScanner
                </h1>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {t("appTagline")}
                </p>
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onLanguageToggle}
              className="border-cyber-purple/30 hover:border-cyber-purple"
            >
              {language === "fr" ? "FR" : "EN"}
            </Button>
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-void border-cyber-purple/30">
              <nav className="flex flex-col gap-4 mt-8">
                <a href="/" className="flex items-center gap-2 text-foreground hover:text-cyber-purple transition-colors">
                  <Upload className="w-5 h-5" />
                  {t("scanner")}
                </a>
                <a href="/#history" className="flex items-center gap-2 text-foreground hover:text-cyber-purple transition-colors">
                  <History className="w-5 h-5" />
                  {t("history")}
                </a>
                <Button
                  variant="outline"
                  onClick={onLanguageToggle}
                  className="border-cyber-purple/30 hover:border-cyber-purple"
                >
                  {language === "fr" ? "Passer en anglais" : "Switch to French"}
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

// Main Scanner Page
const ScannerPage = () => {
  const [language, setLanguage] = useState(() => localStorage.getItem("app_language") || "en");
  const [activeTab, setActiveTab] = useState("upload");
  const [extractedText, setExtractedText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const navigate = useNavigate();
  const t = getTranslator(language);

  const toggleLanguage = () => {
    const next = language === "en" ? "fr" : "en";
    setLanguage(next);
    localStorage.setItem("app_language", next);
  };

  const handleTextExtracted = useCallback((text) => {
    setExtractedText(text);
  }, []);

  const handleAnalyze = async (text) => {
    if (!text || text.trim().length < 50) {
      toast.error(t("toastTextTooShort"));
      return;
    }

    setIsAnalyzing(true);
    
    try {
      const response = await axios.post(`${API}/analyze/text`, {
        text: text,
        analysis_type: "resume"
      });

      setAnalysis(response.data);
      setShowResults(true);
      toast.success(t("toastAnalysisComplete"));
    } catch (err) {
      console.error("Analysis error:", err);
      toast.error(err.response?.data?.detail || t("toastAnalysisFailed"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleHistorySelect = (selectedAnalysis) => {
    setAnalysis(selectedAnalysis);
    setShowResults(true);
  };

  const handleBack = () => {
    setShowResults(false);
  };

  // Show results view
  if (showResults && analysis) {
    return (
      <div className="min-h-screen bg-void noise-overlay">
        <Header showBackButton onBack={handleBack} language={language} onLanguageToggle={toggleLanguage} t={t} />
        
        <main className="container-responsive py-8">
          <div className="max-w-4xl mx-auto">
            <AnalysisResults analysis={analysis} />
            
            {/* Document Explainer */}
            <div className="mt-8">
              <DocumentExplainer text={analysis.raw_text} language={language} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void noise-overlay">
      <Header language={language} onLanguageToggle={toggleLanguage} t={t} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-radial from-cyber-purple/10 via-transparent to-transparent" />
        
        <div className="container-responsive py-12 md:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground mb-4 tracking-tight">
              {t("heroTitlePrefix")} {" "}
              <span className="text-cyber-purple">{t("heroTitleHighlight")}</span>
            </h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("heroSubtitle")}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="container-responsive pb-16">
        <div className="max-w-4xl mx-auto">
          {/* Scanner Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
            <TabsList className="w-full grid grid-cols-2 bg-void/50 border border-cyber-purple/30 rounded-xl p-1">
              <TabsTrigger 
                value="upload" 
                className="data-[state=active]:bg-cyber-purple data-[state=active]:text-white rounded-lg font-medium"
                data-testid="upload-tab"
              >
                <Upload className="w-4 h-4 mr-2" />
                {t("uploadTab")}
              </TabsTrigger>
              <TabsTrigger 
                value="camera" 
                className="data-[state=active]:bg-cyber-purple data-[state=active]:text-white rounded-lg font-medium"
                data-testid="camera-tab"
              >
                <Camera className="w-4 h-4 mr-2" />
                {t("cameraTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-6">
              <FileUploader 
                onTextExtracted={handleTextExtracted} 
                onAnalyze={handleAnalyze}
                language={language}
              />
            </TabsContent>

            <TabsContent value="camera" className="mt-6">
              <CameraScanner 
                onTextExtracted={handleTextExtracted}
                onAnalyze={handleAnalyze}
                language={language}
              />
            </TabsContent>
          </Tabs>

          {/* Loading State */}
          {isAnalyzing && (
            <div className="glass-card rounded-xl p-12 border border-cyber-purple/30 text-center fade-in-up">
              <div className="relative inline-block">
                <Loader2 className="w-16 h-16 text-cyber-purple animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <ScanLine className="w-8 h-8 text-neon-cyan" />
                </div>
              </div>
              <p className="text-xl font-heading text-foreground mt-6 mb-2">
                {t("analyzingTitle")}
              </p>
              <p className="text-muted-foreground">
                {t("analyzingSubtitle")}
              </p>
            </div>
          )}

          {/* History Section */}
          <div className="mt-12">
            <HistoryPanel onSelectAnalysis={handleHistorySelect} language={language} />
          </div>

          {/* Features Section */}
          <section className="mt-16">
            <h3 className="text-2xl font-heading font-bold text-foreground text-center mb-8">
              {t("howItWorks")}
            </h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="glass-card rounded-xl p-6 border border-cyber-purple/30 hover-card text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-cyber-purple/20 flex items-center justify-center mb-4">
                  <Upload className="w-7 h-7 text-cyber-purple" />
                </div>
                <h4 className="font-heading font-semibold text-foreground mb-2">
                  {t("step1Title")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("step1Desc")}
                </p>
              </div>

              <div className="glass-card rounded-xl p-6 border border-cyber-purple/30 hover-card text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-neon-cyan/20 flex items-center justify-center mb-4">
                  <ScanLine className="w-7 h-7 text-neon-cyan" />
                </div>
                <h4 className="font-heading font-semibold text-foreground mb-2">
                  {t("step2Title")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("step2Desc")}
                </p>
              </div>

              <div className="glass-card rounded-xl p-6 border border-cyber-purple/30 hover-card text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-success-green/20 flex items-center justify-center mb-4">
                  <FileText className="w-7 h-7 text-success-green" />
                </div>
                <h4 className="font-heading font-semibold text-foreground mb-2">
                  {t("step3Title")}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {t("step3Desc")}
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-cyber-purple/20 py-8">
        <div className="container-responsive text-center">
          <p className="text-sm text-muted-foreground">
            {t("footerText")} <a href="https://jokast38.fr" target="_blank" rel="noopener noreferrer">Jokast Kassa</a> &copy; {new Date().getFullYear()}.
          </p>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#0a0a0c',
            border: '1px solid rgba(124, 58, 237, 0.3)',
            color: '#F8FAFC',
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ScannerPage />} />
          <Route path="*" element={<ScannerPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
