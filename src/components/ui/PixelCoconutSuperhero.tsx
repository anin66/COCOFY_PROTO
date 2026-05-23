"use client";

import React, { useEffect, useRef, useCallback } from "react";

// ─── Source image extraction constants ────────────────────────────────────────
// img2.png: 625×488px, character extracted at:
//   startX=78, startY=1, blockW=16.4, cols=29, rows=26
const SRC_X = 78;
const SRC_Y = 1;
const BLOCK = 16.4;
const COLS = 29;
const ROWS = 26;
const SRC_W = Math.ceil(COLS * BLOCK);  // 476
const SRC_H = Math.ceil(ROWS * BLOCK);  // 427

// Right waving arm bounds (grid coords within character region)
const ARM_GX = 18; // arm starts at column 18
const ARM_GY = 6;  // arm starts at row 6
const ARM_GW = 11; // 11 columns wide
const ARM_GH = 8;  // 8 rows tall

// Eye positions (grid coords)
const L_EYE_GX = 7;
const L_EYE_GY = 11;
const EYE_GW = 3;
const EYE_GH = 2;
const R_EYE_GX = 14;
const R_EYE_GY = 11;

// Pupil size (1 grid unit)
const PUPIL_GW = 1;
const PUPIL_GH = 2;

// Background color check - light grayish-green background of the sprite card
function isBackground(r: number, g: number, b: number): boolean {
  // All background variants are high-luminance greenish-gray
  // They have: r > 185, g > 195, b > 185, and roughly r ≈ b < g
  return (
    r > 185 && g > 195 && b > 185 &&
    Math.abs(r - b) < 25 &&
    g >= r &&
    g >= b
  );
}

