---
title: "Fieldwork"
type: entity
created: 2026-10-07
updated: 2026-10-16
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
- ADR 087 (the customer intake in the register) is live on `main` via PR #65 (2026-10-16). It is the second register audit, and the first on a customer surface.
- ADR 088 (the customer workspace home in the register) is live on `main` via PR #66 (2026-10-16). It is the third register audit.
- ADR 089 (the contractor workspace in the register) is live on `main` via PR #67 (2026-10-16), merged as `597edd3`. It is the fourth register audit, and the first on the contractor.
- ADR 090 (the operator's request list in the register) is live on `main` via PR #68 (2026-10-16), merged as `1fd0181`. It is the fifth register audit.
- ADR 091 (the operator's request detail in the register) is live on `main` via PR #69 (2026-10-16), merged as `0a2cda3`. It is the sixth register audit.
- ADR 092 (the operator's Home and Today in the register) is live on `main` via PR #70 (2026-10-16), merged as `1042549`. It is the seventh register audit.
- ADR 093 (the operator's Walkthroughs and the decision queue in the register) is live on `main` via PR #71 (2026-10-16), merged as `29765cd`. It is the eighth register audit, and with it every operator screen has had one.
- ADR 094 (the customer's and contractor's queues say what is still waiting) is live on `main` via PR #72 (2026-10-16), merged as `82cf204`.
- ADR 095 (a link that no longer works is not offered) is live on `main` via PR #73 (2026-10-16), merged as `7bf92bb`.
- ADR 096 (an assessment waits on the customer only while its link works) is live on `main` via PR #74 (2026-10-16), merged as `7712366`.
- ADR 097 (a dead link is the operator's move, not the customer's) is live on `main` via PR #75 (2026-10-16), merged as `e4ecafa`.
- ADR 098 (the customer can ask for a fresh link) is live on `main` via PR #76 (2026-10-16), merged as `fdabe92`.
- ADR 099 (the ask reaches the operator; no link is the operator's move) is live on `main` via PR #77 (2026-10-17), merged as `26909f7`, and verified on j.ogden.ag.
- The ready-to-convert seed (PMW-0004) is live on `main` via PR #79 (2026-10-17), merged as `1a60f52`, and verified on j.ogden.ag.
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
- 2026-10-17: The demo seeds a fourth walkthrough, PMW-0004 on Amir Hassan's 90 Rebecca Street: sent, two findings approved through `decide()`, one undecided. Walkthroughs opens with "Ready to convert 1" and a working "Convert 2 approved", which before took a whole approval by hand to reach. The proposed text is worded so conversion lands on Handrail/Railing and Faucet or fixture replacement, not restricted review. No ADR; seed content only. Returning visitors see it after "Reset all demo data". There are 695 tests.
- 2026-10-16: ADR 099, amending ADR 097 and ADR 098. A customer's ask sends the operator one documentary `fresh-link` notice that opens the walkthrough's card (`walkthroughId` on the notice, `noticeTarget` "walkthrough", one-shot `openWalkthrough`). The guest page for a dead link, and the record on a live guest page, can ask too, via `walkthroughByToken`; logged as "Link holder". A Sent walkthrough with no link reads "No link yet", counts as the operator's move, and offers "Issue a link" with no empty Copy or Open. There are 694 tests.
- 2026-10-16: ADR 098, amending ADR 096 and ADR 097. The customer's maintenance record offers "Ask for a fresh link" while a sent assessment's link is dead; the ask is held as `access.freshLinkRequestedAt`, so a fresh link clears it. `requestFreshLink` checks the rule in the model. `freshLinkIds` puts asked-about walkthroughs first, and the operator's lead, row and card read "Fresh link requested" with "Sarah Lin asked for a fresh link today." No notification. There are 688 tests.
- 2026-10-16: ADR 097, amending ADR 053. `walkthroughGlance` moves a Sent walkthrough whose link was withdrawn or has expired out of With customer into a new `freshLinkIds` bucket, and the chase skips it; Ready to convert still wins. The Walkthroughs glance leads with the oldest such walkthrough ("Link withdrawn" / "Link expired", "The customer can’t open it until you issue a fresh link.") and its row carries the same badge. Still three counts. There are 684 tests.
- 2026-10-16: ADR 096, amending ADR 062. `customerGlance` keeps a Sent assessment only while `linkState` is live at the glance's clock, so the customer's "Waiting on you" count, the review button and the queue drop a withdrawn or expired one together, and an open queue skips it. The customer's record reads "Link withdrawn" or "Link expired" with no "Open assessment" link. `linkState` takes an optional clock. There are 679 tests.
- 2026-10-16: ADR 095. While the customer's link is withdrawn or expired, the Sent walkthrough card hides "Copy link" and "Open as the customer"; with nothing approved its h2 is "Link withdrawn" or "Link expired" and "Issue a fresh link" is the primary, handing focus to "Copy link" once issued. The operator's property record shows the link's state as plain text instead of a dead "Open assessment" link. There are 675 tests.
- 2026-10-16: ADR 094. The shared `AllCaughtUp` takes the number still waiting from its caller, so the customer's and contractor's queues, skipped through, end on "End of the queue" with "2 still waiting on you, on Home." or "2 offers still waiting, under Offers." "All caught up" and its tick show only when nothing is left, and say where anything new will show. There are 670 tests.
- 2026-10-16: ADR 093, the eighth register audit, on the operator's Walkthroughs and the decision queue. After skips the queue ends on "End of the queue" with how many still need a decision; "All caught up" shows only when none are left. Opening a walkthrough focuses its h1, and coming back focuses its row. "Withdraw this link", and "Issue a fresh link" while the link still works, ask first with Keep it focused. The page is "Walkthroughs" with no label or slogan; groups are captioned Draft, Sent and Converted, and rows carry only "Ready to convert". That count is no longer red, accent marks only the operator's move, and a draft's findings carry no state. The Sent card's notes are plain text and the developer note is gone. Queue buttons that leave it all say "Open request"; the quote's in-place one says "Change price". There are 667 tests.
- 2026-10-16: ADR 092, the seventh register audit, on the operator's Home and Today. Today's h1 names the day it shows ("Today" only on today, otherwise "Monday, October 19"), and "Next scheduled day" hands focus to it. Home's h1 is "Home": ADR 084's greeting and `greetingFor` are retired. The decisions count is "Needs action", not red, and only "All of today" goes to Today. Home cards and Today badges keep accent for the operator's own move; the timeline's line, dots and totals are neutral. The buffer is said once, both totals count every listed visit, and the switch and totals hide on an empty day. `RouteMap` draws one pin per visit and a route only for one provider; `.map-label` and `.map-expand` are gone. "View progress" shows only once a visit is confirmed, and its panel takes focus and returns it. There are 661 tests.
- 2026-10-16: ADR 091, the sixth register audit, on the operator's request detail and fulfilment. Remove visit, Withdraw offer and Cancel question each ask first in a dialog, since their toasts have no undo. The detail's status chip follows ADR 090 (accent only in Needs Action); the booking mode is plain text, and visit and offer chips are neutral. Facts leave the accent tint. The Maps link, the Tasks heading, task names, the slot line and the minutes are said once, and a tab shows a count only above 0. A rejected override time is an inline field error. Eyebrows, the fulfilment headings ("Offer to a contractor", "Do it myself") and buttons are sentence case. There are 664 tests.
- 2026-10-16: ADR 090, the fifth register audit, on the operator's request list. The h1 is "Requests", with one factual line ("4 of 7 requests") in place of the eyebrow, slogan and accent count. Accent marks only the rows in Needs Action; other statuses sit on a neutral `.badge.quiet` chip. "Needs Review" is not red: `Review` is out of the shared `badgeTone` red pattern, so the customer's "In review" is not red either. "All requests" sorts by bucket (`BUCKET_ORDER`). An empty search or filter says "No requests match." and offers "Show all requests". The detail's "← All requests" header is gone. The search has an `aria-label`, and filter options are sentence case. There are 662 tests.
- 2026-10-16: ADR 089, the fourth register audit, on the contractor workspace. Accept is amber everywhere, as the one primary: the green `.contractor-accept` rules are gone, Review steps aside while an offer is open, View job is secondary, and New offers is not red. Pay sits on `--surface-raised` and is worded once by `payLabel`. The h1 is "Your work", with no slogan, and headings inside the page are `--text-intro`, below it. Labels are sentence case. A one-task job says its title once. An empty Today says "No jobs today." Past work appears only when there is some, newest first, and a finished job reads "Completed". There are 660 tests.
- 2026-10-16: ADR 088, the third register audit, on the customer workspace home. The h1 is "My bookings", as the sidebar names it. Requests run in the order the customer acts on them: waiting on them, scheduled, in hand, drafts, closed. "Waiting on you" is no longer red and opens the review queue when no request row waits. Labels are sentence case. `Submitted` reads "Received" to the customer. Task icons are muted, notes inside a customer request sit on `--surface-raised`, and the request row is a grid that keeps its badge and chevron at the edge. There are 658 tests.
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
