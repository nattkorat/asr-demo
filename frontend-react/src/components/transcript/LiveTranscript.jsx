import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import { Copy } from "lucide-react";
import { api } from "../../services/api";

/**
 * LiveTranscript — append-only transcript display with built-in audio recording.
 *
 * Props:
 *   onFinalResult {fn}      Called with final transcript string after ASR responds
 *   asrMimeType   {string}  Preferred MIME type (default: "audio/webm;codecs=opus")
 *
 * Ref methods:
 *   commit(text)            — append committed word(s)
 *   setInterim(text)        — set in-progress italic text
 *   clear()                 — wipe everything
 *   getText()               — return full visible text
 *   startRecording(stream)  — begin buffering audio from a MediaStream
 *   stopRecording()         — stop + POST to ASR via api.transcribe; returns Promise<string>
 */
export const LiveTranscript = forwardRef(function LiveTranscript(
  {
    onFinalResult,
    asrMimeType = "audio/webm;codecs=opus",
  },
  ref
) {
  // ── DOM refs ──────────────────────────────────────────────────────────────
  const committedRef = useRef(null);
  const interimRef   = useRef(null);
  const wrapRef      = useRef(null);
  const statusRef    = useRef(null);

  // ── Recording state ───────────────────────────────────────────────────────
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);

  // ── Stable prop refs (fixes stale-closure in useImperativeHandle) ─────────
  const onFinalResultRef = useRef(onFinalResult);
  const asrMimeTypeRef   = useRef(asrMimeType);

  useEffect(() => { onFinalResultRef.current = onFinalResult; }, [onFinalResult]);
  useEffect(() => { asrMimeTypeRef.current   = asrMimeType;   }, [asrMimeType]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const scrollBottom = () =>
    wrapRef.current?.scrollTo({ top: 99999, behavior: "smooth" });

  const setStatus = (msg, color = "var(--color-muted)") => {
    const el = statusRef.current;
    if (!el) return;
    el.textContent     = msg;
    el.style.color     = color;
    el.style.display   = msg ? "block" : "none";
  };

  // ── ASR fetch ─────────────────────────────────────────────────────────────
  const sendToAsr = async (blob) => {
    setStatus("⏳ Transcribing…", "var(--color-accent, #3ecf8e)");
    try {
      // Force audio/webm so the backend MIME_TO_FORMAT map matches
      const safeBlob = new Blob([blob], { type: "audio/webm" });
      const form = new FormData();
      form.append("file", safeBlob, "recording.webm"); // field must be "file"

      const res  = await api.transcribe(form);
      if (!res.ok) throw new Error(`ASR HTTP ${res.status}`);

      const data = await res.json();
      const transcript =
        typeof data === "string"
          ? data
          : (data.text ?? data.transcript ?? JSON.stringify(data));

      setStatus("");
      return transcript;
    } catch (err) {
      setStatus("⚠ ASR failed", "#f87171");
      console.error("[LiveTranscript] ASR error:", err);
      return "";
    }
  };

  // ── Apply final transcript to the DOM ────────────────────────────────────
  const applyFinalTranscript = (transcript) => {
    if (!transcript) return;
    // Replace whatever was live-transcribed with the authoritative ASR text
    if (committedRef.current) committedRef.current.textContent = transcript;
    if (interimRef.current)   interimRef.current.textContent  = "";
    scrollBottom();
    onFinalResultRef.current?.(transcript);
  };

  // ── Imperative API ────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    commit(text) {
      if (!text) return;
      const el = committedRef.current;
      if (el.textContent.length > 0) el.appendChild(document.createTextNode(" "));
      el.appendChild(document.createTextNode(text));
      if (interimRef.current) interimRef.current.textContent = "";
      scrollBottom();
    },

    setInterim(text) {
      if (interimRef.current) interimRef.current.textContent = text ? " " + text : "";
      scrollBottom();
    },

    clear() {
      if (committedRef.current) committedRef.current.textContent = "";
      if (interimRef.current)   interimRef.current.textContent  = "";
    },

    getText() {
      return (
        (committedRef.current?.textContent || "") +
        (interimRef.current?.textContent   || "")
      );
    },

    // ── startRecording(stream) ─────────────────────────────────────────────
    startRecording(stream) {
      if (recorderRef.current?.state === "recording") return;
      chunksRef.current = [];

      const preferred = asrMimeTypeRef.current;
      const mimeType  = MediaRecorder.isTypeSupported(preferred)
        ? preferred
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(200); // 200 ms chunks
      recorderRef.current = recorder;
      setStatus("🔴 Recording", "#f87171");
    },

    // ── stopRecording() → Promise<string> ─────────────────────────────────
    stopRecording() {
      return new Promise((resolve) => {
        const recorder = recorderRef.current;

        // Nothing to stop
        if (!recorder || recorder.state === "inactive") {
          resolve("");
          return;
        }

        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });
          chunksRef.current = [];
          recorderRef.current = null;

          if (blob.size < 100) {
            setStatus("");
            resolve("");
            return;
          }

          const transcript = await sendToAsr(blob);
          applyFinalTranscript(transcript);
          resolve(transcript);
        };

        recorder.stop();
      });
    },
  }));

  // ── Copy handler ──────────────────────────────────────────────────────────
  const copy = () => {
    const txt = committedRef.current?.textContent?.trim();
    if (txt) navigator.clipboard.writeText(txt);
  };

  return (
    <div
      ref={wrapRef}
      className="relative bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl p-5 min-h-[140px] max-h-[300px] overflow-y-auto group light:bg-[#f4f7f6] light:text-[#1a2e28]"
    >
      <p className="font-khmer text-center text-[17px] leading-[1.85] text-tx dark:text-tx light:text-tx/light light:text-[#1a2e28]">
        <span ref={committedRef} />
        <span ref={interimRef} className="text-muted italic" />
      </p>

      {/* Placeholder */}
      <span
        className="tx-placeholder absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] text-muted tracking-wide whitespace-nowrap pointer-events-none select-none"
        style={{ display: "none" }}
        id="live-ph"
      >
        Press record to begin…
      </span>

      {/* ASR status badge */}
      <span
        ref={statusRef}
        style={{ display: "none" }}
        className="absolute bottom-2.5 left-3 text-[10px] tracking-wide pointer-events-none select-none"
      />

      {/* Copy button */}
      <button
        onClick={copy}
        className="absolute top-2.5 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted border border-border rounded-md px-2.5 py-1 hover:text-accent hover:border-accent"
      >
        <Copy size={10} className="inline mr-1" />copy
      </button>
    </div>
  );
});