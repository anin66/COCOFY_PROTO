"use client";

import { Suspense, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Layers, Zap, Shield } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '2px', color: 'var(--foreground)' }}>
          COCOFY<span style={{ color: 'var(--primary)' }}>.</span>
        </div>
        <nav>
          <Link href="/login" className="btn btn-secondary" style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            Sign In
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section" style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        gap: '4rem'
      }}>
        {/* Left: Text Content */}
        <div className="animate-fade-in" style={{ flex: 1, zIndex: 10 }}>
          <div style={{ 
            display: 'inline-block', 
            padding: '0.25rem 0.75rem', 
            background: 'rgba(123, 44, 191, 0.2)', 
            border: '1px solid rgba(123, 44, 191, 0.3)',
            borderRadius: '20px',
            fontSize: '0.875rem',
            color: 'var(--accent)',
            marginBottom: '1.5rem'
          }}>
            Logistics Reimagined
          </div>
          <h1>Manage Your Logistics with Precision.</h1>
          <p style={{ fontSize: '1.125rem', marginBottom: '2.5rem', maxWidth: '500px' }}>
            COCOFY connects workers, delivery personnel, and managers into one seamless ecosystem. 
            Streamline your operations with our premium logistics platform.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link href="/login" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem' }}>
              Get Started <ArrowRight size={20} />
            </Link>
          </div>
        </div>

        {/* Right: 3D Element Placeholder */}
        <div className="animate-fade-in hero-3d-container" style={{ 
          flex: 1, 
          height: '500px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          animationDelay: '0.2s',
          position: 'relative'
        }}>
          {/* Glowing orb effect behind the placeholder */}
          <div style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            background: 'var(--primary)',
            filter: 'blur(100px)',
            opacity: 0.4,
            borderRadius: '50%'
          }}></div>
          
          {/* True 3D Interactive Canvas */}
          <div style={{ 
            width: '100%', 
            height: '100%', 
            minHeight: '400px',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            zIndex: 5,
            position: 'relative'
          }}>
            <Canvas camera={{ position: [0, 0, 8], fov: 45 }} style={{ cursor: 'default' }} shadows>
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
          </div>
        </div>
      </section>
    </main>
  );
}

function CoconutModel() {
  const tiltRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    // Standard cursor interaction: smooth tilt based on mouse position
    if (tiltRef.current) {
      const targetX = state.pointer.y * 0.3; 
      const targetZ = -state.pointer.x * 0.3; 
      
      tiltRef.current.rotation.x = THREE.MathUtils.lerp(tiltRef.current.rotation.x, targetX, 0.1);
      tiltRef.current.rotation.z = THREE.MathUtils.lerp(tiltRef.current.rotation.z, targetZ, 0.1);
    }
  });

  const coconutColor = "#598b3c"; // Lighter green
  const stemColor = "#3f6629"; // Lighter green stem
  
  // We rely on OrbitControls for drag interaction and auto-rotation
  // and tiltRef handles the cursor following movement.

  return (
    <group ref={tiltRef}>
      {/* Main Body (Oval Sphere) */}
      <mesh scale={[1.8, 2.2, 1.8]} castShadow receiveShadow>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial 
          color={coconutColor}
          roughness={0.9} 
          metalness={0.05}
        />
      </mesh>

      {/* Top Crown/Cap (Less clunky, more organic cap) */}
      <mesh position={[0, 2.15, 0]} scale={[0.6, 0.1, 0.6]} castShadow receiveShadow>
        <sphereGeometry args={[1, 6, 2]} />
        <meshStandardMaterial color={stemColor} roughness={0.9} metalness={0.05} />
      </mesh>

      {/* Main Stem (Thinner, sleeker) */}
      <mesh position={[0.2, 2.5, 0]} rotation={[0, 0, -0.4]} castShadow receiveShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.8, 8]} />
        <meshStandardMaterial color={stemColor} roughness={0.9} metalness={0.05} />
      </mesh>
      
      {/* Side Stem (Thinner) */}
      <mesh position={[-0.2, 2.35, 0]} rotation={[0, 0, 0.8]} castShadow receiveShadow>
        <cylinderGeometry args={[0.03, 0.05, 0.5, 8]} />
        <meshStandardMaterial color={stemColor} roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  );
}



