import React, { useEffect, useRef, useState } from "react";
import { askHrsyncAI } from "./aiService";
import { useHrsyncAI } from "./aiContext";
import "./HrsyncAI.css";

const suggestions = [
  "Show employees with incomplete data",
  "Give me today's attendance summary",
  "Which vendor agreements need attention?",
  "Explain my leave balance",
  "Find unusual payroll records",
];

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" />
      <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4l16 8-16 8 3.5-8L4 4Z" />
      <path d="M7.5 12H20" />
    </svg>
  );
}

export default function HrsyncAI() {
  const { isOpen, closeAI, context, module } = useHrsyncAI();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I’m HRSYNC AI. Ask me about employees, attendance, leave, payroll, recruitment, training, PMS or MIS.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!isOpen) return null;

  async function submit(value = input) {
    const message = String(value || "").trim();
    if (!message || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const result = await askHrsyncAI({
      message,
      context: { ...context, activeModule: module },
      signal: controller.signal,
    });

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text:
          result.ok
            ? result.answer
            : result.aborted
              ? "Request cancelled."
              : result.message,
        actions: result.actions,
      },
    ]);

    setLoading(false);
  }

  return (
    <div className="hrsx-ai-backdrop" onMouseDown={closeAI}>
      <aside
        className="hrsx-ai-panel"
        role="dialog"
        aria-modal="true"
        aria-label="HRSYNC AI"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="hrsx-ai-header">
          <div className="hrsx-ai-title-wrap">
            <span className="hrsx-ai-logo">
              <SparkleIcon />
            </span>
            <div>
              <strong>HRSYNC AI</strong>
              <small>HR Copilot · {module}</small>
            </div>
          </div>

          <button className="hrsx-ai-icon-btn" onClick={closeAI} aria-label="Close">
            <CloseIcon />
          </button>
        </header>

        <div className="hrsx-ai-body">
          <div className="hrsx-ai-suggestions">
            {suggestions.map((item) => (
              <button
                key={item}
                className="hrsx-ai-suggestion"
                onClick={() => submit(item)}
                disabled={loading}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="hrsx-ai-messages">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`hrsx-ai-message ${message.role}`}
              >
                {message.text}
              </div>
            ))}

            {loading && (
              <div className="hrsx-ai-message assistant hrsx-ai-loading">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
        </div>

        <form
          className="hrsx-ai-composer"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask HRSYNC AI..."
            disabled={loading}
          />
          <button type="submit" disabled={!input.trim() || loading} aria-label="Send">
            <SendIcon />
          </button>
        </form>

        <div className="hrsx-ai-footer">
          AI suggestions are subject to HR permissions and human approval.
        </div>
      </aside>
    </div>
  );
}
