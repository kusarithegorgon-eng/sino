import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface VisualCanvasProps {
  frequencyData: Uint8Array;
  bassIntensity: number;
}

const VisualCanvas: React.FC<VisualCanvasProps> = ({ frequencyData, bassIntensity }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const frameIdRef = useRef<number | null>(null);
  const freqRef = useRef<Uint8Array>(frequencyData);
  const bassRef = useRef<number>(bassIntensity);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    freqRef.current = frequencyData;
  }, [frequencyData]);

  useEffect(() => {
    bassRef.current = bassIntensity;
  }, [bassIntensity]);

  useEffect(() => {
    const container = containerRef.current;
    const flashEl = flashRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight || 300);
    renderer.setClearColor(0x020814, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      1000
    );
    camera.position.set(0, 0, 4.2);

    // ─── LIGHTS ───────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0a1a2e, 1.0);
    const coreLight = new THREE.PointLight(0x00f7ff, 4.0, 25);
    coreLight.position.set(0, 0, 2);
    const leftLight = new THREE.PointLight(0xff00ff, 2.0, 18);
    leftLight.position.set(-3, 1, 2);
    const rightLight = new THREE.PointLight(0x00ff88, 1.5, 18);
    rightLight.position.set(3, -1, 2);
    const rimLight = new THREE.PointLight(0x4400ff, 1.2, 15);
    rimLight.position.set(0, 2, -3);
    scene.add(ambientLight, coreLight, leftLight, rightLight, rimLight);

    // ─── STAR FIELD ───────────────────────────────────────────────
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      // Distribute on a large sphere shell
      const r = 12 + Math.random() * 8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
      starSizes[i] = 0.5 + Math.random() * 1.5;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    starGeo.setAttribute("size", new THREE.BufferAttribute(starSizes, 1));

    // Use a simple circle texture for stars
    const starCanvas = document.createElement("canvas");
    starCanvas.width = 32; starCanvas.height = 32;
    const sc = starCanvas.getContext("2d")!;
    const sg = sc.createRadialGradient(16, 16, 0, 16, 16, 16);
    sg.addColorStop(0, "rgba(255,255,255,1)");
    sg.addColorStop(0.3, "rgba(180,220,255,0.8)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    sc.fillStyle = sg;
    sc.fillRect(0, 0, 32, 32);
    const starTex = new THREE.CanvasTexture(starCanvas);

    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      map: starTex,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      alphaTest: 0.01,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ─── MAIN SPHERE (deformable) ──────────────────────────────────
    const sphereDetail = 5;
    const mainSphereGeometry = new THREE.IcosahedronGeometry(0.85, sphereDetail);
    // Store original positions for deformation
    const origPositions = mainSphereGeometry.attributes.position.array.slice() as Float32Array;
    const vertCount = mainSphereGeometry.attributes.position.count;

    const mainSphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x00c8ff,
      emissive: 0x003366,
      emissiveIntensity: 1.2,
      metalness: 0.3,
      roughness: 0.05,
      transparent: true,
      opacity: 0.82,
    });
    const mainSphere = new THREE.Mesh(mainSphereGeometry, mainSphereMaterial);
    scene.add(mainSphere);

    // ─── WIREFRAME SHELL ──────────────────────────────────────────
    const wireframeGeometry = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.92, 4));
    const wireframeMaterial = new THREE.LineBasicMaterial({
      color: 0x00ffe0,
      transparent: true,
      opacity: 0.55,
    });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);

    // ─── FREQUENCY BAR RING ───────────────────────────────────────
    const BAR_COUNT = 128;
    const barMeshes: THREE.Mesh[] = [];
    const barRingRadius = 1.5;

    for (let i = 0; i < BAR_COUNT; i++) {
      const angle = (i / BAR_COUNT) * Math.PI * 2;
      const geo = new THREE.CylinderGeometry(0.012, 0.018, 1, 4);
      // Shift geometry so it grows outward from the base
      geo.translate(0, 0.5, 0);

      // Gradient color: cyan on low freqs → magenta → yellow on highs
      const t = i / BAR_COUNT;
      const color = new THREE.Color();
      if (t < 0.33) color.setHSL(0.5 + t * 0.2, 1.0, 0.55);        // cyan → blue
      else if (t < 0.66) color.setHSL(0.7 + (t - 0.33) * 0.6, 1.0, 0.55); // blue → magenta
      else color.setHSL(0.0 + (t - 0.66) * 0.5, 1.0, 0.55);         // magenta → red/yellow

      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.8,
        metalness: 0.6,
        roughness: 0.2,
      });
      const bar = new THREE.Mesh(geo, mat);

      bar.position.x = Math.cos(angle) * barRingRadius;
      bar.position.z = Math.sin(angle) * barRingRadius;
      bar.rotation.z = -Math.PI / 2; // point radially outward
      bar.rotation.y = -angle;

      barMeshes.push(bar);
      scene.add(bar);
    }

    // ─── RINGS ────────────────────────────────────────────────────
    const createRing = (radius: number, color: number, opacity: number, tube = 0.014) => {
      const geo = new THREE.TorusGeometry(radius, tube, 16, 160);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.9,
        transparent: true,
        opacity,
        metalness: 0.9,
        roughness: 0.1,
      });
      return new THREE.Mesh(geo, mat);
    };

    const ring1 = createRing(1.15, 0x00ffe0, 0.7);
    ring1.rotation.x = Math.PI / 2;
    scene.add(ring1);

    const ring2 = createRing(1.5, 0xff00ff, 0.5, 0.01);
    ring2.rotation.z = Math.PI / 3.5;
    scene.add(ring2);

    const ring3 = createRing(1.85, 0x00ff88, 0.4, 0.008);
    ring3.rotation.y = Math.PI / 2.2;
    scene.add(ring3);

    // Thin fast outer ring
    const ring4 = createRing(2.3, 0xff6600, 0.3, 0.006);
    ring4.rotation.x = Math.PI / 5;
    scene.add(ring4);

    // ─── CORE GLOW (billboard plane) ─────────────────────────────
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = 128; glowCanvas.height = 128;
    const gc = glowCanvas.getContext("2d")!;
    const gg = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, "rgba(0,247,255,0.9)");
    gg.addColorStop(0.3, "rgba(0,100,255,0.5)");
    gg.addColorStop(1, "rgba(0,0,0,0)");
    gc.fillStyle = gg;
    gc.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const glowPlaneGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const glowPlaneMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowPlane = new THREE.Mesh(glowPlaneGeo, glowPlaneMat);
    scene.add(glowPlane);

    // ─── PARTICLES ────────────────────────────────────────────────
    const particleCount = 600;
    const pPositions = new Float32Array(particleCount * 3);
    const pVelocities = new Float32Array(particleCount * 3);
    const pLife = new Float32Array(particleCount);
    const pMaxLife = new Float32Array(particleCount);

    const resetParticle = (i: number) => {
      const r = 1.6 + Math.random() * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pPositions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pPositions[i * 3 + 2] = r * Math.cos(phi);
      // Drift outward
      pVelocities[i * 3]     = pPositions[i * 3] * 0.002;
      pVelocities[i * 3 + 1] = pPositions[i * 3 + 1] * 0.002;
      pVelocities[i * 3 + 2] = pPositions[i * 3 + 2] * 0.002;
      pMaxLife[i] = 120 + Math.random() * 180;
      pLife[i] = 0;
    };

    for (let i = 0; i < particleCount; i++) {
      resetParticle(i);
      pLife[i] = Math.random() * pMaxLife[i]; // stagger initial life
    }

    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
    const particlesMat = new THREE.PointsMaterial({
      color: 0x27f4ff,
      size: 0.045,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      map: starTex,
      alphaTest: 0.01,
    });
    const particles = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particles);

    // Outer magenta cloud
    const glowPCount = 300;
    const glowPPos = new Float32Array(glowPCount * 3);
    for (let i = 0; i < glowPCount; i++) {
      const r = 2.4 + Math.random() * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      glowPPos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      glowPPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      glowPPos[i * 3 + 2] = r * Math.cos(phi);
    }
    const glowPGeo = new THREE.BufferGeometry();
    glowPGeo.setAttribute("position", new THREE.BufferAttribute(glowPPos, 3));
    const glowPMat = new THREE.PointsMaterial({
      color: 0xcc00ff,
      size: 0.025,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    const glowParticles = new THREE.Points(glowPGeo, glowPMat);
    scene.add(glowParticles);

    // ─── ANIMATE ──────────────────────────────────────────────────
    let elapsed = 0;
    let lastBass = 0;
    let flashAlpha = 0;
    // Beat detection state
    let beatCooldown = 0;

    const animate = () => {
      const freq = freqRef.current;
      let bass = 0, mid = 0, high = 0, presence = 0;

      if (freq && freq.length > 0) {
        const len = freq.length;
        const bassEnd   = Math.max(1, Math.floor(len * 0.08));
        const midEnd    = Math.max(2, Math.floor(len * 0.35));
        const presEnd   = Math.max(3, Math.floor(len * 0.65));

        let s = 0;
        for (let i = 0; i < bassEnd; i++) s += freq[i];
        bass = s / bassEnd;

        s = 0;
        for (let i = bassEnd; i < midEnd; i++) s += freq[i];
        mid = s / (midEnd - bassEnd);

        s = 0;
        for (let i = midEnd; i < presEnd; i++) s += freq[i];
        presence = s / (presEnd - midEnd);

        s = 0;
        for (let i = presEnd; i < len; i++) s += freq[i];
        high = s / (len - presEnd);
      }

      const bI = bassRef.current / 100;
      const normBass = bass / 255;
      const normMid  = mid / 255;
      const normHigh = high / 255;
      const normPres = presence / 255;

      // Beat detection: sudden bass spike
      const beatThreshold = 0.35;
      const isBeat = normBass > beatThreshold && normBass > lastBass * 1.3 && beatCooldown <= 0;
      if (isBeat) {
        flashAlpha = 0.18 + normBass * 0.25;
        beatCooldown = 12;
      }
      if (beatCooldown > 0) beatCooldown--;
      lastBass = normBass;

      // CSS flash overlay
      if (flashEl) {
        flashAlpha *= 0.78;
        flashEl.style.opacity = String(Math.max(0, flashAlpha));
      }

      // ── Sphere vertex deformation ──────────────────────────────
      const pos = mainSphereGeometry.attributes.position as THREE.BufferAttribute;
      const t = elapsed * 0.001;
      const deformScale = 0.08 + normBass * bI * 0.35 + normMid * 0.12;
      for (let i = 0; i < vertCount; i++) {
        const ox = origPositions[i * 3];
        const oy = origPositions[i * 3 + 1];
        const oz = origPositions[i * 3 + 2];
        const len3 = Math.sqrt(ox * ox + oy * oy + oz * oz);
        const nx = ox / len3, ny = oy / len3, nz = oz / len3;
        // Noise: use sine combination as cheap noise
        const n =
          Math.sin(nx * 4.2 + t * 1.1) * Math.cos(ny * 3.7 + t * 0.9) +
          Math.cos(nz * 5.1 - t * 1.3) * Math.sin(nx * 2.8 + t * 0.7) * 0.5;
        const disp = 1 + n * deformScale;
        pos.setXYZ(i, ox * disp, oy * disp, oz * disp);
      }
      pos.needsUpdate = true;
      mainSphereGeometry.computeVertexNormals();

      mainSphere.rotation.x += 0.002 + normBass * 0.005;
      mainSphere.rotation.y += 0.003 + normMid  * 0.005;
      mainSphereMaterial.emissiveIntensity = 1.0 + normBass * bI * 2.0;

      // ── Wireframe ────────────────────────────────────────────────
      wireframe.rotation.y += 0.006 + normMid * 0.004;
      wireframe.rotation.x += 0.002;
      wireframe.rotation.z += 0.001;
      wireframe.scale.setScalar(1.0 + normBass * 0.06);
      (wireframeMaterial as THREE.LineBasicMaterial).opacity = 0.3 + normBass * 0.45;

      // ── Frequency bars ───────────────────────────────────────────
      const freq2 = freqRef.current;
      for (let i = 0; i < BAR_COUNT; i++) {
        const freqVal = freq2 && freq2.length > 0
          ? freq2[Math.floor((i / BAR_COUNT) * freq2.length)] / 255
          : 0;
        const targetScale = 0.08 + freqVal * 2.2 + (i < BAR_COUNT * 0.15 ? normBass * bI * 1.5 : 0);
        barMeshes[i].scale.y += (targetScale - barMeshes[i].scale.y) * 0.25;
        const mat = barMeshes[i].material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.4 + freqVal * 2.5;
      }

      // ── Rings ────────────────────────────────────────────────────
      ring1.rotation.x += 0.007 + normBass * 0.012;
      ring1.scale.setScalar(1 + normBass * bI * 0.22);
      (ring1.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.6 + normBass * 1.5;

      ring2.rotation.z += 0.005 + normMid * 0.008;
      ring2.scale.setScalar(1 + normMid * 0.18);
      (ring2.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + normMid * 1.2;

      ring3.rotation.y += 0.004 + normPres * 0.006;
      ring3.scale.setScalar(1 + normPres * 0.14);
      (ring3.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + normPres * 1.0;

      ring4.rotation.x += 0.01 + normHigh * 0.01;
      ring4.rotation.z += 0.008;
      ring4.scale.setScalar(1 + normHigh * 0.1);
      (ring4.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + normHigh * 0.8;

      // ── Core glow ────────────────────────────────────────────────
      glowPlane.lookAt(camera.position);
      glowPlaneMat.opacity = 0.25 + normBass * bI * 0.6;
      const glowScale = 1.0 + normBass * bI * 1.2 + Math.sin(t * 2.1) * 0.05;
      glowPlane.scale.setScalar(glowScale);

      // ── Lights ───────────────────────────────────────────────────
      coreLight.intensity   = 3.0 + normBass * bI * 5.0;
      leftLight.intensity   = 1.2 + normMid  * 2.0;
      rightLight.intensity  = 0.8 + normPres * 1.5;
      rimLight.intensity    = 0.8 + normHigh * 1.2;

      // ── Particles ────────────────────────────────────────────────
      const pPosAttr = particlesGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        pLife[i]++;
        if (pLife[i] >= pMaxLife[i]) {
          resetParticle(i);
        }
        const lifeFrac = pLife[i] / pMaxLife[i];
        const speedMult = 1 + normBass * bI * 4.0;
        pPositions[i * 3]     += pVelocities[i * 3]     * speedMult;
        pPositions[i * 3 + 1] += pVelocities[i * 3 + 1] * speedMult;
        pPositions[i * 3 + 2] += pVelocities[i * 3 + 2] * speedMult;
        pPosAttr.setXYZ(i, pPositions[i * 3], pPositions[i * 3 + 1], pPositions[i * 3 + 2]);
      }
      pPosAttr.needsUpdate = true;
      particlesMat.opacity = 0.7 + normBass * 0.25;
      particles.rotation.y += 0.001 + normBass * 0.003;

      // Outer cloud
      const gpa = glowPGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < glowPCount; i++) {
        const x = gpa.getX(i), y = gpa.getY(i), z = gpa.getZ(i);
        gpa.setXYZ(i, x * (1 + normHigh * 0.001), y * (1 + normHigh * 0.001), z);
      }
      gpa.needsUpdate = true;
      glowParticles.rotation.z += 0.002 + normHigh * 0.003;
      glowParticles.rotation.x += 0.001;
      glowPMat.opacity = 0.3 + normHigh * 0.35;

      // ── Stars: slow pulse ────────────────────────────────────────
      stars.rotation.y += 0.00015;
      stars.rotation.x += 0.00008;
      starMat.opacity = 0.6 + Math.sin(t * 0.5) * 0.15;

      // ── Camera ───────────────────────────────────────────────────
      camera.position.z = 4.0 + Math.sin(t * 0.9) * 0.15 + normBass * 0.08;
      camera.position.x = Math.sin(t * 0.3) * 0.35;
      camera.position.y = Math.cos(t * 0.4) * 0.22;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(animate);
      elapsed += 16;
    };
    frameIdRef.current = requestAnimationFrame(animate);

    // ─── RESIZE ───────────────────────────────────────────────────
    const handleResize = () => {
      const w = container.clientWidth || 300;
      const h = container.clientHeight || 300;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    if ((window as any).ResizeObserver) {
      resizeObserverRef.current = new (window as any).ResizeObserver(handleResize);
      resizeObserverRef.current.observe(container);
    } else {
      window.addEventListener("resize", handleResize);
    }

    // ─── CLEANUP ──────────────────────────────────────────────────
    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (resizeObserverRef.current) {
        try { resizeObserverRef.current.disconnect(); } catch {}
      } else {
        window.removeEventListener("resize", handleResize);
      }

      const disposables: THREE.BufferGeometry[] = [
        mainSphereGeometry, wireframeGeometry, particlesGeo, glowPGeo,
        starGeo, glowPlaneGeo,
      ];
      disposables.forEach(g => { try { g.dispose(); } catch {} });

      const mats: THREE.Material[] = [
        mainSphereMaterial, wireframeMaterial, particlesMat, glowPMat,
        starMat, glowPlaneMat,
        ring1.material as THREE.Material,
        ring2.material as THREE.Material,
        ring3.material as THREE.Material,
        ring4.material as THREE.Material,
      ];
      mats.forEach(m => { try { m.dispose(); } catch {} });
      barMeshes.forEach(b => {
        try { b.geometry.dispose(); } catch {}
        try { (b.material as THREE.Material).dispose(); } catch {}
      });

      [glowTex, starTex].forEach(t => { try { t.dispose(); } catch {} });

      try { renderer.dispose(); } catch {}
      try {
        if (renderer.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
      {/* Beat flash overlay */}
      <div
        ref={flashRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(ellipse at center, rgba(0,230,255,0.6) 0%, rgba(120,0,255,0.3) 60%, transparent 100%)",
          opacity: 0,
          transition: "opacity 0.04s ease-out",
          mixBlendMode: "screen",
        }}
      />
    </div>
  );
};

export default VisualCanvas;
