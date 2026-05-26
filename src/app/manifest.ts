import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COCOFY Logistics",
    short_name: "COCOFY",
    description: "A premium logistics and business management application",
    start_url: "/",
    display: "standalone",
    background_color: "#091209",
    theme_color: "#2e7d32",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
