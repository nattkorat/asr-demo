import { useState } from "react";
import { Sparkles } from "lucide-react";
import { api } from "../../services/api";
import clsx from "clsx";

export function SummaryPanel({ transcript, segments, metadata, onSummaryReady }) {
  const [loading,  setLoading]  = useState(false);
  const [summary,  setSummary]  = useState(null);
  const [error,    setError]    = useState(null);
  const [included, setIncluded] = useState(false);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const res  = await api.summarize({ transcript, segments, metadata });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || res.statusText);
      setSummary(data);
      setIncluded(true);
      onSummaryReady?.(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Trigger row */}
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-purple text-white text-[11px] font-mono tracking-widest uppercase font-medium hover:opacity-90 transition disabled:opacity-40 light:bg-[#f4f7f6] light:text-[#1a2e28]"
        >
          {loading
            ? <><span className="spinner" />Summarizing…</>
            : <><Sparkles size={12} />Summarize</>}
        </button>
        <span className="text-[11px] text-muted tracking-wide">
          Generate summary · key points · action items
        </span>
        {summary && (
          <label className="ml-auto flex items-center gap-2 text-[11px] text-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={included}
              onChange={e => { setIncluded(e.target.checked); onSummaryReady?.(e.target.checked ? summary : null); }}
              className="accent-purple"
            />
            Include in report
          </label>
        )}
      </div>

      {error && <p className="text-[11px] text-danger">{error}</p>}

      {summary && (
        <div className="flex flex-col gap-3">
          <Section label="Summary" accent="accent">
            <p className="text-[13px] leading-relaxed text-tx dark:text-tx light:text-tx/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
              {summary.summary}
            </p>
          </Section>

          <Section label="Key Points" accent="accent">
            {summary.key_points?.length
              ? <ul className="flex flex-col gap-1.5">
                  {summary.key_points.map((pt, i) => (
                    <li key={i} className="flex gap-2 items-start text-[13px] text-tx dark:text-tx light:text-tx/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              : <p className="text-[12px] text-muted italic">None identified.</p>}
          </Section>

          <Section label="Action Items" accent="accent">
            {summary.action_items?.length
              ? <ul className="flex flex-col gap-1.5">
                  {summary.action_items.map((ai, i) => (
                    <li key={i} className="flex gap-2 items-start text-[13px] text-tx dark:text-tx light:text-tx/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
                      <span className="mt-[7px] w-1.5 h-1.5 rounded-full bg-accent2 shrink-0" />
                      {ai}
                    </li>
                  ))}
                </ul>
              : <p className="text-[12px] text-muted italic">None identified.</p>}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ label, accent, children }) {
  return (
    <div className="bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl p-4 light:bg-[#f4f7f6] light:text-[#1a2e28]">
      <p className={clsx(
        "text-[9px] tracking-[.15em] uppercase font-medium mb-2.5",
        accent === "accent2" ? "text-accent2" : "text-accent"
      )}>{label}</p>
      {children}
    </div>
  );
}