export default function PixelCoconutSuperhero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pre-processed offscreen canvases
  const bodyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const armCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animation state
  const mousePosRef = useRef({ x: 0, y: 0 });
  const wavePhaseRef = useRef(0);
  const floatPhaseRef = useRef(0);
  const rafRef = useRef<number>(0);
  const loadedRef = useRef(false);

  // Pre-process the image: separate body and arm, remove background
  const preprocessImage = useCallback((img: HTMLImageElement) => {
    // ── Full character region ──────────────────────────────────────────────
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = SRC_W;
    fullCanvas.height = SRC_H;
    const fullCtx = fullCanvas.getContext("2d")!;
    fullCtx.drawImage(img, SRC_X, SRC_Y, SRC_W, SRC_H, 0, 0, SRC_W, SRC_H);
    const fullData = fullCtx.getImageData(0, 0, SRC_W, SRC_H);

    // Remove background from the full image
    for (let i = 0; i < fullData.data.length; i += 4) {
      if (isBackground(fullData.data[i], fullData.data[i + 1], fullData.data[i + 2])) {
        fullData.data[i + 3] = 0;
      }
    }
    fullCtx.putImageData(fullData, 0, 0);

    // ── Body canvas (full character minus arm region) ──────────────────────
    const bodyCanvas = document.createElement("canvas");
    bodyCanvas.width = SRC_W;
    bodyCanvas.height = SRC_H;
    const bodyCtx = bodyCanvas.getContext("2d")!;
    bodyCtx.drawImage(fullCanvas, 0, 0);

    // Clear the arm area from the body canvas
    const armPxX = Math.round(ARM_GX * BLOCK);
    const armPxY = Math.round(ARM_GY * BLOCK);
    const armPxW = Math.round(ARM_GW * BLOCK);
    const armPxH = Math.round(ARM_GH * BLOCK);
    bodyCtx.clearRect(armPxX, armPxY, armPxW, armPxH);

    // Also clear the eye whites so we can draw dynamic pupils on top
    const lEyePxX = Math.round(L_EYE_GX * BLOCK);
    const lEyePxY = Math.round(L_EYE_GY * BLOCK);
    const eyePxW = Math.round(EYE_GW * BLOCK);
    const eyePxH = Math.round(EYE_GH * BLOCK);
    const rEyePxX = Math.round(R_EYE_GX * BLOCK);
    // Don't clear eyes - just let pupils draw on top

    bodyCanvasRef.current = bodyCanvas;

    // ── Arm canvas (just the arm region) ──────────────────────────────────
    const armCanvas = document.createElement("canvas");
    armCanvas.width = armPxW;
    armCanvas.height = armPxH;
    const armCtx = armCanvas.getContext("2d")!;
    armCtx.drawImage(
      fullCanvas,
      armPxX, armPxY, armPxW, armPxH,
      0, 0, armPxW, armPxH
    );
    armCanvasRef.current = armCanvas;

    loadedRef.current = true;
  }, []);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const bodyCanvas = bodyCanvasRef.current;
    const armCanvas = armCanvasRef.current;
    if (!canvas || !bodyCanvas || !armCanvas || !loadedRef.current) {
      rafRef.current = requestAnimationFrame(drawFrame);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const SCALE = W / SRC_W;
    const block = BLOCK * SCALE;

    // Animation phases
    const wave = Math.sin(wavePhaseRef.current) * (14 * Math.PI / 180);
    const floatY = Math.sin(floatPhaseRef.current) * 6; // pixels of float

    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    ctx.save();

    // Float animation
    ctx.translate(0, floatY);

    // ── 1. Draw body ──────────────────────────────────────────────────────
    ctx.drawImage(bodyCanvas, 0, 0, SRC_W, SRC_H, 0, 0, W, H);

    // ── 2. Draw animated waving arm ───────────────────────────────────────
    const armDispX = ARM_GX * block;
    const armDispY = ARM_GY * block;
    const armDispW = ARM_GW * block;
    const armDispH = ARM_GH * block;

    ctx.save();
    // Pivot at the shoulder: top-left of arm area
    ctx.translate(armDispX, armDispY);
    ctx.rotate(wave);
    ctx.drawImage(armCanvas, 0, 0, armCanvas.width, armCanvas.height, 0, 0, armDispW, armDispH);
    ctx.restore();

    // ── 3. Draw cursor-tracking pupils ────────────────────────────────────
    const rect = canvas.getBoundingClientRect();
    const mx = mousePosRef.current.x;
    const my = mousePosRef.current.y;

    // Left eye pupil
    const lCx = (L_EYE_GX + EYE_GW / 2) * block;
    const lCy = (L_EYE_GY + EYE_GH / 2) * block;
    const lDx = mx - (rect.left + lCx);
    const lDy = my - (rect.top + lCy + floatY);
    const lDist = Math.sqrt(lDx * lDx + lDy * lDy) || 1;
    const lOx = (lDx / lDist) * block * 0.45;
    const lOy = (lDy / lDist) * block * 0.25;

    // Right eye pupil
    const rCx = (R_EYE_GX + EYE_GW / 2) * block;
    const rCy = (R_EYE_GY + EYE_GH / 2) * block;
    const rDx = mx - (rect.left + rCx);
    const rDy = my - (rect.top + rCy + floatY);
    const rDist = Math.sqrt(rDx * rDx + rDy * rDy) || 1;
    const rOx = (rDx / rDist) * block * 0.45;
    const rOy = (rDy / rDist) * block * 0.25;

    const pupilW = PUPIL_GW * block;
    const pupilH = PUPIL_GH * block;

    ctx.fillStyle = "#111710";
    // Left pupil
    ctx.fillRect(lCx - pupilW / 2 + lOx, lCy - pupilH / 2 + lOy, pupilW, pupilH);
    // Right pupil
    ctx.fillRect(rCx - pupilW / 2 + rOx, rCy - pupilH / 2 + rOy, pupilW, pupilH);

    ctx.restore();

    // Advance animation phases
    wavePhaseRef.current += 0.055;
    floatPhaseRef.current += 0.025;

    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = "/img2.png";
    img.onload = () => {
      preprocessImage(img);
      rafRef.current = requestAnimationFrame(drawFrame);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [preprocessImage, drawFrame]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "350px",
      }}
    >
      <canvas
        ref={canvasRef}
        width={SRC_W}
        height={SRC_H}
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "400px",
          maxHeight: "380px",
          imageRendering: "pixelated",
          filter: "drop-shadow(0 15px 30px var(--primary-glow-border))",
        }}
      />
    </div>
  );
}
