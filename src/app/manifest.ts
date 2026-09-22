import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BrainBo",
    short_name: "BrainBo",
    description: "Local-first flashcards and study decks.",
    id: "/",
    scope: "/",
    start_url: "/",
    orientation: "any",
    display: "standalone",
    background_color: "#07090c",
    theme_color: "#0e1217",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
