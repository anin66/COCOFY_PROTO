"use client";

import React, { useState, useEffect, useRef } from "react";

// Pixel art maps where:
// 'G' = Body forest green
// 'L' = Highlights lime green
// 'B' = Mask / Cape wood brown
// 'K' = Outline dark green-black
// '.' = Transparent

const capeMap = [
  "....KKKK..",
  "...KBBBBK.",
  "..KBBBBBK.",
  ".KBBBBBBK.",
  ".KBBBBBBK.",
  "KBBBBBBBK.",
  "KBBBBBBK..",
  "KBBBBBBK..",
  "KBBBBBK...",
  "KBBBBK....",
  "KKKKK....."
];

const leftArmMap = [
  "..KKK",
  ".KGGK",
  "KGGK.",
  "KGK..",
  "KGK..",
  "KGGK.",
  ".KKK."
];

const bodyMap = [
  ".....KKKKKK.....",
  "....KGGGGGGK....",
  "...KGGGGGGGGK...",
  "..KGGGGGGGGGGK..",
  ".KGGGGGGGGGGGGK.",
  "KGGGGGGGGGGGGGGK",
  "KGBBBBBBBBBBBBGK", // Mask starts
  "KGBBBBBBBBBBBBGK",
  "KGBBBBBBBBBBBBGK",
  "KGBBBBBBBBBBBBGK",
  "KGBBBBBBBBBBBBGK", // Mask ends
  "KGGGGKKKKKGGGGGK", // Logo border top
  "KGGGKLLLLLKGGGGK", // Logo C top
  "KGGGKLKKKKKGGGGK", // Logo C mid
  "KGGGKLLLLLKGGGGK", // Logo C bottom
  "KGGGGKKKKKGGGGGK", // Logo border bottom
  ".KGGGGGGGGGGGGK.",
  "..KGGGGGGGGGGK..",
  "...KGGGGGGGGK...",
  "....KKKKKKKK...."
];

const legsMap = [
  ".KKK......KKK.",
  ".KGGK....KGGK.",
  ".KGGK....KGGK.",
  ".KBBK....KBBK.",
  "KBBBKK..KBBBKK",
  "KKKKKK..KKKKKK"
];

const rightArmMap = [
  "KKKK....", // Shoulder pivot at top-left
  "KGGKK...",
  "KGGGGK..",
  ".KGGGGK.",
  ".KGGGGK.",
  "..KGGGGK",
  "...KGGGK",
  "...KLLLK", // Lime glove
  "...KKKKK"
];

const colorMap = {
  K: "#0f140f",          // Fixed dark outline matching both light/dark theme backgrounds
  G: "var(--primary)",   // Dynamic theme primary green
  L: "var(--accent)",    // Dynamic theme accent lime green
  B: "var(--secondary)", // Dynamic theme secondary wood brown
};

export default function PixelCoconutSuperhero() {
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      // Center coordinates of the eyes relative to the viewport
      const eyeCenterX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + rect.height * 0.4; // Eyes are roughly at 40% height of character

      const dx = e.clientX - eyeCenterX;
      const dy = e.clientY - eyeCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Max travel distance for pupils inside eye sockets is 0.75 pixels (viewBox 32x32)
      const maxOffset = 0.85;
      setEyeOffset({
        x: (dx / dist) * maxOffset,
        y: (dy / dist) * maxOffset
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const renderPixels = (map: string[], startX: number, startY: number) => {
    const rects: React.JSX.Element[] = [];
    map.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        if (char !== "." && colorMap[char as keyof typeof colorMap]) {
          rects.push(
            <rect
              key={`${x}-${y}`}
              x={startX + x}
              y={startY + y}
              width={1.05} // Subtle overlap to prevent visual grid lines between adjacent rects
              height={1.05}
              fill={colorMap[char as keyof typeof colorMap]}
            />
          );
        }
      }
    });
    return rects;
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center relative overflow-visible"
      style={{ minHeight: "400px" }}
    >
      <svg
        viewBox="0 0 32 32"
        className="w-full h-full max-w-[420px] max-h-[420px] drop-shadow-[0_15px_30px_var(--primary-glow-border)]"
        style={{ imageRendering: "pixelated" }}
      >
        <defs>
          <style>{`
            @keyframes pixel-wave {
              0% { transform: rotate(0deg); }
              50% { transform: rotate(-28deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes pixel-cape {
              0% { transform: skewY(0deg) scaleX(1); }
              50% { transform: skewY(3deg) scaleX(1.03); }
              100% { transform: skewY(0deg) scaleX(1); }
            }
            @keyframes pixel-float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-8px); }
              100% { transform: translateY(0px); }
            }
            .character-root {
              animation: pixel-float 4s ease-in-out infinite;
            }
            .animate-cape {
              animation: pixel-cape 2.4s ease-in-out infinite;
              transform-origin: 10px 8px;
            }
            .animate-arm {
              animation: pixel-wave 1.1s ease-in-out infinite;
              transform-origin: 23px 10px;
            }
          `}</style>
        </defs>

        <g className="character-root">
          {/* 1. Flowing Cape (placed behind body) */}
          <g className="animate-cape">
            {renderPixels(capeMap, 4, 8)}
          </g>

          {/* 2. Legs & Boots */}
          {renderPixels(legsMap, 9, 21)}

          {/* 3. Static Left Arm (resting on hip) */}
          {renderPixels(leftArmMap, 4, 11)}

          {/* 4. Body & Head (with Mask and chest Emblem) */}
          {renderPixels(bodyMap, 8, 4)}

          {/* 5. Eye Whites (cutouts in the mask area) */}
          {/* Left Eye */}
          <rect x={11} y={10} width={2} height={2} fill="#ffffff" />
          {/* Right Eye */}
          <rect x={16} y={10} width={2} height={2} fill="#ffffff" />

          {/* 6. Pupils that track cursor position */}
          {/* Left Pupil */}
          <rect
            x={11.5 + eyeOffset.x}
            y={10.5 + eyeOffset.y}
            width={0.9}
            height={0.9}
            fill="#0f140f"
          />
          {/* Right Pupil */}
          <rect
            x={16.5 + eyeOffset.x}
            y={10.5 + eyeOffset.y}
            width={0.9}
            height={0.9}
            fill="#0f140f"
          />

          {/* 7. Animated Waving Right Arm (placed in front of body) */}
          <g className="animate-arm">
            {renderPixels(rightArmMap, 22, 8)}
          </g>
        </g>
      </svg>
    </div>
  );
}
