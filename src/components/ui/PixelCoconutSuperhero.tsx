"use client";

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Settings, Sliders, Scissors, Pipette, Eye, EyeOff } from "lucide-react";

export default function PixelCoconutSuperhero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Configuration State ---
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(10);
  const [duration, setDuration] = useState<number>(10);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  
  // Chroma Key Settings
  const [keyColor, setKeyColor] = useState<{ r: number; g: number; b: number }>({ r: 0, g: 0, b: 0 });
  const [tolerance, setTolerance] = useState<number>(45);
  const [feather, setFeather] = useState<number>(15);
  const [autoDetect, setAutoDetect] = useState<boolean>(true);
  
  // UI Panels
  const [showControls, setShowControls] = useState<boolean>(false);
  const [isPickingColor, setIsPickingColor] = useState<boolean>(false);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let rafId: number;
    let autoDetectDone = false;

    // Set duration when metadata is loaded
    const onMetadataLoaded = () => {
      setDuration(video.duration);
      setEndTime(video.duration);
    };
    video.addEventListener("loadedmetadata", onMetadataLoaded);

    // Main render loop
    const render = () => {
      if (video.paused || video.ended) {
        rafId = requestAnimationFrame(render);
        return;
      }

      // 1. Time clamping and looping logic
      const current = video.currentTime;
      setCurrentTime(current);

      if (current < startTime) {
        video.currentTime = startTime;
      } else if (current >= endTime) {
        video.currentTime = startTime;
      }

      // 2. Setup canvas sizes
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh) {
        if (canvas.width !== vw) {
          canvas.width = vw;
          canvas.height = vh;
        }

        // Initialize offscreen buffer canvas if needed
        if (!bufferCanvasRef.current) {
          bufferCanvasRef.current = document.createElement("canvas");
        }
        const buffer = bufferCanvasRef.current;
        if (buffer.width !== vw) {
          buffer.width = vw;
          buffer.height = vh;
        }

        const ctx = canvas.getContext("2d");
        const bCtx = buffer.getContext("2d");

        if (ctx && bCtx) {
          // Draw video frame to buffer canvas
          bCtx.drawImage(video, 0, 0, vw, vh);

          // Get image data
          const imgData = bCtx.getImageData(0, 0, vw, vh);
          const pixels = imgData.data;

          // 3. Auto-detect background color from corner pixels on first frame
          if (autoDetect && !autoDetectDone && pixels.length > 0) {
            // Sample the 4 corners: top-left, top-right, bottom-left, bottom-right
            const corners = [
              0, // Top-Left
              (vw - 1) * 4, // Top-Right
              (vh - 1) * vw * 4, // Bottom-Left
              (vh * vw - 1) * 4 // Bottom-Right
            ];
            let avgR = 0, avgG = 0, avgB = 0;
            corners.forEach(idx => {
              avgR += pixels[idx];
              avgG += pixels[idx + 1];
              avgB += pixels[idx + 2];
            });
            setKeyColor({
              r: Math.round(avgR / 4),
              g: Math.round(avgG / 4),
              b: Math.round(avgB / 4)
            });
            autoDetectDone = true;
          }

          // 4. Perform Chroma-Key background removal
          const kr = keyColor.r;
          const kg = keyColor.g;
          const kb = keyColor.b;
          const tolSq = tolerance * tolerance;
          const featherRange = feather * feather;

          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Euclidean distance in RGB color space squared
            const distSq = (r - kr) * (r - kr) + (g - kg) * (g - kg) + (b - kb) * (b - kb);

            if (distSq < tolSq) {
              pixels[i + 3] = 0; // Fully transparent
            } else if (distSq < tolSq + featherRange && featherRange > 0) {
              // Smooth feathering alpha transition
              const diff = distSq - tolSq;
              const ratio = diff / featherRange; // 0 to 1
              pixels[i + 3] = Math.min(pixels[i + 3], Math.round(ratio * 255));
            }
          }

          // Write processed pixels back to the visible canvas
          ctx.putImageData(imgData, 0, 0);
        }
      }

      rafId = requestAnimationFrame(render);
    };

    video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    rafId = requestAnimationFrame(render);

    return () => {
      video.removeEventListener("loadedmetadata", onMetadataLoaded);
      cancelAnimationFrame(rafId);
    };
  }, [startTime, endTime, keyColor, tolerance, feather, autoDetect]);

  // Click on canvas to sample chroma-key color
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingColor) return;
    const canvas = canvasRef.current;
    const buffer = bufferCanvasRef.current;
    if (!canvas || !buffer) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    const bCtx = buffer.getContext("2d");
    if (bCtx) {
      const pixel = bCtx.getImageData(x, y, 1, 1).data;
      setKeyColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
      setAutoDetect(false); // Disable auto-detect since user manually chose a color
      setIsPickingColor(false);
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    }}>
      {/* Hidden Video Source */}
      <video
        ref={videoRef}
        src="/hero_video.mp4"
        style={{ display: "none" }}
        loop
        muted
        playsInline
      />

      {/* Render Canvas */}
      <div style={{ position: "relative", cursor: isPickingColor ? "crosshair" : "default" }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            display: "block",
            width: "100%",
            maxWidth: "380px",
            height: "auto",
            filter: "drop-shadow(0 15px 35px var(--primary-glow-border))",
            borderRadius: "16px",
          }}
        />

        {isPickingColor && (
          <div style={{
            position: "absolute",
            top: "12px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(10, 10, 10, 0.85)",
            backdropFilter: "blur(8px)",
            padding: "6px 12px",
            borderRadius: "20px",
            fontSize: "0.75rem",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.15)",
            pointerEvents: "none",
            zIndex: 10,
            whiteSpace: "nowrap"
          }}>
            Click anywhere on background to select color
          </div>
        )}
      </div>

      {/* Settings Panel Toggle */}
      <button
        onClick={() => setShowControls(!showControls)}
        style={{
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "var(--text-light)",
          padding: "0.5rem 1rem",
          borderRadius: "20px",
          cursor: "pointer",
          fontSize: "0.85rem",
          transition: "all 0.2s",
          backdropFilter: "blur(10px)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          e.currentTarget.style.borderColor = "var(--primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        }}
      >
        {showControls ? <EyeOff size={16} /> : <Eye size={16} />}
        {showControls ? "Hide Calibration Settings" : "Calibrate Animation & Background"}
      </button>

      {/* Dev & Calibration Controls */}
      {showControls && (
        <div style={{
          marginTop: "1rem",
          width: "100%",
          maxWidth: "400px",
          background: "rgba(15, 18, 20, 0.95)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "16px",
          padding: "1.25rem",
          color: "#eee",
          fontSize: "0.85rem",
          zIndex: 10,
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}>
          {/* Section 1: Playback Timing */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: "bold" }}>
                <Scissors size={14} className="text-primary" />
                <span>Wave Loop Range</span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
              </span>
            </div>
            
            {/* Start Time Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                <span>Start Time: {startTime.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0"
                max={endTime.toFixed(2)}
                step="0.05"
                value={startTime}
                onChange={(e) => setStartTime(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
            </div>

            {/* End Time Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                <span>End Time: {endTime.toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min={startTime.toFixed(2)}
                max={duration.toFixed(2)}
                step="0.05"
                value={endTime}
                onChange={(e) => setEndTime(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
            </div>
          </div>

          {/* Section 2: Chroma Key Controls */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: "bold" }}>
                <Pipette size={14} className="text-primary" />
                <span>Background Removal</span>
              </div>
              <button
                onClick={() => setAutoDetect(!autoDetect)}
                style={{
                  background: autoDetect ? "rgba(0, 240, 120, 0.15)" : "transparent",
                  border: "1px solid " + (autoDetect ? "var(--primary)" : "rgba(255,255,255,0.15)"),
                  color: autoDetect ? "var(--primary)" : "#aaa",
                  padding: "2px 8px",
                  borderRadius: "10px",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                }}
              >
                {autoDetect ? "Auto: ON" : "Auto: OFF"}
              </button>
            </div>

            {/* Key Color Picker Indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "0.25rem 0" }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: `rgb(${keyColor.r}, ${keyColor.g}, ${keyColor.b})`,
                border: "1px solid rgba(255,255,255,0.3)"
              }} />
              <button
                onClick={() => setIsPickingColor(!isPickingColor)}
                style={{
                  background: isPickingColor ? "var(--primary)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: isPickingColor ? "#000" : "#fff",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: isPickingColor ? "bold" : "normal"
                }}
              >
                {isPickingColor ? "Picking..." : "Click canvas to pick color"}
              </button>
            </div>

            {/* Tolerance Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                <span>Tolerance: {tolerance}</span>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
            </div>

            {/* Feather Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
                <span>Feather/Smoothness: {feather}</span>
              </div>
              <input
                type="range"
                min="0"
                max="60"
                value={feather}
                onChange={(e) => setFeather(parseInt(e.target.value))}
                style={{ width: "100%", accentColor: "var(--primary)" }}
              />
            </div>
          </div>

          {/* Section 3: Playback Action */}
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "0.75rem" }}>
            <button
              onClick={togglePlayback}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                padding: "4px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.75rem"
              }}
            >
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              onClick={() => {
                const configString = `// Hardcode these parameters inside PixelCoconutSuperhero.tsx:\nconst DEFAULT_START_TIME = ${startTime.toFixed(2)};\nconst DEFAULT_END_TIME = ${endTime.toFixed(2)};\nconst DEFAULT_KEY_COLOR = { r: ${keyColor.r}, g: ${keyColor.g}, b: ${keyColor.b} };\nconst DEFAULT_TOLERANCE = ${tolerance};\nconst DEFAULT_FEATHER = ${feather};`;
                navigator.clipboard.writeText(configString);
                alert("Calibration parameters copied to clipboard!");
              }}
              style={{
                background: "var(--primary)",
                border: "none",
                color: "#000",
                padding: "4px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: "bold"
              }}
            >
              Copy Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
