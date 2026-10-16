---
title: "Fieldwork"
type: entity
created: 2026-10-07
updated: 2026-10-15
tags: [project, prototype, react]
sources: 1
---

# Fieldwork

An interactive prototype of a handyman services platform. It has three roles, Customer, Operator and Contractor, and covers intake, scheduling, dispatch, quotes, payment and the visit itself. Everything is simulated, and data lives in each browser. It is deployed at [j.ogden.ag](https://j.ogden.ag) from `main`.

## Key Facts
- **Stack:** React 19, Vite, TypeScript, vitest, lucide-react. There is no backend. State is kept in localStorage under `fieldwork-demo-v1`.
- **Gates:**
  - `npm test` runs the catalogue and status checks, then vitest: 604 tests as of 2026-10-08, 48 of them screen tests in jsdom (`workspace.test.tsx`).
  - `npm run build` runs `design:check`, `catalogue:check`, `status:check`, `tsc` and then `vite build`.
- **Deploy:** merging to `main` runs GitHub Actions, which publishes to Pages at j.ogden.ag. The repository is public.
- **Decisions:** ADR 001–087 are in `docs/design-decisions.md`. Business calls are in `docs/decisions.md`.
- **Line endings:** most files are CRLF. Scripted edits must keep CRLF. Prettier rewrites to LF, so restore CRLF after running it.

## Architecture / Structure
- `src/main.tsx` is only the entry: CSS, `pickView()` and `createRoot`.
- `src/Workspace.tsx` holds `Workspace` and `App`. `Workspace` is the shell: the chrome, the modals and the toasts, about 850 lines. ADR 077 broke it up one role at a time.
- `src/useWorkspaceState.tsx` holds `useWorkspaceState()`, the workspace's state, effects and the helpers more than one place reads (about 740 lines). It returns the context `api` and the names the shell reads. Helpers only one role reads live in that role's file.
- `src/CustomerWorkspace.tsx`, `src/ContractorWorkspace.tsx` and `src/OperatorWorkspace.tsx` are the extracted role workspaces. `OperatorWorkspace` switches on `page`, and renders `src/OperatorRequests.tsx` (about 1,690 lines, with its helpers) for Requests. They read from `useWorkspace()` (`src/workspaceContext.ts`), whose `WorkspaceApi` type lists only what extracted components read. Each role loads as its own chunk through `lazyScreen()`, and the other two are preloaded when the browser is idle (ADR 078).
- `src/RequestFields.tsx` holds `NoteReply`, `TaskAnswers` and `ClarificationFields`, which several workspaces share.
- The CSS order follows the import order. After any extraction, check that the built stylesheet is byte-identical (ADR 077). `Workspace.tsx` imports `onsite.css` and `work.css` first, so the lazy roles don't take them out of the first load (ADR 078).
- `src/Shell.tsx` is the shared chrome: the sidebar, demo bar, topbar, `identity()` and `homeOf()`.
- `src/model.ts` handles classification, scheduling (`slots`, `available`, holds, `chosenStart`), accounts and lifecycle.
- `src/decisions.ts` builds the operator's decision queue (`nextDecision`) and offers.
- `src/dispatch.ts` handles declines and reoffers. `src/payments.ts` handles payments.
- `src/JobWork.tsx` is the job checklist, photos, outcomes and finish sheet, plus `Sheet`. Operator and contractor both use it (ADR 075).
- The queues are `CustomerQueue.tsx`, `ContractorQueue.tsx` and `DecisionQueue.tsx`, all built on `QueueLayer.tsx` (the operator's since ADR 079). `src/useSwapFocus.ts` moves focus through a swap of buttons, such as Decline opening its reasons, or a confirmation. It is its own module so the shell doesn't load `QueueLayer`. See [[one-at-a-time]].
- `src/customerText.ts` is the one place that writes customer-facing status wording.

## Current Status
- The customer UX audit of 2026-10 is fully resolved. See [[customer-ux-audit-2026-10]].
- PR #44 (ADR 071–073) merged on 2026-10-08.
- PR #45 (wiki and ADR 074) merged on 2026-10-08.
- PR #46 (ADR 075 and ADR 076) merged on 2026-10-08.
- ADR 077 (breaking up `Workspace`): every role's pages are out, live on `main` via PR #47 (2026-10-08) and PR #50 (2026-10-08). #48 and #49 merged into their stacked bases rather than `main`, and #50 carried them over. Next time, open each branch against `main` instead of stacking.
- ADR 077 step 6 (`useWorkspaceState()`) is live on `main` via PR #51 (2026-10-08).
- ADR 077 step 7 (each role's helpers into its own file) is live on `main` via PR #52 (2026-10-08).
- ADR 078 (a chunk per role) is live on `main` via PR #53 (2026-10-08).
- A platform-wide UX audit ran on 2026-10-08, after ADR 078: 8 P1s, 15 P2s and 15 P3s across the three roles and the shell, The P1s are fixed in ADR 079, and the P2s in ADR 080 (PR #56, merged). The P3s are open. See [[platform-ux-audit-2026-10]].
- A WCAG 2.1 AA audit ran on 2026-10-14, after ADR 080: 0 critical, 6 major and 17 minor. The majors are fixed in ADR 081 (PR #57, merged) and the minors in ADR 082. See [[accessibility-audit-2026-10]].
- ADR 085 (the Contractors page in the operational register) is live on `main` via PR #62 (2026-10-16). It is the first register audit. The other screens have not had one.
- ADR 087 (the customer intake in the register) is on branch `claude/intake-register`, with its PR open and not merged. It is the second register audit, and the first on a customer surface.
- Local dev uses Vite on 5173 and the preview build on 4173 (`.claude/launch.json`, untracked).

## Connections
- [[one-at-a-time]]: the interaction pattern behind every queue.
- [[customer-chosen-time]]: how holds and the customer's chosen slot reach the operator.
- [[customer-ux-audit-2026-10]]: the customer audit, and where each finding went.
- [[platform-ux-audit-2026-10]]: the platform UX audit, covering every role. Closed: P1s and P2s in ADR 079–080, P3s and the Offer's Undo in ADR 083.
- [[accessibility-audit-2026-10]]: the most recent audit, WCAG 2.1 AA across every role and both themes.
- [[2026-10-07-wiki-in-repo]]: why this wiki is here.

## Open Questions
- The accessibility audit is closed: its 6 majors are fixed in ADR 081, and its 17 minors in ADR 082.
- The platform UX audit is closed (ADR 083). An Offer can be withdrawn until the contractor answers, as an assignment status `Withdrawn`; the unreachable `FindingReview` buttons are gone.
- Instant Book's prices live in `INSTANT_PRICES` (`model.ts`), one per catalogue job, keyed by category. A job with no entry is never offered Instant Book (ADR 084).
- ADR 077 is complete, and each role is its own chunk (ADR 078). The operator, the default, saves only 5% of its first load, because most of the role code is the operator's. Splitting `OperatorRequests` off from the operator's home is the next size candidate, if first load ever matters.
- Bundle-size work is parked (ADR 074–076). The catalogue and the per-role CSS were measured at 6% and 2% of the first load (ADR 076).

## History
- 2026-10-16: ADR 087, the second register audit, on the customer intake. Instant Book shows real times first, the times read best fit first and then in time order (grouped by day in "See more times"), and customer surfaces no longer show review or booking-mode badges. "Recommended" and the visit length are said once. The gradient map is a one-line address confirmation. Time pills are 44px. There are 658 tests.
- 2026-10-16: ADR 086. The seeded offer v5 starts at 10:00 Toronto time on the first weekday at least three days out, on a machine in any timezone. It used to use machine-local `setHours(10)` and could fall on a weekend. There are 658 tests.
- 2026-10-16: ADR 085, the first register audit. The operator's Contractors page is now operational: the h1 is "Contractors" with a factual line under it, and the page is one roster table that lines up rate, hours, next day off and restricted work. It stacks into labelled lines below 47rem of workspace. The eyebrow, the slogan and the per-card badges are gone, and the credentials caveat is said once. `DESIGN.md` declares every role's workspace operational. There are 657 tests. Four in `concurrency.test.ts` fail on `main` too, because they depend on the machine's timezone.
- 2026-10-15: a screen test pins the intake's photo-only Continue (ADR 082's inline error and focus). There are 656 tests.
- 2026-10-15: ADR 084. The greeting is a pure `greetingFor(clock)`, so the suite passes at any hour. Instant Book's $129 moved into an `INSTANT_PRICES` table keyed by catalogue category, which every price display and record reads. `instantEligible` requires a priced category. There are 655 tests, all passing.
- 2026-10-15: ADR 083. The operator can withdraw an Offer until it is answered: Undo on the queue's "Sent" line and "Withdraw offer" on the request page. An unread offer (and its "Visit proposed") is taken back silently; a read one gets "Offer withdrawn"; an accepted one refuses. `reoffer` keeps the earlier provider and time as `previous`, so a withdrawn replacement puts the visit back. The platform audit's P3s are fixed with a shared `plural()`, one-tap decline reasons on the Work page, Activity entries that open their request, named Remove buttons, and "Your provider" until acceptance. `FindingReview` loses its unreachable buttons. There are 648 tests.
- 2026-10-15: ADR 082 fixes the accessibility audit's 17 minors. Headings no longer skip, prices aren't headings, there is a skip link and a labelled nav, and errors describe their fields instead of being part of their names. Every lucide icon is `aria-hidden`, checked by `design:check` along with the intake's done check. There are 629 tests.
- 2026-10-15: ADR 081 fixes the accessibility audit's 6 majors. It adds a `--field-border` token (checked at 3:1 by `design:check`), a doubled edge for whatever is chosen, `aria-pressed` and `aria-current` with an ", done" for screen readers, and `useModal`, shared by the queues, `JobMode` and `OnSite`. Toasts hold on hover or focus and can be dismissed, and an error stays until dismissed. There are 616 tests.
- 2026-10-14: a WCAG 2.1 AA audit of the whole platform (no source changes). Text contrast passes on 16 screens in both themes, and nothing overflows at 320 px. Field borders (1.3:1), colour-only selection, unexposed selected or current state, `JobMode`/`OnSite` dialogs with no trap, and timed toasts are the majors. See [[accessibility-audit-2026-10]].
- 2026-10-08: the platform audit's P2s fixed (ADR 080). Toasts have an error tone in an always-mounted alert region and one cleared timer, and clear on a switch of who is viewed. A declined quote reads "Quote declined · we’re revising it" to the customer. The contractor's glance, Accepted badge, photo removal (with Undo) and Availability draft (`sessionStorage`) are fixed. The operator's counts agree, "← All requests" goes back to the list, a chosen request takes focus, More is current under it, and the queue says "Sent: Offer to …". Instant Book confirms and focuses the booking, and intake's missing task is said inline. 16 tests were added (604), with one new CSS rule.
- 2026-10-08: the platform audit's 8 P1s fixed (ADR 079). `DecisionQueue` moved onto `QueueLayer`. Focus falls back to `main h1`, follows every button swap (`useSwapFocus`), and goes to each intake step's h1. Quote and charge Decline, Availability's withdrawals and Reset confirm, and Remove finding has an inline Undo. The role switch has `aria-pressed`. 10 screen tests were added (588 tests), the stylesheet is byte-identical, and the first load grew 0.3 kB gzipped.
- 2026-10-08: a report-mode UX audit of the whole platform (no source changes). The customer fixes from ADR 069, 070 and 073 all hold. See [[platform-ux-audit-2026-10]].
- 2026-10-08: each role loads as its own chunk (ADR 078). First loads went down 5% (operator), 13% (customer) and 11% (contractor), gzipped. The other roles are preloaded when idle, and the stylesheet is byte-identical. ADR 077 is complete.
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
