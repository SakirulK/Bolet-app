import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BOLET",
    short_name: "BOLET",
    description: "Local-first flashcards and study decks.",
    id: "/",
    scope: "/",
    start_url: "/",
    orientation: "any",
    display: "standalone",
    background_color: "#f3f0e8",
    theme_color: "#b5471d",
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
