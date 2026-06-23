import React, { useRef, useState } from "react";
import BeatCanvas from "./BeatCanvas";
import "../styles/BeatCanvas.css";

const DEMO_FREQS = [110, 220, 440, 880];
const PRESETS: { name: string; palette: string[] }[] = [
  { name: "Oceanic", palette: ["#0FB9B1", "#44C2FF", "#2D6AFC", "#7FFFD4", "#005F73"] },
  { name: "Neon", palette: ["#FF2D95", "#6BFFCA", "#7DE2FF", "#FFD36E", "#C57BFF"] },
  { name: "Aurora", palette: ["#7DE2FF", "#7FFFAD", "#C57BFF", "#FF9FD6", "#FFD36E"] },
];

function makeSineWavDataURI(frequency = 440, durationSec = 4, volume = 0.6) {
  // generate 16-bit PCM WAV in memory and return a blob URL
  const sampleRate = 44100;
  const samples = Math.floor(sampleRate * durationSec);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  /* RIFF identifier */ writeString(view, 0, "RIFF");
  /* file length */ view.setUint32(4, 36 + samples * 2, true);
  /* RIFF type */ writeString(view, 8, "WAVE");
  /* format chunk identifier */ writeString(view, 12, "fmt ");
  /* format chunk length */ view.setUint32(16, 16, true);
  /* sample format (raw) */ view.setUint16(20, 1, true);
  /* channel count */ view.setUint16(22, 1, true);
  /* sample rate */ view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * blockAlign) */ view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytesPerSample) */ view.setUint16(32, 2, true);
  /* bits per sample */ view.setUint16(34, 16, true);
  /* data chunk identifier */ writeString(view, 36, "data");
  /* data chunk length */ view.setUint32(40, samples * 2, true);

  // write samples
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
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export default function Player() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [particleIntensity, setParticleIntensity] = useState(0.7);
  const [barCount, setBarCount] = useState(64);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const demoUrlRef = useRef<string | null>(null);

  const palette = PRESETS[paletteIdx].palette;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioRef.current) return;
    const url = URL.createObjectURL(file);
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
  };

  const playDemo = () => {
    if (!audioRef.current) return;
    // if already demo, stop
    if (isDemoPlaying) {
      audioRef.current.pause();
      if (demoUrlRef.current) {
        URL.revokeObjectURL(demoUrlRef.current);
        demoUrlRef.current = null;
      }
      setIsDemoPlaying(false);
      return;
    }
    const freq = DEMO_FREQS[Math.floor(Math.random() * DEMO_FREQS.length)];
    const url = makeSineWavDataURI(freq, 8, 0.6);
    demoUrlRef.current = url;
    audioRef.current.src = url;
    audioRef.current.loop = true;
    audioRef.current.play().catch(() => {});
    setIsDemoPlaying(true);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
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
          <select value={paletteIdx} onChange={(e) => setPaletteIdx(Number(e.target.value))}>
            {PRESETS.map((p, i) => (
              <option key={p.name} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <BeatCanvas
        audioRef={audioRef}
        height={420}
        particleIntensity={particleIntensity}
        sensitivity={sensitivity}
        barCount={barCount}
        palette={palette}
      />

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
        Tip: Click Play on the audio controls (or use the Play demo button) to start the AudioContext.
      </div>
    </div>
  );
}
