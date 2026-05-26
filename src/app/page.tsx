/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { gsap } from 'gsap';
import { ArrowRight, Sun, Moon } from 'lucide-react';

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
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  const [isMobile, setIsMobile] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            router.push(`/dashboard/${userData.role}`);
          }
        } catch (err) {
          console.error("Error auto-login redirecting:", err);
        }
      }
    });
    return () => unsub();
  }, [router]);
  
  // Separate states for dark and light cache buffers
  const [darkFramesReady, setDarkFramesReady] = useState(false);
  const [lightFramesReady, setLightFramesReady] = useState(false);
  const [darkProgress, setDarkProgress] = useState(0);
  const [lightProgress, setLightProgress] = useState(0);

  const darkVideoRef = useRef<HTMLVideoElement>(null);
  const lightVideoRef = useRef<HTMLVideoElement>(null);
  const videoBgRef = useRef<HTMLDivElement>(null);
  
  const darkCanvasRef = useRef<HTMLCanvasElement>(null);
  const lightCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const darkFramesRef = useRef<HTMLCanvasElement[]>([]);
  const lightFramesRef = useRef<HTMLCanvasElement[]>([]);

  // Effect 0: Mount fade-in and read theme from document attributes
  useEffect(() => {
    setMounted(true);
    const activeTheme = (document.documentElement.getAttribute('data-theme') || 'dark') as 'dark' | 'light';
    setTheme(activeTheme);

    const checkMobile = () => {
      const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsMobile(window.innerWidth <= 1150 || isTouch);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Reusable function to set up frame capturing logic
  const setupCapture = (
    video: HTMLVideoElement, 
    framesRef: React.MutableRefObject<HTMLCanvasElement[]>, 
    setReady: (ready: boolean) => void, 
    setProgress: (progress: number) => void
  ) => {
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

      const progress = Math.min(100, Math.round((currentTime / duration) * 100));
      setProgress(progress);

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
      setReady(true);
    };
    video.addEventListener('ended', onEnded);

    if (video.readyState >= 1) {
      onLoaded();
    }

    return () => {
      capturing = false;
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('ended', onEnded);
      if (frameId !== null) {
        const anyVideo = video as any;
        if (anyVideo && 'cancelVideoFrameCallback' in anyVideo && typeof anyVideo.cancelVideoFrameCallback === 'function') {
          anyVideo.cancelVideoFrameCallback(frameId);
        } else {
          cancelAnimationFrame(frameId);
        }
      }
    };
  };

  // Capture effect for dark video (starts immediately)
  useEffect(() => {
    if (isMobile) return;
    const video = darkVideoRef.current;
    if (!video) return;
    return setupCapture(video, darkFramesRef, setDarkFramesReady, setDarkProgress);
  }, [isMobile]);

  // Capture effect for light video (runs sequentially after dark is ready, OR if theme is light)
  useEffect(() => {
    if (isMobile) return;
    if (!darkFramesReady && theme !== 'light') return;
    const video = lightVideoRef.current;
    if (!video) return;
    return setupCapture(video, lightFramesRef, setLightFramesReady, setLightProgress);
  }, [darkFramesReady, theme, isMobile]);

  // Reusable function to set up render loop
  const setupRender = (canvas: HTMLCanvasElement, frames: HTMLCanvasElement[]) => {
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
  };

  // Render loop for dark video
  useEffect(() => {
    if (!darkFramesReady || darkFramesRef.current.length <= 1) return;
    const canvas = darkCanvasRef.current;
    if (!canvas) return;
    return setupRender(canvas, darkFramesRef.current);
  }, [darkFramesReady]);

  // Render loop for light video
  useEffect(() => {
    if (!lightFramesReady || lightFramesRef.current.length <= 1) return;
    const canvas = lightCanvasRef.current;
    if (!canvas) return;
    return setupRender(canvas, lightFramesRef.current);
  }, [lightFramesReady]);

  // Effect 3: Parallax mouse tracking
  useEffect(() => {
    if (isMobile) return;
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
  }, [isMobile]);

  const activeFramesReady = theme === 'dark' ? darkFramesReady : lightFramesReady;
  const activeProgress = theme === 'dark' ? darkProgress : lightProgress;

  return (
    <div id="root-viewport" className="min-h-screen bg-black text-white font-body overflow-x-hidden relative select-none">
      {/* Theme Toggle Switch */}
      <button
        id="theme-toggle-switch"
        onClick={toggleTheme}
        className="fixed top-6 right-8 z-50 p-3 rounded-full cursor-pointer transition-all duration-300 bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 hover:border-white/20 active:scale-95 shadow-lg flex items-center justify-center group"
        aria-label="Toggle theme"
      >
        <div className="relative w-6 h-6">
          <Moon 
            className={`w-6 h-6 absolute inset-0 text-sky-300 transition-all duration-500 ease-out transform ${
              theme === 'dark' ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'
            }`}
          />
          <Sun 
            className={`w-6 h-6 absolute inset-0 text-amber-400 transition-all duration-500 ease-out transform ${
              theme === 'light' ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 rotate-90'
            }`}
          />
        </div>
      </button>

      {/* 1. Video background layer */}
      <div 
        id="video-parallax-container"
        ref={videoBgRef} 
        className="fixed top-0 left-0 w-full h-full z-0 scale-[1.08] origin-center pointer-events-none"
      >
        {/* Hidden video buffers for frame capturing */}
        <video
          id="hero-video-dark-backend"
          ref={darkVideoRef}
          src="/dark_video.mp4"
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          className="hidden"
        />
        <video
          id="hero-video-light-backend"
          ref={lightVideoRef}
          src="/light_video.mp4"
          muted
          playsInline
          preload="auto"
          crossOrigin="anonymous"
          className="hidden"
        />

        {/* Display Canvases */}
        <canvas 
          id="hero-boomerang-canvas-dark"
          ref={darkCanvasRef} 
          className="w-full h-full object-cover absolute inset-0 transition-opacity duration-1000 ease-in-out" 
          style={{ 
            display: darkFramesReady ? 'block' : 'none',
            opacity: theme === 'dark' ? 1 : 0,
            zIndex: theme === 'dark' ? 2 : 1
          }}
        />
        <canvas 
          id="hero-boomerang-canvas-light"
          ref={lightCanvasRef} 
          className="w-full h-full object-cover absolute inset-0 transition-opacity duration-1000 ease-in-out" 
          style={{ 
            display: lightFramesReady ? 'block' : 'none',
            opacity: theme === 'light' ? 1 : 0,
            zIndex: theme === 'light' ? 2 : 1
          }}
        />
        
        {/* Fallback raw video players (while loading) */}
        {!darkFramesReady && theme === 'dark' && (
          <video
            src="/dark_video.mp4"
            muted
            playsInline
            autoPlay
            loop
            className="w-full h-full object-cover absolute inset-0"
          />
        )}
        {!lightFramesReady && theme === 'light' && (
          <video
            src="/light_video.mp4"
            muted
            playsInline
            autoPlay
            loop
            className="w-full h-full object-cover absolute inset-0"
          />
        )}
        
        {/* Dynamic theme-specific color washing overlay to make text highly readable */}
        <div 
          id="theme-overlay" 
          className={`absolute inset-0 transition-all duration-1000 z-10 pointer-events-none ${
            theme === 'dark' 
              ? 'bg-black/35' 
              : 'bg-transparent'
          }`} 
        />
        
        {/* Dynamic vignette/ambient overlay covering the background */}
        <div 
          id="vignette-overlay" 
          className="absolute inset-0 transition-all duration-1000 pointer-events-none z-10 bg-transparent" 
        />
      </div>

      {/* 2. Hero title */}
      <div 
        id="hero-title-container"
        className={isMobile ? "relative mx-auto mt-16 mb-8 w-full px-4 text-center z-20 transition-opacity duration-1000" : `fixed left-0 right-0 z-20 w-full px-4 text-center transition-all duration-1000 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
        style={isMobile ? undefined : { top: '126px' }}
      >
        <span className="hero-subtitle">
          LOGISTICS REIMAGINED
        </span>
        <h1 className="hero-title select-none">
          COCOFY
        </h1>
      </div>

      {/* 3. Center Get Started Button */}
      <div 
        id="center-cta-container"
        className={isMobile ? "relative mx-auto my-8 flex justify-center w-fit z-20 transition-opacity duration-1000 delay-200" : `fixed left-1/2 -translate-x-1/2 z-20 transition-all duration-1000 delay-200 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
        style={isMobile ? undefined : { top: '62%' }}
      >
        <Link 
          id="get-started-center-button"
          href="/login"
          className="cta"
        >
          <span className="hover-underline-animation">
            Get started
          </span>
          <svg viewBox="0 0 46 16" height="12" width="18" xmlns="http://www.w3.org/2000/svg" id="cta-arrow-horizontal">
            <path 
              transform="translate(30)" 
              d="M8,0,6.545,1.455l5.506,5.506H0V9H12.052L6.545,14.506,8,16l8-8Z" 
              fill="currentColor"
            ></path>
          </svg>
        </Link>
      </div>

      {/* 4. Bottom row HUD */}
      <div 
        id="hud-bottom-row"
        className={isMobile ? "relative w-full px-4 flex flex-col items-center gap-6 z-20 transition-opacity duration-1000 delay-300" : `fixed bottom-12 left-0 right-0 px-10 flex items-end justify-between z-20 transition-all duration-1000 delay-300 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Left Side Blurb */}
        <p className="hud-blurb">
          COCOFY connects managers, workers, and field teams into one seamless, high-performance ecosystem.
        </p>

        {/* Right Side Blurb */}
        <p className="hud-blurb text-right">
          Streamline your supply chain, track runs in real time, and monitor cash flow ledger statistics.
        </p>
      </div>

      {/* Frame Loading State Indicator at VERY Bottom */}
      {!isMobile && (
        <div 
          id="loading-progress-bar"
          className="fixed bottom-0 left-0 w-full z-30 flex flex-col items-center pointer-events-none"
        >
          <div 
            className={`w-full max-w-xs mb-4 bg-white/5 border border-white/10 rounded px-3 py-1.5 backdrop-blur-md flex items-center justify-between transition-all duration-500 text-[11px] font-mono tracking-wider text-white/50 ${
              activeFramesReady ? 'opacity-0 translate-y-2 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping" />
              <span>CACHING {theme.toUpperCase()} FRAME BUFFERS</span>
            </div>
            <span className="text-white/80 font-semibold">{activeProgress}%</span>
          </div>
          
          {/* Subtle persistent loading bar inside the screen border */}
          <div className="w-full bg-white/5 h-0.5 relative overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-sky-400 via-white to-indigo-400 transition-all duration-100 ease-out" 
              style={{ width: `${activeFramesReady ? 100 : activeProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
