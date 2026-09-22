# BrainBo product and implementation audit

Date: September 21, 2026. Scope: the existing application, including the visual changes made immediately before this audit request. This is a plan, not an implementation.

**Recommendation: improve trust, continuity, and speed before adding more visual treatment.** BrainBo has enough study modes. Its next release should help someone resume immediately, find a particular card, understand a grading result, and leave without losing work.

The warm paper identity is worth keeping. The newly enlarged decorative Home banner should be reduced: its appearance improved, but it gives the dominant space to Create Deck even when the user already has material. That conflicts with studying first.

## Evidence and limits

- Inspected the app shell, every major screen, study utilities, IndexedDB schema and migrations, draft storage, transaction journal, cloud transport/merge/replay, backups, authentication, and service worker.
- Inspected the production UI using isolated browser fixtures, without touching the user's library. Checked Home, Library, Deck, Learn setup, Test setup, Match setup, Progress, Profile, and Settings at 320, 390, 768, 834, 1194, and 1440px: 54 combinations, no horizontal document overflow.
- Visually inspected phone/desktop Home, iPad Deck and Learn setup, and dark Learn setup. These checks establish layout observations, not physical iPad/Safari certification or an exhaustive accessibility audit.
- The build and lint started before the audit request completed successfully. The 65 existing unit/data tests passed, including migration, backup, merge, and PostgreSQL policy tests. Those passing tests do not cover all product semantics: additional read-only probes reproduced the grading and summary defects below.
- No live Supabase account was modified or used to certify production sync. Existing cloud browser tests were inspected; they were not rerun for this audit. No paid service is proposed.
- No further implementation changes were made after the request to audit first. This document is the audit deliverable.

## A. Current strengths

1. **The core product structure is already recognizable.** Library → deck → Flashcards / Learn / Test / Match is understandable. Decks contain real term/definition pairs, not mode-specific copies.
2. **The durability foundation is substantial.** [IndexedDB](../src/lib/db.ts), [the journal](../src/data/sync/journal.ts), and [history transactions](../src/data/history.ts) preserve local writes, queue sync, and deduplicate attempts. Trash, explicit permanent deletion, backup validation, and terminal tombstones deserve preservation.
3. **Stars are shared.** [The content helper](../src/lib/learning/content.ts) and [StarButton](../src/components/learning/StarButton.tsx) consistently expose one card-level star, including offline persistence and legacy compatibility. Keep this model.
4. **Flashcards already have the interaction people expect.** Tap/keyboard flip, direction, session shuffle, horizontal drag-following, swipe labels, cancellation, and delayed retries already exist in [Flashcard](../src/components/study/Flashcard.tsx). Do not rebuild the gesture system to add features it already has.
5. **Learn has real learning behavior.** Bounded adaptive retries, explicit rounds, local grading, Don't Know, retyping, and a correction override exist. Retype does not erase the original mistake.
6. **Test has a useful foundation.** It supports multiple question types, eligible-card limits, answer direction, hidden correctness while taking, unanswered warnings, navigation, and auto/manual review.
7. **Match uses touch-friendly selection.** No drag-and-drop is required. Timing, mistakes, completion, stars, and follow-up study links already exist.
8. **The presentation system is coherent.** Warm surfaces, serif display typography, readable body text, reusable buttons/forms, and light/dark tokens fit the product. Native dialogs, most large targets, reduced-motion rules, and safe-area handling are good foundations.
9. **The app already separates study from navigation.** [AppShell](../src/components/layout/AppShell.tsx) removes the sidebar and bottom navigation during sessions. Desktop sticky navigation is already implemented; it is not a redesign project.
10. **Progress is based on real activity.** Empty accuracy uses a dash in the analytics utility. The simple scheduler requires repeated success for persistent mastery.

## B. Current weaknesses

### 1. Grading confidence is overstated — fix first

[grading.ts](../src/lib/learning/grading.ts) uses a set of stemmed words with an 80% overlap threshold for semantic grading. Word order and relationships disappear. A direct probe confirmed these are accepted with Smart Grading enabled:

- Expected: “Plants convert light energy into chemical energy.”
- Submitted: “Plants convert chemical energy into light energy.”
- Also accepted: “Plants destroy light energy into chemical energy.”

