import React, { useEffect, useRef, useState } from "react";
import "./../styles/BeatCanvas.css";

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

  // Setup audio context and analyser when audioRef becomes available or on user interaction
  useEffect(() => {
    if (!audioRef?.current) return;

    let audio = audioRef.current;
    // create AudioContext on user gesture if not created (Chrome autoplay policy)
    const startAudio = async () => {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AC();
      }
      const audioCtx = audioCtxRef.current!;
      if (!sourceRef.current) {
        sourceRef.current = audioCtx.createMediaElementSource(audio);
      }
      if (!analyserRef.current) {
        analyserRef.current = audioCtx.createAnalyser();
        analyserRef.current.fftSize = 2048;
      }
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioCtx.destination);

      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      waveformArrayRef.current = new Uint8Array(bufferLength);
      setIsRunning(true);
    };

    // If audio is already allowed to play, start, otherwise listen to first play
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
      // leave audio context running — not closing to avoid re-creating frequently
    };
  }, [audioRef]);

  // Canvas resize and DPR handling
  useEffect(() => {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const resize = () => {
      const parent = canvas.parentElement;
      const dpr = window.devicePixelRatio || 1;
      const w =
        width === "auto"
          ? (parent?.clientWidth ?? 600)
          : (width as number | undefined) ?? parent?.clientWidth ?? 600;
      const h =
        height === "auto"
          ? (parent?.clientHeight ?? 200)
          : (height as number | undefined);

      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // normalize drawing to CSS pixels
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [width, height]);

  // Main draw loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const analyser = analyserRef.current;
    if (!analyser) {
      // clear canvas with nice background until audio starts
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawIdleBackground(ctx, canvas, palette);
      return;
    }

    const freqData = dataArrayRef.current!;
    const waveData = waveformArrayRef.current!;
    const bufferLength = analyser.frequencyBinCount;

    // helpers
    const getAvg = (arr: Uint8Array, start = 0, end = arr.length) => {
      let s = 0;
      for (let i = start; i < end; i++) s += arr[i];
      return s / (end - start || 1);
    };

    const spawnParticles = (count: number, x: number, y: number) => {
      const pArr = particlesRef.current;
      for (let i = 0; i < count; i++) {
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
      // cap total
      if (pArr.length > 1000) {
        pArr.splice(0, pArr.length - 800);
      }
    };

    const draw = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(freqData);
      analyserRef.current.getByteTimeDomainData(waveData);

      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);

      // subtle background fade (gives motion trail)
      ctx.fillStyle = "rgba(6,6,12,0.25)";
      ctx.fillRect(0, 0, w, h);

      // nice radial gradient background
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(
        0,
        mixColors(
          palette[0],
          palette[1],
          Math.sin(Date.now() / 5000) * 0.5 + 0.5
        )
      );
      grad.addColorStop(1, mixColors(palette[2], palette[3], 0.4));
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      // compute bass energy for beat detection
      const bass = getAvg(freqData, 0, Math.floor(bufferLength * 0.08));
      const mid = getAvg(
        freqData,
        Math.floor(bufferLength * 0.08),
        Math.floor(bufferLength * 0.5)
      );

      // draw bars
      const barW = w / barCount;
      for (let i = 0; i < barCount; i++) {
        const index = Math.floor((i / barCount) * bufferLength);
        const value = freqData[index] / 255; // 0..1
        const barH = Math.max(2, value * h * 0.9 * sensitivity);
        const x = i * barW + barW * 0.15;
        const y = h - barH;

        // color cycling
        const cA = palette[i % palette.length];
        const cB = palette[(i + 2) % palette.length];
        const col = mixColors(cA, cB, value);
        // glow effect
        ctx.fillStyle = col;
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = 12 * (0.5 + value);
        ctx.fillRect(x, y, barW * 0.7, barH);
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
          if (i === 0) ctx.moveTo(x, y / 2 + yv);
          else ctx.lineTo(x, y / 2 + yv);
        }
        ctx.stroke();
      }

      // star-like center halo pulse based on mid energy
      const centerX = w * 0.5;
      const centerY = h * 0.5;
      const pulse = Math.min(1, mid / 150) * (1 + Math.sin(Date.now() / 250) * 0.1);
      ctx.beginPath();
      const radius = 30 + pulse * 140;
      const halo = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      halo.addColorStop(0, hexToRgba(palette[1], 0.28));
      halo.addColorStop(0.6, hexToRgba(palette[3], 0.06));
      halo.addColorStop(1, hexToRgba("#000000", 0.0));
      ctx.fillStyle = halo;
      ctx.globalCompositeOperation = "lighter";
      ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
      ctx.globalCompositeOperation = "source-over";

      // beat detection: if bass spikes, spawn particles
      const now = performance.now();
      const bassThreshold = 160 * (0.9 / sensitivity); // tweak
      if (bass > bassThreshold && now - lastBeatRef.current > 120) {
        lastBeatRef.current = now;
        const spawnCount = Math.floor(6 + particleIntensity * 30);
        // spawn around center with random offset
        for (let i = 0; i < spawnCount; i++) {
          const tx = centerX + (Math.random() - 0.5) * 200;
          const ty = centerY + (Math.random() - 0.5) * 120;
          spawnParticles(1, tx, ty);
        }
      }

      // update and draw particles
      const parts = particlesRef.current;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        // physics
        p.vx *= 0.99;
        p.vy *= 0.99;
        p.vy += 0.03; // gravity
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

      // subtle vignette and overlay lines
      drawOverlay(ctx, w, h, palette);

      rafRef.current = requestAnimationFrame(draw);
    };

    // Start loop
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    isRunning,
    barCount,
    sensitivity,
    showWaveform,
    particleIntensity,
    palette,
  ]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) {
        // do NOT close audioCtx to keep playback stable across remounts; let GC handle it
      }
    };
  }, []);

  return (
    <div className={`beat-canvas-root ${className ?? ""}`}>
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
  // faint centre glow
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
  // soft vignette
  ctx.save();
  const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 4, w / 2, h / 2, Math.max(w, h));
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // diagonal streaks
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
  // naive hex/RGB parse for typical #RRGGBB or CSS color fallback via canvas
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
  const computed = ctx.fillStyle; // standardized rgb(...) or #rrggbb
  // handle rgb(a)
  const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  }
  // hex fallback
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
