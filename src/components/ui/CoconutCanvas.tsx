"use client";

import { Suspense, useRef, useEffect } from "react";
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
      {/* Render only the Tripo3D Coconut Superhero model in the center */}
      <CoconutSuperhero />
    </group>
  );
}

function CoconutSuperhero() {
  const { scene } = useGLTF("/models/coconut_superhero.glb");
  const leftUpperArmRef = useRef<THREE.Object3D | null>(null);
  const leftForearmRef = useRef<THREE.Object3D | null>(null);
  const initialRotations = useRef({
    upperArm: new THREE.Euler(),
    foreArm: new THREE.Euler(),
  });

  useEffect(() => {
    if (scene) {
      const upper = scene.getObjectByName("L_Upperarm");
      const fore = scene.getObjectByName("L_Forearm");
      if (upper) {
        leftUpperArmRef.current = upper;
        initialRotations.current.upperArm.copy(upper.rotation);
      }
      if (fore) {
        leftForearmRef.current = fore;
        initialRotations.current.foreArm.copy(fore.rotation);
      }
    }
  }, [scene]);

  // Enable shadows on all child meshes of the loaded model
  scene.traverse((node) => {
    if ((node as THREE.Mesh).isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    // Wave animation: raise left arm and wave forearm
    if (leftUpperArmRef.current) {
      const init = initialRotations.current.upperArm;
      // Rotate L_Upperarm upwards (Z-axis offset)
      leftUpperArmRef.current.rotation.z = init.z - 1.2 + Math.sin(time * 2) * 0.1;
      leftUpperArmRef.current.rotation.x = init.x + Math.sin(time * 2) * 0.1;
    }
    
    if (leftForearmRef.current) {
      const init = initialRotations.current.foreArm;
      // Wave L_Forearm back and forth rapidly
      leftForearmRef.current.rotation.y = init.y + Math.sin(time * 6) * 0.35;
    }
  });

  return (
    <primitive 
      object={scene} 
      position={[0, -3.3, 0]} 
      scale={5.0} 
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
