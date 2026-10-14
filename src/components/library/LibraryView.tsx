"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Plus } from "lucide-react";
import dynamic from "next/dynamic";
const CreateDeckDialog = dynamic(() => import("@/components/decks/CreateDeckDialog").then(module => module.CreateDeckDialog));
const ImportDeckDialog = dynamic(() => import("@/components/decks/ImportDeckDialog").then(module => module.ImportDeckDialog));
import { DeckCard } from "@/components/decks/DeckCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import { SearchBar } from "@/components/ui/SearchBar";
import { cn } from "@/lib/cn";
import { useStore } from "@/providers/StoreProvider";
import { readDraft, saveDraft } from "@/data/drafts";

const FILTERS = ["All", "Favorites"] as const;
type LibraryViewDraft = { version: 1; query: string; filter: (typeof FILTERS)[number]; subject: string; sort: string };

export function LibraryView() {
  const router = useRouter();
  const { ready, decks, masteryForDeck, dueCountForDeck, toggleFavorite } =
    useStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [subject, setSubject] = useState("All subjects");
  const [sort, setSort] = useState("newest");
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [imported, setImported] = useState<{ id: string; title: string } | null>(null);
  const [viewReady, setViewReady] = useState(false);
  const latestView = useRef<LibraryViewDraft>({ version: 1, query: "", filter: "All", subject: "All subjects", sort: "newest" });

  useEffect(() => {
    let active = true;
    const urlQuery = new URLSearchParams(window.location.search).get("q");
    void readDraft<LibraryViewDraft>("library-view").then(saved => {
      if (!active) return;
      if (saved?.version === 1) {
        latestView.current = { ...saved, query: urlQuery ?? (typeof saved.query === "string" ? saved.query : "") };
        setQuery(urlQuery ?? (typeof saved.query === "string" ? saved.query : "")); setFilter(FILTERS.includes(saved.filter) ? saved.filter : "All");
        setSubject(saved.subject || "All subjects"); setSort(["newest", "oldest", "alphabetical"].includes(saved.sort) ? saved.sort : "newest");
      } else if (urlQuery) setQuery(urlQuery);
    }).finally(() => { if (active) setViewReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const next = { version: 1 as const, query, filter, subject, sort };
    latestView.current = next;
    if (!viewReady) return;
    const timer = window.setTimeout(() => void saveDraft("library-view", next), 200);
    return () => window.clearTimeout(timer);
  }, [filter, query, sort, subject, viewReady]);
  useEffect(() => {
    const flush = () => { if (viewReady) void saveDraft("library-view", latestView.current); };
    const hidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush); window.addEventListener("brainbo-before-navigate", flush); document.addEventListener("visibilitychange", hidden);
    return () => { window.removeEventListener("pagehide", flush); window.removeEventListener("brainbo-before-navigate", flush); document.removeEventListener("visibilitychange", hidden); };
  }, [viewReady]);
  function checkpointView(next: LibraryViewDraft) {
    latestView.current = next;
    void saveDraft("library-view", next);
  }

  const subjects = useMemo(() => {
    const unique = Array.from(new Set(decks.map((deck) => deck.subject))).sort();
    return ["All subjects", ...unique];
  }, [decks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decks.filter((deck) => {
      if (filter === "Favorites" && !deck.favorite) return false;
      if (subject !== "All subjects" && deck.subject !== subject) return false;
      if (!q) return true;
      return `${deck.title} ${deck.description} ${deck.subject}`
        .toLowerCase()
        .includes(q);
    }).sort((a, b) => sort === "alphabetical" ? a.title.localeCompare(b.title) : sort === "oldest" ? a.createdAt - b.createdAt : b.createdAt - a.createdAt);
  }, [decks, filter, query, subject, sort]);

  if (!ready) return <ScreenSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Library"
        title="Your decks"
        description="Search, favorite, and group by subject. Cards stay on this device."
        actions={
          <><Button size="lg" variant="secondary" onClick={() => setImportOpen(true)}><FileUp className="h-5 w-5" aria-hidden />Import deck</Button><Button size="lg" onClick={() => setCreateOpen(true)}>
            <Plus className="h-5 w-5" aria-hidden />
            Create deck
          </Button></>
        }
      />

      {imported && <div role="status" className="panel-surface flex flex-wrap items-center gap-3 border-accent/25 p-4"><div className="mr-auto"><p className="font-medium">{imported.title} added to your library.</p><p className="mt-1 text-sm text-muted">It is a fresh copy with new IDs and new study progress.</p></div><Button variant="secondary" onClick={() => router.push(`/library/${imported.id}`)}>Open deck</Button><Button variant="ghost" onClick={() => setImported(null)}>Dismiss</Button></div>}

      <SearchBar
        id="library-search"
        value={query}
        onChange={value => { setQuery(value); checkpointView({ ...latestView.current, query: value }); }}
        placeholder="Search titles, subjects, or descriptions"
      />

      <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Deck filters">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={filter === item}
              onClick={() => { setFilter(item); checkpointView({ ...latestView.current, filter: item }); }}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                filter === item
                  ? "border-accent bg-accent text-accent-fg"
                  : "border-edge bg-surface text-muted hover:text-ink",
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">Sort<select value={sort} onChange={event => { const value = event.target.value; setSort(value); checkpointView({ ...latestView.current, sort: value }); }} className="h-11 min-w-0 max-w-full rounded-xl border border-edge bg-surface px-3 text-ink"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="alphabetical">Alphabetically</option></select></label>
        <label className="flex items-center gap-2 text-sm text-muted">
          Subject
          <select
            value={subject}
            onChange={(event) => { const value = event.target.value; setSubject(value); checkpointView({ ...latestView.current, subject: value }); }}
            className="h-11 min-w-0 max-w-full rounded-xl border border-edge bg-surface px-3 text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          >
            {subjects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-edge bg-surface px-5 py-10 text-center">
          <h2 className="font-display text-2xl">{decks.length ? "No matching decks" : "Make room for your next idea"}</h2>
          <p className="my-3 text-sm text-muted">{decks.length ? "Try another search or clear your filters." : "Create your first deck and turn what you’re learning into something you remember."}</p>
          <Button variant="secondary" onClick={() => { if (decks.length) { setQuery(""); setFilter("All"); setSubject("All subjects"); } else setCreateOpen(true); }}>{decks.length ? "Clear filters" : "Create your first deck"}</Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(deck => <DeckCard key={deck.id} deck={deck} mastery={masteryForDeck(deck.id)} dueCount={dueCountForDeck(deck.id)}
            onToggleFavorite={id => { setError(""); void toggleFavorite(id).catch(() => setError("Could not update favorite. Please try again.")); }} />)}
        </div>
      )}

      {createOpen && <CreateDeckDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => router.push(`/library/${id}`)}
      />}
      {importOpen && <ImportDeckDialog onClose={() => setImportOpen(false)} onImported={(id, title) => { setImportOpen(false); setImported({ id, title }); }} />}
    </div>
  );
}
