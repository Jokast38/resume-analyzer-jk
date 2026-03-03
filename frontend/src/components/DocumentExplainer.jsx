import { useState } from "react";
import { MessageSquare, Send, Loader2, Copy, Check, BookOpen } from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import axios from "axios";
import { getTranslator } from "../lib/i18n";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const DocumentExplainer = ({ text, language = "en" }) => {
  const [question, setQuestion] = useState("");
  const [explanation, setExplanation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const t = getTranslator(language);

  const handleExplain = async () => {
    if (!text || text.trim().length < 20) {
      setError(t("explainerNoText"));
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await axios.post(`${API}/explain`, {
        text: text,
        question: question || null,
      });

      setExplanation(response.data);
    } catch (err) {
      console.error("Explanation error:", err);
      setError(err.response?.data?.detail || t("explainerFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  const copyExplanation = async () => {
    if (!explanation) return;
    
    const textToCopy = `${explanation.explanation}\n\n${t("keyPoints")}:\n${explanation.key_points.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6" data-testid="document-explainer">
      <div className="glass-card rounded-xl p-6 border border-cyber-purple/30">
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-cyber-purple" />
          {t("documentExplainer")}
        </h3>

        <p className="text-muted-foreground mb-4">
          {t("explainerSubtitle")}
        </p>

        {/* Question Input */}
        <div className="space-y-4">
          <Textarea
            placeholder={t("explainerPlaceholder")}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="bg-void/50 border-cyber-purple/30 focus:border-cyber-purple min-h-[80px] resize-none"
            data-testid="question-input"
          />

          <Button
            onClick={handleExplain}
            disabled={isLoading || !text}
            className="w-full bg-cyber-purple hover:bg-cyber-purple/90 shadow-glow-purple"
            data-testid="explain-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("analyzingTitle")}
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                {t("explainDocument")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          {error}
        </div>
      )}

      {/* Explanation Result */}
      {explanation && (
        <div className="glass-card rounded-xl p-6 border border-neon-cyan/30 fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-neon-cyan" />
              <h4 className="font-heading font-semibold text-foreground">
                {t("explanation")}
              </h4>
              <span className="px-2 py-0.5 rounded-full text-xs bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30">
                {explanation.document_type}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={copyExplanation}
              className="border-neon-cyan/30 hover:border-neon-cyan"
              data-testid="copy-explanation-btn"
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
          </div>

          <p className="text-muted-foreground leading-relaxed mb-6">
            {explanation.explanation}
          </p>

          {/* Key Points */}
          {explanation.key_points && explanation.key_points.length > 0 && (
            <div>
              <h5 className="font-heading font-medium text-foreground mb-3">
                {t("keyPoints")}
              </h5>
              <ul className="space-y-2">
                {explanation.key_points.map((point, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-3 text-muted-foreground"
                  >
                    <span className="w-6 h-6 rounded-full bg-cyber-purple/20 text-cyber-purple text-sm flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentExplainer;
