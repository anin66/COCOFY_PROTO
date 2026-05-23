"use client";

import React, { useState, useEffect, useRef } from "react";

// Pixel art maps based on the reference "Coconut-Man" sprite sheet:
// 'G' = Body forest green (var(--primary))
// 'D' = Dark green vertical stripes (#144a13)
// 'T' = Tan/brown husk cap on head (#dfc19c)
// 'C' = Cape green (var(--accent) - bright lime green)
// 'Y' = Yellow/orange gloves & boots (#ffa000)
// 'R' = Red emblem & boot stripe details (#d01c1c)
// 'B' = Belt brown (#8a5229)
// 'O' = Buckle gold outline (#ffca28)
// 'P' = Pink cheeks (#ff9494)
// 'K' = Outline dark green-black (#111710)
// '.' = Transparent

const capeMap = [
  "....KKKK.",
  "...KCCCCK",
  "..KCCCCCK",
  ".KCCCCCCK",
  ".KCCCCCCK",
  "KCCCCCCK.",
  "KCCCCCCK.",
  "KCCCCCK..",
  "KCCCCK...",
  "KKKKK...."
];

const leftArmMap = [
  "KKKKK",
  "KGGGK",
  "KGGK.",
  "KYYK.", // Yellow glove resting on hip
  "KYYK.",
  ".KKK."
];

const bodyMap = [
  ".....KKK........", // Y=2: Sprout top bend
  "....KGGGK.......", // Y=3
  "....KGGGK.......", // Y=4
  "....KGGGK.......", // Y=5
  "....KGGGK.......", // Y=6
  "....KGGK........", // Y=7: Sprout stem base
  "....KGKKKKKK....", // Y=8: Cap top
  "...KKGTTTTTTK...", // Y=9: Tan cap
  "..KKGGTTTTTTTK..", // Y=10
  ".KGGKTTTTTTTTTK.", // Y=11
  "KGGGGTTTTTTTTTTK", // Y=12
  "KGGGGGGGGGGGGGGK", // Y=13
  "KGGGGGGGDDGGGGGK", // Y=14 (vertical stripes)
  "KGGPGGGGDDGGGPgK", // Y=15 (pink cheeks at index 3 & 12)
  "KGGGGGGKKDGGGGGK", // Y=16 (smirk mouth)
  "KGGGGGGGDDGGGGGK", // Y=17
  "KGGGGGGGDDGGGGGK", // Y=18
  "KGBBBBBBBBBBBBGK", // Y=19 (belt)
  "KGBBBBOOOBBBBBGK", // Y=20 (buckle border)
  "KGBBBBOROBBBBBGK", // Y=21 (buckle red C logo)
  "KGBBBBOOOBBBBBGK", // Y=22
  ".KGGGGGGGGGGGGK.", // Y=23
  "..KKKKKKKKKKKK.."  // Y=24
];

const legsMap = [
  ".KKK......KKK.",
  ".KGGK....KGGK.",
  ".KYYK....KYYK.", // Yellow boots top
  ".KRRK....KRRK.", // Red stripe
  "KYYYKK..KYYYKK", // Yellow boots base
  "KKKKKK..KKKKKK"
];

const rightArmMap = [
  "KKKK....", // Shoulder pivot at top-left
  "KGGKK...",
  "KGGGGK..",
  ".KGGGGK.",
  ".KGGGGK.",
  "..KGGGGK",
  "...KYYYK", // Yellow glove
  "...KYYYK",
  "...KKKKK"
];

const colorMap = {
  K: "#111710",          // Dark green-black outline
  G: "var(--primary)",   // Main green skin
  D: "#144a13",          // Dark green stripes
  T: "#dfc19c",          // Tan head cap
  C: "var(--accent)",    // Bright lime green cape
  Y: "#ffa000",          // Yellow gloves & boots
  R: "#d01c1c",          // Red buckle C & boot accents
  B: "#8a5229",          // Belt brown
  O: "#ffca28",          // Buckle gold outline
  P: "#ff9494",          // Pink cheeks
  g: "var(--primary)",   // Fallback for minor typo in grid map row Y=15
};

export default function PixelCoconutSuperhero() {
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const eyeCenterX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + rect.height * 0.43; // Eyes center relative to top of character

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
              width={1.05}
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
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "visible",
        minHeight: "400px"
      }}
    >
      <svg
        viewBox="0 0 32 32"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "420px",
          maxHeight: "420px",
          filter: "drop-shadow(0 15px 30px var(--primary-glow-border))",
          imageRendering: "pixelated",
          overflow: "visible"
        }}
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
          {/* 1. Flowing Green/Lime Cape (placed behind body) */}
          <g className="animate-cape">
            {renderPixels(capeMap, 4, 9)}
          </g>

          {/* 2. Legs & Boots (Yellow with Red accents) */}
          {renderPixels(legsMap, 9, 22)}

          {/* 3. Static Left Arm (resting on hip with Yellow glove) */}
          {renderPixels(leftArmMap, 4, 13)}

          {/* 4. Body & Head (with tan head cap, sprout, chest logo, vertical stripes, cheeks, smirk) */}
          {renderPixels(bodyMap, 8, 2)}

          {/* 5. Eyebrows (thick heroic black lines) */}
          <rect x={11} y={11} width={3} height={1} fill="#111710" />
          <rect x={18} y={11} width={3} height={1} fill="#111710" />

          {/* 6. Eye Whites */}
          <rect x={11} y={12} width={3} height={3} fill="#ffffff" />
          <rect x={18} y={12} width={3} height={3} fill="#ffffff" />

          {/* 7. Pupils that track cursor position (vertical rects matching style sheet) */}
          {/* Left Pupil */}
          <rect
            x={12 + eyeOffset.x}
            y={12.5 + eyeOffset.y}
            width={1}
            height={1.5}
            fill="#111710"
          />
          {/* Right Pupil */}
          <rect
            x={19 + eyeOffset.x}
            y={12.5 + eyeOffset.y}
            width={1}
            height={1.5}
            fill="#111710"
          />

          {/* 8. Animated Waving Right Arm (placed in front of body) */}
          <g className="animate-arm">
            {renderPixels(rightArmMap, 22, 9)}
          </g>
        </g>
      </svg>
    </div>
  );
}
