# BrainBo

Local-first study app for decks and flashcards. Data is saved immediately in IndexedDB (Dexie), with optional Supabase account sync and full local backups. No paid APIs.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

Open [http://localhost:3000](http://localhost:3000). On iPad Safari: Share → Add to Home Screen for standalone PWA chrome (see Settings → Install BrainBo for offline readiness).

## Flashcards

Tap a card or press Space to flip. Swipe left / press Left Arrow for Don’t Know;
swipe right / press Right Arrow for Know. The visible buttons do the same thing.
Two consecutive correct recalls master a card for the session. Misses reset that
streak and return after up to three other cards. Settings can start a shuffled,
reversed, random-direction, or starred-only round. Applying settings saves the
current round before restarting. You can also finish early from settings.

Each answer atomically saves card progress, daily activity, and a session record
in Dexie. Session records include answer totals, missed cards, mastery streaks,
and timestamps. Accuracy counts all attempts. The existing IndexedDB database
and theme keys retain their original internal names to preserve existing data
through the BrainBo rename.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm test` — imports, exports, deck persistence, and study scheduling/statistics
- `npm run build` — production build when Turbopack workers are restricted
- `npm run test:e2e` — production browser tests using installed Google Chrome with iPad touch emulation; build first. The tests start their own production server on port 3100 and a separate development server on port 3101 for mocked cloud integration.

## Learn grading and rounds

Learn and Test share deterministic, local grading utilities. Basic grading ignores
capitalization, extra whitespace, and harmless punctuation. Turning **Spelling
matters** off enables conservative typo matching; it does not enable aliases.
**Smart Grading** accepts explicit aliases entered under a card’s optional accepted
answers and uses a conservative local concept comparison for sentence-length
answers. It never requires a network or paid service. Definition aliases and term
aliases remain separate. To accept an abbreviation or optional parenthetical form,
add that exact form as an alias.

Learn offers **I was correct** only after an automatically rejected written answer.
The final override is saved when continuing and replaces the rejection in both
statistics and scheduling. Don’t Know cannot be overridden. Retyping alone does
not change a result. One persistent star applies to the whole card pair.

Every selected round contains questions. Confident cards receive less practice;
when all cards are confident, a rotating maintenance card keeps intermediate
rounds meaningful. The final round checks the selected set. Misses get one later
retry per round, preventing an endless loop while preserving difficult material
for further study.

Migration tests cover version 1 and 2 databases. Optional accepted-answer fields
need no schema change and do not overwrite older cards or their study history.

Account sync, Trash and full backups are documented in [Data durability & Supabase setup](docs/DATA-DURABILITY.md). Use Node 22+; copy the public configuration names from `.env.example`. The app continues to work locally when Supabase is not configured.