These are correctness failures, not acceptable typo tolerance. The Learn/Test helper text describes saved equivalent answers, but the implementation also accepts this broader heuristic.

**Decision:** keep strict normalization, conservative typo checks, explicit author aliases, and “I was correct.” Remove automatic correctness based solely on unordered concept overlap until a demonstrably safe approach exists. Do not add remote AI to compensate. Explain the supported grading behavior plainly.

### 2. Flashcards mix three different meanings of progress

[sessionStats](../src/lib/study-session.ts) calculates Known as all selected cards minus any card ever missed. A probe with three cards and one successful attempt reported **3 Known, 1 studied**. A previously missed card remains Still Learning even after two later successful recalls retire it.

Meanwhile, the header's `0 / 12` counts cards with two consecutive recalls, not the current card or unique cards reviewed. One correct answer can leave the header unchanged. Persistent mastery has a different threshold again.

**Decision:** distinguish Unseen, Known this session, Needs another try, and persistent mastery. Never infer Known from absence of a miss. Keep “missed at any point” as a separate review subset. Label header progress as cards reviewed and make the current repeat policy visible without multiple competing counters.

Flashcards also require grading to advance; there is no ungraded Next/Previous browsing path. Add a discreet browse path while retaining swipe left/right for assessment.

### 3. Resume is incomplete and difficult to discover

- [Flashcards](../src/components/study/StudySession.tsx) always construct a fresh session on mount, despite saving sessions to IndexedDB after answers.
- [Learn](../src/components/learning/LearnMode.tsx) offers recovery, but saves at grading/Continue/override boundaries. Text typed before checking, initial session state, and retype text are not continuously recoverable.
- [Test](../src/components/learning/TestMode.tsx) saves a local recovery draft on state changes, including typed answers. Its draft contains the whole exam and is rewritten on every keystroke.
- Learn/Test recovery reads parse unversioned JSON without a local error recovery handler. A bad draft can reject rather than offering a clean recovery choice.
- Match and Daily Review preserve committed activity but not the current game/queue for exact resume.
- Home's “Continue studying” routes to Flashcards, regardless of the actual last mode or whether a Learn/Test draft exists.

**Decision:** standardize local session checkpoints and a small resume index. Show deck, mode, completed work, and last active time. An explicit Starred/Review Missed link must keep its requested scope; never silently replace it with an unrelated draft. Cross-device unfinished-session handoff should wait.

### 4. Home gives attention to the wrong tasks

[HomeDashboard](../src/components/home/HomeDashboard.tsx) leads with a large greeting and Create Deck, followed by search, streak/goal metrics, due review, then Continue. With the fixture library, phone Home was about 2,941px tall at 390px width; Continue was below the initial viewport.

Search on Home only filters the six displayed recent results after matching; it is not a full-library results screen. Home's recent cards follow updated order, while Library defaults to creation date, making “recent” ambiguous. A new library with no query still gets “No decks match that search.”

**Decision:** prioritize resumable session → last studied deck → due review → first-deck creation. Keep a separate due count/action visible even when resume is primary. Reduce the greeting to a compact welcome and put streak/goal below study actions.

### 5. Deck browsing does not scale

[DeckDetail](../src/components/library/DeckDetail.tsx) renders every card with no within-deck search or term-list filters. Its desktop/iPad rows still stack term above definition. Twelve short fixture cards already made an approximately 2,245px page at iPad portrait width. Export/Delete are at the very bottom.

Deck favorites and card stars both use star icons, although they mean different things. Users can reasonably confuse “Favorite deck” with “Study starred.”

**Decision:** add term/definition search and All / Starred / Needs practice filters. Use two-column term/definition rows when space permits. Retain one card star; distinguish deck favorites with a bookmark icon and explicit wording. Put secondary deck management in a reachable More menu. Preserve destructive confirmation.

### 6. Setup is complete but too demanding

Learn/Test settings are component state with defaults on every new mount. Users repeatedly see content, direction, question types, grading, rounds/count, and shuffle. At iPad portrait, the measured Learn setup was about 1,272px tall and Test 1,344px, with Start at the bottom.

Both modes show written grading controls even when written answers are not selected. Learn's no-history recommendation is usually six rounds, with limited deck-size adjustment; it is not a carefully budgeted time recommendation.

