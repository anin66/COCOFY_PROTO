"use client";

import { useState, useEffect } from "react";

export default function SpotlightTracker() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    // Global click listener to toggle card flips on touch / click (for mobile)
    const handleGlobalClick = (e: MouseEvent) => {
      const card = (e.target as HTMLElement).closest(".job-card");
      if (!card) return;

      const interactive = (e.target as HTMLElement).closest("button, a, input, select, textarea, [role='button']");
      if (interactive) return;

      card.classList.toggle("flipped");
    };

    document.addEventListener("click", handleGlobalClick);

    // Disable mouse spotlight on touch viewports for performance
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      setIsTouch(true);
      return () => {
        document.removeEventListener("click", handleGlobalClick);
      };
    }

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      document.documentElement.style.setProperty("--mouse-x", `${e.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${e.clientY}px`);
    };
    
    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => setIsHovering(false);

    window.addEventListener("mousemove", handleMouseMove);
    document.body.addEventListener("mouseenter", handleMouseEnter);
    document.body.addEventListener("mouseleave", handleMouseLeave);
    
    // Set initial hover state
    setIsHovering(true);

    return () => {
      document.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("mousemove", handleMouseMove);
      document.body.removeEventListener("mouseenter", handleMouseEnter);
      document.body.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  if (isTouch) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-10 transition-opacity duration-1000"
      style={{
        opacity: isHovering ? 1 : 0,
        background: `radial-gradient(circle 380px at ${mousePos.x}px ${mousePos.y}px, rgba(181, 130, 93, 0.05) 0%, rgba(79, 110, 82, 0.06) 50%, transparent 100%)`
      }}
    />
  );
}
