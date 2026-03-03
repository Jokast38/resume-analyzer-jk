import { useState, useEffect, useCallback, useMemo } from "react";
import { History, Trash2, Eye, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import axios from "axios";
import { getTranslator } from "../lib/i18n";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const HistoryPanel = ({ onSelectAnalysis, language = "en" }) => {
  const [analyses, setAnalyses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const t = useMemo(() => getTranslator(language), [language]);

  const fetchAnalyses = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/analyses`);
      setAnalyses(response.data);
    } catch (err) {
      console.error("Failed to fetch analyses:", err);
      setError(t("historyLoadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const deleteAnalysis = async (id, e) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/analyses/${id}`);
      setAnalyses(analyses.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "text-success-green";
    if (score >= 60) return "text-yellow-400";
    return "text-destructive";
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 border border-cyber-purple/30">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-cyber-purple animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-xl p-6 border border-cyber-purple/30" data-testid="history-panel">
      <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-cyber-purple" />
        {t("recentAnalyses")}
      </h3>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-4">
          {error}
        </div>
      )}

      {analyses.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">
          {t("historyEmpty")}
        </p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {analyses.map((analysis) => (
            <div
              key={analysis.id}
              onClick={() => onSelectAnalysis?.(analysis)}
              className="group flex items-center gap-4 p-4 rounded-lg bg-void/50 border border-transparent hover:border-cyber-purple/30 cursor-pointer transition-all"
              data-testid={`history-item-${analysis.id}`}
            >
              {/* Score Badge */}
              <div className={`w-12 h-12 rounded-lg bg-cyber-purple/20 flex items-center justify-center font-heading font-bold ${getScoreColor(analysis.overall_score)}`}>
                {analysis.overall_score}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {analysis.candidate_name || t("unknown")}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(analysis.created_at)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => deleteAnalysis(analysis.id, e)}
                  data-testid={`delete-analysis-${analysis.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <ChevronRight className="w-5 h-5 text-cyber-purple" />
              </div>
            </div>
          ))}
        </div>
      )}

      {analyses.length > 0 && (
        <Button
          variant="outline"
          onClick={fetchAnalyses}
          className="w-full mt-4 border-cyber-purple/30 hover:border-cyber-purple"
          data-testid="refresh-history-btn"
        >
          {t("refreshHistory")}
        </Button>
      )}
    </div>
  );
};

export default HistoryPanel;
