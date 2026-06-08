import { useState, useRef, useCallback } from "react";
import { Upload, FileAudio } from "lucide-react";
import clsx from "clsx";
import { api } from "../../services/api";
import { useAudioPlayer } from "../../hooks/useAudioPlayer";
import { AudioPlayer } from "../player/AudioPlayer";
import { AsrResult } from "../transcript/AsrResult";
import { DiarizeResult } from "../transcript/DiarizeResult";
import { SummaryPanel } from "../summary/SummaryPanel";
import { ReportBar } from "../summary/ReportBar";

const MODES = [
  { id: "asr",     label: "🗒 Transcribe" },
  { id: "diarize", label: "👥 Diarize"    },
];

function fmtSize(b) {
  return b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : (b / 1024).toFixed(0) + " KB";
}

export function UploadTab({ diarizationEnabled }) {
  const [mode,        setMode]        = useState("asr");
  const [file,        setFile]        = useState(null);
  const [dragging,    setDragging]    = useState(false);
  const [statusDot,   setStatusDot]   = useState("");
  const [statusMsg,   setStatusMsg]   = useState("Select a file to begin");
  const [loading,     setLoading]     = useState(false);
  const [asrText,     setAsrText]     = useState(null);
  const [diarSegs,    setDiarSegs]    = useState([]);
  const [hasResult,   setHasResult]   = useState(false);
  const [summary,     setSummary]     = useState(null);    // set by SummaryPanel
  const fileInputRef  = useRef(null);

  const player = useAudioPlayer();

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setFile(f);
    setAsrText(null); setDiarSegs([]); setHasResult(false); setSummary(null);
    setStatusMsg("file ready — click the button below");
    player.loadFile(f);
  }, [player]);

  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); };

  // ── Run ─────────────────────────────────────────────────────────────────────
  const run = async () => {
    if (!file || loading) return;
    setLoading(true); setStatusDot(""); setSummary(null);
    setAsrText(null); setDiarSegs([]); setHasResult(false);

    const form = new FormData();
    form.append("file", file);

    try {
      if (mode === "asr") {
        setStatusMsg("transcribing…");
        const res  = await api.transcribe(form);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || res.statusText);
        setAsrText(data.transcript);
        setStatusDot("connected");
        setStatusMsg(`done · ${data.duration_sec}s`);
        setHasResult(true);
      } else {
        setStatusMsg("running diarization — this may take a moment…");
        const res  = await api.diarize(form);
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || res.statusText);
        setDiarSegs(data.segments);
        player.loadSegments(data.segments);
        setStatusDot("connected");
        setStatusMsg(`done · ${data.num_speakers} speaker(s) · ${data.segments.length} segments · ${data.duration_sec}s`);
        setHasResult(true);
      }
    } catch (e) {
      setStatusDot(""); setStatusMsg("error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setFile(null); setAsrText(null); setDiarSegs([]);
    setHasResult(false); setSummary(null);
    setStatusDot(""); setStatusMsg("Select a file to begin");
    player.loadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const metadata = {
    filename:     file?.name   || null,
    duration_sec: player.duration || null,
    num_speakers: diarSegs.length ? Object.keys(player.colorMap).length : null,
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Status */}
      <div className="flex items-center gap-2 min-h-[22px]">
        <span className={clsx("w-[7px] h-[7px] rounded-full shrink-0 transition-colors",
          statusDot === "connected" && "bg-accent shadow-[0_0_8px_#00e5a0]",
          !statusDot && "bg-muted"
        )} />
        <span className="text-[11px] text-muted tracking-wide">{statusMsg}</span>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-bg dark:bg-bg light:bg-bg/light border border-border dark:border-border light:border-border/light rounded-xl light:bg-[#f4f7f6] light:text-[#1a2e28]">
        {MODES.filter(m => m.id === "asr" || diarizationEnabled).map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={clsx(
              "flex-1 py-2 rounded-lg text-[10px] font-mono tracking-widest uppercase transition-all light:bg-[#f4f7f6] light:text-[#1a2e28]",
              mode === m.id
                ? "bg-raised dark:bg-raised light:bg-raised/light text-tx border border-border shadow-sm"
                : "text-muted hover:text-tx"
            )}
          >{m.label}</button>
        ))}
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            "bg-bg dark:bg-bg light:bg-bg/light border border-dashed rounded-xl p-9 text-center cursor-pointer transition-colors light:bg-[#f4f7f6] light:text-[#1a2e28]",
            dragging ? "border-accent2 bg-accent2/5" : "border-border hover:border-accent2/50"
          )}
        >
          <FileAudio size={28} className="mx-auto mb-2.5 text-muted" />
          <p className="text-[12px] text-muted">
            Drop audio file here or <span className="text-accent2">browse</span>
          </p>
          <p className="text-[10px] text-muted/60 mt-1.5 tracking-widest uppercase">
            WAV · MP3 · OGG · FLAC · AAC · WEBM · M4A
          </p>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="audio/*,video/webm" className="hidden"
        onChange={e => handleFile(e.target.files[0])} />

      {/* File info */}
      {file && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-raised dark:bg-raised light:bg-raised/light border border-border dark:border-border light:border-border/light rounded-xl text-[11px] light:bg-[#f4f7f6] light:text-[#1a2e28]">
          <span className="text-tx font-mono truncate max-w-[70%]">{file.name}</span>
          <span className="text-muted">{fmtSize(file.size)}</span>
        </div>
      )}

      {/* Audio player */}
      {file && (
        <AudioPlayer
          peaks={player.peaks}
          segments={player.segments}
          colorMap={player.colorMap}
          playing={player.playing}
          progress={player.progress}
          currentTime={player.currentTime}
          duration={player.duration}
          togglePlay={player.togglePlay}
          seek={player.seek}
          seekToTime={player.seekToTime}
        />
      )}

      {/* Result */}
      {mode === "asr"
        ? <AsrResult transcript={asrText} />
        : <DiarizeResult
            segments={diarSegs}
            colorMap={player.colorMap}
            currentTime={player.currentTime}
            onSeek={player.seekToTime}
          />}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={!file || loading}
          className="flex items-center gap-2 px-7 py-3 rounded-xl bg-accent2 text-white text-[12px] font-mono tracking-widest uppercase font-medium hover:bg-accent2/hover transition disabled:opacity-40"
        >
          {loading
            ? <><span className="spinner" />{mode === "asr" ? "Transcribing…" : "Diarizing…"}</>
            : <><Upload size={12} />{mode === "asr" ? "Transcribe" : "Diarize"}</>}
        </button>
        <button onClick={clear}
          className="px-5 py-3 rounded-xl text-[11px] font-mono tracking-wide text-muted border border-border hover:text-tx hover:border-muted transition-colors">
          clear
        </button>
      </div>

      {/* Summarize + Report — shown after any result */}
      {hasResult && (
        <>
          <hr className="border-border dark:border-border light:border-border/light light:bg-[#f4f7f6] light:text-[#1a2e28]" />

          <SummaryPanel
            transcript={asrText}
            segments={diarSegs.length ? diarSegs : null}
            metadata={metadata}
            onSummaryReady={setSummary}
          />

          <ReportBar
            transcript={asrText}
            segments={diarSegs.length ? diarSegs : null}
            metadata={metadata}
            summary={summary}
          />
        </>
      )}
    </div>
  );
}
