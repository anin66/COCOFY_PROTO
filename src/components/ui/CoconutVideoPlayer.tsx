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

  // Initialize with a random index on mount (client-side only to prevent hydration mismatch)
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * GIFS.length);
    setActiveIdx(randomIndex);
  }, []);

  useEffect(() => {
    // Set up an interval of 8 seconds (matching the 8.0s duration of the animations)
    // Every 8 seconds, we transition to another random GIF without repeat
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
      {/* Render all 4 GIFs concurrently in the DOM.
          This enforces immediate background loading/caching by the browser,
          resulting in instant zero-lag switching when display state changes. */}
      {GIFS.map((src, idx) => (
        <img
          key={src}
          src={src}
          alt="Coconut Character Animation"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            background: "transparent",
            display: idx === activeIdx ? "block" : "none",
          }}
        />
      ))}
    </div>
  );
}
