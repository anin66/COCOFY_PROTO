"use client";

import React, { useState, useEffect, useRef } from "react";

// Pixel-perfect maps extracted from the reference "Coconut-Man" sprite sheet (img2.png)
// 'G' = Body forest green (var(--primary))
// 'D' = Dark green vertical stripes (rgba(0,0,0,0.18))
// 'T' = Tan/brown husk cap cutout (#dfc19c)
// 'Y' = Yellow/orange gloves, buckle outline, and boots (#ffa000)
// 'R' = Red buckle center & boot details (#d01c1c)
// 'B' = Belt brown (var(--secondary))
// 'P' = Pink cheeks (#ff9494)
// 'W' = Eye whites (#ffffff)
// 'K' = Outline black (#111710)
// '.' = Transparent / Background

const bodyMap = [
  ".........KKK.................", // Row 0
  "........KGGGK................", // Row 1
  "........KGGGK................", // Row 2
  "........KGGGK................", // Row 3
  "........KGGGK................", // Row 4
  "........KGGK.................", // Row 5
  "........KGKKKKKK.............", // Row 6
  "....KKKKKGTTTTTTK............", // Row 7
  "...KGGKKGGTTTTTTTK...........", // Row 8
  "..KGGKGKKKTTTTKKKT...........", // Row 9
  ".KGGKGGKKKTTTTKKKTT..........", // Row 10
  "KKKKKGGWWWGGGGWWWGGK.........", // Row 11
  "KGGGKGGWWWGGGGWWWGGK.........", // Row 12
  "KGGKKGGPGGGGGGGGGPGK.........", // Row 13
  "KYYKKGGGGGGKKGGGGGGK.........", // Row 14
  "KYYKKGGGGGGGGGGGGGGK.........", // Row 15
  "KKKKKGGGGGGGGGGGGGGK.........", // Row 16
  "....KGBBBBBBBBBBBBGK.........", // Row 17
  "....KGBBBBYYYBBBBBGK.........", // Row 18
  "....KGBBBBYRYBBBBBGK.........", // Row 19
  "....KGBBBBYYYBBBBBGK.........", // Row 20
  ".....KGGGGGGGGGGGGK..........", // Row 21
  "......KKKKKKKKKKKK..........."  // Row 22
];

const legsMap = [
  "......KRRK....KRRK...........", // Row 0
  "......YYYK....YYYKK..........", // Row 1
  "......KKKK....KKKKK.........."  // Row 2
];

const rightArmMap = [
  "..KKK......", // Row 0
  "KKGKGKKK...", // Row 1
  "KGGGGGGK...", // Row 2
  "KKGGGGGGGK.", // Row 3
  ".KKGGGGYYK.", // Row 4
  "......YYY.K", // Row 5
  "......KYKK.", // Row 6
  "......KK..."  // Row 7
];

const colorMap = {
  K: "#111710",          // Black outline
  G: "var(--primary)",   // Main skin green
  D: "rgba(0,0,0,0.18)", // Dark green stripes shading
  T: "#dfc19c",          // Tan head slice
  Y: "#ffa000",          // Yellow gloves & boots
  R: "#d01c1c",          // Red emblem & boot details
  B: "var(--secondary)", // Belt brown
  P: "#ff9494",          // Pink cheeks
  W: "#ffffff",          // Eye whites
};

export default function PixelCoconutSuperhero() {
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const eyeCenterX = rect.left + rect.width * (12 / 29);
      const eyeCenterY = rect.top + rect.height * (11.5 / 26);

      const dx = e.clientX - eyeCenterX;
      const dy = e.clientY - eyeCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Limit travel offset for pupils inside eye sockets
      const maxOffsetX = 0.7;
      const maxOffsetY = 0.3;

      setEyeOffset({
        x: (dx / dist) * maxOffsetX,
        y: (dy / dist) * maxOffsetY
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
              width={1.03}
              height={1.03}
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
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "visible",
        minHeight: "350px"
      }}
    >
      <svg
        viewBox="0 0 29 26"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "380px",
          maxHeight: "380px",
          filter: "drop-shadow(0 15px 30px var(--primary-glow-border))",
          imageRendering: "pixelated",
          overflow: "visible"
        }}
      >
        <defs>
          <style>{`
            @keyframes pixel-wave {
              0% { transform: rotate(0deg); }
              50% { transform: rotate(-14deg); }
              100% { transform: rotate(0deg); }
            }
            @keyframes pixel-float {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-6px); }
              100% { transform: translateY(0px); }
            }
            .character-root {
              animation: pixel-float 4s ease-in-out infinite;
            }
            .animate-arm {
              animation: pixel-wave 1.2s ease-in-out infinite;
              transform-origin: 18.5px 8.5px;
            }
          `}</style>
        </defs>

        <g className="character-root">
          {/* 1. Legs and boots */}
          {renderPixels(legsMap, 0, 23)}

          {/* 2. Main body, head, face structure & static left arm */}
          {renderPixels(bodyMap, 0, 0)}

          {/* 3. Pupils that track cursor position */}
          {/* Left Eye Pupil */}
          <rect
            x={8 + eyeOffset.x}
            y={11 + eyeOffset.y}
            width={1}
            height={2}
            fill="#111710"
          />
          {/* Right Eye Pupil */}
          <rect
            x={15 + eyeOffset.x}
            y={11 + eyeOffset.y}
            width={1}
            height={2}
            fill="#111710"
          />

          {/* 4. Animated Waving Right Arm (positioned at shoulder x=18, y=6) */}
          <g className="animate-arm">
            {renderPixels(rightArmMap, 18, 6)}
          </g>
        </g>
      </svg>
    </div>
  );
}