**Decision:** keep a compact setup summary and visible Start action. Remember explicit choices. Place advanced options in expandable sections. Show grading only when relevant. Preserve manual rounds 1–10; make Automatic favor a bounded initial workload with an honest explanation and optional continuation.

### 7. Learn feedback and progress need clearer context

The student's answer remains in a disabled input rather than a clear “Your answer / Expected answer” comparison. The progress bar advances at round boundaries, so a long first round can remain visually at zero while the learner answers questions. Next-question focus is not explicitly managed.

**Decision:** give every wrong answer a compact comparison and one clear Continue action. Retype and “I was correct” remain secondary and conditional. Display within-round progress honestly, including when retries add work. Separate “confident this session” from persistent “Mastered.”

### 8. Test has review friction and misleading timing

Unanswered submissions become Incorrect in the main results. The detail says Unanswered but there is no separate skipped count. The question navigator renders one control per question, which becomes unwieldy for a large set. Manual review asks users to acknowledge even objective results, whose incorrect grading option is disabled. Taking a test has no explicit Back to Deck/pause action.

Duration uses submission time minus the original start time. Resuming after a long absence can include inactive hours, unlike Learn's reset timer. Several completion actions compete at equal weight.

**Decision:** separate Correct / Incorrect / Unanswered in the UI, state scoring treatment, track active time, add safe Save & Exit, and make Review Missed the primary follow-up. Keep automatic final scoring off during manual review; objective answers can be presented as resolved without requiring needless extra taps.

### 9. Match needs bounded boards and duplicate-pair validation

[MatchMode](../src/components/learning/MatchMode.tsx) defaults to six pairs but offers All regardless of deck size. At portrait tablet widths the grid remains two columns until the `lg` breakpoint. Long definitions can push matching tiles far apart. The Shuffle checkbox changes which cards are selected; tile placement is randomized regardless, so the wording is ambiguous.

The text-based duplicate allowance checks whether a pairing exists anywhere in the deck, not whether accepting it preserves a solvable remaining board. Code inspection yields a counterexample: pairs A→X, A→Y, B→Y permit both A tiles to consume both Y tiles, leaving B and X. This deserves a dedicated browser regression test before claiming duplicates are fully supported. Attempt attribution also follows one tile's card ID, which can misrepresent the other card after interchangeable matches.

**Decision:** preserve tap matching; cap each board to a comfortable size and offer another board for large sets. Validate ambiguous pairings as a solvable multiset or exclude ambiguous combinations with clear setup guidance. Add personal best only after boards and scoring are comparable.

### 10. Progress reports before it guides

[ProgressView](../src/components/progress/ProgressView.tsx) places seven Today metrics, a chart, and mastery before Needs Attention. Difficult material is repeated in a later section. The fixture page exceeded 3,000px on iPad/desktop. The attention predicate uses lifetime miss counts, so a repeatedly missed card can remain flagged indefinitely despite subsequent mastery.

**Decision:** lead with Review Due, Needs Practice, and Starred. Put history/chart detail below. Explain why an item needs practice and allow recovery to reduce its priority. Keep counts real and missing-data percentages absent.

### 11. Editing is vulnerable to accidental dismissal

[CreateDeckDialog](../src/components/decks/CreateDeckDialog.tsx) keeps unsaved content in React state; Close, Escape, Cancel, or reload can discard it without a draft or dirty-state guard. Removing a card from the draft has no Undo. Import preview is good, but success is primarily inferred from the editor changing or closing.

**Decision:** persist a local recovery draft and retain explicit Save as the commit boundary. Do not autosave half-written cards into the synced deck. Offer Undo for draft row removal and dirty-close protection until draft recovery is robust. Keep focus/scroll near the edited card after save.

### 12. Navigation and accessibility have specific gaps

