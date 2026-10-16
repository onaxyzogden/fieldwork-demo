---
title: "Wiki Log"
type: log
---

## [2026-10-16] session | ADR 086: the customer intake in the register

- **Completed:**
  - A register audit of the customer intake (address, tasks, timing). The intake may speak warmly but does not sell. The audit found 11 issues, 2 P1, 3 P2 and 6 P3, and all 11 are fixed.
  - The P1s: Instant Book shows the real appointments before the timing constraints, so they are no longer below the fold on a phone, and the step h1 is `--text-h2`. The times read in order: the best fit first, then time order, and "See more times" is grouped by day. Only the display order changed, not the scoring in `intakeOptions`.
  - The P2s: there is no review badge or booking-mode badge on customer surfaces. The copy that used internal vocabulary is rewritten. `.time-pill` is 44px.
  - The P3s: "Recommended" appears once, as a muted label. The visit length is said once. The 150px gradient is now a one-line address confirmation, and its four tokens are removed. The photo button no longer uses accent. The dialog h2 is `look-h3`.
  - `DESIGN.md`'s register line now says customer surfaces never show the operator's working state, and compared lists come in a readable order.
- **Verified:**
  - `npm run build`, and `npm test` (657 tests, all passing). No assertions changed.
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes, on all three steps. Nothing overflows. "Recommended" is 6.1:1 in light and about 7.5:1 in dark. Time pills are 44px. No console errors. Request to Book was checked by marking the task unreviewed in the demo state.
- **Correction:** the audit listed `.task-number` as an intake element. It is only used by `OperatorRequests`, so it is untouched.
- **Deferred:** a regression test for the time order; the "Send for referral review" copy; the customer workspace's "Home, handled." and its eyebrows; offering the soonest times as well as the best-scored ones.
- **Pages touched:** [[fieldwork]], [[index]].

## [2026-10-16] session | `concurrency.test.ts` independent of the timezone

- **Cause:** four tests picked "three days out at 15:00 UTC" by hand. `seed()` puts marcus's visit v5 on the same day at `setHours(10)`, which is 10:00 in the machine's own timezone. On a Toronto or New York machine, v5 runs 14:00–15:45 UTC including its wrap-up, and the test's slot starts at 14:52 UTC once travel is counted. So the scheduler refused it: correctly, since it clashes. Under `TZ=UTC` all five passed. Eastern machines failed every day except Wednesday and Thursday, when three days out is a weekend, so the test moved to Monday and v5 stayed on the weekend. It was never the date, and it was not a scheduler bug.
- **Completed:**
  - The tests take their slot from `slots()`, the scheduler's own list of free times, so they cannot land on a seeded visit.
  - Corrected the "depends on the date" diagnosis in ADR 085, in [[fieldwork]] History and in the ADR 085 log entry below. Marked ADR 085 as live on `main` via PR #62 in [[fieldwork]] Current Status.
- **Verified:**
  - All five pass with the clock faked to every day from 12 to 18 October, under UTC, America/Toronto and Asia/Tokyo. The same probe on the old helper fails in Toronto, which shows the faked clock reproduces it.
  - `npm test` (657 tests, all passing) and `npm run build`.
- **Closes:** "Making `concurrency.test.ts` independent of the date" from ADR 085. Only a test changed, so there is no ADR.
- **Deferred:** `seed()` places v5 with machine-local `setHours(10)`, while the scheduler works in Toronto time (`localTime`). Outside Toronto the demo visit lands at a shifted hour, sometimes on a weekend.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 085: the Contractors page in the operational register

- **Completed:**
  - A register audit of the operator's Contractors page against the house methodology's persuasive/operational register. Copy voice, type scale, density and accent were all persuasive. There was no motion.
  - The page is now an h1 "Contractors", one factual line, and one roster table. It has three widths, set by the workspace container: one line per value at 64rem and wider, wrapped below that, and stacked labelled lines below 47rem. It has explicit table roles, and the credentials caveat appears once.
  - A register paragraph in `DESIGN.md`: all three roles' workspaces are operational.
  - Checked live at 320–1440px in both themes. Nothing overflows, the whole roster fits in one desktop view at 1440px, and there are no console errors.
  - 657 tests and the build. Four `concurrency.test.ts` tests fail on `main` as well, because they depend on the machine's timezone.
