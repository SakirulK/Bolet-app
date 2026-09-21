import { ModeRouter } from "@/components/learning/ModeRouter";
export default async function StudyDeckPage({ params, searchParams }: {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<{ mode?: string; ids?: string; filter?: string }>;
}) {
  const { deckId } = await params;
  const { mode, ids, filter } = await searchParams;
  return <ModeRouter deckId={deckId} mode={mode} ids={ids?.split(",")} filter={filter} />;
}
