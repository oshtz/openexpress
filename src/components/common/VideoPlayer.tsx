import { useRef, useState, useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface VideoPlayerProps {
  path: string;
  startTime?: number;
  endTime?: number;
  playbackRate?: number;
  onDurationChange?: (duration: number) => void;
  onTimeUpdate?: (time: number) => void;
}

function formatTime(secs: number): string {
  if (!isFinite(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({
  path,
  startTime,
  endTime,
  playbackRate = 1,
  onDurationChange,
  onTimeUpdate,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      if (startTime !== undefined && video.currentTime < startTime) {
        video.currentTime = startTime;
      }
      video.play();
      setPlaying(true);
    }
  }, [playing, startTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      onTimeUpdate?.(t);
      if (endTime !== undefined && t >= endTime) {
        video.pause();
        video.currentTime = startTime ?? 0;
        setPlaying(false);
      }
    };

    const onMeta = () => {
      const d = video.duration;
      setDuration(d);
      onDurationChange?.(d);
    };

    const onEnded = () => setPlaying(false);

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnded);
    };
  }, [startTime, endTime, onDurationChange, onTimeUpdate]);

  // Seek to startTime when it changes while paused
  useEffect(() => {
    const video = videoRef.current;
    if (video && startTime !== undefined && !playing) {
      video.currentTime = startTime;
    }
  }, [startTime, playing]);

  // Seek bar click
  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    video.currentTime = ratio * duration;
  };

  const handleSeekKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const video = videoRef.current;
    if (!video || duration <= 0) return;
    const delta = e.key === "ArrowLeft" ? -5 : 5;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + delta));
  };

  return (
    <div className="overflow-hidden bg-bg-secondary border border-border-subtle animate-fade-in-up">
      <div className="relative group cursor-pointer" onClick={togglePlay}>
        <video
          ref={videoRef}
          src={convertFileSrc(path)}
          className="w-full max-h-[350px] object-contain bg-black"
          muted={muted}
          preload="metadata"
        />
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-200 ${
            playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
        >
          <button
            aria-label={playing ? "Pause" : "Play"}
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-12 h-12 bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            {playing ? (
              <Pause size={20} className="text-white" />
            ) : (
              <Play size={20} className="text-white ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 py-2.5 space-y-2">
        {/* Seek bar */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration * 100) / 100}
          aria-valuenow={Math.round(currentTime * 100) / 100}
          aria-valuetext={formatTime(currentTime)}
          onClick={handleSeekClick}
          onKeyDown={handleSeekKeyDown}
          className="h-1.5 bg-bg-tertiary cursor-pointer group/seek relative"
        >
          <div
            className="absolute inset-y-0 left-0 bg-primary/60"
            style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary opacity-0 group-hover/seek:opacity-100 transition-opacity"
            style={{ left: duration > 0 ? `calc(${(currentTime / duration) * 100}% - 6px)` : "0" }}
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="text-text-muted hover:text-text transition-colors"
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <span className="text-[12px] text-text-secondary tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <button
            onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}
            className="text-text-muted hover:text-text transition-colors"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>
      </div>
    </div>
  );
}
