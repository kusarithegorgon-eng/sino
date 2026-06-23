import React, { useRef, useState, useEffect } from "react";
import BeatCanvas from "./BeatCanvas";

const PRESETS: { name: string; palette: string[] }[] = [
  { name: "Oceanic", palette: ["#0FB9B1", "#44C2FF", "#2D6AFC", "#7FFFD4", "#005F73"] },
  { name: "Neon", palette: ["#0FFFB8", "#6BFFCA", "#7DE2FF", "#FFD36E", "#FF2D95"] },
  { name: "Aurora", palette: ["#7DE2FF", "#7FFFAD", "#C57BFF", "#FF9FD6", "#FFD36E"] },
  { name: "Dark", palette: ["#0b0f0d", "#07211a", "#05323a", "#022225", "#00303b"] },
];

export default function Player() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [particleIntensity, setParticleIntensity] = useState(0.7);
  const [barCount, setBarCount] = useState(64);
  const [presetIdx, setPresetIdx] = useState(0);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [visualMode, setVisualMode] = useState<"nebula" | "bars" | "ring">("nebula");
  const demoUrlRef = useRef<string | null>(null);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ignore if typing
      const tag = (document.activeElement && (document.activeElement as HTMLElement).tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!audioRef.current) return;
        if (audioRef.current.paused) audioRef.current.play().catch(() => {});
        else audioRef.current.pause();
      }
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      try {
        await el.requestFullscreen();
      } catch (e) {
        // ignore
      }
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioRef.current) return;
    const url = URL.createObjectURL(file);
    audioRef.current.src = url;
    audioRef.current.loop = false;
    audioRef.current.play().catch(() => {});
    setIsDemoPlaying(false);
  };

  const makeSineWavDataURI = (frequency = 440, durationSec = 4, volume = 0.6) => {
    const sampleRate = 44100;
    const samples = Math.floor(sampleRate * durationSec);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const writeString = (v: DataView, o: number, s: string) => { for (let i=0;i<s.length;i++) v.setUint8(o+i, s.charCodeAt(i)); };
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples * 2, true);
    writeString(view, 8, "WAVE");
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, "data");
    view.setUint32(40, samples * 2, true);
    let offset = 44;
    for (let i = 0; i < samples; i++) {
      const t = i / sampleRate;
      const v = Math.sin(2 * Math.PI * frequency * t) * volume;
      const s = Math.max(-1, Math.min(1, v));
      view.setInt16(offset, s * 0x7fff, true);
      offset += 2;
    }
    const blob = new Blob([view], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  };

  const playDemo = () => {
    if (!audioRef.current) return;
    if (isDemoPlaying) {
      audioRef.current.pause();
      if (demoUrlRef.current) {
        URL.revokeObjectURL(demoUrlRef.current);
        demoUrlRef.current = null;
      }
      setIsDemoPlaying(false);
      return;
    }
    const freq = [110, 220, 330, 440][Math.floor(Math.random() * 4)];
    const url = makeSineWavDataURI(freq, 10, 0.6);
    demoUrlRef.current = url;
    audioRef.current.src = url;
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {});
    setIsDemoPlaying(true);
  };

  // cleanup demo blob on unmount
  useEffect(() => () => { if (demoUrlRef.current) { URL.revokeObjectURL(demoUrlRef.current); demoUrlRef.current = null; } }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input type="file" accept="audio/*,video/*" onChange={handleUpload} />
          <span style={{ fontSize: 13 }}>Upload audio/video</span>
        </label>
        <button onClick={() => audioRef.current?.play()}>Play</button>
        <button onClick={() => audioRef.current?.pause()}>Pause</button>
        <button onClick={playDemo}>{isDemoPlaying ? "Stop demo" : "Play demo"}</button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13 }}>Preset:</label>
          <select value={presetIdx} onChange={(e) => setPresetIdx(Number(e.target.value))}>
            {PRESETS.map((p, i) => (
              <option key={p.name} value={i}>{p.name}</option>
            ))}
          </select>

          <label style={{ fontSize: 13 }}>Mode:</label>
          <select value={visualMode} onChange={(e) => setVisualMode(e.target.value as any)}>
            <option value="nebula">Nebula</option>
            <option value="bars">Bars</option>
            <option value="ring">FFT Ring</option>
          </select>

          <button onClick={() => toggleFullscreen()}>Fullscreen (F)</button>
        </div>
      </div>

      <div ref={containerRef}>
        <BeatCanvas
          audioRef={audioRef}
          height={480}
          particleIntensity={particleIntensity}
          sensitivity={sensitivity}
          barCount={barCount}
          palette={PRESETS[presetIdx].palette}
          visualMode={visualMode}
          containerRef={containerRef}
        />
      </div>

      <audio ref={audioRef} controls style={{ width: "100%", marginTop: 12 }} />

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 220 }}>
          <label style={{ display: "block", fontSize: 13 }}>Bass / overall sensitivity</label>
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.05}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ minWidth: 220 }}>
          <label style={{ display: "block", fontSize: 13 }}>Particle intensity</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={particleIntensity}
            onChange={(e) => setParticleIntensity(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 13 }}>Bars</label>
          <input
            type="range"
            min={16}
            max={256}
            step={1}
            value={barCount}
            onChange={(e) => setBarCount(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#bfc9c6" }}>
        Tips: Space toggles Play/Pause, F toggles Fullscreen. Use the Preset and Mode menus to explore Neon/Dark/FFT Ring visuals.
      </div>
    </div>
  );
}
