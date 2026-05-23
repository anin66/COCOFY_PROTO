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
  const [fade, setFade] = useState<boolean>(true);
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
    
    // Smooth transition between videos
    setFade(false);
    
    setTimeout(() => {
      setCurrentVideo(nextVideo);
      setFade(true);
      
      // Explicitly trigger load and play on video change to support all browsers
      if (videoRef.current) {
        videoRef.current.load();
        videoRef.current.play().catch((err) => {
          console.log("Autoplay interrupted or failed:", err);
        });
      }
    }, 300); // match fade transition timeout
  };

  // Play immediately when currentVideo changes
  useEffect(() => {
    if (videoRef.current && currentVideo) {
      videoRef.current.load();
      videoRef.current.play().catch((err) => {
        console.log("Autoplay failed:", err);
      });
    }
  }, [currentVideo]);

  return (
    <div style={{
      width: "100%",
      maxWidth: "520px",
      borderRadius: "24px",
      overflow: "hidden",
      background: "rgba(0, 0, 0, 0.4)",
      border: "1px solid var(--surface-border)",
      boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5), 0 0 40px var(--primary-glow-border)",
      backdropFilter: "blur(12px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      aspectRatio: "1/1", // Square aspect ratio fits the character videos perfectly
      transition: "opacity 0.3s ease",
      opacity: fade ? 1 : 0.2,
    }}>
      {currentVideo ? (
        <video
          ref={videoRef}
          src={currentVideo}
          autoPlay
          muted
          playsInline
          controls={false}
          onEnded={playNextVideo}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "24px",
          }}
        />
      ) : (
        <div style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
          Initializing Video...
        </div>
      )}
    </div>
  );
}
