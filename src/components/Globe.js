import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";

const pointer = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });
}

function latLngToVec(lat, lng, r = 1) {
  const phi = ((lng + 180) * Math.PI) / 180;
  const theta = ((90 - lat) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(theta) * Math.cos(phi),
    r * Math.cos(theta),
    r * Math.sin(theta) * Math.sin(phi)
  );
}

function Earth({ locations }) {
  const tilt = useRef();
  const spin = useRef();
  const texture = useLoader(THREE.TextureLoader, "/textures/earth-dark.jpg");
  const focus = locations[locations.length - 1];

  const markers = useMemo(
    () => locations.map((l) => latLngToVec(l.lat, l.lng, 1.01)),
    [locations]
  );

  useFrame((state, delta) => {
    if (!tilt.current || !spin.current) return;
    if (focus) {
      const p = latLngToVec(focus.lat, focus.lng);
      const targetY = -Math.atan2(p.x, p.z);
      const targetX = (focus.lat * Math.PI) / 180;
      let dy = targetY - spin.current.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      spin.current.rotation.y += dy * 0.06;
      tilt.current.rotation.x = THREE.MathUtils.lerp(
        tilt.current.rotation.x,
        targetX + pointer.y * 0.15,
        0.06
      );
    } else {
      spin.current.rotation.y += delta * 0.15;
      tilt.current.rotation.x = THREE.MathUtils.lerp(
        tilt.current.rotation.x,
        0.3 + pointer.y * 0.2,
        0.05
      );
    }
    tilt.current.rotation.z = THREE.MathUtils.lerp(
      tilt.current.rotation.z,
      -pointer.x * 0.12,
      0.05
    );
    tilt.current.position.x = THREE.MathUtils.lerp(
      tilt.current.position.x,
      pointer.x * 0.08,
      0.05
    );
  });

  return (
    <group ref={tilt}>
      <group ref={spin}>
        <mesh>
          <sphereGeometry args={[1, 64, 64]} />
          <meshStandardMaterial
            map={texture}
            color="#0b2a12"
            emissiveMap={texture}
            emissive="#00ff41"
            emissiveIntensity={1.6}
            roughness={0.9}
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[1.003, 32, 32]} />
          <meshBasicMaterial
            color="#00ff41"
            wireframe
            transparent
            opacity={0.08}
          />
        </mesh>
        {markers.map((v, i) => (
          <group key={i} position={v}>
            <mesh>
              <sphereGeometry args={[0.028, 16, 16]} />
              <meshBasicMaterial color="#00ff41" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.07, 16, 16]} />
              <meshBasicMaterial color="#00ff41" transparent opacity={0.25} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh scale={1.12}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#00ff41"
          transparent
          opacity={0.06}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export default function Globe({ locations = [] }) {
  return (
    <div className="globe-wrap">
      <Canvas camera={{ position: [0, 0, 2.9], fov: 45 }} gl={{ alpha: true }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 2, 4]} intensity={1.6} />
        <Suspense fallback={null}>
          <Earth locations={locations} />
        </Suspense>
      </Canvas>
    </div>
  );
}
