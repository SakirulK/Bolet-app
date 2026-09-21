"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ModeRouter } from "@/components/learning/ModeRouter";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
function Practice() {
  const query = useSearchParams();
  return <ModeRouter key={query.toString()} deckId={query.get("deck") ?? ""} mode={query.get("mode") ?? "flashcards"} filter={query.get("filter") ?? "all"} ids={query.get("ids")?.split(",")} />;
}
export default function PracticePage() { return <Suspense fallback={<ScreenSkeleton />}><Practice /></Suspense>; }
