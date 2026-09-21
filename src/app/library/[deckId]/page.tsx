import type { Metadata } from "next";
import { DeckDetail } from "@/components/library/DeckDetail";

export const metadata: Metadata = {
  title: "Deck",
};

export default async function DeckPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  return <DeckDetail deckId={deckId} />;
}
