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
  send: { scale: 96, fov: 56 },
  corner: { scale: 64, cameraZ: 1.65, fov: 56 },
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

function enhanceMaterials(mats, mode) {
  mats.forEach((mat) => {
    if (mat.metalness === undefined) return;
    mat.transparent = false;
    mat.opacity = 1;
    mat.metalness = 0.95;
    mat.roughness = 0.1;
    mat.envMapIntensity = mode === "send" ? 2.8 : 2.4;
    if (mat.color) {
      mat.color.set("#e8eef2");
    }
    if (mat.emissive) {
      mat.emissive.set("#0c4a6e");
      mat.emissiveIntensity = mode === "send" ? 0.08 : 0.05;
    }
    mat.needsUpdate = true;
  });
}

function SendCamera({ sendProgress }) {
  const { camera } = useThree();
  const startZ = 2.8;
  const endZ = 0.72;

  useFrame(() => {
    const eased = 1 - Math.pow(1 - sendProgress, 2);
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
        enhanceMaterials(mats, mode);
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
      const zoomScale = 0.9 + sendProgress * 0.45;
      group.current.position.set(0, 0, 0);
      group.current.rotation.y = 0.45 + t * 0.1;
      group.current.rotation.x = 0.12 + Math.sin(t * 0.28) * 0.03;
      group.current.rotation.z = 0;
      group.current.scale.setScalar(base * zoomScale * fade);
      return;
    }

    group.current.position.y = Math.sin(t * 0.55) * 0.02;
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
      <Environment preset="studio" environmentIntensity={2.2} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[6, 10, 8]} intensity={2} color="#ffffff" />
      <directionalLight position={[-6, 3, -5]} intensity={1} color="#a5f3fc" />
      <pointLight position={[4, 5, 6]} intensity={1.4} color="#ffffff" />
      <pointLight position={[-5, -2, 4]} intensity={0.9} color="#67e8f9" />
      <pointLight position={[0, -4, 3]} intensity={0.5} color="#e0f2fe" />
      <spotLight
        position={[0, 8, 4]}
        angle={0.45}
        penumbra={0.9}
        intensity={1.2}
        color="#ffffff"
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

  const cameraZ = mode === "send" ? 2.8 : config.cameraZ;

  return (
    <div className={`${className} pointer-events-none`} aria-hidden>
      <ModelErrorBoundary>
        <Canvas
          dpr={[1, 2]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.15,
          }}
          style={{ background: "transparent", width: "100%", height: "100%" }}
          camera={{
            position: [0, 0, cameraZ],
            fov: config.fov,
            near: 0.05,
            far: 200,
          }}
        >
          <Suspense fallback={null}>
            <Scene mode={mode} sendProgress={sendProgress} />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>
    </div>
  );
}
