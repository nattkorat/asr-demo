import { Copy } from "lucide-react";

export function AsrResult({ transcript }) {
  const copy = () => navigator.clipboard.writeText(transcript || "");

  if (!transcript) return (
    <div className="relative bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl p-5 min-h-[140px] flex items-center justify-center light:bg-[#f4f7f6] light:text-[#1a2e28]">
      <span className="text-[11px] text-muted tracking-wide">Transcript will appear here…</span>
    </div>
  );

  return (
    <div className="relative bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl p-5 min-h-[140px] max-h-[300px] overflow-y-auto group light:bg-[#f4f7f6] light:text-[#1a2e28]">
      <p className="font-khmer text-[17px] leading-[1.85] text-tx dark:text-tx light:text-tx/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
        {transcript}
      </p>
      <button
        onClick={copy}
        className="absolute top-2.5 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted border border-border rounded-md px-2.5 py-1 hover:text-accent hover:border-accent"
      >
        <Copy size={10} className="inline mr-1" />copy
      </button>
    </div>
  );
}
