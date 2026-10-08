---
title: "Wiki Log"
type: log
---

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