- **Deferred:**
  - Making `concurrency.test.ts` independent of the date.
  - Phone and email on the roster.
  - Linking each contractor to their visits.
  - Elias's role text repeats the restricted-work column.
  - Register audits of the other screens.
- **Pages touched:** [[fieldwork]].

## [2026-10-15] session | A screen test for the intake's photo-only Continue

- **Completed:**
  - One test in `workspace.test.tsx`. A draft task with photos and no description, on Continue, shows "Describe the task for these photos before continuing." beside the task, with no toast. Focus goes to that task's description, which names the message in `aria-describedby`, and the intake stays on the tasks screen.
  - Checked that the test fails when the photo-only branch in `CustomerIntake.advance()` is disabled.
  - 656 tests pass.
- **Closes:** the deferred item from ADR 082–084. No code changed, so there is no ADR.
- **Still deferred:** `OperatorRequests` as its own chunk.
- **Pages touched:** [[fieldwork]].

## [2026-10-15] session | ADR 084: the greeting's clock, Instant Book's price list

- **Decided:**
  - Instant Book prices come from a table per catalogue job, keyed by category, with DOOR-01 at $129 to start (Yousef's choice). The operator's quote formula, which would have made it $165, was not used.
  - A job with no price is not eligible for Instant Book.
  - Splitting `OperatorRequests` into its own chunk waits.
- **Completed:**
  - `greetingFor(clock)` with four fixed-instant tests. The screen test passed at 18:25, the hour that used to fail it.
  - `INSTANT_PRICES` and `instantPrice`, and the five `$129` literals replaced.
  - 655 tests (7 new), `tsc` and the build pass.
  - Live check: intake, dialog and toast all show $129, and the recorded quote and payment carry the table's amount and notes. No console errors.
- **Deferred:**
  - `OperatorRequests` as its own chunk.
  - A screen test for the intake's photo-only Continue.
- **Pages touched:** [[fieldwork]].

## [2026-10-15] session | ADR 083: Offer withdraw, `FindingReview`, the platform audit's P3s

- **Decided:**
  - The Offer's undo is a withdraw, available until the contractor answers, not a timed grace period. Chosen by Yousef as the better long-term option.
  - An unread offer notice is taken back with its unread "Visit proposed", and nothing is sent. A read one gets "Offer withdrawn". The contractor gets no visit notice for a withdraw, either way. The customer hears the visit change as usual.
  - A replacement offer keeps the earlier provider, start, travel and status as `previous`, so withdrawing it puts the visit back.
  - Decline on the Work page uses the queue's one-tap reasons (Yousef's choice).
  - The demo bar's chips get a 32 px floor on desktop in every role. This corrects ADR 082: it said "already 44 px", which held only on phones and in the Operator view.
- **Completed:**
  - `withdrawOffer` and the `Withdrawn` status, listed in the status dictionary.
  - Undo in the queue and "Withdraw offer" on the request page.
  - `FindingReview` cleaned up.
  - Every P3; see [[platform-ux-audit-2026-10]].
  - 648 tests (19 new), `tsc` and the build pass. The only failure is the greeting test, which depends on the wall clock and fails on main too.
  - Live checks:
    - queue Undo, with focus on the line;
    - request-page Withdraw, with the toast, the request back to Submitted and "1 task" in the list;
    - Marcus, who had read the offer, shows "Offer withdrawn";
    - Nina, who hadn't, shows no offer notice;
    - one-tap Decline, with focus on the first reason;
    - Activity links open their request;
    - the demo bar at 1024 px in three roles;
    - dark theme, with no console errors.
  - Live checking also found a "1 tasks" in the operator's request list and the contractor's "Visit proposed/cancelled" notices around a withdraw. Both are fixed and tested.
