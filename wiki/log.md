---
title: "Wiki Log"
type: log
---

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
