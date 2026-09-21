# BOLET data durability

## Supabase setup (required to enable account sync)

1. Create a Supabase **Free** project. BOLET needs no paid API, AI service, server secret, or paid plan. Review the provider's current free-plan limits before relying on it as your only backup.
2. Run [`supabase/migrations/202609210001_bolet_durability.sql`](../supabase/migrations/202609210001_bolet_durability.sql) in the project's SQL Editor. It creates `bolet_records`, RLS, and the transactional `bolet_merge_record` function. Re-running it is safe.
3. Enable Email authentication in Authentication → Providers. Keep email confirmation enabled. Set Authentication → URL Configuration → Site URL to the app's HTTPS origin; allow `<origin>/settings` for confirmation and password recovery. Add localhost only for development. Configure email delivery for your intended users; Supabase's built-in sender has delivery restrictions/rate limits. Test confirmation and password recovery with your own email before launch.
4. Put the project URL and **public** publishable key in `.env.local` (see [`.env.example`](../.env.example)):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Older projects can instead use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public anon key only).
   Never put a service-role/secret key in these variables. No service-role key is needed anywhere in BOLET.
5. Use Node 22 or later (`.nvmrc`), then `npm install`, `npm run build`, and `npm run start`. Public Next.js environment variables are embedded at build time; rebuild after changing them. Set the same variables on your deployment before building.
6. Open Settings, create/confirm your account and sign in. On an existing device, select **Add this data to my account**. Wait for **Synced**. Sign in on another browser/device and verify the same deck appears. Export a BOLET backup as an independent copy.

The repository does not provision or modify a remote Supabase project automatically. Missing configuration leaves BOLET fully usable locally with backups. Do not interpret local-only status as cloud protection.

