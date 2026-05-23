"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, useGLTF } from "@react-three/drei";
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
      {/* Cut-Open Half Coconut */}
      {/* Replace procedural coconut spheres with the Tripo3D Coconut Superhero model */}
      <CoconutSuperhero />
    </group>
  );
}

function CoconutSuperhero() {
  const { scene } = useGLTF("/models/coconut_superhero.glb");
  
  // Enable shadows on all child meshes of the loaded model
  scene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  return (
    <primitive 
      object={scene} 
      position={[0, -1.8, 0]} 
      scale={2.2} 
    />
  );
}

// Preload the 3D model asset for zero-latency presentation
useGLTF.preload("/models/coconut_superhero.glb");

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
