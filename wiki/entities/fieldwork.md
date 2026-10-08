---
title: "Fieldwork"
type: entity
created: 2026-10-07
updated: 2026-10-07
tags: [project, prototype, react]
sources: 1
---

# Fieldwork

An interactive prototype of a handyman services platform. It has three roles, Customer, Operator and Contractor, and covers intake, scheduling, dispatch, quotes, payment and the visit itself. Everything is simulated, and data lives in each browser. It is deployed at [j.ogden.ag](https://j.ogden.ag) from `main`.

## Key Facts
- **Stack:** React 19, Vite, TypeScript, vitest, lucide-react. There is no backend. State is kept in localStorage under `fieldwork-demo-v1`.
- **Gates:**
  - `npm test` runs the catalogue and status checks, then vitest (555 tests as of 2026-10-07).
  - `npm run build` runs `design:check`, `catalogue:check`, `status:check`, `tsc` and then `vite build`.
- **Deploy:** merging to `main` runs GitHub Actions, which publishes to Pages at j.ogden.ag. The repository is public.
- **Decisions:** ADR 001–073 are in `docs/design-decisions.md`. Business calls are in `docs/decisions.md`.
- **Line endings:** most files are CRLF. Scripted edits must keep CRLF. Prettier rewrites to LF, so restore CRLF after running it.

## Architecture / Structure
- `src/main.tsx` holds the role workspaces. It is the largest file.
- `src/Shell.tsx` is the shared chrome: the sidebar, demo bar, topbar, `identity()` and `homeOf()`.
- `src/model.ts` handles classification, scheduling (`slots`, `available`, holds, `chosenStart`), accounts and lifecycle.
- `src/decisions.ts` builds the operator's decision queue (`nextDecision`) and offers.
- `src/dispatch.ts` handles declines and reoffers. `src/payments.ts` handles payments.
- The queues are `CustomerQueue.tsx`, `ContractorQueue.tsx` and `DecisionQueue.tsx`, built on `QueueLayer.tsx`. See [[one-at-a-time]].
- `src/customerText.ts` is the one place that writes customer-facing status wording.

## Current Status
- The customer UX audit of 2026-10 is fully resolved. See [[customer-ux-audit-2026-10]].
- PR #44 (ADR 071–073 and the provider-card wording) is open as of 2026-10-07 and awaits merge.
- Local dev uses Vite on 5173 and the preview build on 4173 (`.claude/launch.json`, untracked).

## Connections
- [[one-at-a-time]]: the interaction pattern behind every queue.
- [[customer-chosen-time]]: how holds and the customer's chosen slot reach the operator.
- [[customer-ux-audit-2026-10]]: the most recent audit, and where each finding went.
- [[2026-10-07-wiki-in-repo]]: why this wiki is here.

## Open Questions
- The bundle is larger than 500 kB after minification. Vite warns about it, and nothing has been done yet.

## History
- 2026-10-07:
  - ADR 071: a request's own hold no longer hides its own time from the operator.
  - ADR 072: the customer's chosen time comes first.
  - ADR 073: avatar, breadcrumb and 44 px targets.
  - The provider card says "Customer’s choice" when that time leads the list.
  - Wiki created.
- 2026-10-07: ADR 069 and ADR 070 merged (PR #43). These are the audit's P0–P2 fixes.
- 2026-09-09: first published.
