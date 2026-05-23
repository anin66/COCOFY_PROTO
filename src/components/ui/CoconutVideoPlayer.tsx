"use client";

import React, { useState, useEffect, useRef } from "react";

const VIDEOS = [
  "/videos/coco_1.mp4",
  "/videos/coco_2.mp4",
  "/videos/coco_3.mp4",
  "/videos/coco_4.mp4"
];

export default function CoconutVideoPlayer() {
  // Start with coco_1.mp4 as default to ensure instant preloading during SSR and zero visual lag
  const [currentVideo, setCurrentVideo] = useState<string>("/videos/coco_1.mp4");
  const videoRef = useRef<HTMLVideoElement>(null);

  const playNextVideo = () => {
    // Filter out the current video to prevent consecutive repeat
    const candidates = VIDEOS.filter((v) => v !== currentVideo);
    const nextVideo = candidates[Math.floor(Math.random() * candidates.length)];
    
    setCurrentVideo(nextVideo);
  };

  // Ensure DOM-level muting is always enforced on source change to satisfy browser autoplay requirements
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.defaultMuted = true;
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.log("Autoplay failed or was interrupted:", err);
        });
      }
    }
  }, [currentVideo]);

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
          background: "transparent",
        }}
      />
    </div>
  );
}