- Six mobile tabs crowd a 320px layout. Settings and Profile consume two primary destinations.
- Study is currently largely a second deck grid leading to Flashcards. It does not yet justify its own tab as a distinct task center.
- [LibraryView](../src/components/library/LibraryView.tsx) marks filter buttons as tabs without a complete tab-panel/arrow-key pattern. Toggle buttons would be simpler.
- [SettingsView](../src/components/settings/SettingsView.tsx) does not expose the selected appearance choice using `aria-pressed` or radio semantics.
- Flashcards' window-level Space shortcut intercepts Space even while a real button is focused. Existing tests intentionally expect this, but it conflicts with the usual keyboard behavior of that focused button.
- Screen transitions do not consistently move focus to the next prompt/result. The backup file input is visually hidden without a visible focus state on its label. Several account text links are smaller touch targets than the primary controls.

**Decision:** use five mobile destinations—Home, Library, Study, Progress, Profile—with Settings directly inside Profile. Make Study a resume/review launcher, not a second Library. Preserve desktop routes and sticky navigation. Correct the specific semantics and focus behaviors before adding decorative motion.

### 13. Sync communication can falsely reassure

[SyncProvider](../src/providers/SyncProvider.tsx) catches failures inside `retry()` and updates error state, but resolves its promise. [ProfileView](../src/components/profile/ProfileView.tsx) can therefore show “Sync complete.” after that resolved call even when status is “Sync problem — retry.” The normal Profile screen does not display `sync.error`, only its own local action error. [LocalDataConsent](../src/components/auth/AccountOnboarding.tsx) also relies on a rejection that retry does not propagate.

The small status link is appropriately restrained, but too small and not sufficient for a recoverable error. Some copy still says data stays only “on this device” even for signed-in users. “Protected and synced” should describe a completed operation, not a permanent durability guarantee.

**Decision:** give the existing sync operation a truthful structured outcome; render friendly status and an actionable persistent error. Keep normal status compact near Profile, with saved-locally and pending distinctions. Do not change merge semantics just to improve wording.

### 14. Performance work should target real growth paths

- [StoreProvider](../src/providers/StoreProvider.tsx) observes whole deck/card/history/event tables in one subscription. An answer or remote merge can reload/recompose the library and invalidate consumers.
- [studyAnalytics](../src/lib/learning/analytics.ts) uses nested history/event scans. Progress also repeatedly filters per deck.
- Sync retries every ten seconds, also on focus and queue changes. Each run pulls all records before and after pushing. Each push acknowledgement invokes [applyRemote](../src/data/sync/localRepository.ts), which rereads and replays card/event projections across the database. This can grow roughly with cards × events per replay, repeated for queued uploads.
- Test rewrites a full exam draft for each input change. All deck rows and import preview rows render immediately.
- `LocalLink` intentionally uses document navigation for offline service-worker fallback. Replacing all anchors with client routing as a cosmetic cleanup risks breaking offline navigation.

**Decision:** measure with large libraries and long history before a broad optimization. First reduce redundant invalidation, aggregate with maps, and checkpoint changed answer state efficiently with a reliable final flush. Then optimize replay to affected cards and unchanged-record writes. Incremental cloud cursors require a separate design and loss/reconnect tests; postpone them until justified.

## C. Highest-impact improvements

Order reflects trust and frequency of use. Difficulty includes meaningful verification; risk reflects changing existing semantics or persistence.

| Rank | Improvement | User impact | Difficulty | Regression risk |
| --- | --- | --- | --- | --- |
| 1 | Correct unsafe semantic grading; align explanation with behavior | High | Medium | Medium |
| 2 | Correct Known / Still Learning / Unseen and session progress | High | Medium | Medium |
| 3 | Truthful sync outcomes and visible recovery errors | High | Medium | Medium |
| 4 | Consistent local checkpoints and discoverable Resume | High | High | High |
| 5 | Dynamic Home study action; move metrics below study priorities | High | Low | Low |
| 6 | Deck search, useful filters, and compact term rows | High | Medium | Low |
| 7 | Save explicit study preferences; compact Learn/Test setup | High | Medium | Medium |
| 8 | Recoverable editor drafts, dirty-close safety, draft Undo | High | Medium | Medium |
| 9 | Clear Learn answer comparison, focus, and within-round progress | High | Medium | Medium |
| 10 | Test skipped-state review, active timing, and Save & Exit | High | Medium | Medium |
| 11 | Solvable duplicate Match boards and bounded board size | Medium | Medium | Medium |
| 12 | Five-tab mobile navigation and purposeful tablet layouts | High | Medium | Medium |
| 13 | Action-first Progress with recent, recoverable difficulty | Medium | Medium | Medium |
| 14 | Shared save/error/Undo feedback and accessibility corrections | Medium | Medium | Low |
| 15 | Measured improvements to store invalidation and sync replay | High for large libraries | High | High |

