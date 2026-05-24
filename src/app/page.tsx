"use client";

import InteractiveBackground from "@/components/ui/InteractiveBackground";
import ActiveTheoryShowcase from "@/components/ui/ActiveTheoryShowcase";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", position: "relative", overflowX: "hidden" }}>
      {/* Immersive cybernetic backgrounds, parallax tilt grid, scanlines */}
      <InteractiveBackground />

      {/* Main Active Theory visual showcase, HUD consoles, and onboarding portals */}
      <ActiveTheoryShowcase />
    </main>
  );
}
