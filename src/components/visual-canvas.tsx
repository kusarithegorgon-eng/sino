import React, { useEffect, useRef } from "react";
import * as THREE from "three";

interface VisualCanvasProps {
  frequencyData: Uint8Array;
  bassIntensity: number;
}

const VisualCanvas: React.FC<VisualCanvasProps> = ({ frequencyData, bassIntensity }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
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
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight || 300);
    renderer.setClearColor(0x020a14, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / Math.max(1, container.clientHeight), 0.1, 1000);
    camera.position.set(0, 0, 3);

    const ambient = new THREE.AmbientLight(0x4dfffe, 0.35);
    const point = new THREE.PointLight(0x22ffff, 1.6, 12);
    point.position.set(1.6, 1.2, 2.5);
    scene.add(ambient, point);

    const mainSphereGeometry = new THREE.IcosahedronGeometry(0.72, 4);
    const mainSphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f7ff,
      emissive: 0x0056a5,
      metalness: 0.2,
      roughness: 0.15,
      transparent: true,
      opacity: 0.75,
      wireframe: false,
    });
    const mainSphere = new THREE.Mesh(mainSphereGeometry, mainSphereMaterial);
    scene.add(mainSphere);

    const wireframeGeometry = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.78, 4));
    const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0x00ffe0, transparent: true, opacity: 0.55 });
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    scene.add(wireframe);

    const pulseRingGeometry = new THREE.TorusGeometry(1.05, 0.012, 16, 120);
    const pulseRingMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffe0, transparent: true, opacity: 0.5 });
    const pulseRing = new THREE.Mesh(pulseRingGeometry, pulseRingMaterial);
    pulseRing.rotation.x = Math.PI / 2;
    scene.add(pulseRing);

    const particleCount = 320;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const radius = 1.8 + Math.random() * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);
    }
    const particlesGeometry = new THREE.BufferGeometry();
    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: 0x27f4ff, size: 0.03, transparent: true, opacity: 0.9 });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);

    const bgGeometry = new THREE.PlaneGeometry(8, 8);
    const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x00121d, transparent: true, opacity: 0.95 });
    const bgPlane = new THREE.Mesh(bgGeometry, bgMaterial);
    bgPlane.position.z = -4;
    scene.add(bgPlane);

    let elapsed = 0;
    const animate = () => {
      const freq = freqRef.current;
      let avg = 0;
      if (freq && freq.length > 0) {
        const lowCount = Math.max(1, Math.floor(freq.length * 0.08));
        let sum = 0;
        for (let i = 0; i < lowCount; i++) sum += freq[i];
        avg = sum / lowCount;
      }

      const intensity = bassRef.current;
      const beat = 1 + (avg / 255) * (intensity / 90);
      const glow = Math.min(1.5, 0.8 + (avg / 255) * 0.9);

      mainSphere.scale.setScalar(0.9 + beat * 0.4);
      mainSphere.rotation.x += 0.002 + (avg / 255) * 0.003;
      mainSphere.rotation.y += 0.003 + (avg / 255) * 0.004;

      wireframe.rotation.y += 0.005;
      wireframe.rotation.x += 0.002;
      wireframe.material.opacity = 0.35 + (avg / 255) * 0.4;

      pulseRing.scale.setScalar(1 + (avg / 255) * 0.12);
      pulseRing.material.opacity = 0.35 + (avg / 255) * 0.35;

      point.intensity = 1.2 + (avg / 255) * 0.75;
      mainSphereMaterial.emissiveIntensity = glow;

      const positions = particlesGeometry.attributes.position as THREE.BufferAttribute;
      const time = elapsed * 0.001;
      for (let i = 0; i < particleCount; i++) {
        const index = i * 3;
        const x = positions.getX(i);
        const y = positions.getY(i);
        const z = positions.getZ(i);
        positions.setXYZ(i, x, y, z + Math.sin(time + i * 0.14) * 0.0015);
      }
      positions.needsUpdate = true;
      particles.rotation.y += 0.0008 + (avg / 255) * 0.002;

      camera.position.z = 2.9 + Math.sin(elapsed * 0.0009) * 0.07 + (avg / 255) * 0.12;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      frameIdRef.current = requestAnimationFrame(animate);
      elapsed += 16;
    };
    frameIdRef.current = requestAnimationFrame(animate);

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

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      if (resizeObserverRef.current) {
        try {
          resizeObserverRef.current.disconnect();
        } catch {}
      } else {
        window.removeEventListener("resize", handleResize);
      }
      try {
        mainSphereGeometry.dispose();
      } catch {}
      try {
        mainSphereMaterial.dispose();
      } catch {}
      try {
        wireframeGeometry.dispose();
      } catch {}
      try {
        wireframeMaterial.dispose();
      } catch {}
      try {
        pulseRingGeometry.dispose();
      } catch {}
      try {
        pulseRingMaterial.dispose();
      } catch {}
      try {
        particlesGeometry.dispose();
      } catch {}
      try {
        particlesMaterial.dispose();
      } catch {}
      try {
        bgGeometry.dispose();
      } catch {}
      try {
        bgMaterial.dispose();
      } catch {}
      try {
        scene.remove(mainSphere);
        scene.remove(wireframe);
        scene.remove(pulseRing);
        scene.remove(particles);
        scene.remove(bgPlane);
      } catch {}
      try {
        renderer.dispose();
      } catch {}
      try {
        if (renderer.domElement && renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }} />;
};

export default VisualCanvas;
