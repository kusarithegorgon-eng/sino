import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  Upload,
  Download,
  Video,
  Share2,
  Sparkles,
  ChevronDown,
  Activity,
  Music2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visual Sync — Shareable Music Card Maker" },
      {
        name: "description",
        content:
          "Design audio-reactive visuals synced to your music. Real-time WebGL renders, exportable as GIF or MP4.",
      },
      { property: "og:title", content: "Visual Sync — Shareable Music Card Maker" },
      {
        property: "og:description",
        content:
          "Design audio-reactive visuals synced to your music. Real-time WebGL renders, exportable as GIF or MP4.",
      },
    ],
  }),
  component: Index,
});

const STYLES = [
  "The Nebula (Active)",
  "Pulsing City",
  "Fluid Ocean",
  "Quantum Burst",
] as const;

const PALETTES = [
  { name: "Neon Teal", colors: ["#0CF6E0", "#066F65"] },
  { name: "Cyber Pink", colors: ["#FF3DAA", "#7A0E4A"] },
  { name: "Electric Blue", colors: ["#3DA8FF", "#10406E"] },
  { name: "Acid Lime", colors: ["#C9FF3D", "#3F5A0E"] },
];

const PRESETS = [
  { name: "The Nebula", gradient: "radial-gradient(circle at 30% 30%, #0CF6E0 0%, #1a1a4a 45%, #050510 100%)" },
  { name: "Pulsing City", gradient: "linear-gradient(180deg, #ff3dff 0%, #1a0b3a 60%, #050015 100%)" },
  { name: "Fluid Ocean", gradient: "linear-gradient(160deg, #3dffd6 0%, #0a3a6e 60%, #020a1f 100%)" },
  { name: "Quantum Burst", gradient: "conic-gradient(from 210deg at 50% 50%, #c9ff3d, #ff3daa, #3da8ff, #c9ff3d)" },
];

const TECH = ["Web Audio API", "WebGL/Three.js", "TypeScript", "React Flow"];