- **Deferred:**
  - The greeting test's wall-clock dependency.
  - Instant Book's $129.
  - A screen test for the intake's photo-only Continue.
- **Pages touched:** [[platform-ux-audit-2026-10]], [[fieldwork]], [[index]].

## [2026-10-15] session | ADR 082: the accessibility audit's minors

- **Decided:**
  - An error sits after its `<label>`, not in it. A `display: contents` wrapper keeps the layouts, rather than a restyle.
  - A price stays the quote's focus target as a `<p tabIndex={-1}>`, not a heading.
  - The intake's photo-only Continue gets an inline error and focus, not a toast.
  - The icon rule lives in `design:check` and treats `Icon` as a lucide icon, because two icons (sidebar nav, operator status) are held that way and escaped the first pass.
  - `button.badge` grows about 2 px to reach 32 px; the time pill and the role switch already met it.
- **Completed:**
  - All 17 minors; see [[accessibility-audit-2026-10]].
  - 629 tests (13 new), `tsc`, and the build pass.
  - Live: the skip link is the first stop and focuses `<main>`; the intake's error describes its field and takes focus; the done check, badges, and both themes look as before; no console errors.
  - The wiki records ADR 081 as PR #57, merged.
- **Deferred:**
  - Removing the unreachable `FindingReview` decision buttons.
  - The Offer undo.
  - Instant Book's $129.
  - The platform audit's P3s.
  - A test for the intake's photo-only Continue.
- **Pages touched:** [[accessibility-audit-2026-10]], [[fieldwork]], [[index]].

## [2026-10-15] session | ADR 081: the accessibility audit's majors

- **Decided:**
  - The field border is `#878b94` in light mode, not the proposed `#8b8f98`, which was 3.0:1 on the page.
  - The chosen state is a doubled edge, not a check mark, because there is no room in the pills or the column cards.
  - The contrast check lives in `design:check`, not vitest: vitest stubs CSS, and the tsconfig has no Node types.
  - An error toast has no timer.
- **Completed:**
  - `--field-border` and `--shadow-chosen`.
  - `aria-pressed` and `aria-current` on seven controls, and the status tracks.
  - A global `.sr-only`.
  - `useModal`, now shared by `QueueLayer`, `JobMode` and `OnSite`.
  - Toast hold and Dismiss.
  - 616 tests (12 new), `tsc`, and the build pass.
  - Live: the field border measured in both themes, no console errors, and Escape on the queue returns focus to its trigger.
- **Deferred:**
  - The 17 minors.
  - Removing the unreachable `FindingReview` decision buttons.
  - The Offer undo.
  - Instant Book's $129.
  - The platform audit's P3s.
- **Pages touched:** [[accessibility-audit-2026-10]], [[fieldwork]], [[index]].

## [2026-10-14] ingest | Accessibility audit (WCAG 2.1 AA)

- **Ran:** `design:accessibility-review` on the entire site. It scanned 16 live screens in both themes and did a keyboard pass, a reflow at 320 px, a CSS token sweep and a TSX semantics sweep.
- **Found:**
  - 0 critical, 6 major and 17 minor.
  - The majors: field borders at 1.31–1.42:1, selection shown by hue only, status track and selection state not exposed, `JobMode` and `OnSite` dialogs with no Escape, trap or inert, and toasts that time out with no pause or dismiss.
  - Zero text-contrast failures, and no reflow failures.
- **Not tested:** a real screen reader.
- **Next:** ADR 081 for the majors, with the plan awaiting approval.
- **Pages touched:** [[accessibility-audit-2026-10]] (new), [[fieldwork]], [[index]].

## [2026-10-08] session | ADR 080: the platform audit's P2s

- **Decided:**
  - The Offer gets a "Sent:" record, not an Undo, because an offer notifies and holds.
  - A declined quote gets customer wording only, with no new status.
  - The Availability draft lives in `sessionStorage`, with the saved hours it was made from.
  - On a narrow screen, a chosen request scrolls to the top, instantly.