## D. Recommended BrainBo product structure

### Home

One primary study action: Resume an unfinished session, otherwise Continue the last studied deck in its last mode, otherwise Review Due, otherwise create the first deck. Show pending due work alongside it, not hidden by resume. Follow with a short Recent section and a compact today/goal line. Search should open full Library results. A small greeting is enough.

### Library

Own finding and organizing sets. Keep search, Favorites, Subject, and Sort. Add Recently Studied sort and remember the view. Use compact cards with title, subject, card count, and one relevant status. Offer a simple list density once real libraries need it. Avoid a folder hierarchy. Keep Create Deck accessible.

### Deck

Own the set and its study entry points. Title, optional description, counts, and modest progress come first. Use four restrained icon-and-label mode tiles with short purpose text: Flip & recall; Practice weak spots; Check yourself; Pair concepts. The last mode can be suggested without hiding the others. Add Resume if relevant, then scope controls and a searchable term list. Card star is always reachable; management actions live in More.

### Flashcards

Open directly with remembered direction/order. Keep tap flip, swipe assessment, visible Know/Still Learning, and keyboard shortcuts. Add understated ungraded browsing, not another primary control row. Use unique cards reviewed for understandable progress, reveal retry state clearly, and offer Review Missed after completion. Preserve the card's native vertical scroll behavior and restrained flip.

### Learn

Begin with a concise setup summary and Start/Resume. Advanced settings remain available. During study show one prompt, one answer area, progress, and calm feedback. On an error, compare answers and prioritize Continue; Retype and I Was Correct have clearly different consequences. Explain automatic workload; do not imply guaranteed mastery after a fixed number of rounds.

### Test

Offer Quick Test (up to 10 eligible cards), Full Test, and Custom as shortcuts over the same settings model. Keep remembered direction and grading transparent. During a test show one question, Previous/Next, progress, and safe exit; collapse a large question navigator. Results lead with score and Correct/Incorrect/Unanswered, then Review Missed and expandable detail. No second testing engine.

### Match

Start a comfortable board quickly. Keep tap selection and stable tile positions; completed tiles should not cause layout jumps. Use the available tablet width. Next Board is better than a 100-pair wall. Play Again and Review Difficult are sufficient; a comparable personal best can be added later.

### Progress

Answer “What should I review?” first. Due and Needs Practice lead to scoped sessions, with reasons. Starred is a deliberate user-selected subset. A few today/mastery figures follow; chart and recent history are secondary. Avoid penalizing a recovered card forever for old mistakes.

### Profile

Own identity, display name, email, daily goal, account sync, password, and sign out. Include a clear Settings link on mobile. Preserve the existing account binding boundary. An account mismatch needs an understandable explanation and route back to the owning account—not an automatic merge or deletion.

### Settings

Own appearance, study defaults, backups, storage, Trash, and install/offline help. Keep account management in Profile and deep technical details behind disclosure. Backup replace remains explicit about what it does locally versus in the cloud.

### Authentication and Daily Review

Keep local continuation easy to find. After sign-in, load cached material promptly where safe; show recovery work without unnecessarily blocking study. Make display name/goal setup skippable with defaults, while keeping local-data/account merge consent explicit. Retain confirmation and password-recovery flows, adding clear resend/change-email recovery when supported.

Daily Review should remain simple: due cards, source deck, reveal, four ratings, completion. Keep Again's ten-minute schedule; do not add a forced wait inside the session. Add checkpointing, active time, and clearer next-due feedback rather than a new scheduler.

## E. Mobile/iPad recommendations

