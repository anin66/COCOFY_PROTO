"use client";

import React, { useState, useEffect, useRef } from "react";

const VIDEOS = [
  "/videos/coco_1.mp4",
  "/videos/coco_2.mp4",
  "/videos/coco_3.mp4",
  "/videos/coco_4.mp4"
];

export default function CoconutVideoPlayer() {
  const [currentVideo, setCurrentVideo] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize with a random video on mount (client-side only to prevent hydration mismatch)
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * VIDEOS.length);
    setCurrentVideo(VIDEOS[randomIndex]);
  }, []);

  const playNextVideo = () => {
    if (!currentVideo) return;
    
    // Filter out the current video to prevent consecutive repeat
    const candidates = VIDEOS.filter((v) => v !== currentVideo);
    const nextVideo = candidates[Math.floor(Math.random() * candidates.length)];
    
    setCurrentVideo(nextVideo);
  };

  return (
    <div style={{
      width: "100%",
      maxWidth: "520px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      aspectRatio: "1/1", // Square aspect ratio fits the character videos perfectly
    }}>
      <video
        ref={(el) => {
          (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
          if (el) {
            el.muted = true;
          }
        }}
        src={currentVideo || undefined}
        autoPlay
        muted
        playsInline
        controls={false}
        onEnded={playNextVideo}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: "transparent",
        }}
      />
      {!currentVideo && (
        <div style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
          Initializing Video...
        </div>
      )}
    </div>
  );
}