- **Completed:**
  - Toast tone, mounted status and alert regions, one cleared timer, and a clear on role switch.
  - The sidebar name and counts, "← All requests", focus on the chosen request, and More as current.
  - The queue's "Sent:" line, the glance's next job, the Accepted badge, photo removal with Undo, and the Availability draft.
  - The declined-quote wording, the Instant Book confirmation and focus, and the inline missing-task error.
- **Found:**
  - A quote payment's "Payment received" toast was being cleared straight after it was set.
  - Two test fixtures needed `reconcile`, or the reconciler reverted their hand-set state.
  - Live, the seeded draft offers only Request to Book, so the Instant Book confirmation was checked by its screen test alone.
- **Verified:** 604 tests (16 new, each failing without its fix). `tsc` and the build pass, and the CSS gained one rule. Live on `vite preview`: intake's inline error and focus, Availability's draft across pages, and no console errors.
- **Next:** the audit's P3s, and an undo for the operator's Offer.
- **Pages touched:** [[platform-ux-audit-2026-10]], [[fieldwork]], [[index]].

## [2026-10-08] session | ADR 079: the platform audit's P1s

- **Decided:** confirm declines and withdrawals, undo removals. There is no snapshot undo, because restoring one would retract notifications and holds already sent.
- **Completed:**
  - `DecisionQueue` moved onto `QueueLayer`, keeping "Decision N of M" and its own end screen.
  - `QueueLayer` falls back to `main h1` when the opener is gone. `useSwapFocus` (new, `src/useSwapFocus.ts`) moves focus through every button swap. Intake focuses each step's h1.
  - The customer's quote Decline asks why (`QUOTE_REASONS`), and the charge Decline confirms. Availability dry-runs `setAvailability` and asks before withdrawing. Reset confirms, and Remove finding has an inline Undo.
  - The role switch has `aria-pressed`, in a group labelled "Viewing as".
- **Found:** importing `useSwapFocus` from `QueueLayer` pulled the layer into the first load (+1.1 kB gzipped), so it is its own module (+0.3 kB). Prettier reformats unrelated lines in `Shell.tsx`, `Walkthroughs.tsx` and `workspace.test.tsx`, so those were edited by hand.
- **Verified:** 588 tests (10 new, each failing without its fix). `tsc` and the build pass, and the stylesheet is byte-identical. A keyboard pass on `vite preview` found no focus drop to `<body>` in the queues, Reset, the contractor's Decline, Availability or intake.
- **Next:** the audit's P2s, starting with the Declined quote's own status and the toasts.
- **Pages touched:** [[platform-ux-audit-2026-10]], [[fieldwork]], [[one-at-a-time]], [[index]].

## [2026-10-08] session | Platform UX audit (report only)

- **Completed:** a report-mode audit (`ux-engine:ux-auditor`) of every role and the shell, in four phases: Operator, Contractor, a Customer re-check, and cross-cutting. It was run live on `vite preview` with a contrast, name and target-size script, plus a code read. No source changed.
- **Found:**
  - 8 P1s, 15 P2s and 15 P3s. See [[platform-ux-audit-2026-10]].
  - The P1s are focus dropping to `<body>` (the `QueueLayer` fallback, the decline swap, intake steps, and `DecisionQueue`, which isn't on `QueueLayer` at all), one-tap destructive actions (quote and charge Decline, Reset all demo data, Remove finding, Availability's Save withdrawing offers), and the role switch with no `aria-pressed`.
  - A Declined quote reads "Quote ready" to the customer, because the reconciler maps every unapproved quote to "Awaiting Quote Approval".
- **Verified:** the 12 fixes from [[customer-ux-audit-2026-10]] all hold. Contrast passes AA in both themes on every screen checked.
- **Next:** fix the P1s as one ADR batch (079): focus fallback first, then friction on destructive actions, then the role switch.
- **Pages touched:** [[platform-ux-audit-2026-10]] (new), [[fieldwork]], [[index]].

## [2026-10-08] session | ADR 078: each role loads as its own chunk

