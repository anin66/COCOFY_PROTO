"use client";

import React, { useState, useEffect, useRef } from "react";

const GIFS = [
  "/videos/coco_1.gif",
  "/videos/coco_2.gif",
  "/videos/coco_3.gif",
  "/videos/coco_4.gif"
];

const VIDEOS = [
  "/videos/coco_1.webm",
  "/videos/coco_2.webm",
  "/videos/coco_3.webm",
  "/videos/coco_4.webm"
];

export default function CoconutVideoPlayer() {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [isSafari, setIsSafari] = useState<boolean>(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Detect Safari client-side to render fallback hq GIFs
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isSafariUA = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("android");
    setIsSafari(isSafariUA);
  }, []);

  // Ensure all videos play concurrently in the background for zero-lag transition
  useEffect(() => {
    if (isSafari) return;

    videoRefs.current.forEach((video) => {
      if (video) {
        // Enforce DOM-level muting required by modern browsers to allow autoplay
        video.muted = true;
        video.defaultMuted = true;
        
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.log("Autoplay failed or was interrupted:", err);
          });
        }
      }
    });
  }, [isSafari]);

  useEffect(() => {
    // Every 8 seconds, we transition to another random character animation without repeat.
    // Starting with index 0 on load allows the first video to render immediately and
    // gives the browser 8 seconds to preload subsequent assets in the background.
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
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      aspectRatio: "16/9", // Widescreen aspect ratio matching original videos prevents character clipping
    }}>
      {isSafari ? (
        // Safari Fallback: Render high-clarity 24fps GIFs
        GIFS.map((src, idx) => (
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
        ))
      ) : (
        // Non-Safari (Chrome, Firefox, Edge, etc.): Render high-clarity 24fps transparent WebM videos
        VIDEOS.map((src, idx) => (
          <video
            key={src}
            ref={(el) => {
              videoRefs.current[idx] = el;
            }}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            controls={false}
            preload="auto"
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
        ))
      )}
    </div>
  );
}