| Layout | Specific recommendation |
| --- | --- |
| 320–430px phone | Five tabs, generous thumb targets, compact Home action above statistics, a single Filters sheet when Library controls wrap, stacked term rows, expandable secondary mode options. Start/Continue controls remain reachable above the keyboard and safe area. |
| 600–800px small tablet / split view | Use content width rather than device identity. Two-column mode tiles and term/definition columns only when readable; otherwise stack. Do not force a sidebar into narrow split view. |
| iPad portrait | Keep bottom navigation for general screens. Use wide paired term/definition rows, 2×2 mode tiles, a compact setup summary, and a three-column Match board when tile text permits. Study cards should use comfortable reading widths rather than filling every available pixel. |
| iPad landscape | Retain stationary navigation outside study. Use available width for setup groups or a question navigator beside the test, not oversized answer text. Four-column Match when practical; allow fewer columns for long definitions. |
| Laptop / desktop | Preserve sticky sidebar. Bound reading width; use wider layouts for library scanning and term comparisons. Keep keyboard focus and all actions visible without hover. |

Validation must include iPad Split View, software keyboard open, rotation mid-question, 200% zoom, long unbroken terms, long definitions, large text, and safe-area/PWA standalone mode. The no-overflow checks are useful but do not prove these cases work. Physical Safari and VoiceOver checks remain necessary before calling the result iPad-certified.

## F. Visual design recommendations

- **Keep paper, ink, and rust.** Retain existing font roles and warm tokens; use color for selected state and study feedback. No global palette replacement.
- **Shrink the new hero.** Keep a little warmth, but remove the large illustration from the main study path. A compact resume/review surface should dominate because of usefulness, not height or a dark gradient.
- **Create hierarchy through spacing.** Deck term lists need fewer individual bordered containers. Use grouped surfaces and quiet dividers, with more space around sections than between related labels.
- **Use mode identity sparingly.** Four familiar icons and concise descriptions beat four brightly colored banners. Selected/default mode can use the existing accent.
- **Preserve typography roles.** Serif for titles and a flashcard term, sans-serif for answers and explanations. Reduce long-definition font size gradually, preserve selectable/readable text where appropriate, and avoid enormous centered paragraphs.
- **Use semantic, theme-aware feedback tokens.** Selected, success, warning, and error should work in both themes and include text/icons. Measure contrast; visual inspection alone is insufficient.
- **Micro-interactions should confirm work.** A filled star already confirms a star; a toast for every star would be noise. Use “Deck saved,” “Imported 45 cards,” and “Moved to Trash · Undo” where a transient message adds information. Durable errors must not disappear on a timer.
- **Avoid motion that competes with recall.** Keep the flip, subtle selection, and short completion transition. No confetti, looping decoration, hover-dependent controls, or large card fly-outs. Honor reduced motion for transforms as well as timing.
- **Do not overextract styling abstractions.** Reuse Button, Dialog, ProgressBar, and shared study controls. Introduce an action bar or status component only when several real screens need the same behavior.

## G. Functionality changes

### Change existing behavior

- Correct grading and summary defects; explain persistent versus session mastery.
- Make navigation and session resume preserve the intended deck, mode, and filter scope.
- Remember explicit settings and make setup concise; keep type/count validation and conservative grading.
- Separate Test skipped answers from attempted incorrect answers, while preserving a clearly stated scoring policy.
- Make Home and Progress actionable before statistical.
- Return truthful sync operation outcomes without changing merge semantics.
- Make attention ranking respond to recent recovery; preserve historical mistakes as history.
- Resolve Match duplicate pairing safely and bound board size.

### Small additions justified by the core workflow

- Search within a deck and visible scope filters.
- Recently Studied sort and remembered Library view.
- Local session/editor recovery index and draft lifecycle handling.
- Quick/Full Test shortcuts over existing settings.
- Safe Save & Exit, compact shortcut help, and targeted Undo feedback.
- Optional ungraded Flashcard browsing, with no fabricated attempts or mastery changes.

### Larger work that should wait

- Cross-device unfinished-session handoff: local resume first; never pretend current local drafts sync.
- Incremental cloud pulls or batched protocol redesign: profile, design reconciliation semantics, then migrate safely.
- Virtualization: measure large-list costs first; preserve keyboard navigation, find-in-page, and accessibility.
- A conflict-history viewer: valuable later because competing text is retained, but not a prerequisite for better study flow.
- Personal best in Match: only compare compatible deck revision, pair count, and scope; no meaningless all-board leaderboard.

## H. Things NOT to build yet

