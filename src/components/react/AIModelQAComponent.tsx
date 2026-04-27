import React, { useState, FC } from "react";
import type { FormEvent } from "react";
import { MessageSquare, Send, Sparkles, Clock, CheckCircle } from "lucide-react";

interface AIModelQAProps {
  bridge: any;
  directory: string;
  analysisId: string;
}

const AIModelQAComponent: FC<AIModelQAProps> = ({ bridge, directory, analysisId }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ question: string; answer: any; timestamp: Date }>>(
    []
  );

  const suggestedQuestions = [
    "How much space do AI models use?",
    "What frameworks are detected?",
    "How can I optimize these models?",
    "What is safetensors format?",
    "How do I use these AI models?",
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    try {
      const result = await bridge.aiModelQA(question, directory, analysisId);
      setAnswer(result);
      setHistory((prev) => [...prev, { question, answer: result, timestamp: new Date() }]);
      setQuestion("");
    } catch (error) {
      console.error("Q&A error:", error);
      setAnswer({ error: (error as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestedQuestion = (q: string) => {
    setQuestion(q);
  };

  return (
    <div className="glass-panel qa-container">
      <h3 className="qa-header">
        <MessageSquare size={20} className="qa-title" />
        AI Model Q&A
        <span className="qa-subtitle">(Self-Learning Enabled)</span>
      </h3>

      {/* Suggested Questions */}
      <div className="suggestions-description">
        <p>Suggested questions:</p>
      </div>
      <div className="suggestions-grid">
        {suggestedQuestions.map((q, i) => (
          <button key={i} onClick={() => handleSuggestedQuestion(q)} className="suggestion-chip">
            <Sparkles size={12} />
            {q}
          </button>
        ))}
      </div>

      {/* Question Input */}
      <form onSubmit={handleSubmit} className="qa-form">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about AI models in this directory..."
          className="qa-input"
        />
        <button type="submit" className="primary-btn" disabled={loading || !question.trim()}>
          {loading ? (
            <span className="loading-spinner loading-spinner-compact" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>

      {/* Answer Display */}
      {answer && !answer.error && (
        <div className="qa-answer">
          <div className="answer-header">
            <CheckCircle size={16} className="answer-icon-success" />
            <span>{answer.intent?.replace(/_/g, " ").toUpperCase()}</span>
            {answer.cached && (
              <span className="cached-badge">
                <Clock size={12} /> Cached
              </span>
            )}
          </div>
          <div className="answer-content">
            <pre className="answer-content-pre">{answer.answer}</pre>
          </div>
          {answer.suggestions && answer.suggestions.length > 0 && (
            <div className="answer-suggestions">
              <p className="suggestions-description">Related questions:</p>
              {answer.suggestions.map((s: string, i: number) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(s)}
                  className="suggestion-link-button"
                >
                  → {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {answer?.error && <div className="qa-error-message">Error: {answer.error}</div>}

      {/* Q&A History */}
      {history.length > 0 && (
        <div className="qa-history">
          <p className="qa-history-title">Recent questions: {history.length}</p>
        </div>
      )}
    </div>
  );
};

export default AIModelQAComponent;
