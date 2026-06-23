import { useCallback, useEffect, useRef, useState } from "react";

type FileOrUrl = File | string;

type UseAudioAnalyzerReturn = {
  loadSource: (fileOrUrl: FileOrUrl) => void;
  play: () => Promise<void>;
  pause: () => void;
  togglePlay: () => Promise<void>;
  isPlaying: boolean;
  currentFileName: string | null;
  executionDuration: number;
  duration: number;
  progress: number;
  frequencyDataRef: React.MutableRefObject<Uint8Array | null>;
  updateFrequencyData: () => Uint8Array | null;
  mediaRef: React.MutableRefObject<HTMLMediaElement | null>;
};

export default function useAudioAnalyzer(initialSource?: FileOrUrl): UseAudioAnalyzerReturn {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const mediaTypeRef = useRef<"audio" | "video" | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFileName, setCurrentFileName] = useState<string | null>(
    typeof initialSource === "string" ? initialSource : initialSource instanceof File ? initialSource.name : null
  );
  const [executionDuration, setExecutionDuration] = useState(0);
  const [duration, setDuration] = useState(0);

  const createMediaElement = useCallback((type: "audio" | "video") => {
    if (mediaRef.current && mediaTypeRef.current === type) return mediaRef.current;
    if (mediaRef.current) {
      try {
        mediaRef.current.pause();
        mediaRef.current.src = "";
      } catch {}
      mediaRef.current = null;
      mediaTypeRef.current = null;
    }

    const el = type === "video" ? document.createElement("video") : document.createElement("audio");
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    el.muted = false;
    el.playsInline = true;
    if (type === "video") {
      el.style.display = "none";
      document.body.appendChild(el);
    }
    mediaRef.current = el;
    mediaTypeRef.current = type;
    return el;
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (ctxRef.current && analyserRef.current) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    ctxRef.current = ctx;
    analyserRef.current = analyser;
  }, []);

  const connectSource = useCallback(() => {
    const media = mediaRef.current;
    const ctx = ctxRef.current;
    const analyser = analyserRef.current;
    if (!media || !ctx || !analyser) return;
    if (sourceRef.current) return;

    const src = ctx.createMediaElementSource(media);
    sourceRef.current = src;
    src.connect(analyser);
    analyser.connect(ctx.destination);
  }, []);

  const loadSource = useCallback((fileOrUrl: FileOrUrl) => {
    const isVideo = typeof fileOrUrl !== "string" && fileOrUrl.type.startsWith("video/");
    const media = createMediaElement(isVideo ? "video" : "audio");

    // Revoke previous object URL if present
    if (objectUrlRef.current) {
      try {
        URL.revokeObjectURL(objectUrlRef.current);
      } catch {}
      objectUrlRef.current = null;
    }

    if (typeof fileOrUrl === "string") {
      media.src = fileOrUrl;
      setCurrentFileName(fileOrUrl);
    } else {
      const url = URL.createObjectURL(fileOrUrl);
      objectUrlRef.current = url;
      media.src = url;
      setCurrentFileName(fileOrUrl.name);
    }

    media.load();
    media.volume = 1;
    ensureAudioContext();
    connectSource();

    const handleTimeUpdate = () => {
      if (mediaRef.current) setExecutionDuration(mediaRef.current.currentTime || 0);
    };
    const handleLoadedMetadata = () => {
      if (mediaRef.current) setDuration(mediaRef.current.duration || 0);
    };
    media.addEventListener("timeupdate", handleTimeUpdate);
    media.addEventListener("loadedmetadata", handleLoadedMetadata);

    const cleanup = () => {
      media.removeEventListener("timeupdate", handleTimeUpdate);
      media.removeEventListener("loadedmetadata", handleLoadedMetadata);
    };

    (media as any).__useAudioAnalyzerCleanup = cleanup;
  }, [createMediaElement, ensureAudioContext, connectSource]);

  const resumeOnUserGesture = useCallback(() => {
    const tryResume = () => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      window.removeEventListener("click", tryResume);
      window.removeEventListener("touchstart", tryResume);
    };
    window.addEventListener("click", tryResume, { once: true });
    window.addEventListener("touchstart", tryResume, { once: true });
  }, []);

  const play = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;

    ensureAudioContext();
    connectSource();

    const ctx = ctxRef.current;
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {}
    }

    resumeOnUserGesture();

    try {
      await media.play();
      setIsPlaying(true);
    } catch (err) {
      setIsPlaying(false);
      throw err;
    }
  }, [ensureAudioContext, connectSource, resumeOnUserGesture]);

  const pause = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    media.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(async () => {
    if (isPlaying) pause();
    else await play();
  }, [isPlaying, pause, play]);

  const updateFrequencyData = useCallback((): Uint8Array | null => {
    const analyser = analyserRef.current;
    const arr = frequencyDataRef.current;
    if (!analyser || !arr) return null;
    analyser.getByteFrequencyData(arr);
    return arr;
  }, []);

  useEffect(() => {
    if (initialSource) loadSource(initialSource);

    return () => {
      const media = mediaRef.current;
      if (media && (media as any).__useAudioAnalyzerCleanup) {
        try {
          (media as any).__useAudioAnalyzerCleanup();
        } catch {}
      }

      if (media) {
        try {
          media.pause();
          media.src = "";
          if (mediaTypeRef.current === "video" && media.parentNode) {
            media.parentNode.removeChild(media);
          }
        } catch {}
      }

      if (objectUrlRef.current) {
        try {
          URL.revokeObjectURL(objectUrlRef.current);
        } catch {}
        objectUrlRef.current = null;
      }

      try {
        if (sourceRef.current) sourceRef.current.disconnect();
      } catch {}
      try {
        if (analyserRef.current) analyserRef.current.disconnect();
      } catch {}

      const ctx = ctxRef.current;
      if (ctx) {
        try {
          ctx.close();
        } catch {}
        ctxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressValue = duration > 0 ? executionDuration / duration : 0;

  return {
    loadSource,
    play,
    pause,
    togglePlay,
    isPlaying,
    currentFileName,
    executionDuration,
    duration,
    progress: progressValue,
    frequencyDataRef,
    updateFrequencyData,
    mediaRef,
  };
}
