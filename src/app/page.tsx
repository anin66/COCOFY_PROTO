/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ArrowRight } from 'lucide-react';

const NAV_LINKS = ['Platform', 'Solutions', 'Fleet', 'Pricing', 'Contact'];
const VIDEO_SRC = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260511_080827_a9e5ad52-b6ee-4e79-b393-d936f179cfd7.mp4';

function LogoMark() {
  return (
    <svg width="44" height="26" viewBox="0 0 44 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="3" width="14" height="20" rx="3" fill="white" />
      <rect x="16" y="3" width="12" height="20" rx="3" fill="white" />
      <rect x="30" y="3" width="14" height="20" rx="3" fill="white" />
    </svg>
  );
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [framesReady, setFramesReady] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoBgRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef<HTMLCanvasElement[]>([]);

  // Effect 0: Mount fade-in
  useEffect(() => {
    setMounted(true);
  }, []);

  // Effect 1: Frame capture (boomerang setup)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let capturing = true;
    let lastTime = -1;
    const MAX_WIDTH = 960;
    const frames: HTMLCanvasElement[] = [];
    let frameId: number | null = null;
    let started = false;

    const onLoaded = () => {
      if (started) return;
      started = true;
      video.play().catch(() => {});
      startCaptureLoop();
    };

    const captureFrame = () => {
      if (!capturing) return;

      const readyState = video.readyState;
      const currentTime = video.currentTime;
      const duration = video.duration || 1;

      // Update capture progress percentage for a polished visual loader
      const progress = Math.min(100, Math.round((currentTime / duration) * 100));
      setCaptureProgress(progress);

      if (readyState < 2) {
        scheduleNextCapture();
        return;
      }

      if (currentTime === lastTime) {
        scheduleNextCapture();
        return;
      }

      lastTime = currentTime;

      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) {
        const scale = Math.min(1, MAX_WIDTH / w);
        const scaledW = w * scale;
        const scaledH = h * scale;

        const canvas = document.createElement('canvas');
        canvas.width = scaledW;
        canvas.height = scaledH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, scaledW, scaledH);
          frames.push(canvas);
        }
      }

      scheduleNextCapture();
    };

    const scheduleNextCapture = () => {
      if (!capturing) return;
      const anyVideo = video as any;
      if ('requestVideoFrameCallback' in anyVideo && typeof anyVideo.requestVideoFrameCallback === 'function') {
        frameId = anyVideo.requestVideoFrameCallback(captureFrame);
      } else {
        frameId = requestAnimationFrame(captureFrame);
      }
    };

    const startCaptureLoop = () => {
      scheduleNextCapture();
    };

    video.addEventListener('loadedmetadata', onLoaded);

    const onEnded = () => {
      capturing = false;
      framesRef.current = frames;
      setFramesReady(true);
    };
    video.addEventListener('ended', onEnded);

    // If metadata ready state indicates it can start immediately
    if (video.readyState >= 1) {
      onLoaded();
    }

    return () => {
      capturing = false;
      if (video) {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('ended', onEnded);
      }
      if (frameId !== null) {
        const anyVideo = video as any;
        if (anyVideo && 'cancelVideoFrameCallback' in anyVideo && typeof anyVideo.cancelVideoFrameCallback === 'function') {
          anyVideo.cancelVideoFrameCallback(frameId);
        } else {
          cancelAnimationFrame(frameId);
        }
      }
    };
  }, []);

  // Effect 2: Boomerang render
  useEffect(() => {
    if (!framesReady || framesRef.current.length <= 1) return;

    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    const frames = framesRef.current;
    canvas.width = frames[0].width;
    canvas.height = frames[0].height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let index = 0;
    let direction = 1;
    let last = performance.now();
    const interval = 1000 / 30; // 30 FPS playback
    let rafId: number;

    const render = (now: number) => {
      rafId = requestAnimationFrame(render);

      if (now - last >= interval) {
        last = now;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(frames[index], 0, 0);

        index += direction;
        if (index >= frames.length - 1) {
          index = frames.length - 1;
          direction = -1;
        } else if (index <= 0) {
          index = 0;
          direction = 1;
        }
      }
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [framesReady]);

  // Effect 3: Parallax mouse tracking
  useEffect(() => {
    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;
    const strength = 20;
    let rafId: number;

    const handleMouseMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      targetX = ((e.clientX - cx) / cx) * strength;
      targetY = ((e.clientY - cy) / cy) * strength;
    };

    const updateParallax = () => {
      currentX += (targetX - currentX) * 0.06;
      currentY += (targetY - currentY) * 0.06;

      if (videoBgRef.current) {
        gsap.set(videoBgRef.current, { x: currentX, y: currentY });
      }

      rafId = requestAnimationFrame(updateParallax);
    };

    window.addEventListener('mousemove', handleMouseMove);
    rafId = requestAnimationFrame(updateParallax);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div id="root-viewport" className="min-h-screen bg-black text-white font-body overflow-x-hidden relative select-none">
      {/* 1. Video background layer */}
      <div 
        id="video-parallax-container"
        ref={videoBgRef} 
        className="fixed top-0 left-0 w-full h-full z-0 scale-[1.08] origin-center pointer-events-none"
      >
        <video
          id="hero-video-backend"
          ref={videoRef}
          src={VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          className="w-full h-full object-cover"
          style={{ display: framesReady ? 'none' : 'block' }}
        />
        <canvas 
          id="hero-boomerang-canvas"
          ref={displayCanvasRef} 
          className="w-full h-full object-cover" 
          style={{ display: framesReady ? 'block' : 'none' }}
        />
        
        {/* Subtle vignette/ambient glow covering the background */}
        <div id="vignette-overlay" className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40 pointer-events-none" />
      </div>

      {/* 2. Hero title */}
      <div 
        id="hero-title-container"
        className={`fixed left-0 right-0 z-20 w-full px-4 text-center transition-all duration-1000 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
        style={{ top: '126px' }}
      >
        <span className="text-xs uppercase tracking-[0.3em] text-white/50 block mb-3 font-semibold font-body">
          LOGISTICS REIMAGINED
        </span>
        <h1 className="hero-title select-none">
          COCOFY
        </h1>
      </div>

      {/* 3. Navigation Bar */}
      <nav 
        id="top-nav-bar"
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap"
      >
        <div className="liquid-glass flex items-center gap-6 rounded px-4 py-2.5">
          <LogoMark />
          <div className="flex items-center gap-5">
            {NAV_LINKS.map((link) => (
              <a
                id={`nav-link-${link.toLowerCase()}`}
                key={link}
                href={`#${link.toLowerCase()}`}
                className="text-sm font-body font-light text-white/70 hover:text-white transition-colors duration-200"
              >
                {link}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 ml-4">
            <Link
              id="nav-link-signin"
              href="/login"
              className="text-sm font-body font-light text-white/70 hover:text-white transition-colors duration-200"
            >
              Sign in
            </Link>
            <Link
              id="nav-action-try"
              href="/login"
              className="liquid-glass-strong text-sm font-body font-medium text-white rounded px-4 py-1.5 transition-all duration-200 hover:scale-[1.04] hover:shadow-[0_0_16px_2px_rgba(255,255,255,0.12)] active:scale-[0.97]"
            >
              Try it free
            </Link>
          </div>
        </div>
      </nav>

      {/* 4. Bottom row HUD */}
      <div 
        id="hud-bottom-row"
        className={`fixed bottom-12 left-0 right-0 px-10 flex items-end justify-between z-20 transition-all duration-1000 delay-300 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Left Side Blurb */}
        <p className="text-sm font-body font-light text-white/75 max-w-[250px] leading-relaxed">
          COCOFY connects managers, workers, and field teams into one seamless, high-performance ecosystem.
        </p>

        {/* Center Buttons */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex items-center gap-3">
          <Link 
            id="get-started-button"
            href="/login"
            className="group relative bg-white text-black text-sm font-body font-medium rounded px-8 py-3.5 overflow-hidden active:scale-[0.97] transition-all duration-200 shadow-[0_0_0_0_rgba(255,255,255,0)] hover:shadow-[0_0_24px_4px_rgba(255,255,255,0.25)] hover:scale-[1.03] flex items-center gap-2 cursor-pointer"
          >
            <span className="relative z-10 flex items-center gap-1.5">
              Get started
              <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
            <span className="absolute inset-0 bg-gradient-to-b from-white to-white/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </Link>
        </div>

        {/* Right Side Blurb */}
        <p className="text-sm font-body font-light text-white/75 max-w-[250px] leading-relaxed text-right">
          Streamline your supply chain, track runs in real time, and monitor cash flow ledger statistics.
        </p>
      </div>

      {/* Frame Loading State Indicator at VERY Bottom */}
      <div 
        id="loading-progress-bar"
        className="fixed bottom-0 left-0 w-full z-30 flex flex-col items-center pointer-events-none"
      >
        <div 
          className={`w-full max-w-xs mb-4 bg-white/5 border border-white/10 rounded px-3 py-1.5 backdrop-blur-md flex items-center justify-between transition-all duration-500 text-[11px] font-mono tracking-wider text-white/50 ${
            framesReady ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping" />
            <span>CACHING FRAME BUFFERS</span>
          </div>
          <span className="text-white/80 font-semibold">{captureProgress}%</span>
        </div>
        
        {/* Subtle persistent loading bar inside the screen border */}
        <div className="w-full bg-white/5 h-0.5 relative overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-sky-400 via-white to-indigo-400 transition-all duration-100 ease-out" 
            style={{ width: `${framesReady ? 100 : captureProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
