import { useRef, useState, useCallback, useEffect } from "react";

const SPEAKER_COLORS = [
  "#00e5a0","#00b3ff","#ff7b54","#a78bfa",
  "#fbbf24","#f472b6","#34d399","#60a5fa",
];

export function useAudioPlayer() {
  const audioRef    = useRef(null);
  const rafRef      = useRef(null);
  const canvasRef   = useRef(null);

  const [peaks,       setPeaks]       = useState([]);
  const [playing,     setPlaying]     = useState(false);
  const [progress,    setProgress]    = useState(0);   // 0-1
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [segments,    setSegments]    = useState([]);
  const [colorMap,    setColorMap]    = useState({});

  // ── Load file → create Audio + decode peaks ──────────────────────
  const loadFile = useCallback(async (file) => {
    // Tear down previous
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
    cancelAnimationFrame(rafRef.current);
    setPlaying(false); setProgress(0); setCurrentTime(0); setDuration(0);
    setPeaks([]); setSegments([]); setColorMap({});

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.onended = () => { setPlaying(false); cancelAnimationFrame(rafRef.current); };
    audio.onloadedmetadata = () => setDuration(audio.duration || 0);

    // Decode for waveform (non-blocking)
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const ctx     = new OfflineAudioContext(1, 1, 44100);
        const decoded = await ctx.decodeAudioData(ev.target.result);
        setPeaks(buildPeaks(decoded, 200));
      } catch { setPeaks([]); }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Attach diarization segments ───────────────────────────────────
  const loadSegments = useCallback((segs) => {
    setSegments(segs);
    const map = {};
    let idx = 0;
    segs.forEach(s => { if (!(s.speaker in map)) map[s.speaker] = SPEAKER_COLORS[idx++ % SPEAKER_COLORS.length]; });
    setColorMap(map);
  }, []);

  // ── rAF sync loop ─────────────────────────────────────────────────
  const startSync = useCallback(() => {
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      const p = a.duration ? a.currentTime / a.duration : 0;
      setProgress(p);
      setCurrentTime(a.currentTime);
      if (!a.paused) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ── Controls ──────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); startSync(); }
    else          { a.pause(); setPlaying(false); cancelAnimationFrame(rafRef.current); }
  }, [startSync]);

  const seek = useCallback((ratio) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = ratio * a.duration;
    setProgress(ratio);
    setCurrentTime(a.currentTime);
  }, []);

  const seekToTime = useCallback((t) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    a.currentTime = t;
    setProgress(t / a.duration);
    setCurrentTime(t);
    if (a.paused) { a.play(); setPlaying(true); startSync(); }
  }, [startSync]);

  // Cleanup on unmount
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
  }, []);

  return {
    canvasRef, audioRef,
    peaks, segments, colorMap,
    playing, progress, currentTime, duration,
    loadFile, loadSegments,
    togglePlay, seek, seekToTime,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildPeaks(audioBuffer, numBars) {
  const raw  = audioBuffer.getChannelData(0);
  const step = Math.floor(raw.length / numBars);
  const out  = [];
  for (let i = 0; i < numBars; i++) {
    let max = 0;
    for (let j = 0; j < step; j++) { const v = Math.abs(raw[i * step + j] || 0); if (v > max) max = v; }
    out.push(max);
  }
  const gmax = Math.max(...out, 0.001);
  return out.map(p => p / gmax);
}

export { SPEAKER_COLORS };
