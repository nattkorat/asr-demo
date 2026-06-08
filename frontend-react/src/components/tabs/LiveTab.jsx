import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";
import { LiveTranscript } from "../transcript/LiveTranscript";
import clsx from "clsx";

const SAMPLE_RATE = 16000;
const CHUNK_MS    = 250;
const NUM_BARS    = 56;

function float32ToPCM16(f32) {
  const buf  = new ArrayBuffer(f32.length * 2);
  const view = new DataView(buf);
  f32.forEach((v, i) => {
    const s = Math.max(-1, Math.min(1, v));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  });
  return buf;
}

export function LiveTab() {
  const [recording,  setRecording]  = useState(false);
  const [statusDot,  setStatusDot]  = useState("");      // "" | "recording" | "connected"
  const [statusMsg,  setStatusMsg]  = useState("Press record to begin");
  const [elapsed,    setElapsed]    = useState(0);
  const [barHeights, setBarHeights] = useState(Array(NUM_BARS).fill(4));

  const transcriptRef  = useRef(null);
  const processorRef   = useRef(null);
  const audioCtxRef    = useRef(null);
  const analyserRef    = useRef(null);
  const mediaStreamRef = useRef(null);
  const timerRef       = useRef(null);
  const animRef        = useRef(null);

  const handleStatus = useCallback((dot, msg) => {
    setStatusDot(dot); setStatusMsg(msg);
  }, []);

  const teardownAudio = useCallback(() => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
    processorRef.current?.disconnect();   processorRef.current  = null;
    audioCtxRef.current?.close();         audioCtxRef.current   = null;
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current = null;
    setBarHeights(Array(NUM_BARS).fill(4));
    setRecording(false);
  }, []);

  const { openWS, closeWS, sendBinary } = useWebSocket({
    onPartial: (t)     => transcriptRef.current?.setInterim(t),
    onFinal:   (t)     => { if (t) transcriptRef.current?.commit(t); },
    onStatus:  handleStatus,
    onClose:   () => {
      teardownAudio();
      transcriptRef.current?.setInterim("");
      setStatusMsg("Recording stopped");
    },
  });

  // ── Waveform animation ──────────────────────────────────────────────────────
  const animWave = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const step = Math.floor(data.length / NUM_BARS);
    setBarHeights(Array.from({ length: NUM_BARS }, (_, i) =>
      Math.max(4, (data[i * step] / 255) * 52)
    ));
    animRef.current = requestAnimationFrame(animWave);
  }, []);

  // ── Start recording ─────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch { handleStatus("", "mic access denied"); return; }

    audioCtxRef.current  = new AudioContext({ sampleRate: SAMPLE_RATE });
    analyserRef.current  = audioCtxRef.current.createAnalyser();
    analyserRef.current.fftSize = 256;
    const src = audioCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
    src.connect(analyserRef.current);

    const rawSize = SAMPLE_RATE * CHUNK_MS / 1000;
    const bufSize = Math.min(16384, Math.pow(2, Math.ceil(Math.log2(rawSize))));
    processorRef.current = audioCtxRef.current.createScriptProcessor(bufSize, 1, 1);
    src.connect(processorRef.current);
    processorRef.current.connect(audioCtxRef.current.destination);
    processorRef.current.onaudioprocess = (e) => {
      sendBinary(float32ToPCM16(e.inputBuffer.getChannelData(0)));
    };

    openWS();
    setRecording(true);
    setStatusDot("recording");
    animWave();

    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }, [openWS, sendBinary, animWave, handleStatus]);

  // ── Stop recording ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    setStatusMsg("finalising…");
    // Stop sending chunks immediately
    if (processorRef.current) {
      processorRef.current.onaudioprocess = null;
    }
    closeWS(); // triggers server final decode → onClose → teardownAudio
  }, [closeWS]);

  useEffect(() => () => { teardownAudio(); closeWS(); }, []);

  const fmt = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  return (
    <div className="flex flex-col gap-5">
      {/* Status */}
      <div className="flex items-center gap-2 min-h-[22px]">
        <span className={clsx("w-[7px] h-[7px] rounded-full shrink-0 transition-colors",
          statusDot === "recording" && "bg-danger shadow-[0_0_8px_#ff4d6d] rec-pulse",
          statusDot === "connected" && "bg-accent shadow-[0_0_8px_#00e5a0]",
          !statusDot && "bg-muted"
        )} />
        <span className="text-[11px] text-muted tracking-wide">{statusMsg}</span>
      </div>

      {/* Waveform */}
      <div className="bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl h-[66px] flex items-center overflow-hidden px-3 light:bg-[#f4f7f6] light:text-[#1a2e28]">
        <div className="flex items-center gap-[3px] h-full py-2 w-full ">
          {barHeights.map((h, i) => (
            <div key={i} className={clsx("w-[3px] rounded-sm wf-bar shrink-0",
              recording ? "bg-accent opacity-85" : "bg-accent opacity-50"
            )} style={{ height: h + "px" }} />
          ))}
        </div>
      </div>

      {/* Transcript */}
      <LiveTranscript ref={transcriptRef} />

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={recording ? stop : start}
          className={clsx(
            "flex items-center gap-2 px-8 py-3 rounded-xl text-[12px] font-mono tracking-widest uppercase font-medium transition-all",
            recording
              ? "bg-danger text-white hover:bg-danger/hover shadow-[0_0_22px_rgba(255,77,109,.3)]"
              : "bg-accent text-black hover:bg-accent/hover shadow-[0_0_0px_transparent] hover:shadow-[0_0_22px_rgba(0,229,160,.3)]"
          )}
        >
          {recording ? <><Square size={12} fill="white" />Stop</> : <><Mic size={12} />Rec</>}
        </button>
        <button
          onClick={() => transcriptRef.current?.clear()}
          className="px-5 py-3 rounded-xl text-[11px] font-mono tracking-wide text-muted border border-border hover:text-tx hover:border-muted transition-colors"
        >
          clear
        </button>
        <span className="ml-auto text-[12px] text-muted font-mono tabular-nums">{fmt(elapsed)}</span>
      </div>
    </div>
  );
}
