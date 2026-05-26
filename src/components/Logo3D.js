import React, { Suspense, useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment } from "@react-three/drei";
import * as THREE from "three";

class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err) {
    console.warn("3D logo failed to load:", err);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

const MODEL_URL = "/models/3d-logo.glb";

useGLTF.preload(MODEL_URL);

function centerAndScale(object, sizeTarget = 5.5) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = sizeTarget / maxDim;
  object.position.sub(center);
  object.scale.setScalar(scale);
  return scale;
}

function LogoModel({ mouse, sending, sendProgress }) {
  const group = useRef();
  const baseScaleRef = useRef(1);
  const { scene } = useGLTF(MODEL_URL);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    baseScaleRef.current = centerAndScale(clone, sending ? 5.25 : 6.5);
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((mat) => {
          mat.transparent = true;
          if (mat.opacity === undefined || mat.opacity === 1) {
            mat.opacity = 0.98;
          }
          if (mat.metalness !== undefined) {
            mat.metalness = Math.min(mat.metalness + 0.15, 1);
            mat.roughness = Math.max((mat.roughness ?? 0.5) - 0.15, 0.08);
          }
          if (mat.emissive) {
            mat.emissive.set("#0e7490");
            mat.emissiveIntensity = 0.12;
          }
        });
      }
    });
    return clone;
  }, [scene, sending]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const base = baseScaleRef.current;

    if (sending) {
      const lift = sendProgress * 1.6;
      const spin = sendProgress * Math.PI * 2.5;
      const fade =
        sendProgress > 0.78
          ? 1 - ((sendProgress - 0.78) / 0.22) * 0.92
          : 1;
      group.current.position.y = lift;
      group.current.rotation.y = spin + t * 0.15;
      group.current.rotation.x = 0.1 + Math.sin(t * 0.4) * 0.05;
      group.current.scale.setScalar(base * (1 + sendProgress * 0.08) * fade);
      return;
    }

    group.current.position.y = Math.sin(t * 0.6) * 0.05;
    group.current.rotation.y += 0.35 * delta;
    group.current.rotation.x = 0.1 + Math.sin(t * 0.35) * 0.06;
    group.current.scale.setScalar(base);
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

function Scene({ mouse, sending, sendProgress }) {
  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-4, 1, -3]} intensity={0.55} color="#67e8f9" />
      <pointLight position={[2, 3, 4]} intensity={0.85} color="#22d3ee" />
      <pointLight position={[-3, -1, 2]} intensity={0.45} color="#a5f3fc" />
      <LogoModel mouse={mouse} sending={sending} sendProgress={sendProgress} />
    </>
  );
}

export default function Logo3D({
  sending = false,
  className = "",
  onSendProgress,
}) {
  const containerRef = useRef(null);
  const [mouse] = useState({ x: 0, y: 0 });
  const [sendProgress, setSendProgress] = useState(0);
  const sendStartRef = useRef(null);

  useEffect(() => {
    if (!sending) {
      setSendProgress(0);
      sendStartRef.current = null;
      return;
    }
    sendStartRef.current = performance.now();
    let raf;
    const tick = (now) => {
      const start = sendStartRef.current || now;
      const p = Math.min((now - start) / 3800, 1);
      setSendProgress(p);
      onSendProgress?.(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sending, onSendProgress]);

  return (
    <div
      ref={containerRef}
      className={`${className} pointer-events-none`}
      aria-hidden
    >
      <ModelErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          camera={{
            position: [0, 0, sending ? 3.55 : 2.75],
            fov: sending ? 46 : 48,
            near: 0.1,
            far: 100,
          }}
          style={{ background: "transparent", width: "100%", height: "100%" }}
        >
          <Suspense fallback={null}>
            <Scene
              mouse={mouse}
              sending={sending}
              sendProgress={sendProgress}
            />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>
    </div>
  );
}
