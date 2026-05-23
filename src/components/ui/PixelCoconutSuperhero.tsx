"use client";

import React, { useEffect, useRef, useState } from "react";

interface EyeConfig {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  cx: number;
  cy: number;
}

export default function PixelCoconutSuperhero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const [loading, setLoading] = useState<boolean>(true);
  
  // Ref to hold detected eye coordinates
  const eyesRef = useRef<{ left: EyeConfig; right: EyeConfig } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set up mouse move listener
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    const img = new window.Image();
    img.src = "/hero_character.png";
    img.onload = () => {
      const w = img.width;
      const h = img.height;

      // 1. Create offline processed canvas
      const pc = document.createElement("canvas");
      pc.width = w;
      pc.height = h;
      const pCtx = pc.getContext("2d")!;
      pCtx.drawImage(img, 0, 0);

      const imgData = pCtx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Helper to classify background grays/whites
      const isBgColor = (r: number, g: number, b: number): boolean => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        const avg = (r + g + b) / 3;
        if (diff < 35) return avg > 40;
        if (r > 215 && g > 215 && b > 215) return true;
        return false;
      };

      // 2. BFS flood-fill background removal
      const visited = new Uint8Array(w * h);
      const queue: number[] = [];
      const pushPixel = (x: number, y: number) => {
        const idx = y * w + x;
        if (!visited[idx]) {
          visited[idx] = 1;
          queue.push(idx);
        }
      };

      for (let x = 0; x < w; x++) {
        pushPixel(x, 0);
        pushPixel(x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        pushPixel(0, y);
        pushPixel(w - 1, y);
      }

      let qHead = 0;
      while (qHead < queue.length) {
        const idx = queue[qHead++];
        const x = idx % w;
        const y = Math.floor(idx / w);
        const pxIdx = idx * 4;
        
        if (isBgColor(data[pxIdx], data[pxIdx + 1], data[pxIdx + 2])) {
          data[pxIdx + 3] = 0; // Make transparent
          if (x > 0) pushPixel(x - 1, y);
          if (x < w - 1) pushPixel(x + 1, y);
          if (y > 0) pushPixel(x, y - 1);
          if (y < h - 1) pushPixel(x, y + 1);
        }
      }
      pCtx.putImageData(imgData, 0, 0);

      // 3. Scan face region for white eye pixels to auto-calibrate eye boxes
      // Face bounding box: x (35% to 65%), y (25% to 55%)
      const leftEyePixels: { x: number; y: number }[] = [];
      const rightEyePixels: { x: number; y: number }[] = [];

      for (let y = Math.round(h * 0.25); y < Math.round(h * 0.55); y++) {
        for (let x = Math.round(w * 0.35); x < Math.round(w * 0.65); x++) {
          const idx = (y * w + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];

          // Pure white eye whites (excluding background and outline)
          if (a > 0 && r > 248 && g > 248 && b > 248) {
            if (x < w / 2) {
              leftEyePixels.push({ x, y });
            } else {
              rightEyePixels.push({ x, y });
            }
          }
        }
      }

      const getBBox = (pixels: { x: number; y: number }[]): EyeConfig => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        pixels.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
        return {
          minX,
          maxX,
          minY,
          maxY,
          cx: (minX + maxX) / 2,
          cy: (minY + maxY) / 2,
        };
      };

      if (leftEyePixels.length > 0 && rightEyePixels.length > 0) {
        const leftBBox = getBBox(leftEyePixels);
        const rightBBox = getBBox(rightEyePixels);
        eyesRef.current = { left: leftBBox, right: rightBBox };

        // 4. Fill original eye whites with pure white on the base processed canvas
        // This paints over the static black pupils, preparing the canvas for dynamic pupils
        pCtx.fillStyle = "#ffffff";
        leftEyePixels.forEach(p => pCtx.fillRect(p.x, p.y, 1, 1));
        rightEyePixels.forEach(p => pCtx.fillRect(p.x, p.y, 1, 1));
      }

      processedCanvasRef.current = pc;
      setLoading(false);
    };

    // 5. 60 FPS animation loop to render character and dynamic pupils
    let rafId: number;
    const animate = () => {
      const canvas = canvasRef.current;
      const pc = processedCanvasRef.current;
      const eyes = eyesRef.current;

      if (canvas && pc) {
        if (canvas.width !== pc.width) {
          canvas.width = pc.width;
          canvas.height = pc.height;
        }

        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw the character body (without static pupils)
        ctx.drawImage(pc, 0, 0);

        if (eyes) {
          const rect = canvas.getBoundingClientRect();
          const displayScale = rect.width / canvas.width;
          
          // Get mouse relative coordinates
          const mx = mouseRef.current.x;
          const my = mouseRef.current.y;

          const drawPupil = (eye: EyeConfig) => {
            const screenX = rect.left + eye.cx * displayScale;
            const screenY = rect.top + eye.cy * displayScale;
            
            const dx = mx - screenX;
            const dy = my - screenY;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;

            // Pupil size relative to the eye socket size
            const pw = (eye.maxX - eye.minX) * 0.35;
            const ph = (eye.maxY - eye.minY) * 0.70;

            // Maximum range the pupil can shift inside the socket
            const maxShiftX = (eye.maxX - eye.minX) * 0.22;
            const maxShiftY = (eye.maxY - eye.minY) * 0.15;

            // Calculate offset direction towards mouse
            const ox = (dx / dist) * maxShiftX;
            const oy = (dy / dist) * maxShiftY;

            // Draw pupil
            ctx.fillStyle = "#111710"; // Dark pixel color matching the outline
            ctx.fillRect(eye.cx - pw / 2 + ox, eye.cy - ph / 2 + oy, pw, ph);
          };

          drawPupil(eyes.left);
          drawPupil(eyes.right);
        }
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
          Processing image and calibrating eye tracking...
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
