import React, { Suspense, useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

const MODE_CONFIG = {
  send: { scale: 6.8, fov: 42 },
  corner: { scale: 4.4, cameraZ: 3.35, fov: 44 },
};

useGLTF.preload(MODEL_URL);

function centerAndScale(object, sizeTarget) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = sizeTarget / maxDim;
  object.position.sub(center);
  object.scale.setScalar(scale);
  return scale;
}

function SendCamera({ sendProgress }) {
  const { camera } = useThree();
  const startZ = 5.4;
  const endZ = 2.5;

  useFrame(() => {
    const eased = sendProgress * sendProgress;
    camera.position.set(0, 0, THREE.MathUtils.lerp(startZ, endZ, eased));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  });

  return null;
}

function LogoModel({ mode, sendProgress }) {
  const group = useRef();
  const baseScaleRef = useRef(1);
  const { scene } = useGLTF(MODEL_URL);
  const config = MODE_CONFIG[mode] || MODE_CONFIG.corner;

  const model = useMemo(() => {
    const clone = scene.clone(true);
    baseScaleRef.current = centerAndScale(clone, config.scale);
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
            mat.metalness = Math.min(mat.metalness + 0.25, 1);
            mat.roughness = Math.max((mat.roughness ?? 0.5) - 0.22, 0.06);
          }
          if (mat.emissive) {
            mat.emissive.set("#0891b2");
            mat.emissiveIntensity = mode === "send" ? 0.18 : 0.1;
          }
        });
      }
    });
    return clone;
  }, [scene, config.scale, mode]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const base = baseScaleRef.current;

    if (mode === "send") {
      const fade =
        sendProgress > 0.88
          ? 1 - ((sendProgress - 0.88) / 0.12) * 0.95
          : 1;
      const zoomScale = 0.82 + sendProgress * 0.28;
      group.current.position.set(0, 0, 0);
      group.current.rotation.y = 0.45 + t * 0.1;
      group.current.rotation.x = 0.12 + Math.sin(t * 0.28) * 0.03;
      group.current.rotation.z = 0;
      group.current.scale.setScalar(base * zoomScale * fade);
      return;
    }

    group.current.position.y = Math.sin(t * 0.55) * 0.035;
    group.current.rotation.y += 0.18 * delta;
    group.current.rotation.x = 0.12 + Math.sin(t * 0.4) * 0.05;
    group.current.scale.setScalar(base);
  });

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

function Scene({ mode, sendProgress }) {
  return (
    <>
      <Environment preset="studio" />
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 8, 6]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-5, 2, -4]} intensity={0.7} color="#67e8f9" />
      <pointLight position={[3, 4, 5]} intensity={1.1} color="#22d3ee" />
      <pointLight position={[-4, -2, 3]} intensity={0.55} color="#f0abfc" />
      <spotLight
        position={[0, 6, 2]}
        angle={0.35}
        penumbra={0.8}
        intensity={0.9}
        color="#e0f2fe"
      />
      {mode === "send" && <SendCamera sendProgress={sendProgress} />}
      <LogoModel mode={mode} sendProgress={sendProgress} />
    </>
  );
}

export default function Logo3D({
  variant = "corner",
  sending = false,
  className = "",
  onSendProgress,
}) {
  const mode = sending ? "send" : variant;
  const config = MODE_CONFIG[mode] || MODE_CONFIG.corner;
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

  const cameraZ = mode === "send" ? 5.4 : config.cameraZ;

  return (
    <div className={`${className} pointer-events-none`} aria-hidden>
      <ModelErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          camera={{
            position: [0, 0, cameraZ],
            fov: config.fov,
            near: 0.1,
            far: 100,
          }}
          style={{ background: "transparent", width: "100%", height: "100%" }}
        >
          <Suspense fallback={null}>
            <Scene mode={mode} sendProgress={sendProgress} />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>
    </div>
  );
}
