---
title: "Fieldwork"
type: entity
created: 2026-10-07
updated: 2026-10-08
tags: [project, prototype, react]
sources: 1
---

# Fieldwork

An interactive prototype of a handyman services platform. It has three roles, Customer, Operator and Contractor, and covers intake, scheduling, dispatch, quotes, payment and the visit itself. Everything is simulated, and data lives in each browser. It is deployed at [j.ogden.ag](https://j.ogden.ag) from `main`.

## Key Facts
- **Stack:** React 19, Vite, TypeScript, vitest, lucide-react. There is no backend. State is kept in localStorage under `fieldwork-demo-v1`.
- **Gates:**
  - `npm test` runs the catalogue and status checks, then vitest: 578 tests as of 2026-10-08, 23 of them screen tests in jsdom (`workspace.test.tsx`).
  - `npm run build` runs `design:check`, `catalogue:check`, `status:check`, `tsc` and then `vite build`.
- **Deploy:** merging to `main` runs GitHub Actions, which publishes to Pages at j.ogden.ag. The repository is public.
- **Decisions:** ADR 001–077 are in `docs/design-decisions.md`. Business calls are in `docs/decisions.md`.
- **Line endings:** most files are CRLF. Scripted edits must keep CRLF. Prettier rewrites to LF, so restore CRLF after running it.

## Architecture / Structure
- `src/main.tsx` is only the entry: CSS, `pickView()` and `createRoot`.
- `src/Workspace.tsx` holds `Workspace` and `App`. `Workspace` is the shell: the chrome, the modals and the toasts, about 850 lines. ADR 077 broke it up one role at a time.
- `src/useWorkspaceState.tsx` holds `useWorkspaceState()`, the workspace's state, effects and the helpers more than one place reads (about 740 lines). It returns the context `api` and the names the shell reads. Helpers only one role reads live in that role's file.
- `src/CustomerWorkspace.tsx`, `src/ContractorWorkspace.tsx` and `src/OperatorWorkspace.tsx` are the extracted role workspaces. `OperatorWorkspace` switches on `page`, and renders `src/OperatorRequests.tsx` (about 1,690 lines, with its helpers) for Requests. They read from `useWorkspace()` (`src/workspaceContext.ts`), whose `WorkspaceApi` type lists only what extracted components read.
- `src/RequestFields.tsx` holds `NoteReply`, `TaskAnswers` and `ClarificationFields`, which several workspaces share.
- The CSS order follows the import order. After any extraction, check that the built stylesheet is byte-identical (ADR 077).
- `src/Shell.tsx` is the shared chrome: the sidebar, demo bar, topbar, `identity()` and `homeOf()`.
- `src/model.ts` handles classification, scheduling (`slots`, `available`, holds, `chosenStart`), accounts and lifecycle.
- `src/decisions.ts` builds the operator's decision queue (`nextDecision`) and offers.
- `src/dispatch.ts` handles declines and reoffers. `src/payments.ts` handles payments.
- `src/JobWork.tsx` is the job checklist, photos, outcomes and finish sheet, plus `Sheet`. Operator and contractor both use it (ADR 075).
- The queues are `CustomerQueue.tsx`, `ContractorQueue.tsx` and `DecisionQueue.tsx`, built on `QueueLayer.tsx`. See [[one-at-a-time]].
- `src/customerText.ts` is the one place that writes customer-facing status wording.

## Current Status
- The customer UX audit of 2026-10 is fully resolved. See [[customer-ux-audit-2026-10]].
- PR #44 (ADR 071–073) merged on 2026-10-08.
- PR #45 (wiki and ADR 074) merged on 2026-10-08.
- PR #46 (ADR 075 and ADR 076) merged on 2026-10-08.
- ADR 077 (breaking up `Workspace`): every role's pages are out, live on `main` via PR #47 (2026-10-08) and PR #50 (2026-10-08). #48 and #49 merged into their stacked bases rather than `main`, and #50 carried them over. Next time, open each branch against `main` instead of stacking.
- ADR 077 step 6 (`useWorkspaceState()`) is live on `main` via PR #51 (2026-10-08).
- ADR 077 step 7 (each role's helpers into its own file) is on `claude/role-helpers`, not yet pushed.
- Local dev uses Vite on 5173 and the preview build on 4173 (`.claude/launch.json`, untracked).

## Connections
- [[one-at-a-time]]: the interaction pattern behind every queue.
- [[customer-chosen-time]]: how holds and the customer's chosen slot reach the operator.
- [[customer-ux-audit-2026-10]]: the most recent audit, and where each finding went.
- [[2026-10-07-wiki-in-repo]]: why this wiki is here.

## Open Questions
- Splitting the role workspaces would save each role's first load 11–17% gzipped (ADR 075). That is now under way (ADR 077). Every role's pages and helpers are out of `Workspace` and the hook, which keeps only the shared state. Next comes a lazy chunk per role.
- Bundle-size work is parked (ADR 074–076). The catalogue and the per-role CSS were measured at 6% and 2% of the first load (ADR 076).

## History
- 2026-10-08: each role's helpers moved verbatim out of `useWorkspaceState()` into its own file (ADR 077, step 7): 19 into `OperatorRequests.tsx`, 11 into `CustomerWorkspace.tsx`, and `RouteMap` into `OperatorWorkspace.tsx`. The hook went from about 1,830 to 740 lines. 578 tests pass unchanged, and the stylesheet is byte-identical.
- 2026-10-08: `Workspace`'s state, effects and helpers moved verbatim into `useWorkspaceState()` (ADR 077, step 6). `Workspace` went from about 2,530 to 850 lines. 578 tests pass unchanged, and the stylesheet is byte-identical.
- 2026-10-08: the operator's Requests page moved into `OperatorRequests.tsx` (ADR 077). `WorkspaceApi` gained 43 names, and five screen tests were added first. 578 tests pass, and the stylesheet is byte-identical.
- 2026-10-08: the operator's Home, More, Walkthroughs, Today, Contractors and Activity pages moved into `OperatorWorkspace.tsx` (ADR 077). Three screen tests were added first. 573 tests pass, and the stylesheet is byte-identical.
- 2026-10-08: ADR 077 started breaking up `Workspace`:
  - It moved out of `main.tsx`.
  - 15 jsdom screen tests now pin each role.
  - The customer and contractor workspaces moved into their own files behind `WorkspaceContext`, with no test changes and a byte-identical stylesheet.
- 2026-10-08: ADR 076 measured loading the intake catalogue on demand and splitting the CSS per screen, and decided no-go on both. The catalogue is how every request is classified, and the stylesheet is shared.
- 2026-10-08: ADR 075 measured a role-workspace split and decided no-go. `JobWork` was extracted from `ContractorWork`.
- 2026-10-07: ADR 074 split the bundle:
  - Blueprint, Assessment, Walkthroughs and New request load on demand via `lazyScreen()` in `Recovery.tsx`.
  - React goes in a `vendor` chunk.
  - A screen that fails to load offers a reload, not a reset.
  - The app script went from 602 kB to 305 kB, and the build no longer warns.
- 2026-10-07:
  - ADR 071: a request's own hold no longer hides its own time from the operator.
  - ADR 072: the customer's chosen time comes first.
  - ADR 073: avatar, breadcrumb and 44 px targets.
  - The provider card says "Customer’s choice" when that time leads the list.
  - Wiki created.
- 2026-10-07: ADR 069 and ADR 070 merged (PR #43). These are the audit's P0–P2 fixes.
- 2026-09-09: first published.
