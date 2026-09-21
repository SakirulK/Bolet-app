# BOLET

Local-first study app for decks and flashcards. Data stays in your browser via IndexedDB (Dexie). No account, no paid APIs.

## Scripts

```bash
npm install
npm run dev
npm run build
npm run start
npm run lint
```

Open [http://localhost:3000](http://localhost:3000). On iPad Safari: Share → Add to Home Screen for standalone PWA chrome (offline caching comes later).

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
through the BOLET rename.

## Validation

- `npm run typecheck`
- `npm run lint`
- `npm test` — imports, exports, deck persistence, and study scheduling/statistics
- `npm run build -- --webpack` — production build when Turbopack workers are restricted
- `npm run test:e2e` — production browser tests using installed Google Chrome with iPad touch emulation; build first. The tests start their own server on port 3100.
