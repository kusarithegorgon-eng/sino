import React, { useEffect, useRef, useState } from "react";
import "../styles/BeatCanvas.css";

type BeatCanvasProps = {
  audioRef?: React.RefObject<HTMLAudioElement>;
  width?: number | "auto";
  height?: number | "auto";
  barCount?: number;
  sensitivity?: number; // 0.5..2
  showWaveform?: boolean;
  particleIntensity?: number; // 0..1
  palette?: string[]; // array of CSS colors
  className?: string;
  visualMode?: "nebula" | "bars" | "ring";
  containerRef?: React.RefObject<HTMLDivElement>;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
};

export default function BeatCanvas({
  audioRef,
  width = "auto",
  height = 200,
  barCount = 64,
  sensitivity = 1.0,
  showWaveform = true,
  particleIntensity = 0.6,
  palette = [
    "#FF5C7F",
    "#FFD36E",
    "#7DE2FF",
    "#7FFFAD",
    "#C57BFF",
    "#FF9FD6",
  ],
  className,
  visualMode = "nebula",
  containerRef,
}: BeatCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const waveformArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastBeatRef = useRef<number>(0);
  const [isRunning, setIsRunning] = useState(false);

  // adaptive performance
  const deviceIsMobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Setup audio context and analyser when audioRef becomes available or on user interaction
  useEffect(() => {
    if (!audioRef?.current) return;

    let audio = audioRef.current;
    const startAudio = async () => {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const audioCtx = audioCtxRef.current!;
      if (!sourceRef.current) {
        try {
          sourceRef.current = audioCtx.createMediaElementSource(audio);
        } catch (e) {
          // cross-origin or already connected
        }
      }
      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 2048;
      }
      try {
        sourceRef.current && sourceRef.current.connect(analyserRef.current as AnalyserNode);
        analyserRef.current.connect(audioCtx.destination);
      } catch (e) {
        // ignoring double connect errors
      }

      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      waveformArrayRef.current = new Uint8Array(bufferLength);
      setIsRunning(true);
    };

    if (audio.readyState >= 2 || !audio.paused) {
      startAudio().catch(() => {});
    } else {
      const handler = () => {
        startAudio().catch(() => {});
        audio.removeEventListener("play", handler);
      };
      audio.addEventListener("play", handler);
    }

    return () => {
      // leave audio context running
    };
  }, [audioRef]);

  // Canvas resize and DPR handling with adaptive downscale
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const resize = () => {
      const parent = (containerRef && containerRef.current) || canvas.parentElement;
      let w =
        width === "auto"
          ? (parent?.clientWidth ?? 600)
          : (width as number | undefined) ?? parent?.clientWidth ?? 600;
      let h =
        height === "auto"
          ? (parent?.clientHeight ?? 200)
          : (height as number | undefined);

      // adaptive downscale for performance on mobile / high DPR
      let effectiveDpr = dpr;
      if (deviceIsMobile) effectiveDpr = Math.min(effectiveDpr, 1);
      if (w < 600) effectiveDpr *= 0.9; // slight downscaling

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.floor(w * effectiveDpr));
      canvas.height = Math.max(1, Math.floor(h * effectiveDpr));
      ctx.setTransform(effectiveDpr, 0, 0, effectiveDpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [width, height, containerRef]);

  // Pause rendering when hidden
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      } else {
        // resume
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(drawLoop);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // main draw loop function needs to be defined before used in visibility effect
  const drawLoop = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const analyser = analyserRef.current;
    if (!analyser) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawIdleBackground(ctx, canvas, palette);
      return;
    }

    const freqData = dataArrayRef.current!;
    const waveData = waveformArrayRef.current!;
    const bufferLength = analyser.frequencyBinCount;

    const getAvg = (arr: Uint8Array, start = 0, end = arr.length) => {
      let s = 0;
      for (let i = start; i < end; i++) s += arr[i];
      return s / (end - start || 1);
    };

    const spawnParticles = (count: number, x: number, y: number) => {
      const pArr = particlesRef.current;
      const cap = deviceIsMobile ? 300 : 900;
      for (let i = 0; i < count; i++) {
        if (pArr.length > cap) break;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        const size = Math.random() * 3 + 2;
        const life = Math.random() * 40 + 40;
        const color = palette[Math.floor(Math.random() * palette.length)];
        pArr.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size,
          life,
          maxLife: life,
          color,
        });
      }
    };

    const draw = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(freqData);
      analyserRef.current.getByteTimeDomainData(waveData);

      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      ctx.fillStyle = "rgba(6,6,12,0.18)";
      ctx.fillRect(0, 0, w, h);

      // subtle animated gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, mixColors(palette[0], palette[1], Math.sin(Date.now() / 6000) * 0.5 + 0.5));
      grad.addColorStop(1, mixColors(palette[2], palette[3], 0.4));
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      const bass = getAvg(freqData, 0, Math.floor(bufferLength * 0.08));
      const mid = getAvg(freqData, Math.floor(bufferLength * 0.08), Math.floor(bufferLength * 0.5));

      if (visualMode === "bars" || visualMode === "nebula") {
        const barW = w / barCount;
        for (let i = 0; i < barCount; i++) {
          const index = Math.floor((i / barCount) * bufferLength);
          const value = freqData[index] / 255; // 0..1
          const barH = Math.max(2, value * h * 0.9 * sensitivity);
          const x = i * barW + barW * 0.15;
          const y = h - barH;

          const cA = palette[i % palette.length];
          const cB = palette[(i + 2) % palette.length];
          const col = mixColors(cA, cB, value);
          ctx.fillStyle = col;
          ctx.save();
          ctx.shadowColor = col;
          ctx.shadowBlur = 12 * (0.5 + value);
          ctx.fillRect(x, y, barW * 0.7, barH);
          ctx.restore();
        }
      }

      // ring mode: FFT ring around center
      if (visualMode === "ring") {
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) * 0.28;
        const rings = 120;
        ctx.save();
        ctx.translate(cx, cy);
        for (let i = 0; i < rings; i++) {
          const angle = (i / rings) * Math.PI * 2;
          const idx = Math.floor((i / rings) * bufferLength);
          const mag = (freqData[idx] / 255) * 1.8;
          const x1 = Math.cos(angle) * radius;
          const y1 = Math.sin(angle) * radius;
          const x2 = Math.cos(angle) * (radius + mag * 80);
          const y2 = Math.sin(angle) * (radius + mag * 80);
          const col = mixColors(palette[i % palette.length], palette[(i + 2) % palette.length], mag);
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(1, mag * 3);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.restore();
      }

      // waveform overlay
      if (showWaveform) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        const slice = w / bufferLength;
        for (let i = 0; i < bufferLength; i++) {
          const v = waveData[i] / 128.0; // approx -1..1
          const yv = (v * h) / 2;
          const x = i * slice;
          if (i === 0) ctx.moveTo(x, h / 2 + yv);
          else ctx.lineTo(x, h / 2 + yv);
        }
        ctx.stroke();
      }

      // center halo pulse
      const centerX = w * 0.5;
      const centerY = h * 0.5;
      const pulse = Math.min(1, mid / 150) * (1 + Math.sin(Date.now() / 250) * 0.1);
      const radius = 30 + pulse * 140;
      const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      halo.addColorStop(0, hexToRgba(palette[1], 0.28));
      halo.addColorStop(0.6, hexToRgba(palette[3], 0.06));
      halo.addColorStop(1, hexToRgba("#000000", 0.0));
      ctx.fillStyle = halo;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      ctx.globalCompositeOperation = "source-over";

      const now = performance.now();
      const bassThreshold = 160 * (0.95 / sensitivity);
      if (bass > bassThreshold && now - lastBeatRef.current > 120) {
        lastBeatRef.current = now;
        const spawnCount = Math.floor(4 + particleIntensity * 28);
        for (let i = 0; i < spawnCount; i++) {
          const tx = centerX + (Math.random() - 0.5) * 200;
          const ty = centerY + (Math.random() - 0.5) * 120;
          spawnParticles(1, tx, ty);
        }
      }

      // particles
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.vy += 0.03;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
        const lifePct = p.life / p.maxLife;
        ctx.beginPath();
        ctx.fillStyle = hexToRgba(p.color, Math.max(0.05, lifePct));
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowBlur = 8 * lifePct;
        ctx.shadowColor = p.color;
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * lifePct), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = "source-over";
        if (p.life <= 0) parts.splice(i, 1);
      }

      drawOverlay(ctx, w, h, palette);
      rafRef.current = requestAnimationFrame(draw);
    };

    // Start loop
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(draw);
  };

  // mount/unmount loop
  useEffect(() => {
    drawLoop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, barCount, sensitivity, showWaveform, particleIntensity, palette, visualMode]);

  // cleanup
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        // don't close to avoid recreating repeatedly
      }
    };
  }, []);

  return (
    <div className={`beat-canvas-root ${className ?? ""}`} ref={containerRef}>
      <canvas ref={canvasRef} className="beat-canvas-element" />
      <div className="beat-canvas-ghost">
        <div className="beat-canvas-title">Beat Canvas</div>
        <div className="beat-canvas-hint">Visuals synced to audio</div>
      </div>
    </div>
  );
}

/* ---------- Utility drawing helpers ---------- */

function drawIdleBackground(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  palette: string[]
) {
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, hexToRgba(palette[0], 0.12));
  grad.addColorStop(1, hexToRgba(palette[2], 0.06));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const halo = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h));
  halo.addColorStop(0, hexToRgba(palette[1], 0.12));
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: string[]
) {
  ctx.save();
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 4, w / 2, h / 2, Math.max(w, h));
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = palette[5] ?? "#fff";
  ctx.lineWidth = 1;
  for (let i = -w; i < w * 2; i += 60) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i - 0.45 * w, h);
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- Color helpers ---------- */

function mixColors(a: string, b: string, t: number) {
  const ca = parseRgb(a);
  const cb = parseRgb(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function parseRgb(color: string) {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = color;
  const computed = ctx.fillStyle;
  const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  }
  let hex = computed.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return { r, g, b };
}

function hexToRgba(hex: string, a: number) {
  const c = parseRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}
