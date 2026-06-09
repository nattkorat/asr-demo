import { SPEAKER_COLORS } from "../../hooks/useAudioPlayer";

function fmtTs(s) {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(2).padStart(5,"0")}`;
}

export function DiarizeResult({ segments, colorMap, currentTime, onSeek }) {
  if (!segments?.length) return (
    <div className="bg-bg dark:bg-bg light:bg-bg/light border border-border rounded-xl p-5 min-h-[140px] flex items-center justify-center light:bg-[#f4f7f6] light:text-[#1a2e28]">
      <span className="text-[11px] text-muted tracking-wide light:bg-[#f4f7f6] light:text-[#1a2e28]">Diarization result will appear here…</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
      {segments.map((seg, i) => {
        const color   = colorMap[seg.speaker] || SPEAKER_COLORS[0];
        const isActive = currentTime >= seg.start && currentTime < seg.end;
        const hasCurrent = segments.some(s => currentTime >= s.start && currentTime < s.end);
        const isDimmed = hasCurrent && !isActive;

        return (
          <div
            key={i}
            onClick={() => onSeek?.(seg.start)}
            className="rounded-xl px-4 py-3 cursor-pointer transition-all duration-150"
            style={{
              borderLeft:  `3px solid ${color}`,
              background:  `${color}12`,
              boxShadow:   isActive ? `0 0 0 2px ${color}` : undefined,
              opacity:     isDimmed ? 0.4 : 1,
            }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] font-mono uppercase tracking-widest font-medium" style={{ color }}>
                {seg.speaker}
              </span>
              <span className="ml-auto text-[10px] text-muted font-mono tabular-nums">
                {fmtTs(seg.start)} → {fmtTs(seg.end)}
              </span>
            </div>
            <p className="font-khmer text-[16px] leading-[1.8] text-tx dark:text-tx light:text-tx/light pl-4 light:bg-[#f4f7f6] light:text-[#1a2e28]">
              {seg.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
