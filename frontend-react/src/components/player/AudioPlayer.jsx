import { useEffect, useRef } from "react";
import { Play, Pause } from "lucide-react";
import clsx from "clsx";

const SPEAKER_COLORS = [
  "#00e5a0","#00b3ff","#ff7b54","#a78bfa",
  "#fbbf24","#f472b6","#34d399","#60a5fa",
];

function fmtDur(s) {
  if (!isFinite(s) || !s) return "0:00";
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2,"0")}`;
}

export function AudioPlayer({
  peaks, segments, colorMap,
  playing, progress, currentTime, duration,
  togglePlay, seek, seekToTime,
}) {
  const canvasRef = useRef(null);

  // ── Draw waveform ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks.length) return;

    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight || 72;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const isDark  = document.documentElement.classList.contains("dark");
    const clrRest = isDark ? "#1d2724" : "#d5e3de";
    const clrPlay = "#00b3ff";
    const barW    = 2;
    const gap     = Math.max(1, (W - barW * peaks.length) / (peaks.length + 1));
    const midY    = H / 2;
    const dur     = duration || 1;

    peaks.forEach((amp, i) => {
      const x       = gap + i * (barW + gap);
      const barH    = Math.max(2, amp * H * 0.82);
      const barTime = (i / peaks.length) * dur;
      const played  = i / peaks.length < progress;

      // Speaker segment colouring
      let segColor = null;
      if (segments.length && dur > 0) {
        const seg = segments.find(s => barTime >= s.start && barTime < s.end);
        if (seg) segColor = colorMap[seg.speaker] || null;
      }

      ctx.globalAlpha = played ? 1 : (segColor ? 0.45 : 0.6);
      ctx.fillStyle   = segColor
        ? (played ? segColor : segColor)
        : (played ? clrPlay  : clrRest);

      ctx.beginPath();
      ctx.roundRect(x, midY - barH / 2, barW, barH, 1);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }, [peaks, progress, segments, colorMap, duration]);

  const handleWaveClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - rect.left) / rect.width);
  };

  if (!peaks.length && !duration) return null;

  return (
    <div className="rounded-xl border border-border dark:border-border light:border-border/light overflow-hidden bg-bg dark:bg-bg light:bg-bg/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
      {/* Waveform */}
      <div
        className="relative h-[72px] cursor-pointer"
        onClick={handleWaveClick}
        style={{ "--ph": `${(progress * 100).toFixed(2)}%` }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-accent2 pointer-events-none"
          style={{ left: `${(progress * 100).toFixed(2)}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border dark:border-border light:border-border/light light:bg-[#f4f7f6] light:text-[#1a2e28]">
        <button
          onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-accent2 text-white shrink-0 hover:bg-accent2/hover transition-colors"
        >
          {playing
            ? <Pause  size={13} fill="white" />
            : <Play   size={13} fill="white" />}
        </button>

        <input
          type="range" min={0} max={1000} value={Math.round(progress * 1000)}
          onChange={e => seek(e.target.value / 1000)}
          className="flex-1 h-[3px] cursor-pointer"
        />

        <span className="text-[10px] text-muted font-mono tabular-nums whitespace-nowrap min-w-[70px] text-right">
          {fmtDur(currentTime)} / {fmtDur(duration)}
        </span>
      </div>
    </div>
  );
}
