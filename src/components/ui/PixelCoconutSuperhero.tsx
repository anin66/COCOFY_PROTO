"use client";

import React, { useEffect, useRef, useState } from "react";

export default function PixelCoconutSuperhero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Track mouse coordinates
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const img = new window.Image();
    img.src = "/hero_character_transparent.png";
    img.onload = () => {
      imgRef.current = img;
      setLoading(false);
    };

    img.onerror = () => {
      console.error("Failed to load /hero_character_transparent.png");
      setLoading(false);
    };

    // 60 FPS animation loop
    let rafId: number;
    const animate = () => {
      const canvas = canvasRef.current;
      const pc = imgRef.current;

      if (canvas && pc) {
        // Setup matching width/height
        if (canvas.width !== pc.width) {
          canvas.width = pc.width;
          canvas.height = pc.height;
        }

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 1. Draw the pre-processed character body (with solid white eyes)
        ctx.drawImage(pc, 0, 0);

        // 2. Draw dynamic cursor-tracking pupils
        const rect = canvas.getBoundingClientRect();
        const displayScale = rect.width / canvas.width;
        
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;

        const drawPupil = (cx: number, cy: number, minX: number, maxX: number, minY: number, maxY: number) => {
          const screenX = rect.left + cx * displayScale;
          const screenY = rect.top + cy * displayScale;
          
          const dx = mx - screenX;
          const dy = my - screenY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          // Pupil dimensions (scales nicely with pixel art look)
          const pw = 14;
          const ph = 22;

          // Maximum amount pupil can travel inside the eye socket
          const maxShiftX = (maxX - minX) * 0.20;
          const maxShiftY = (maxY - minY) * 0.15;

          // Shift coordinates towards cursor position
          const ox = (dx / dist) * maxShiftX;
          const oy = (dy / dist) * maxShiftY;

          // Draw the pupil
          ctx.fillStyle = "#111710"; // Dark pixel color matching the outlines
          ctx.fillRect(cx - pw / 2 + ox, cy - ph / 2 + oy, pw, ph);
        };

        // Left Eye (cx=380, cy=222, BBox bounds: x[335..425], y[180..265])
        drawPupil(380, 222, 335, 425, 180, 265);

        // Right Eye (cx=647, cy=230, BBox bounds: x[600..695], y[180..265])
        drawPupil(647, 230, 600, 695, 180, 265);
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "750px",
    }}>
      {loading && (
        <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Loading transparent character...
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          display: loading ? "none" : "block",
          width: "100%",
          maxWidth: "850px",
          height: "auto",
          imageRendering: "pixelated",
          filter: "drop-shadow(0 20px 40px var(--primary-glow-border))",
        }}
      />
    </div>
  );
}
