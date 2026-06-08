import { useState } from "react";
import { Download } from "lucide-react";
import { api } from "../../services/api";

/**
 * ReportBar — Download Report is ALWAYS available after a result.
 * Summary data is optional — included only if the user ran summarize
 * and checked "Include in report".
 */
export function ReportBar({ transcript, segments, metadata, summary }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const download = async () => {
    setLoading(true); setError(null);
    try {
      const payload = {
        // Summary fields — present only if user included them
        ...(summary || { summary: null, key_points: [], action_items: [] }),
        transcript,
        segments,
        metadata,
      };
      const res = await api.report(payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.statusText);
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement("a"), {
        href:     url,
        download: (metadata?.filename?.replace(/\.[^.]+$/, "") || "transcript") + "_report.docx",
      });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl light:bg-[#f4f7f6] light:text-[#1a2e28]">
      <div className="flex-1">
        <p className="text-[11px] text-muted tracking-wide">
          Export full report as Word document (.docx)
          {summary
            ? <span className="ml-2 text-purple">· includes summary</span>
            : <span className="ml-2 text-muted/60">· transcript only</span>}
        </p>
        {error && <p className="text-[11px] text-danger mt-0.5">{error}</p>}
      </div>
      <button
        onClick={download}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-yellow text-black text-[11px] font-mono tracking-widest uppercase font-medium hover:opacity-90 transition disabled:opacity-40"
      >
        {loading
          ? <><span className="spinner border-black/25 border-t-black" />Building…</>
          : <><Download size={12} />Download Report</>}
      </button>
    </div>
  );
}
