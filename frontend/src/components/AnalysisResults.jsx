import { 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  FileText,
  Mail,
  Phone,
  User,
  Target,
  Sparkles,
  BarChart3
} from "lucide-react";
import { Progress } from "../components/ui/progress";

export const AnalysisResults = ({ analysis }) => {
  if (!analysis) return null;

  const getScoreColor = (score) => {
    if (score >= 80) return "text-success-green";
    if (score >= 60) return "text-yellow-400";
    return "text-destructive";
  };

  const getScoreGradient = (score) => {
    if (score >= 80) return "from-success-green to-neon-cyan";
    if (score >= 60) return "from-yellow-400 to-orange-400";
    return "from-destructive to-orange-400";
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  return (
    <div className="space-y-6 fade-in-up" data-testid="analysis-results">
      {/* Header with Overall Score */}
      <div className="glass-card rounded-xl p-6 md:p-8 border border-cyber-purple/30">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Score Circle */}
          <div className="flex-shrink-0 mx-auto md:mx-0">
            <div className="score-circle pulse-glow">
              <div className="text-center">
                <span className={`text-5xl font-heading font-bold ${getScoreColor(analysis.overall_score)}`}>
                  {analysis.overall_score}
                </span>
                <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
              </div>
            </div>
          </div>

          {/* Candidate Info */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
              {analysis.candidate_name || "Resume Analysis"}
            </h2>
            <p className={`text-lg ${getScoreColor(analysis.overall_score)}`}>
              {getScoreLabel(analysis.overall_score)} Match
            </p>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-sm text-muted-foreground">
              {analysis.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-4 h-4 text-cyber-purple" />
                  {analysis.email}
                </span>
              )}
              {analysis.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-4 h-4 text-cyber-purple" />
                  {analysis.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown - Bento Grid */}
      <div className="bento-grid">
        {/* ATS Score */}
        <div className="glass-card rounded-xl p-5 border border-cyber-purple/30 hover-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">ATS Score</span>
            <Target className="w-5 h-5 text-neon-cyan" />
          </div>
          <p className={`text-3xl font-heading font-bold ${getScoreColor(analysis.ats_score)}`}>
            {analysis.ats_score}%
          </p>
          <Progress 
            value={analysis.ats_score} 
            className="mt-3 h-2 bg-muted"
          />
        </div>

        {/* Format Score */}
        <div className="glass-card rounded-xl p-5 border border-cyber-purple/30 hover-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Format</span>
            <FileText className="w-5 h-5 text-cyber-purple" />
          </div>
          <p className={`text-3xl font-heading font-bold ${getScoreColor(analysis.format_score)}`}>
            {analysis.format_score}%
          </p>
          <Progress 
            value={analysis.format_score} 
            className="mt-3 h-2 bg-muted"
          />
        </div>

        {/* Content Score */}
        <div className="glass-card rounded-xl p-5 border border-cyber-purple/30 hover-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Content</span>
            <BarChart3 className="w-5 h-5 text-success-green" />
          </div>
          <p className={`text-3xl font-heading font-bold ${getScoreColor(analysis.content_score)}`}>
            {analysis.content_score}%
          </p>
          <Progress 
            value={analysis.content_score} 
            className="mt-3 h-2 bg-muted"
          />
        </div>

        {/* Skills Score */}
        <div className="glass-card rounded-xl p-5 border border-cyber-purple/30 hover-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Skills</span>
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </div>
          <p className={`text-3xl font-heading font-bold ${getScoreColor(analysis.skills_score)}`}>
            {analysis.skills_score}%
          </p>
          <Progress 
            value={analysis.skills_score} 
            className="mt-3 h-2 bg-muted"
          />
        </div>
      </div>

      {/* Summary */}
      {analysis.summary && (
        <div className="glass-card rounded-xl p-6 border border-cyber-purple/30">
          <h3 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-cyber-purple" />
            Summary
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            {analysis.summary}
          </p>
        </div>
      )}

      {/* Strengths & Improvements */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div className="glass-card rounded-xl p-6 border border-success-green/30 hover-card">
          <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success-green" />
            Strengths
          </h3>
          <ul className="space-y-3">
            {analysis.strengths?.map((strength, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success-green flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Areas for Improvement */}
        <div className="glass-card rounded-xl p-6 border border-yellow-400/30 hover-card">
          <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-yellow-400" />
            Areas to Improve
          </h3>
          <ul className="space-y-3">
            {analysis.improvements?.map((improvement, index) => (
              <li key={index} className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Skills */}
      {analysis.skills && analysis.skills.length > 0 && (
        <div className="glass-card rounded-xl p-6 border border-cyber-purple/30">
          <h3 className="text-lg font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyber-purple" />
            Detected Skills
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.skills.map((skill, index) => (
              <span
                key={index}
                className={`skill-tag ${
                  skill.category === "technical"
                    ? "bg-cyber-purple/20 text-cyber-purple border-cyber-purple/30"
                    : skill.category === "soft"
                    ? "bg-neon-cyan/20 text-neon-cyan border-neon-cyan/30"
                    : "bg-success-green/20 text-success-green border-success-green/30"
                }`}
              >
                {skill.skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Keywords */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Keywords Found */}
        {analysis.keywords_found && analysis.keywords_found.length > 0 && (
          <div className="glass-card rounded-xl p-6 border border-cyber-purple/30">
            <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
              Keywords Found
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.keywords_found.map((keyword, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full text-sm bg-success-green/20 text-success-green border border-success-green/30"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Keywords Missing */}
        {analysis.keywords_missing && analysis.keywords_missing.length > 0 && (
          <div className="glass-card rounded-xl p-6 border border-cyber-purple/30">
            <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
              Consider Adding
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.keywords_missing.map((keyword, index) => (
                <span
                  key={index}
                  className="px-3 py-1 rounded-full text-sm bg-muted text-muted-foreground border border-muted-foreground/30"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recommendation */}
      {analysis.recommendation && (
        <div className="glass-card rounded-xl p-6 border border-neon-cyan/30">
          <h3 className="text-lg font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-neon-cyan" />
            Recommendation
          </h3>
          <p className="text-muted-foreground leading-relaxed">
            {analysis.recommendation}
          </p>
        </div>
      )}
    </div>
  );
};

export default AnalysisResults;