- **Measured first** (JS and CSS, gzipped, following each chunk's static imports): the operator's first load went from 174.6 to 165.8 kB (−5%), the customer's to 152.3 kB (−13%) and the contractor's to 154.8 kB (−11%). The operator only just cleared the 5% go/no-go line, and the operator chose to go ahead.
- **Completed:**
  - The three role workspaces load through `lazyScreen()`, and the other two are preloaded when the browser is idle.
  - `lazyScreen()` gained `preload()`. React 19 suspends a lazy component on its first render even when its chunk is loaded, which flashed "Loading…" on a role switch. A screen that is already loaded now renders directly.
  - `Workspace.tsx` imports `onsite.css` and `work.css` first, so the stylesheet keeps its order.
  - `workspace.test.tsx` loads each role once in a `beforeAll`. No test changed.
- **Found:**
  - Grouping the five small shared chunks with `manualChunks` made the first load import the group and moved CSS into it. Dropped.
  - Leaving out `work.css` put it after the fonts in the stylesheet. Both sheets have to be imported first.
  - The warm-up timed out under the parallel suite at `waitFor`'s default 1 s. It now waits up to 20 s.
  - `workspace.test.tsx` is CRLF in the working copy (git converts it), though the repository stores it LF.
- **Verified:**
  - 578 tests, three full runs in a row. `tsc` and the build pass.
  - The stylesheet is byte-identical, with the same hash (`index-DPXnl4DP.css`).
  - Live on `vite preview`: each role's chunk loads first, the others follow when idle, role switches show no "Loading…", and the portal link loads the customer's chunk first. A missing chunk shows "This page didn't load", and Reload recovers.
- **PR:** #53 (`claude/role-chunks`), against `main`, not stacked. Auto-merge is off.
- **Next:** none for ADR 077. Bundle size is parked again.
- **Pages touched:** [[fieldwork]], [[index]].

## [2026-10-08] session | ADR 077: each role's helpers move into its own file

- **Completed:**
  - The helpers only one role reads moved verbatim out of `useWorkspaceState()`: 19 into `OperatorRequests.tsx`, 11 into `CustomerWorkspace.tsx`, and `RouteMap` into `OperatorWorkspace.tsx`. 1,032 lines moved, and a line-by-line check found every one of them unchanged.
  - The hook went from about 1,830 to 738 lines. `WorkspaceApi` lost 31 names and gained 22.
  - State stayed in the hook, because moving it would reset it whenever a role or page unmounts. Helpers that other hook code reads stayed too (`openContractorJob`, `candidates`, `scopeTasks`, `patchTask`, `chosenTime`).
- **Tooling:** the import pruner was rewritten line by line. It keeps comments, side-effect imports and `import type`. A new script, `helpers.py`, moves named declarations with the comments above them, and refuses to move one the hook still reads. The scratchpad's `operator.py` was shadowing Python's `operator` module, and it was renamed.
- **Verified:**
  - 578 tests, with no test changes. `tsc` and the build pass.
  - The CSS is byte-identical after each of the three moves. The JS index is 309.2 kB.
  - Live on `vite preview`: the route map, a request's decision card, the contractor offer with its candidates and routed times, History, and the customer's home and request card. No console errors.
- **PR:** #52 (`claude/role-helpers`), against `main`, not stacked. Auto-merge is off.
- **Next:** a lazy chunk per role.
- **Pages touched:** [[fieldwork]].

## [2026-10-08] session | ADR 077: Workspace's state moves into useWorkspaceState()

- **Completed:** the state, effects and helpers (about 1,740 lines) moved verbatim into `useWorkspaceState()` in `useWorkspaceState.tsx`. It returns the `api` and the 46 names the shell reads. `Workspace.tsx` went from about 2,530 to 850 lines.
- **Found:**
  - The import pruner turns `import type { X }` into `import type, { X }` (TS1192). It was fixed by hand. Fix the pruner before reusing it.
  - The hook took `suitableProviders`, `Workspace`'s first import. `ContractorWorkspace` is now first, with `useWorkspaceState` right after it, and the order comment was rewritten to match.
- **Verified:**
  - 578 tests, with no test changes. `tsc` and the build pass.
  - The CSS is byte-identical. The JS index is 309.3 kB (+1.3 kB).
  - Live on `vite preview`: Requests and a request's detail, the Decline modal, the theme toggle, all three roles, compare mode, the sidebar toggle and the decision queue. No console errors.
- **PR:** #51 (`claude/workspace-state`), against `main`, not stacked. Auto-merge is off.
- **Next:** move the role-specific helpers into the role files, then a lazy chunk per role.
- **Pages touched:** [[fieldwork]].

## [2026-10-08] session | ADR 077: Requests leaves Workspace

- **Completed:**
  - PRs #47 (`claude/workspace-split`) and #48 (`claude/operator-pages`, stacked) were opened. Neither has auto-merge on.
  - Five screen tests pin Requests: search and filter, the small-screen list, Offer to a contractor and back, Do it myself, and Decline's confirmation. They were committed before the move. jsdom needed a `scrollIntoView` stub.
  - `OperatorRequests.tsx` (about 960 lines) holds the page, and `OperatorWorkspace` renders it. `WorkspaceApi` gained 43 names. The long inline types use `ReturnType` of `suitableProviders` and `scopeMatch`.
  - `Workspace.tsx` went from 3,368 to about 2,530 lines, and renders no role's pages inline.
- **Found:**
  - The pruner dropped the import-order comment again, as expected, and it was restored.
  - `workspace.test.tsx` is LF, not CRLF like the rest of `src`. Keep it LF, and don't run Prettier on the whole file: it reformats the existing tests.
- **Verified:**
  - 578 tests, with the existing tests unchanged.
  - `tsc` and the build pass. The CSS is byte-identical. The JS index is 308.0 kB (+1.3 kB).
  - Live on `vite preview`: every Requests path and a round trip through the roles, with no new console errors.
- **Next:** `useWorkspaceState()`, then a lazy chunk per role.
- **Pages touched:** [[fieldwork]].

## [2026-10-08] session | ADR 077: the small operator pages leave Workspace

- **Completed:**
  - Three screen tests pin the operator's Contractors, Activity and Demo settings. They were committed before the move.
  - `OperatorWorkspace.tsx` now holds Home, More, Walkthroughs, Today, Contractors and Activity, switching on `page`. The lazy `Walkthroughs` moved with them.
  - `WorkspaceApi` gained `choose`, `setSidebar` and `RouteMap`.
- **Found:** the import pruner rebuilds the import header and drops any comment inside it. The comment explaining the `ContractorWorkspace` import order was lost and has been put back. Check for this on the next extraction.
- **Verified:**
  - 573 tests, and the existing tests are unchanged.
  - `tsc` and the build pass. The CSS is byte-identical.
  - A live check on `vite preview` covered all six pages, Demo settings and role switching, with no console errors.
- **Next:** Requests (861 lines, 59 names, about 45 of them new to `WorkspaceApi`), as `OperatorRequests.tsx`.
- **Pages touched:** [[fieldwork]].

## [2026-10-08] session | ADR 077: breaking up Workspace, customer and contractor first

- **Completed:**
  - `Workspace` and `App` moved verbatim from `main.tsx` into `Workspace.tsx`.
  - jsdom and Testing Library were added as dev dependencies. `workspace.test.tsx` adds 15 screen tests covering all three roles.
  - `CustomerWorkspace.tsx` (410 lines) and `ContractorWorkspace.tsx` (44 lines) were extracted. They read from `useWorkspace()`, and the `WorkspaceApi` types were generated with the TypeScript compiler.
  - The shared helpers moved to `RequestFields.tsx` to avoid an import cycle.
- **Found:** removing an import from `Workspace` reordered the CSS (`work.css` ended up ahead of `onsite.css`). Fixed by importing `ContractorWorkspace` where `ContractorWork` was. The stylesheet is byte-identical again.
- **Verified:**
  - 570 tests, with no test changes. `tsc` and the build pass.
  - A live check on `vite preview` covered the contractor's Viewing as, Earnings and Availability, and the customer's view-as, New request and Continue request.
- **Plan change:** the plan assumed the contractor block was about 380 lines. It was 44, so the operator chose to extract Customer as well.
- **Pages touched:** [[fieldwork]], [[index]].

## [2026-10-08] session | ADR 076: catalogue and CSS stay in the first load

- **Measured:**
  - The intake catalogue is 76 kB raw and 9.5 kB gzipped. It is about 6% of the first load, and it is read synchronously by `getIssue()` everywhere.
  - The app CSS is 105 kB raw and 27.5 kB gzipped, and it is shared. The per-role sheets are about 3 kB gzipped in total.
- **Decision:** no-go on both (ADR 076). Bundle-size work is parked.
- **Note:** PR #45 merged before ADR 075 was pushed to its branch. ADR 075 and ADR 076 need a new PR.
- **Pages touched:** [[fieldwork]], [[index]].

## [2026-10-08] session | ADR 075: the role-workspace split, measured and declined

- **Completed:**
  - `JobWork` and `Sheet` moved from `ContractorWork.tsx` into `JobWork.tsx`, so `OperatorWork` no longer imports the contractor's module.
  - Measured what splitting the role workspaces would save each role's first load: operator −16 kB gzipped, contractor −18 kB gzipped, customer −25 kB gzipped.
- **Decision:** no-go on the full split (ADR 075). The operator chose the recommended option, because moving about 1,900 shared-state lines wasn't worth an 11–17% first-paint gain.
- **Verified:** 555 tests, `tsc` and a clean build.
- **Deferred:** splitting the role workspaces (revisit when `Workspace` is broken up for testability), and the 60 kB intake catalogue.
- **Pages touched:** [[fieldwork]], [[index]].

## [2026-10-07] session | ADR 074: splitting the bundle

- **Completed:**
  - Blueprint, Assessment, Walkthroughs and CustomerIntake load on demand via `lazyScreen()`.
  - React goes in a vendor chunk.
  - A chunk that fails to load shows a reload card instead of the destructive reset screen.
- **Result:** the app script went from 602 kB to 305 kB (174 to 84 kB gzipped). A first load is 499 kB (145 kB gzipped), with no build warning.
- **Verified:**
  - 555 tests and a clean build.
  - On `vite preview`, each route fetches its own chunk only when opened.
  - With the Walkthroughs chunk hidden, the page shows the reload card, and Reload recovers once the file is back.
- **Deferred:** splitting the role workspaces out of `App`, and per-screen CSS.
- **Pages touched:** [[fieldwork]], [[index]].

## [2026-10-07] session | Customer audit close-out, operator scheduler, wiki created

- **Completed:**
  - ADR 069 (P0/P1) and ADR 070 (P2), merged in PR #43.
  - ADR 071: a request's own hold no longer hides its own time from the operator.
  - ADR 072: the customer's chosen time comes first in the operator's scheduler and the decision queue.
  - ADR 073 (P3): the avatar names the account, `homeOf` gives each role one home label, `aria-current` on the sidebar, and text buttons of at least 44 px.
  - The provider card says "Customer’s choice" when that time leads the list.
- **PR:** #44 (ADR 071–073 and the card wording) is open.
- **Verified:**
  - 555 tests and a clean build.
  - Live checks on `vite preview` with injected state: holds, the chosen time, avatars SL/DB/NP, the "My bookings" crumb including the direct portal link, and text buttons measured at 375 px.
- **Decisions:** [[2026-10-07-wiki-in-repo]].
- **Deferred:**
  - Decline wasn't seen live (there's no quote in the seed data).
  - The untracked `.claude/launch.json`.
  - The bundle-size warning.
- **Pages touched:** all pages created: [[fieldwork]], [[one-at-a-time]], [[customer-chosen-time]], [[customer-ux-audit-2026-10]], [[2026-10-07-wiki-in-repo]], [[index]], [[SCHEMA]].