Official references: [Supabase email/password authentication](https://supabase.com/docs/guides/auth/passwords), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [public client keys](https://supabase.com/docs/guides/api/api-keys).

## IndexedDB migration and write guarantees

The existing database remains **`recall`**. Version 4 only adds `syncQueue` and `syncMeta`; versions 1–3 remain intact. Existing IDs, stars, aliases, scheduling, sessions, events, history and preferences are preserved. Version 3's legacy single-star migration still maps a starred card to both side stars.

The data-layer journal extends each native read/write transaction to include the outbox. Dexie create/update hooks save field-version metadata and the pending mutation in **the same IndexedDB transaction**. A failed transaction rolls back both. No database replacement, expiry policy, quota cleanup or automatic deck/card deletion is used. Raw row deletion is rejected by the journal; backup replacement is the deliberate, separately confirmed exception.

Deck editing updates existing IDs, inserts genuinely new cards, and only tombstones IDs explicitly removed in the editor. An omitted card is not deletion. Untouched fields in an old editor snapshot do not overwrite newer fields received from another device. Stars and review metadata are preserved when editing content.

## Sync and account isolation

`src/data/sync/` contains the journal, pure field merger, local repository, cloud repository, Auth service and sync engine. React components do not contain cloud merge logic.

Local changes work without connectivity. Pending snapshots coalesce by entity ID, have a revision and attempt count, and remain in IndexedDB across reloads. The runner retries on connectivity/focus, after local changes, and periodically while the app is open. One runner executes at a time in each tab. Duplicate or concurrent-tab uploads are safe. An acknowledgement clears only the sent revision, so an edit made during a request stays queued. A pull never deletes absent local records. Failed requests leave the outbox and local content intact.

Cloud records use `(user_id, entity_type, entity_id)` as their primary key, retaining the existing domain models inside versioned JSON fields. Types cover decks, cards, preferences, study events, generic history, legacy flashcard sessions and activity. Profile name, daily goal and theme are preferences. IndexedDB is the offline replica and immediate-write layer; Supabase is the recoverable account store.

RLS permits authenticated users to select only their own rows. Direct insert/update/delete grants are withheld. The narrow security-definer merge function requires `auth.uid()`, uses an empty search path and explicit owner predicates, and serializes mutations for that account. Anonymous users cannot execute it. No client supplies an owner ID for mutations.

Before first binding, existing device data requires an explicit merge choice. The local cache stays bound to that account after sign-out, preventing accidental uploads into another account. **This version supports one account per browser profile**; a different account must use a separate profile. Signing out revokes the local Auth session but retains local content, pending mutations and cloud content. Shared-device users are told cached data remains visible. No account deletion flow is added.

## Conflicts and study progress

Each ordinary field has a logical timestamp plus UUID tie-breaker. A local write advances beyond clocks already seen. Different fields merge independently, including term/definition stars. Concurrent changes to the same field choose the greater version deterministically. Text and alias revisions are retained in `_sync.versions` and included in full backups rather than silently discarding the losing content. There is no revision-management UI in this release.

Study events retain unique IDs and are additive/idempotent. Scheduling uses a retained baseline and replays subsequent events ordered by timestamp then ID through the **existing scheduler**. Thus concurrent offline practice does not drop one device's attempts or double-count retries. Existing pre-sync mastery is retained. Progress analytics use the event/history records, not an invented aggregate.

A deleted item has an explicit `deletedAt` field. Ordinary stale edits cannot clear it. Restore explicitly changes that field. Permanent deletion uses a terminal `purged` envelope that cannot be undone by stale clients or old backups; only the ID is retained. The server also purges child content when its parent deck is permanently deleted, including children uploaded later by an offline device.

## Trash, backup and restore

Delete Deck → confirmation → Trash. Cards, stars and metadata remain. Settings has Restore and a separately confirmed Delete Permanently. Trash never auto-empties. Permanent deletion removes current deck/card content and related study history, retaining only terminal ID markers for synchronization. Historical aggregate activity is retained. Independently exported backups and the last local restore safety copy are not retroactively erased.

Full backups use `format: bolet-backup`, `version: 1`, ISO export time and all domain tables. They contain personal study content, aliases, stars, schedules, history, preferences, Trash, and content revisions—not Auth tokens, passwords or cloud credentials. Store files privately.

Restore validates the entire file, previews counts, asks Merge/Replace, and requires confirmation. Invalid files never open a write transaction. Merge uses IDs/field versions. Replace explicitly replaces **local** domain rows after recording a downloadable safety copy of the previous local data. Pending account uploads are preserved. Replace does not send deletion for records absent from the backup, so unrelated account data can reappear on the next sync. The dialog explains this. Permanent account tombstones still win over old restored backups. Backup uploads are limited to 50 MB in this initial UI.

Learn feedback/overrides and unfinished Test answers also have local recovery drafts, with Resume buttons after reopening the mode. Drafts are not graded twice and are not cloud history until finalized. They are device-local and are not part of the portable backup. Existing finalized Flashcard/Match/Review attempts remain transactional. Safari termination before an IndexedDB operation completes cannot be made lossless.

## Browser storage and remaining limits

BOLET checks persistent storage and requests it once per local installation when supported. Settings distinguishes Protected, Browser managed and unavailable APIs. This reduces eviction risk; it is not a backup guarantee. Safari/PWA storage policies differ, and installing a PWA can create a separate storage context on some platforms. Sign into the same account or restore a backup in that context.

Unsynced local-only data is still vulnerable to explicitly clearing browser storage, disk failure or device loss. Sign in and finish syncing before moving devices. Background sync while Safari/PWA is closed is not promised; pending work resumes on opening BOLET with connectivity. Provider outages, paused free projects, quotas and email delivery limits can delay sync. Keep independent backups. Physical iPad Safari and live Supabase email delivery must be verified on deployment.

Very large accounts currently use paginated full pulls and replay scheduling events; this favors straightforward recovery over optimal bandwidth. There is no automatic pruning. Device clock skew can affect the winner of simultaneous same-field edits, although losing text is retained. Account changes within one browser profile are intentionally blocked rather than silently mixing caches.

## Verification

- Unit/data tests: transactional outbox rollback, reload/reopen, edit/reorder preservation, explicit card removal, migration from v1/v2/v3, backup validation/merge/replace/safety copy, absence-is-not-deletion, outages/reconnect, in-flight acknowledgement races, two-device field conflicts and additive study, Trash/restore/permanent deletion.
- Embedded PostgreSQL tests execute the **actual migration** and merge RPC, checking RLS across two users, blocked direct writes, anonymous access, merge parity and parent/child tombstones.
- Playwright production tests cover the existing study suite plus durable edits, Trash, backup restore, offline reload and answer recovery.
- A separate browser integration uses the real Supabase Auth client/sync engine with mocked HTTP responses across isolated browser contexts, covering first-login consent, outage, sign-out/in and new-device recovery. It does not claim a live hosted Supabase deployment test.
- Commands: `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`.
