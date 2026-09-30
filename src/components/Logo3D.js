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
  send: { scale: 2.6, fov: 46 },
  corner: { scale: 2.2, cameraZ: 3.1, fov: 48 },
  hero: { scale: 2.1, cameraZ: 3.4, fov: 45 },
};

const pointer = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });
}

function rainbowMarble() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#ffffff",
    metalness: 0.28,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.015,
    iridescence: 1,
    iridescenceIOR: 1.9,
    iridescenceThicknessRange: [120, 1000],
    envMapIntensity: 3,
  });
  // The GLB has no UVs. Build the photographed glitter, dark glass and
  // broad prismatic equator directly from the sphere's object-space position.
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvObjPos = position;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vObjPos;
vec3 hue2rgb(float h) {
  return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
}
float marbleHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}`
      )
      .replace(
        "vec4 diffuseColor = vec4( diffuse, opacity );",
        `vec3 mp = normalize(vObjPos);
float angle = atan(mp.z, mp.x) / 6.2831853;
float slant = mp.y + mp.x * 0.14 + sin(mp.z * 3.0) * 0.035;
float broadBand = exp(-pow(abs(slant) / 0.19, 2.0));
float hotBand = exp(-pow(abs(slant - 0.075) / 0.045, 2.0));
vec3 spectrum = hue2rgb(fract(angle + mp.y * 0.72 + 0.08));
vec3 warmSpectrum = hue2rgb(fract(angle + mp.x * 0.3 + 0.98));
float grain = marbleHash(floor(vObjPos * 4.8));
float glitter = smoothstep(0.82, 0.995, grain);
vec3 glassBlack = vec3(0.008, 0.014, 0.016);
vec3 marble = mix(glassBlack, spectrum * 0.95 + 0.12, glitter);
marble += spectrum * broadBand * 1.15;
marble += warmSpectrum * hotBand * 1.45;
marble += vec3(0.72, 0.92, 0.96) * pow(max(mp.y, 0.0), 5.0) * 0.65;
vec4 diffuseColor = vec4(marble * diffuse, opacity);`
      );
  };
  return mat;
}

function isInnerBall(mesh) {
  return (
    mesh.name === "MESH_2" ||
    (mesh.geometry?.attributes?.position?.count || Infinity) < 50000
  );
}

function iridescentChrome(src) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: "#07100f",
    metalness: 1,
    roughness: 0.045,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    iridescence: 0.38,
    iridescenceIOR: 1.55,
    iridescenceThicknessRange: [100, 420],
    envMapIntensity: 3.4,
  });
  if (src?.normalMap) mat.normalMap = src.normalMap;
  return mat;
}

useGLTF.preload(MODEL_URL);

function centerAndScale(object, sizeTarget) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  // The parent group applies the returned scale each frame.
  object.position.sub(center);
  return sizeTarget / maxDim;
}

function SendCamera({ sendProgress }) {
  const { camera } = useThree();
  const startZ = 4.2;
  const endZ = 2.35;

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
        child.material = isInnerBall(child)
          ? rainbowMarble()
          : Array.isArray(child.material)
            ? child.material.map(iridescentChrome)
            : iridescentChrome(child.material);
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
      const zoomScale = 0.88 + sendProgress * 0.22;
      group.current.position.set(0, 0, 0);
      group.current.rotation.y = 0.45 + t * 0.1;
      group.current.rotation.x = 0.12 + Math.sin(t * 0.28) * 0.03;
      group.current.rotation.z = 0;
      group.current.scale.setScalar(base * zoomScale * fade);
      return;
    }

    if (mode === "hero") {
      const g = group.current;
      g.userData.spin = (g.userData.spin || 0) + 0.35 * delta;
      g.rotation.y = THREE.MathUtils.lerp(
        g.rotation.y,
        g.userData.spin + pointer.x * 0.6,
        0.08
      );
      g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, pointer.y * 0.35, 0.08);
      g.position.x = THREE.MathUtils.lerp(g.position.x, pointer.x * 0.15, 0.06);
      g.position.y = Math.sin(t * 0.55) * 0.04 - pointer.y * 0.1;
      g.scale.setScalar(base);
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
      <Environment preset="warehouse" environmentIntensity={2.2} />
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

  const cameraZ = mode === "send" ? 4.2 : config.cameraZ;

  return (
    <div
      className={`${className} pointer-events-none relative`}
      aria-hidden={!sending}
    >
      <ModelErrorBoundary>
        <Canvas
          dpr={[1, 1.5]}
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
