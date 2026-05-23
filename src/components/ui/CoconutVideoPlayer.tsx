"use client";

import React, { useState, useEffect, useRef } from "react";

const VIDEOS = [
  "/videos/coco_1.mp4",
  "/videos/coco_2.mp4",
  "/videos/coco_3.mp4",
  "/videos/coco_4.mp4"
];

export default function CoconutVideoPlayer() {
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const playNextVideo = (endedIdx: number) => {
    // Exclude the current index to prevent consecutive repetition
    const candidates = [0, 1, 2, 3].filter(idx => idx !== endedIdx);
    const nextIdx = candidates[Math.floor(Math.random() * candidates.length)];
    
    // Reset the finished video to the beginning
    const endedVideo = videoRefs.current[endedIdx];
    if (endedVideo) {
      endedVideo.currentTime = 0;
    }
    
    setActiveIdx(nextIdx);
  };

  // Play the active video immediately whenever activeIdx changes, and pause others
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (video) {
        // Enforce DOM-level muting required by modern browsers to allow autoplay
        video.muted = true;
        video.defaultMuted = true;
        
        if (idx === activeIdx) {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.log("Autoplay failed or was interrupted:", err);
            });
          }
        } else {
          video.pause();
        }
      }
    });
  }, [activeIdx]);

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
      {VIDEOS.map((src, idx) => (
        <video
          key={src}
          ref={(el) => {
            videoRefs.current[idx] = el;
            if (el) {
              el.muted = true;
              el.defaultMuted = true;
            }
          }}
          src={src}
          autoPlay={idx === 0} // Native autoplay on first video for SSR zero-lag
          muted
          playsInline
          controls={false}
          onEnded={() => playNextVideo(idx)}
          preload="auto" // Enforce browser preloading of all videos in the background
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
