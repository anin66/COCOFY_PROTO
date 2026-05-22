"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function CoconutModel() {
  const tiltRef = useRef<THREE.Group>(null);
  const { width } = useThree((state) => state.size);
  
  // Linear scale calculation for perfect portrait/landscape fitting
  const scale = width < 768 ? Math.min(0.65, width / 520) : 1.0;

  useFrame((state) => {
    // Standard cursor interaction: smooth tilt based on mouse position
    if (tiltRef.current) {
      const targetX = state.pointer.y * 0.25; 
      const targetZ = -state.pointer.x * 0.25; 
      
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(tiltRef.current.rotation.x, targetX, 0.1);
      tiltRef.current.rotation.z = THREE.MathUtils.lerp(tiltRef.current.rotation.z, targetZ, 0.1);
    }
  });

  return (
    <group ref={tiltRef} scale={scale}>
      {/* Background Palm Leaves */}
      <group position={[0, -0.6, -1.8]}>
        {/* Left Leaf */}
        <mesh position={[-1.5, 1.4, 0]} rotation={[0.1, 0.2, 0.7]} scale={[0.3, 4.2, 0.02]} castShadow>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#2c5b27" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* Middle-Left Leaf */}
        <mesh position={[-0.4, 1.8, -0.3]} rotation={[0.0, 0.0, 0.25]} scale={[0.35, 4.6, 0.02]} castShadow>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#214b1d" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* Middle-Right Leaf */}
        <mesh position={[0.5, 1.9, -0.4]} rotation={[0.0, 0.0, -0.2]} scale={[0.33, 4.5, 0.02]} castShadow>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#2c5b27" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        {/* Right Leaf */}
        <mesh position={[1.6, 1.3, -0.1]} rotation={[-0.1, -0.2, -0.6]} scale={[0.28, 3.8, 0.02]} castShadow>
          <coneGeometry args={[1, 1, 4]} />
          <meshStandardMaterial color="#1f421b" roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Whole Green Coconut */}
      <group position={[-1.0, 0.3, -0.5]} rotation={[-0.2, 0.4, -0.2]} scale={[0.95, 0.95, 0.95]}>
        <mesh scale={[1.1, 1.35, 1.1]} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial color="#598b3c" roughness={0.8} metalness={0.05} />
        </mesh>
        <mesh position={[0, 1.3, 0]} scale={[0.4, 0.08, 0.4]} castShadow receiveShadow>
          <sphereGeometry args={[1, 8, 4]} />
          <meshStandardMaterial color="#3f6629" roughness={0.9} />
        </mesh>
        <mesh position={[0.1, 1.5, 0]} rotation={[0, 0, -0.3]} castShadow receiveShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.5, 8]} />
          <meshStandardMaterial color="#3f6629" roughness={0.9} />
        </mesh>
      </group>

      {/* Cut-Open Half Coconut */}
      <group position={[1.1, -0.5, 0.5]} rotation={[0.6, -0.5, 0.4]} scale={[0.9, 0.9, 0.9]}>
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#4e2c0e" roughness={0.95} metalness={0.05} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.02, 0]} scale={[0.96, 0.96, 0.96]} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color="#f9f9fb" roughness={0.8} metalness={0.02} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <circleGeometry args={[1, 32]} />
          <meshStandardMaterial color="#ffffff" roughness={0.7} metalness={0.05} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[0.7, 32]} />
          <meshStandardMaterial color="#e0f7fa" roughness={0.1} metalness={0.8} opacity={0.55} transparent />
        </mesh>
      </group>
    </group>
  );
}

export default function CoconutCanvas() {
  return (
    <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ cursor: "default" }} shadows>
      <ambientLight intensity={0.65} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.5} color="#ffffff" />
      <pointLight position={[0, -5, 5]} intensity={0.5} color="#ffffff" />
      
      <Suspense fallback={null}>
        <CoconutModel />
        <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2} far={4} color="#000000" />
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={2} />
    </Canvas>
  );
}
