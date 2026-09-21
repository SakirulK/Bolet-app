"use client";
import { LocalLink } from "@/components/ui/LocalLink";
import { useSyncExternalStore } from "react";
import { ModeRouter } from "@/components/learning/ModeRouter";
import { DeckDetail } from "@/components/library/DeckDetail";
import { DailyReview } from "@/components/learning/DailyReview";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
const subscribe = () => () => {};
export default function OfflinePage() {
  const href = useSyncExternalStore(subscribe, () => window.location.href, () => "");
  if (!href) return <ScreenSkeleton />;
  const url = new URL(href), parts = url.pathname.split("/");
  if (url.pathname === "/review") return <DailyReview />;
  if (parts[1] === "library" && parts[2]) return <DeckDetail deckId={decodeURIComponent(parts[2])} />;
  if (url.pathname === "/practice" || (parts[1] === "study" && parts[2])) return <ModeRouter deckId={url.searchParams.get("deck") ?? decodeURIComponent(parts[2] ?? "")} mode={url.searchParams.get("mode") ?? "flashcards"} filter={url.searchParams.get("filter") ?? "all"} ids={url.searchParams.get("ids")?.split(",")} />;
  return <div className="space-y-4"><h1 className="font-display text-3xl">You’re offline</h1><p>Your saved decks and study tools are available in the library.</p><LocalLink className="study-link" href="/library">Open Library</LocalLink></div>;
}
