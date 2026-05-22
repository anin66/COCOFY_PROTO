"use client";

import { Suspense, useRef } from 'react';
import Link from 'next/link';
import { ArrowRight, Layers, Zap, Shield } from 'lucide-react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Float, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="landing-header" style={{ padding: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          
          <div className="hero-cta-wrapper" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
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
          <div className="hero-canvas-wrapper" style={{ 
            width: '100%', 
            height: '100%', 
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

      {/* Features Section */}
      <section style={{
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        padding: '5rem 2rem',
        borderTop: '1px solid var(--surface-border)'
      }}>
        <h2 style={{ textAlign: 'center', marginBottom: '3.5rem', fontSize: '2rem', fontWeight: 800 }}>
          Designed for Modern Logistics
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
          gap: '2.5rem' 
        }}>
          {/* Card 1 */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(123, 44, 191, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Layers size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Manager Hub</h3>
            <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              Schedule plans, dispatch delivery agents, and monitor field worker performance metrics through a single unified command center.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(76, 201, 240, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Worker Portal</h3>
            <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              Mobile-optimized dashboard for harvesting teams and delivery drivers to log activities, track earnings, and achieve target tiers.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(6, 214, 160, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
              <Shield size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Finance Ledger</h3>
            <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              Audited cash flow monitoring, custom P&L exports, automatic salary calculations, and outstanding dues tracking.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ 
        padding: '2.5rem 2rem', 
        borderTop: '1px solid var(--surface-border)', 
        textAlign: 'center', 
        fontSize: '0.875rem', 
        color: 'var(--text-dim)' 
      }}>
        © {new Date().getFullYear()} COCOFY Logistics. All rights reserved.
      </footer>
    </main>
  );
}

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
        {/* Main Body (Oval Sphere) */}
        <mesh scale={[1.1, 1.35, 1.1]} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32]} />
          <meshStandardMaterial 
            color="#598b3c"
            roughness={0.8} 
            metalness={0.05}
          />
        </mesh>

        {/* Top Crown/Cap (Less clunky, more organic cap) */}
        <mesh position={[0, 1.3, 0]} scale={[0.4, 0.08, 0.4]} castShadow receiveShadow>
          <sphereGeometry args={[1, 8, 4]} />
          <meshStandardMaterial color="#3f6629" roughness={0.9} />
        </mesh>

        {/* Main Stem (Thinner, sleeker) */}
        <mesh position={[0.1, 1.5, 0]} rotation={[0, 0, -0.3]} castShadow receiveShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.5, 8]} />
          <meshStandardMaterial color="#3f6629" roughness={0.9} />
        </mesh>
      </group>

      {/* Cut-Open Half Coconut */}
      <group position={[1.1, -0.5, 0.5]} rotation={[0.6, -0.5, 0.4]} scale={[0.9, 0.9, 0.9]}>
        {/* Brown outer shell hemisphere */}
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial 
            color="#4e2c0e" 
            roughness={0.95} 
            metalness={0.05} 
            side={THREE.DoubleSide} 
          />
        </mesh>
        
        {/* White inner meat hemisphere */}
        <mesh position={[0, 0.02, 0]} scale={[0.96, 0.96, 0.96]} castShadow receiveShadow>
          <sphereGeometry args={[1, 32, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial 
            color="#f9f9fb" 
            roughness={0.8} 
            metalness={0.02} 
            side={THREE.DoubleSide} 
          />
        </mesh>

        {/* Flat white rim representing the cut face */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
          <circleGeometry args={[1, 32]} />
          <meshStandardMaterial 
            color="#ffffff" 
            roughness={0.7} 
            metalness={0.05} 
          />
        </mesh>

        {/* Semi-translucent glossy inner water cavity */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[0.7, 32]} />
          <meshStandardMaterial 
            color="#e0f7fa" 
            roughness={0.1} 
            metalness={0.8} 
            opacity={0.55} 
            transparent 
          />
        </mesh>
      </group>
    </group>
  );
}
