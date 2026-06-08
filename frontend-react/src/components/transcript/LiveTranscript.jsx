import { forwardRef, useImperativeHandle, useRef } from "react";
import { Copy } from "lucide-react";

/**
 * LiveTranscript — append-only transcript display.
 * Exposes: commit(text), setInterim(text), clear() via ref.
 */
export const LiveTranscript = forwardRef(function LiveTranscript(_, ref) {
  const committedRef = useRef(null);
  const interimRef   = useRef(null);
  const wrapRef      = useRef(null);

  useImperativeHandle(ref, () => ({
    commit(text) {
      if (!text) return;
      const el = committedRef.current;
      if (el.textContent.length > 0) el.appendChild(document.createTextNode(" "));
      el.appendChild(document.createTextNode(text));
      if (interimRef.current) interimRef.current.textContent = "";
      wrapRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
    },
    setInterim(text) {
      if (interimRef.current) interimRef.current.textContent = text ? " " + text : "";
      wrapRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
    },
    clear() {
      if (committedRef.current) committedRef.current.textContent = "";
      if (interimRef.current)   interimRef.current.textContent   = "";
    },
    getText() {
      return (committedRef.current?.textContent || "") + (interimRef.current?.textContent || "");
    },
  }));

  const copy = () => {
    const txt = committedRef.current?.textContent?.trim();
    if (txt) navigator.clipboard.writeText(txt);
  };

  return (
    <div
      ref={wrapRef}
      className="relative bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl p-5 min-h-[140px] max-h-[300px] overflow-y-auto group light:bg-[#f4f7f6] light:text-[#1a2e28]"
    >
      <p className="font-khmer text-[17px] leading-[1.85] text-tx dark:text-tx light:text-tx/light">
        <span ref={committedRef} />
        <span ref={interimRef} className="text-muted italic" />
      </p>
      {/* Placeholder */}
      <span className="tx-placeholder absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] text-muted tracking-wide whitespace-nowrap pointer-events-none select-none"
        style={{ display: "none" }}
        id="live-ph">
        Press record to begin…
      </span>
      <button
        onClick={copy}
        className="absolute top-2.5 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted border border-border rounded-md px-2.5 py-1 hover:text-accent hover:border-accent"
      >
        <Copy size={10} className="inline mr-1" />copy
      </button>
    </div>
  );
});
