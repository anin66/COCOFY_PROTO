"use client";

import React, { useState, useEffect } from "react";

const GIFS = [
  "/videos/coco_1.gif",
  "/videos/coco_2.gif",
  "/videos/coco_3.gif",
  "/videos/coco_4.gif"
];

export default function CoconutVideoPlayer() {
  const [activeIdx, setActiveIdx] = useState<number>(0);

  useEffect(() => {
    // Every 8 seconds, we transition to another random GIF without repeat.
    // Starting with index 0 on load allows coco_1.gif to render immediately and
    // gives the browser 8 seconds to preload coco_2, coco_3, and coco_4 in the background.
    const interval = setInterval(() => {
      setActiveIdx((prevIdx) => {
        const candidates = [0, 1, 2, 3].filter(idx => idx !== prevIdx);
        const nextIdx = candidates[Math.floor(Math.random() * candidates.length)];
        return nextIdx;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      width: "100%",
      maxWidth: "520px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      aspectRatio: "1/1", // Square aspect ratio fits the character animations perfectly
    }}>
      {/* Render all 4 GIFs concurrently in the DOM with position: absolute and opacity control.
          This guarantees the browser fetches and decodes all GIFs immediately on load,
          resulting in instant, zero-lag transitions when switching. */}
      {GIFS.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt="Coconut Character Animation"
          style={{
            position: idx === activeIdx ? "relative" : "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "transparent",
            opacity: idx === activeIdx ? 1 : 0,
            pointerEvents: idx === activeIdx ? "auto" : "none",
            transition: "opacity 0.2s ease-in-out",
          }}
        />
      ))}
    </div>
  );
}
