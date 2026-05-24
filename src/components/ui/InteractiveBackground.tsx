"use client";

import React, { useEffect, useRef, useState } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
}

export default function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [normCoords, setNormCoords] = useState({ x: 0.0, y: 0.0 });

  useEffect(() => {
    // Mouse tracking for parallax and telemetry
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      const xNorm = +(e.clientX / innerWidth).toFixed(3);
      const yNorm = +(e.clientY / innerHeight).toFixed(3);
      setCoords({ x: e.clientX, y: e.clientY });
      setNormCoords({ x: xNorm, y: yNorm });

      // Apply subtle tilt to the cyber grid
      if (gridRef.current) {
        const tiltX = (e.clientY / innerHeight - 0.5) * 15; // max 7.5 deg
        const tiltY = (e.clientX / innerWidth - 0.5) * -15; // max -7.5 deg
        const shiftX = (e.clientX / innerWidth - 0.5) * -30; // max -15px
        const shiftY = (e.clientY / innerHeight - 0.5) * -30; // max -15px
        
        gridRef.current.style.transform = `translate3d(calc(-25% + ${shiftX}px), calc(-25% + ${shiftY}px), 0) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Background Canvas Particle System
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];
    const maxParticles = 30;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Initialize particles
    for (let i = 0; i < maxParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 1,
        color: Math.random() > 0.3 ? "132, 204, 22" : "46, 125, 50", // Lime or Forest green
        alpha: Math.random() * 0.5 + 0.1,
        decay: Math.random() * 0.002 + 0.001
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p) => {
        // Move particle
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around edges
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        // Render particle with soft neon glow
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.shadowColor = `rgba(${p.color}, 0.8)`;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <>
      {/* Background Canvas Particles */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -10,
          pointerEvents: "none",
          backgroundColor: "#060906", // Dark cybernetic forest background
        }}
      />

      {/* Cyber Grid with parallax transform */}
      <div 
        ref={gridRef} 
        className="cyber-grid" 
        style={{
          perspective: "1000px",
          transform: "translate3d(-25%, -25%, 0)",
          transition: "transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)"
        }}
      />

      {/* Dots Matrix */}
      <div className="cyber-dots" />

      {/* Glitch Scanlines Overlay */}
      <div className="scanlines" />

      {/* Telemetry Ticker (Corner Displays) */}
      <div 
        style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "2rem",
          fontFamily: "monospace",
          fontSize: "0.7rem",
          color: "var(--accent)",
          zIndex: 100,
          letterSpacing: "2px",
          pointerEvents: "none",
          opacity: 0.6,
          display: "flex",
          gap: "1.5rem"
        }}
      >
        <span>SYS.LOC // [X:{normCoords.x} Y:{normCoords.y}]</span>
        <span className="hidden md:inline">INDEX.PAGE // ACTIVE</span>
      </div>
    </>
  );
}
