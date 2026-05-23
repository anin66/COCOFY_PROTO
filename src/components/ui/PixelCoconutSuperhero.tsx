"use client";

import React, { useEffect, useRef, useState } from "react";

export default function PixelCoconutSuperhero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new window.Image();
    img.src = "/hero_character.png";
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const w = img.width;
      const h = img.height;
      canvas.width = w;
      canvas.height = h;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Get image data for pixel manipulation
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // Helper to check if a pixel is part of the checkerboard background
      // Checkerboard is made of white (#ffffff) and light gray (#cccccc / #e0e0e0)
      const isBgColor = (r: number, g: number, b: number): boolean => {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        const avg = (r + g + b) / 3;

        // Any neutral/gray shade that is not extremely dark
        // This catches the checkerboard lines, compression artifacts, and the stray gray box
        if (diff < 35) {
          return avg > 40;
        }
        
        // Catch any very bright pixels
        if (r > 215 && g > 215 && b > 215) {
          return true;
        }

        return false;
      };

      // Flood-fill BFS to remove only the connected background checkerboard.
      // This prevents removing internal white elements like eye whites.
      const visited = new Uint8Array(w * h);
      const queue: number[] = [];

      // Add the four corners to the queue
      const pushPixel = (x: number, y: number) => {
        const idx = y * w + x;
        if (!visited[idx]) {
          visited[idx] = 1;
          queue.push(idx);
        }
      };

      // Push all boundary pixels to ensure we catch the background from all edges
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
        const r = data[pxIdx];
        const g = data[pxIdx + 1];
        const b = data[pxIdx + 2];

        if (isBgColor(r, g, b)) {
          // Clear background pixel (make transparent)
          data[pxIdx + 3] = 0;

          // Push neighbors (up, down, left, right)
          if (x > 0) pushPixel(x - 1, y);
          if (x < w - 1) pushPixel(x + 1, y);
          if (y > 0) pushPixel(x, y - 1);
          if (y < h - 1) pushPixel(x, y + 1);
        }
      }

      // Draw clean transparent image back to canvas
      ctx.putImageData(imgData, 0, 0);
      setLoading(false);
    };

    img.onerror = () => {
      console.error("Failed to load image /hero_character.png");
      setLoading(false);
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
          Processing image...
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
