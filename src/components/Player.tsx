import React, { useRef } from "react";
import BeatCanvas from "./components/BeatCanvas";

export default function Player() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <BeatCanvas audioRef={audioRef} height={420} particleIntensity={0.8} />
      <audio
        ref={audioRef}
        src="/audio/your-track.mp3"
        controls
        style={{ width: "100%", marginTop: 12 }}
      />
    </div>
  );
}