function Index() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [style, setStyle] = useState<string>(STYLES[0]);
  const [bass, setBass] = useState([72]);
  const [treble, setTreble] = useState([54]);
  const [energy, setEnergy] = useState([83]);
  const [palette, setPalette] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Lightweight aesthetic canvas animation (no Three.js dep needed)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * devicePixelRatio;
      canvas.height = r.height * devicePixelRatio;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const accent = PALETTES[palette].colors[0];
    const deep = PALETTES[palette].colors[1];

    const start = performance.now();
    const render = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const grd = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) / 1.2);
      grd.addColorStop(0, deep);
      grd.addColorStop(1, "#04060a");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      const rings = 80;
      const bassF = bass[0] / 100;
      const trebF = treble[0] / 100;
      const eF = energy[0] / 100;
      for (let i = 0; i < rings; i++) {
        const p = i / rings;
        const radius =
          (Math.min(w, h) / 2.4) *
          (0.2 + p * 0.8 + Math.sin(t * (1 + trebF * 3) + i * 0.4) * 0.04 * eF);
        ctx.beginPath();
        ctx.arc(
          w / 2 + Math.sin(t * 0.6 + i * 0.2) * 30 * bassF,
          h / 2 + Math.cos(t * 0.5 + i * 0.15) * 30 * bassF,
          radius,
          0,
          Math.PI * 2,
        );
        ctx.strokeStyle = accent + Math.floor(40 + p * 120).toString(16).padStart(2, "0");
        ctx.lineWidth = 1 * devicePixelRatio;
        ctx.stroke();
      }

      // particle burst
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 + t * 0.3;
        const r = (Math.min(w, h) / 3) * (0.6 + Math.sin(t * 2 + i) * 0.3 * eF);
        ctx.beginPath();
        ctx.arc(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2 * devicePixelRatio, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [bass, treble, energy, palette, style]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_340px] gap-4 p-4">
        {/* LEFT */}
        <aside className="rounded-2xl border border-border bg-[var(--panel)] p-5 flex flex-col gap-6 overflow-auto">
          <header className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-neon/15 text-neon">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold tracking-tight">Design Studio</h1>
              <p className="text-xs text-muted-foreground">Visual Sync v1.0</p>
            </div>
          </header>

          <Section title="1. Upload Your Audio">
            <label className="block cursor-pointer rounded-xl border border-dashed border-border bg-[var(--panel-deep)] p-5 text-center hover:border-neon/60 transition-colors">
              <input
                type="file"
                accept="audio/mpeg,audio/mp3"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              <Upload className="mx-auto h-6 w-6 text-neon" />
              <p className="mt-2 text-sm font-medium">Drop MP3 here</p>
              <p className="mt-1 text-xs text-muted-foreground truncate">
                {fileName ?? "midnight_drive_master_v3.mp3"}
              </p>
            </label>
          </Section>

          <Section title="2. Select Visualization Style">
            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="w-full bg-[var(--panel-deep)] border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          <Section title="3. Fine-tune Parameters">
            <SliderRow label="Bass Intensity" value={bass} onChange={setBass} />
            <SliderRow label="Treble Sensitivity" value={treble} onChange={setTreble} />
            <SliderRow label="Overall Energy" value={energy} onChange={setEnergy} />
          </Section>

          <Section title="Palette">
            <div className="flex gap-2">
              {PALETTES.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => setPalette(i)}
                  title={p.name}
                  className={`h-11 w-11 rounded-md border-2 transition-all ${
                    palette === i
                      ? "border-neon shadow-[var(--shadow-neon)] scale-105"
                      : "border-border hover:border-neon/50"
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${p.colors[0]} 0%, ${p.colors[1]} 100%)`,
                  }}
                />
              ))}
            </div>
          </Section>

          <Section title="Curated Styles">
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setStyle(p.name === "The Nebula" ? STYLES[0] : p.name)}
                  className="group rounded-lg border border-border overflow-hidden hover:border-neon/60 transition-colors text-left"
                >
                  <div className="aspect-video w-full" style={{ background: p.gradient }} />
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{p.name}</p>
                  </div>
                </button>
              ))}
            </div>
          </Section>
        </aside>

        {/* CENTER */}
        <main className="flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Music2 className="h-4 w-4 text-neon" />
              <span className="truncate">{fileName ?? "midnight_drive_master_v3.mp3"}</span>
            </div>
            <span className="text-xs text-muted-foreground">{style}</span>
          </div>

          <div className="relative flex-1 rounded-2xl border border-border bg-black overflow-hidden shadow-[0_0_60px_-20px_var(--neon)]">
            <canvas ref={canvasRef} className="block h-full w-full" />
            <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-neon/40 bg-black/60 px-3 py-1.5 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-neon shadow-[0_0_8px_var(--neon)]" />
              <span className="text-xs font-medium text-neon">60 FPS (Stable)</span>
            </div>
          </div>
        </main>

        {/* RIGHT */}
        <aside className="rounded-2xl border border-border bg-[var(--panel)] p-5 flex flex-col gap-6 overflow-auto">
          <header>
            <h2 className="text-base font-semibold tracking-tight">Export & Share</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Render at studio quality, ready for any feed.
            </p>
          </header>

          <div className="flex flex-col gap-3">
            <Button variant="secondary" className="w-full justify-start h-11 bg-[var(--panel-deep)] hover:bg-secondary border border-border">
              <Download className="h-4 w-4" />
              Download High-Res GIF
            </Button>

            <button className="group relative w-full h-14 rounded-lg bg-neon text-primary-foreground font-semibold text-sm shadow-[var(--shadow-neon)] hover:brightness-110 transition-all inline-flex items-center justify-center gap-2 cursor-pointer">
              <Video className="h-5 w-5" />
              Export as MP4 (Synced)
            </button>

            <Button variant="outline" className="w-full justify-start h-11 bg-transparent border-border hover:bg-[var(--panel-deep)]">
              <Share2 className="h-4 w-4" />
              Post directly to TikTok/Instagram
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-[var(--panel-deep)] p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-neon" />
              Render Performance
            </div>
            <p className="mt-2 text-sm font-medium">
              <span className="text-neon">60 FPS</span> (Stable)
              <span className="text-muted-foreground"> · 4K Ready</span>
            </p>
            <div className="mt-3 h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full w-[92%] bg-neon shadow-[0_0_8px_var(--neon)]" />
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
              Powered by
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TECH.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-[var(--panel-deep)] px-2.5 py-1 text-[11px] text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (v: number[]) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-foreground/80">{label}</span>
        <span className="text-xs font-mono text-neon">{value[0]}</span>
      </div>
      <Slider value={value} onValueChange={onChange} max={100} step={1} />
    </div>
  );
}