- No additional study modes, AI tutor, AI deck generator, or paid semantic grading service.
- No pharmacy-specific product branching, calendars, course/LMS hierarchy, note-taking workspace, or productivity dashboard.
- No social feed, public discovery marketplace, XP, streak pressure, achievements, or leaderboards.
- No elaborate folder tree or custom tagging system before search/subject filters prove insufficient.
- No second star model, per-mode star arrays, or reset of legacy star compatibility fields.
- No proprietary or complex spaced-repetition replacement. The current simple scheduler is adequate for this iteration.
- No broad authentication/provider rewrite, internal branding rename, destructive migration, or automatic browser-data clearing.
- No toast on every successful action. No extra confirmation before ordinary study navigation once checkpoints are reliable.
- No new animation/visualization framework for styling that CSS and existing components can handle.

## I. Implementation phases

### Phase 1 — Core interaction improvements

**Files:** `src/lib/learning/grading.ts`, `src/lib/study-session.ts`, `src/data/drafts.ts`, `src/data/study.ts`, `src/components/study/StudySession.tsx`, `src/components/home/HomeDashboard.tsx`, `src/components/library/DeckDetail.tsx`, `src/components/decks/CreateDeckDialog.tsx`, `src/providers/SyncProvider.tsx`, `src/components/profile/ProfileView.tsx`, auth consent components.

**What and why:** fix the reproduced grading/summary defects and misleading sync success first. Add versioned local recovery/checkpoint boundaries, explicit Resume metadata, deck search, and a useful Home primary action. Add recoverable editor drafts while keeping explicit Save. Work in small changesets; do not combine these into a study-engine rewrite.

**Benefit:** trustworthy results, fewer lost sessions/edits, and faster access to the next useful task.

**Risks:** a resumed attempt being counted twice; stale/deleted cards in drafts; resuming the wrong scope; changes to grading expectations; confusing same-device drafts with cloud recovery. Keep identity ownership and data transactions intact.

**Tests:** reversed meanings and contradictory key verbs; unseen cards on early completion; miss→success transitions; refresh before grading and after grading; corrupt/version-old draft; deleted card/deck; duplicate Continue; explicit starred link versus all-card draft; draft close/reopen; offline persistence; retry failure must never announce sync success. Keep existing migration, queue, Trash, backup, and account isolation tests passing.

**Exit:** Home resumes the actual session; one attempt remains one durable event; results contain no inferred Known cards; safe local recovery is visible and accurate.

### Phase 2 — Study mode polish

**Files:** `LearnMode.tsx`, `TestMode.tsx`, `MatchMode.tsx`, `DailyReview.tsx`, `QuestionAnswer.tsx`, `StudyControls.tsx`, `Flashcard.tsx`, `src/lib/learning/{adaptive,recommendation,questions}.ts`, existing history/draft utilities.

**What and why:** remember explicit settings; shorten setup; keep advanced controls discoverable. Improve Learn comparisons and focus, Test Save & Exit/skipped review, and active time. Add restrained ungraded flashcard browsing. Fix ambiguous Match boards before polishing their completion state. Keep existing repeat and rating algorithms unless a specific correctness finding requires a change.

**Benefit:** less setup and frustration, predictable progress, and clear next steps after a miss.

**Risks:** settings leaking across filters/decks; wrong meaning of direction; time double-counting; answer reveal before Test submission; changing which records receive Match progress.

**Tests:** all selected question-type combinations; both directions/mixed; strict versus typo/alias grading; empty/single starred sets; count clamping; all rounds 1–10 and deterministic Auto; delayed retries; Retype versus override history; refresh while paused; manual Test review; skipped scoring; ungraded navigation emits no event; duplicate A→X/A→Y/B→Y Match case; long-definition boards; reduced motion.

**Exit:** common sessions start from a compact summary, every study state has a clear next action, and outcomes remain correct across resume and replay.

### Phase 3 — Navigation and responsive refinement

**Files:** `src/lib/nav.ts`, `AppShell.tsx`, `Sidebar.tsx`, `BottomNav.tsx`, `StudyPicker.tsx`, `LibraryView.tsx`, `DeckDetail.tsx`, `ProfileView.tsx`, `Dialog.tsx`, shared answer controls, `src/app/globals.css`.

