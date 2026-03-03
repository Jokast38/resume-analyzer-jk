import { useCallback, useRef, useState, useEffect } from "react";
import Webcam from "react-webcam";
import { createWorker } from "tesseract.js";
import { Camera, CameraOff, RefreshCw, Loader2, Copy, Check } from "lucide-react";
import { Button } from "../components/ui/button";
import { getTranslator } from "../lib/i18n";

export const CameraScanner = ({ onTextExtracted, onAnalyze, language = "en" }) => {
  const webcamRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const workerRef = useRef(null);
  const t = getTranslator(language);

  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  const initWorker = async () => {
    if (!workerRef.current) {
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      workerRef.current = worker;
    }
    return workerRef.current;
  };

  const capture = useCallback(async () => {
    if (!webcamRef.current) return;

    setIsScanning(true);
    setError("");
    setProgress(0);

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        throw new Error("Failed to capture image");
      }

      const worker = await initWorker();
      const { data: { text } } = await worker.recognize(imageSrc);

      if (text.trim()) {
        setExtractedText(text);
        onTextExtracted?.(text);
      } else {
        setError(t("cameraNoText"));
      }
    } catch (err) {
      setError(t("cameraOcrFailed"));
      console.error("OCR Error:", err);
    } finally {
      setIsScanning(false);
      setProgress(0);
    }
  }, [onTextExtracted]);

  const toggleCamera = () => {
    setIsCameraOn(!isCameraOn);
    setExtractedText("");
    setError("");
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(extractedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAnalyze = () => {
    if (extractedText && onAnalyze) {
      onAnalyze(extractedText);
    }
  };

  const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: facingMode,
  };

  return (
    <div className="space-y-6" data-testid="camera-scanner">
      {/* Camera Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold text-foreground">
          {t("liveCameraScanner")}
        </h3>
        <div className="flex items-center gap-2">
          {isCameraOn && (
            <Button
              variant="outline"
              size="sm"
              onClick={switchCamera}
              className="border-cyber-purple/30 hover:border-cyber-purple hover:bg-cyber-purple/10"
              data-testid="switch-camera-btn"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("flip")}
            </Button>
          )}
          <Button
            onClick={toggleCamera}
            className={`${
              isCameraOn
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-cyber-purple hover:bg-cyber-purple/90"
            } shadow-glow-purple`}
            data-testid="toggle-camera-btn"
          >
            {isCameraOn ? (
              <>
                <CameraOff className="w-4 h-4 mr-2" />
                {t("stopCamera")}
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 mr-2" />
                {t("startCamera")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Camera View */}
      {isCameraOn && (
        <div className="relative">
          <div className="camera-container glass-card border border-cyber-purple/30 viewfinder">
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={videoConstraints}
              className="w-full h-full object-cover rounded-lg"
              data-testid="webcam-view"
            />
            
            {/* Scanner beam animation */}
            {isScanning && (
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <div className="scanner-line scanner-beam" />
              </div>
            )}

            {/* Progress overlay */}
            {isScanning && (
              <div className="absolute inset-0 bg-void/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-lg">
                <Loader2 className="w-12 h-12 text-cyber-purple animate-spin mb-4" />
                <p className="text-lg font-heading text-foreground">
                  {t("deciphering")} {progress}%
                </p>
                <div className="w-48 h-2 bg-muted rounded-full mt-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyber-purple to-neon-cyan transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Capture Button */}
          <div className="flex justify-center mt-4">
            <Button
              onClick={capture}
              disabled={isScanning}
              className="bg-cyber-purple hover:bg-cyber-purple/90 shadow-glow-purple px-8 py-6 text-lg btn-glow"
              data-testid="capture-btn"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t("scanning")}
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 mr-2" />
                  {t("captureAndScan")}
                </>
              )}
            </Button>
          </div>
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
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copyText}
                className="border-cyber-purple/30 hover:border-cyber-purple"
                data-testid="copy-text-btn"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2 text-success-green" />
                    {t("copied")}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    {t("copy")}
                  </>
                )}
              </Button>
              <Button
                onClick={handleAnalyze}
                className="bg-cyber-purple hover:bg-cyber-purple/90"
                data-testid="analyze-camera-text-btn"
              >
                {t("analyze")}
              </Button>
            </div>
          </div>
          <div className="bg-void/50 rounded-lg p-4 max-h-60 overflow-y-auto">
            <pre className="ocr-text text-muted-foreground whitespace-pre-wrap">
              {extractedText}
            </pre>
          </div>
        </div>
      )}

      {/* Instructions when camera is off */}
      {!isCameraOn && (
        <div className="glass-card rounded-xl p-8 border border-cyber-purple/20 text-center">
          <Camera className="w-16 h-16 mx-auto mb-4 text-cyber-purple/50" />
          <p className="text-muted-foreground mb-2">
            {t("cameraGuide1")}
          </p>
          <p className="text-sm text-muted-foreground/70">
            {t("cameraGuide2")}
          </p>
        </div>
      )}
    </div>
  );
};

export default CameraScanner;
