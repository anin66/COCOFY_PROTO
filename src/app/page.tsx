"use client";

import Link from 'next/link';
import { ArrowRight, Layers, Zap, Shield } from 'lucide-react';
import DashboardPreview from '@/components/ui/DashboardPreview';


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
        gap: 'clamp(2rem, 5vw, 4rem)'
      }}>
        {/* Left: Text Content */}
        <div className="animate-fade-in" style={{ flex: 1, zIndex: 10 }}>
          <div style={{ 
            display: 'inline-block', 
            padding: '0.25rem 0.75rem', 
            background: 'var(--primary-glow)', 
            border: '1px solid var(--primary-glow-border)',
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

        {/* Right: Dashboard Preview Container */}
        <div className="animate-fade-in hero-3d-container" style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          animationDelay: '0.2s',
          position: 'relative',
          width: '100%'
        }}>
          {/* Glowing orb effect behind the dashboard preview */}
          <div style={{
            position: 'absolute',
            width: '300px',
            height: '300px',
            background: 'var(--primary)',
            filter: 'blur(100px)',
            opacity: 0.3,
            borderRadius: '50%'
          }}></div>
          
          <DashboardPreview />
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
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Layers size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Manager Hub</h3>
            <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
              Schedule plans, dispatch delivery agents, and monitor field worker performance metrics through a single unified command center.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
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
