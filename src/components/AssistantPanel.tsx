import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askAssistant } from "@/lib/assistant.functions";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = [
  "Which projects are in Testing with open blockers?",
  "List every overdue action and who owns it.",
  "Summarise portfolio health by phase.",
];

export function AssistantPanel({ projectId }: { projectId?: string }) {
  const ask = useServerFn(askAssistant);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await ask({ data: { question: q, projectId: projectId ?? null } });
      if (res.ok) setAnswer(res.answer);
      else setError(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assistant request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-24 flex h-[500px] flex-col rounded-2xl bg-nav p-6 text-nav-foreground shadow-2xl">
      <div className="mb-6 flex items-center gap-2">
        <div className="size-2 animate-pulse rounded-full bg-accent" />
        <h3 className="text-sm font-bold uppercase tracking-widest">Portfolio Intelligence</h3>
      </div>

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto pr-2">
        {!answer && !error && !busy && (
          <>
            <p className="text-xs leading-relaxed text-nav-muted">
              Ask about health, overdue actions, blocked dependencies or owners
              {projectId ? " for this project" : " across the portfolio"}.
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  setQuestion(s);
                  run(s);
                }}
                className="w-full rounded-lg border border-nav-foreground/10 bg-nav-foreground/5 p-3 text-left transition-colors hover:border-accent/40"
              >
                <p className="mb-1 text-[10px] font-bold uppercase text-accent">Suggested query</p>
                <p className="text-xs">{s}</p>
              </button>
            ))}
          </>
        )}

        {busy && <p className="text-xs text-nav-muted">Reading the portfolio…</p>}

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
            {error}
          </div>
        )}

        {answer && (
          <div className="whitespace-pre-wrap border-l-2 border-accent bg-accent/10 p-3 text-xs leading-relaxed">
            {answer}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(question);
        }}
      >
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask the Portfolio AI..."
          className="border-nav-foreground/20 bg-nav-foreground/10 text-nav-foreground placeholder:text-nav-muted"
        />
      </form>
    </div>
  );
}
