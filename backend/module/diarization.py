import torch
import torchaudio
from pathlib import Path
from typing import Optional
from pyannote.audio import Pipeline
from pyannote.audio.pipelines.utils.hook import ProgressHook



class SpeakerDiarizer:
    """
    Load the pyannote diarization pipeline once, then call it on any audio.

    Usage:
        diarizer = SpeakerDiarizer(hf_token="hf_...")
        result1  = diarizer("audio1.wav")
        result2  = diarizer("audio2.wav", min_speakers=2, max_speakers=4)
    """

    def __init__(
        self,
        hf_token: str = None,
        model_name: str = "pyannote/speaker-diarization-community-1",
        device: Optional[str] = None,
    ):
        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = torch.device(device)

        print(f"[SpeakerDiarizer] Loading '{model_name}' on {self.device} ...")
        self._pipeline = Pipeline.from_pretrained(model_name, token=hf_token)
        self._pipeline.to(self.device)
        print("[SpeakerDiarizer] Ready.")

    # ------------------------------------------------------------------
    # Make the instance directly callable:  diarizer("audio.wav")
    # ------------------------------------------------------------------
    def __call__(
        self,
        audio_path: str,
        num_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
        show_progress: bool = True,
    ) -> dict:
        return self._diarize(
            audio_path=audio_path,
            num_speakers=num_speakers,
            min_speakers=min_speakers,
            max_speakers=max_speakers,
            show_progress=show_progress,
        )

    # ------------------------------------------------------------------
    # Internal diarization logic (model already loaded)
    # ------------------------------------------------------------------
    def _diarize(
        self,
        audio_path: str,
        num_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None,
        show_progress: bool = True,
        gap_threshold: float = 0.5
    ) -> dict:
        """
        Returns:
            {
                "audio_path": str,
                "duration":   float,
                "num_speakers": int,
                "speakers":   List[str],
                "segments": [
                    {
                        "start":       float,
                        "end":         float,
                        "duration":    float,
                        "speaker":     str,
                        "audio_chunk": Tensor,   # [channels, samples]
                        "sample_rate": int,
                    },
                    ...
                ],
                "speakers_timeline": {
                    "SPEAKER_00": [{"start": float, "end": float}, ...],
                    ...
                }
            }
        """
        audio_path = Path(audio_path)
        if not audio_path.exists():
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Load waveform for slicing into chunks later
        waveform, sample_rate = torchaudio.load(str(audio_path))
        total_duration = waveform.shape[1] / sample_rate

        # Build optional speaker-count hints
        diarize_kwargs = {}
        if num_speakers is not None:
            diarize_kwargs["num_speakers"] = num_speakers
        else:
            if min_speakers is not None:
                diarize_kwargs["min_speakers"] = min_speakers
            if max_speakers is not None:
                diarize_kwargs["max_speakers"] = max_speakers

        # Run diarization (pipeline already warm)
        if show_progress:
            with ProgressHook() as hook:
                diarization = self._pipeline(
                    str(audio_path), hook=hook, **diarize_kwargs
                )
        else:
            diarization = self._pipeline(str(audio_path), **diarize_kwargs)

        # Parse DiarizeOutput (pyannote 4.x API)
        segments: list[dict] = []
        speakers_timeline: dict[str, list] = {}

        for turn, speaker in diarization.speaker_diarization:
            start_sample = max(0, int(turn.start * sample_rate))
            end_sample   = min(waveform.shape[1], int(turn.end * sample_rate))

            segment = {
                "start":       round(turn.start, 4),
                "end":         round(turn.end, 4),
                "duration":    round(turn.end - turn.start, 4),
                "speaker":     speaker,
                "audio_chunk": waveform[:, start_sample:end_sample],
                "sample_rate": sample_rate,
            }
            segments.append(segment)

            speakers_timeline.setdefault(speaker, []).append({
                "start": round(turn.start, 4),
                "end":   round(turn.end, 4),
            })
            
        segments = self._merge_consecutive_segments(segments, gap_threshold=gap_threshold)
        unique_speakers = sorted(speakers_timeline.keys())

        return {
            "audio_path":        str(audio_path),
            "duration":          round(total_duration, 4),
            "num_speakers":      len(unique_speakers),
            "speakers":          unique_speakers,
            "segments":          segments,
            "speakers_timeline": speakers_timeline,
        }
    
    def _merge_consecutive_segments(
        self,
        segments: list[dict],
        gap_threshold: float = 0.5,  # merge if gap between same speaker < this (seconds)
    ) -> list[dict]:
        """
        Merge consecutive segments from the same speaker if the gap between
        them is smaller than gap_threshold. Audio chunks are concatenated.
        """
        if not segments:
            return segments

        merged = [segments[0].copy()]

        for curr in segments[1:]:
            prev = merged[-1]
            gap  = curr["start"] - prev["end"]

            same_speaker   = curr["speaker"] == prev["speaker"]
            gap_is_small   = gap <= gap_threshold

            if same_speaker and gap_is_small:
                # Extend the previous segment's time boundary
                prev["end"]      = curr["end"]
                prev["duration"] = round(prev["end"] - prev["start"], 4)

                # Concatenate audio — pad the gap with silence so timestamps stay accurate
                gap_samples = int(gap * prev["sample_rate"])
                silence     = torch.zeros(
                    prev["audio_chunk"].shape[0],  # same number of channels
                    gap_samples,
                )
                prev["audio_chunk"] = torch.cat(
                    [prev["audio_chunk"], silence, curr["audio_chunk"]], dim=1
                )
            else:
                merged.append(curr.copy())

        return merged