**What and why:** five mobile tabs with Settings in Profile; give Study a distinct resume/due/needs-practice purpose. Add compact library filters and Recently Studied, adaptive term columns and mode tiles, and keyboard-safe action placement. Correct tab/toggle/focus semantics. Preserve offline link handling.

**Benefit:** less duplicated navigation and better use of tablet space without losing phone usability.

**Risks:** hidden routes, sticky elements covering content, software keyboard collisions, lost scroll/focus, client navigation bypassing the offline fallback.

**Tests:** 320/390/768/834/1194/1440px; portrait/landscape and split-view equivalents; keyboard open; 200% zoom; navigation via touch/keyboard; browser Back restores filters/location; native dialog focus trap/return; reduced motion; stationary sidebar; all relevant routes offline with actual service-worker control. Add real iPad Safari/VoiceOver checks beyond Chromium emulation.

**Exit:** the primary action is reachable, every route remains discoverable, and content stays readable without horizontal document scrolling or covered controls.

### Phase 4 — Product polish

**Files:** `HomeDashboard.tsx`, `DeckCard.tsx`, `ProgressView.tsx`, `SyncStatus.tsx`, `ProfileView.tsx`, `DataSettings.tsx`, `AuthFrame.tsx`, onboarding components, shared UI components, analytics utilities and theme CSS.

**What and why:** reduce decorative hero height, simplify bordered lists, lead Progress with review actions, and add shared durable-error/transient-success treatment. Integrate safe Trash Undo with the existing restore path. Make account setup less blocking without removing migration consent. Add visible status and trustworthy storage/offline wording.

**Benefit:** a calmer product that communicates progress and recovery clearly.

**Risks:** success shown before transaction commit; Undo after permanent purge or conflicting remote action; transient messages hiding errors; contrast regressions; banners causing layout jumps.

**Tests:** save/import/favorite failure, restore and Trash Undo across reload/reconnect, permanent deletion cannot be undone, screen-reader announcements, light/dark contrast, empty/new library, no-history metrics, status transitions, onboarding defer/retry, hidden-tab return, and service-worker update during a session.

**Exit:** feedback confirms real outcomes and the first screenful prioritizes studying rather than account mechanics or decorative statistics.

### Phase 5 — Optional future enhancements

**Files:** `StoreProvider.tsx`, `src/lib/learning/analytics.ts`, `src/data/sync/{syncEngine,localRepository,cloudRepository}.ts`, Test draft handling, large-list components; cloud migration files only if an approved protocol change actually requires them.

**What and why:** benchmark realistic growth—e.g. 200 decks, 10,000 cards, and 50,000 events—then optimize the slow paths. Start with indexed/map aggregation, scoped subscriptions, affected-card replay, unchanged-write avoidance, and efficient draft checkpoints. Evaluate incremental cloud transport only with evidence. Later consider a conflict viewer, compatible Match bests, or cross-device session handoff one at a time.

**Benefit:** preserve responsive typing, answering, and syncing as a library grows.

**Risks:** missing a remote change, misapplied event replay, duplicate history, excessive memory, wrong checkpoint ordering, tombstone resurrection. These are higher-risk data changes and need their own review.

**Tests:** before/after typing and answer latency, initial library load, records/bytes per idle sync, battery-relevant background work, long offline queues, multi-device convergence, concurrent edits during acknowledgement, outage/reconnect, paginated pulls, schema upgrade, backup/restore parity, and owner changes.

**Exit:** measured improvements with all existing durability invariants preserved. No speculative framework replacement.

## Release priorities and success criteria

Ship the correctness/recovery work first, then simplify setup and deck browsing, then refine responsive presentation. Do not begin with a larger dashboard or another study mode.

- A returning student can resume from Home in one action.
- A student can find and study a subset inside a large deck without manually scrolling the entire set.
- Common Learn/Test sessions do not require scrolling past every advanced setting to start.
- Every reported Known card was actually assessed; unanswered Test items are explicit.
- Incorrect semantic relationships never become correct solely through word overlap.
- Refresh and offline navigation preserve committed work and honestly describe draft recovery.
- Sync failures never produce success confirmation.
- Touch, keyboard, and screen-reader users receive the same available actions.
- Appearance reinforces the familiar set → mode → feedback → review loop.
