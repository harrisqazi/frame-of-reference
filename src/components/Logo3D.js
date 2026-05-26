import React, { Suspense, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, Environment } from "@react-three/drei";
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

function centerAndScale(scene, sizeTarget = 5.5) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = sizeTarget / maxDim;
  scene.position.sub(center);
  scene.scale.setScalar(scale);
  return scale;
}

function LogoModel({ mouse, sending, sendProgress, interactive }) {
  const group = useRef();
  const baseScaleRef = useRef(1);
  const preparedRef = useRef(false);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    if (preparedRef.current) return;
    preparedRef.current = true;
    baseScaleRef.current = centerAndScale(scene, sending ? 5 : 6.5);
    scene.traverse((child) => {
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
  }, [scene, sending]);

  useEffect(() => {
    const clip =
      actions.EmptyAction ||
      actions.MESH_1Action ||
      Object.values(actions)[0];
    if (!clip) return;
    clip.reset().setLoop(-1, 300).fadeIn(0.3).play();
    return () => clip.fadeOut(0.2);
  }, [actions]);

  useFrame((state, delta) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const base = baseScaleRef.current;

    if (sending) {
      const lift = sendProgress * 2.8;
      const spin = sendProgress * Math.PI * 3;
      const fade = 1 - sendProgress * 0.85;
      group.current.position.y = lift;
      group.current.rotation.y = spin;
      group.current.rotation.x = 0.12 + mouse.y * 0.08;
      group.current.scale.setScalar(base * (1 + sendProgress * 0.35) * fade);
      return;
    }

    if (interactive) {
      group.current.position.y = Math.sin(t * 0.9) * 0.04;
      group.current.rotation.y = mouse.x * 0.2 + Math.sin(t * 0.25) * 0.06;
      group.current.rotation.x = mouse.y * 0.12 + 0.06;
      group.current.rotation.z = mouse.x * 0.03;
    } else {
      group.current.position.y = Math.sin(t * 0.6) * 0.05;
      group.current.rotation.y += 0.35 * delta;
      group.current.rotation.x =
        0.1 + Math.sin(t * 0.35) * 0.06 + mouse.y * 0.05;
      group.current.rotation.z = mouse.x * 0.04;
    }
    group.current.scale.setScalar(base);
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
    </group>
  );
}

function Scene({ mouse, sending, sendProgress, interactive }) {
  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.35} color="#ffffff" />
      <directionalLight position={[-4, 1, -3]} intensity={0.55} color="#67e8f9" />
      <pointLight position={[2, 3, 4]} intensity={0.85} color="#22d3ee" />
      <pointLight position={[-3, -1, 2]} intensity={0.45} color="#a5f3fc" />
      <LogoModel
        mouse={mouse}
        sending={sending}
        sendProgress={sendProgress}
        interactive={interactive}
      />
    </>
  );
}

export default function Logo3D({
  sending = false,
  interactive = true,
  className = "",
  onSendProgress,
}) {
  const containerRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
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

  const handlePointerMove = (e) => {
    if (!interactive || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    setMouse({ x, y });
  };

  const resetMouse = () => setMouse({ x: 0, y: 0 });

  return (
    <div
      ref={containerRef}
      className={className}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetMouse}
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
            position: [0, 0, sending ? 3.2 : 2.75],
            fov: sending ? 42 : 48,
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
              interactive={interactive}
            />
          </Suspense>
        </Canvas>
      </ModelErrorBoundary>
    </div>
  );
}
