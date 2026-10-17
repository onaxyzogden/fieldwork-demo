---
title: "Wiki Log"
type: log
---

## [2026-10-17] session | The operator's side panel quotes the customer (ADR 100)

- **Completed:**
  - `asideFor` gives the operator each task's description and question answers; the customer and contractor get no description.
  - `QueueAside` quotes the description under each task title (`.aside-words`, muted).
  - Desktop CSS hides the column's `.dq-request` beside the panel, as it already hid `.job-details`.
  - ADR 100; ADR 093's "says the name, address and tasks twice" item marked done; `DESIGN.md` register line updated.
- **Verified:**
  - `tsc`, `npm run build`, `npm test` (696 tests, all passing; one new screen test, the operator aside test extended).
  - Live at 1440px: the name shows once, the words in the panel, 6.2:1 light and 8.5:1 dark. At 320px unchanged. No overflow, no console errors.
- **Kept on purpose:** a task under review quotes the customer in the column as well, beside the title field.
- **Housekeeping:** ADR 093's deferral "v5 `setHours`" was already fixed (`model.ts` uses `torontoParts` and `localTime`); no longer open.
- **Pages touched:** [[fieldwork]].

## [2026-10-17] update | Ready-to-convert seed merged and verified live

- PR #79 merged as `1a60f52`; the GitHub Pages deploy succeeded.
- Verified on j.ogden.ag: a returning visitor still had three walkthroughs; "Reset all demo data" reseeded four. Walkthroughs read "Ready to convert 1", PMW-0004's row "$355 approved" and its card "2 approved · ready to convert"; Convert made one request with Handrail/Railing and Faucet or fixture replacement. No console errors.
- **Settled:** "Opened 2 times" after one guest visit on localhost was React StrictMode running the effect twice in dev. In the production build one visit records one open; no fix needed.
- **Pages touched:** [[fieldwork]].

## [2026-10-17] session | Seed a walkthrough that is ready to convert

- **Completed:**
  - `seedWalkthroughs` adds PMW-0004 on p5 (Amir Hassan, 90 Rebecca Street): three findings, sent, two approved through `decide()` as his page would, one left undecided.
  - Walkthroughs now opens with "Ready to convert 1"; the row reads "Ready to convert · $355 approved" and the card offers "Convert 2 approved" with the undecided-finding warning.
  - One new test: a fresh demo has exactly PMW-0004 in `readyToConvertIds`, its findings read Approved, Approved, Pending decision, and converting makes one request with two unrestricted tasks.
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (695 tests, all passing; one new).
  - Live, after "Reset all demo data": the glance count, row and card as above; Amir's guest page resumes on "Item 3 of 3"; Convert made request "Walkthrough Approval" with Handrail/Railing and Faucet or fixture replacement. 320 and 1440px, both themes: no overflow, Convert 47px tall, no console errors.
- **Found and fixed during the work:** the first wording ("structural screws", "cartridge") sent the railing to restricted electrical review and the tap to "Tell us a little more", because `classify` reads the proposed text. Reworded; the test pins the outcome.
- **Housekeeping:** the h096 Prettier stash was dropped on 2026-10-17 (`0af444b`); it is no longer deferred.
- **Note:** `freshDemo()` seeds only when nothing is stored, so a returning visitor sees PMW-0004 only after "Reset all demo data".
- **Pages touched:** [[fieldwork]].

## [2026-10-17] update | ADR 099 merged and verified live

- PR #77 merged as `26909f7`; the GitHub Pages deploy succeeded.
- Verified on j.ogden.ag: Sarah Lin's ask reached the operator's bell and opened the PMW-0001 card; a fresh link cleared it; the old URL of a withdrawn link asked once ("Link holder") and notified again; PMW-0002 with no link read "No link yet" for the operator (with "Issue a link", no Copy) and for Northline. No console errors.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 099: the ask reaches the operator; no link is the operator's move

- **Completed:**
  - Closes the three gaps ADR 098 deferred.
  - New notification kind `fresh-link` (documentary): "Sarah Lin asked for a fresh link · PMW-0001", emitted by `deliverUpdates` when `freshLinkRequestedAt` changes; opening it goes to Walkthroughs with the card open.
  - The guest page for a withdrawn or expired link offers the ask; once asked the heading reads "Fresh link requested" and takes focus. The guest record offers it too. `walkthroughByToken` finds the walkthrough in any link state; the log actor is "Link holder".
  - A Sent walkthrough with no `access` reads "No link yet" on lead, row, card and customer record, counts with the dead links, and offers "Issue a link".
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (694 tests, all passing; six new).
  - Live: Sarah's ask produced the bell notice and it opened the card; reissuing cleared the ask; the guest ask on the old URL worked once and notified again; PMW-0002 with no link read "No link yet" for operator and Northline. 320 and 1440px, both themes: no overflow, buttons 47px, lowest contrast 5.2:1, no console errors. Focus not checkable live (hidden pane refused focus); tests cover it.
- **Correction:** [[fieldwork]] still said ADR 098's PR was open. It merged as PR #76 (`fdabe92`).
- **Deferred:** the h096 Prettier stash, still droppable.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 098: the customer can ask for a fresh link

- **Completed:**
  - Closes the gap ADR 096 and 097 left: the customer saw "Link withdrawn" in their record and could do nothing but call.
  - `requestFreshLink` (model, ADR 036): only a Sent walkthrough whose link is withdrawn or expired, once; logs the customer as actor. The ask lives on `access.freshLinkRequestedAt`, so `issueAccess` clears it.
  - The customer's record shows "Ask for a fresh link" (no confirmation); once asked, the badge reads "Fresh link requested" and takes focus. Their counts and queue do not move.
  - `freshLinkIds` sorts asked-about walkthroughs first, oldest ask first. The operator's lead, row badge and card heading read "Fresh link requested", with "Sarah Lin asked for a fresh link today." Still three counts; no notification.
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (688 tests, all passing; four new).
  - Live: Sarah Lin asked for PMW-0001 after it was withdrawn; the operator saw the lead, the badge and the card sentence; a fresh link restored "Waiting on the customer" and Sarah's "Open assessment". At 320 to 1440px in both themes: no overflow, ask button 44px, lowest contrast 6.1:1 (button) and 5.2:1 (badge). No console errors.
- **Found and fixed during the work:** `localeCompare` sorts "~" before digits, so the "asked first" sentinel sorted backwards; replaced with a plain comparison. Focus after asking was moved in a frame callback that ran before the re-render; it now moves in an effect after the commit.
- **Correction:** [[fieldwork]] still said ADR 097's PR was open. It merged as PR #75 (`e4ecafa`).
- **Deferred:** an operator notification for the ask; the ask on the guest assessment page's record; a Sent walkthrough with no link at all; the h096 Prettier stash, still droppable.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 097: a dead link is the operator's move, not the customer's

- **Completed:**
  - The operator's mirror of ADR 096. The walkthrough glance still counted a Sent walkthrough with a withdrawn or expired link under With customer, and the lead could suggest chasing it, though the customer could not open it.
  - `walkthroughGlance` splits With customer by `linkState(s, w, clock)`: a dead link goes to a new `freshLinkIds` bucket (oldest sent first) and the chase skips it. Ready to convert still wins (ADR 095). One bucket per walkthrough still holds.
  - The Walkthroughs glance leads with the oldest dead-link walkthrough, eyebrow "Link withdrawn" or "Link expired", opening the card where "Issue a fresh link" is the primary. Its row carries the same badge. The card keeps three counts.
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (684 tests, all passing; five new).
  - Live as the operator: withdrawing PMW-0001's link put "Link withdrawn" in the lead, With customer 2 to 1, badge on the row; the lead opened the card. A fresh link reverted all three. At 320, 375, 768, 1024, 1280 and 1440px in both themes: no overflow, lead and row at least 95px, lowest contrast 10.9:1 dark and 5.2:1 light. No console errors.
- **Correction:** [[fieldwork]] still said ADR 096's PR was open. It merged as PR #74 (`7712366`). The session plan said ADR 097 amends ADR 060; the walkthrough glance is ADR 053, and the ADR says so.
- **Deferred:** a Sent walkthrough with no link at all (still With customer); a dead-link badge on a ready row; a customer action to ask for a fresh link; the h096 Prettier stash, still droppable.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 096: an assessment waits on the customer only while its link works

- **Completed:**
  - The customer's side of a dead link, which ADR 095 left for its own decision because it changes ADR 062. Once a link was withdrawn or expired, the customer's glance still counted the assessment, the Home button still said "Review your assessment for ...", the queue still held it, and the record said "Awaiting your approval" beside a dead "Open assessment" link.
  - `customerGlance` keeps a Sent assessment only while `linkState(s, w, clock)` is "live". The queue is built from the glance (ADR 062), so the count, the label and the queue still agree; an open queue skips the item as it skips any that leaves.
  - The customer's `PropertyRecord` reads "Link withdrawn" or "Link expired" (the operator's words) in place of "Awaiting your approval", and hides "Open assessment".
  - `CustomerQueue`'s `w.access &&` guard is gone, since the queue holds only assessments with a live link.
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (679 tests, all passing; four new). ADR 062's queue-equals-count test passes unchanged.
  - Live as Sarah Lin (c1, PMW-0001): withdrawing took "Waiting on you" from 1 to 0 and removed the review button; with the queue open, the withdrawal moved it to "All caught up" with focus on the heading; a fresh link brought everything back. At 320, 375, 768, 1024, 1280 and 1440px in both themes: no overflow, no target under 44px, lowest record contrast 7.7:1 dark and 5.2:1 light. No console errors.
- **Correction:** [[fieldwork]] still said ADR 095's PR was open. It merged as PR #73 (`7bf92bb`).
- **Note:** running Prettier over the touched files reformatted unrelated lines and switched them to LF; that attempt was stashed (`git stash list`: "h096 prettier-mangled attempt") and the edits re-applied without it. The stash can be dropped.
- **Deferred:** the operator's mirror (`walkthroughGlance` still counts a dead-link walkthrough as with the customer, and can suggest chasing it); a customer action to ask for a fresh link; `PropertyRecord`'s h3s; the desktop queue's repeated name and hidden description; the `GlanceLead` eyebrow; `.badge.neutral`; no ready-to-convert walkthrough in the seed.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 095: a link that no longer works is not offered

- **Completed:**
  - The item ADR 093 left for later: once the customer's link was withdrawn or expired, the Sent card still offered "Copy link" and "Open as the customer", both leading to ADR 047's refusal page, under the heading "Waiting on the customer".
  - The card hides both while the link is dead. With nothing approved, the h2 is "Link withdrawn" or "Link expired", the line says "The customer can't open the assessment until you issue a fresh link.", and "Issue a fresh link" is the primary; once issued, focus goes to "Copy link". With approvals, "Convert" stays first and the muted line says the link is dead.
  - The operator's `PropertyRecord` shows "Link withdrawn" or "Link expired" as plain text instead of a dead "Open assessment" link.
  - `DESIGN.md` gains "A link that no longer works is not offered." and cites ADR 095.
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (675 tests, all passing; five new). One ADR 093 assertion now checks the "Link withdrawn" heading instead of the dropped muted line.
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes: no overflow, no target under 44px, lowest contrast 7.7:1 dark and 6.1:1 light; focus on "Issue a fresh link" after withdrawing and on "Copy link" after a fresh one. Customer and contractor screens unchanged. No console errors.
- **Correction:** [[fieldwork]] still said ADR 094's PR was open. It merged as PR #72 (`82cf204`).
- **Deferred:** the customer's side of a dead link (`customerQueue` and the glance still count it, and its "Review assessment" and "Open assessment" links lead to the refusal page; changes ADR 062, so its own session); `PropertyRecord`'s h3s; the desktop queue's repeated name and hidden description; the `GlanceLead` eyebrow; `.badge.neutral`; no ready-to-convert walkthrough in the seed.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 094: the customer's and contractor's queues say what is still waiting

- **Completed:**
  - The item ADR 093 left for later: the customer's ("Waiting on you") and contractor's ("Offers") queues ended on the shared `AllCaughtUp`, which said "All caught up · 0 done" after every item was skipped.
  - `AllCaughtUp` takes `left`, `waiting` and `where`. The caller counts what is still waiting, skipped items included, as `DecisionQueue` does. With some left, the h1 is "End of the queue" and the line is "1 done. 2 still waiting on you, on Home." or "2 offers still waiting, under Offers."; "All caught up" and its tick show only when nothing is left, now saying where anything new will show instead of "here".
  - `DESIGN.md` cites ADR 094; the rule sentence "An end screen says what is still waiting" was already there.
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (670 tests, all passing; three new).
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes: both queues, skipped through, end on "End of the queue" with focus on the h1; no overflow, no target under 44px, lowest contrast 8.2:1 dark and 5.7:1 light. The operator's queue unchanged. No console errors.
- **Correction:** [[fieldwork]] still said ADR 093's PR was open. It merged as PR #71 (`29765cd`).
- **Deferred:** `PropertyRecord`'s h3s under the next step's h2; the desktop queue's repeated name and hidden description; "Open as the customer" on a dead link.
- **Pages touched:** [[fieldwork]], [[one-at-a-time]].

## [2026-10-16] session | ADR 093: the operator's Walkthroughs and the decision queue in the register

- **Completed:**
  - A register audit of the operator's Walkthroughs (the pipeline, the detail, on-site capture and pricing) and the decision queue, with the remit "the operator sees whose move each walkthrough waits on, and makes each decision in one press or skips it". It found 12 issues, 2 P1, 9 P2 and 1 P3, plus 5 under "Also found". All 12 are fixed, with the empty state from "Also found".
  - P1: skipping every decision ended on "All caught up · 0 decisions handled". The queue counts the live decisions left; with some left it says "End of the queue" and "4 still need a decision, under Needs action on Home".
  - P1: opening a walkthrough, and "All walkthroughs", dropped focus to the top. The detail's h1 takes focus, and the list focuses the row it was left for.
  - A link that stops working asks first: "Withdraw this link" and a live "Issue a fresh link" confirm inline with Keep it focused; a dead link is replaced in one step.
  - The page is "Walkthroughs"; groups are Draft, Sent and Converted; "Ready to convert" is the only row chip, and no longer red. Accent marks only the operator's move; a draft's findings carry no state.
  - The Sent card's notes are plain `.wt-fact` text; the developer "not a secret" note is gone. Queue buttons that leave it say "Open request"; the quote's in-place button says "Change price".
  - "Open assessment" is 44px on operator screens; it and "Open as the customer" name the new tab. Labels are in sentence case.
  - `DESIGN.md`'s register paragraph adds: an end screen says what is still waiting, and a link that stops working asks first.
- **Verified:**
  - `tsc`, `npm run build`, and `npm test` (667 tests, all passing; six new).
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes, on the pipeline, a Sent detail, the link confirmation, a draft, the property record and the queue's first and end screens: no overflow, no target under 44px, lowest contrast 5.2:1. Focus lands as designed at every width. No console errors. Customer and contractor screens unchanged.
- **Correction:** [[fieldwork]] still said ADR 092's PR was open. It merged as PR #70 (`1042549`).
- **Deferred:** the shared `AllCaughtUp`'s false "All caught up" for customer and contractor; `PropertyRecord`'s h3s under the next step's h2; the desktop queue's repeated name and hidden description; "Open as the customer" on a dead link.
- **Pages touched:** [[fieldwork]], [[one-at-a-time]].

## [2026-10-16] session | ADR 092: the operator's Home and Today in the register

- **Completed:**
  - A register audit of the operator's Home and Today, with `RouteMap` and `GlanceCard` as they use them, and the remit "the operator sees what today holds and what needs them first, and gets to it in one step". It found 12 issues, 2 P1, 7 P2 and 3 P3, plus 9 under "Also found". All 12 are fixed, with the eight "Also found" items in scope.
  - P1: Today's h1 said "Today" on any date. It is "Today" only on today, otherwise the long date; the ISO line is gone.
  - P1: "Next scheduled day" removed itself and dropped focus to `<body>`. Focus goes to the h1 (`tabIndex={-1}`), which names the day.
  - The page names itself: Home's h1 is "Home". ADR 084's greeting, `greetingFor` and `greeting.test.ts` are retired; ADR 084 notes it.
  - One state, one word, one number: "Needs action" (no `urgent`), a neutral tab count, tabs in sentence case, a status fallback title in sentence case.
  - One move, one control: only "All of today" goes to Today; the date and two metrics are text.
  - Accent follows whose move it is, scoped to `.op-home` and `.op-today`: card tiles, Today strip badges and timeline badges; the timeline line, dots and totals are neutral.
  - Totals count every listed visit ("Work time", "Simulated travel"); the buffer is said once; the switch and totals hide on an empty day.
  - `RouteMap` takes `stops` and `route`: one pin per visit, a route only for one provider, "Provider locations" otherwise. The overlay label and the self-link button are gone, "LAKE ONTARIO" is muted, and Maps links name the new tab.
  - "View progress" shows only for confirmed, in-progress or completed visits; its panel scrolls in and takes focus, and "Close progress" returns it.
  - `DESIGN.md`'s register paragraph adds: a count is not an alarm, one destination has one control, a control that removes itself hands focus on, and a map draws only what it knows.
- **Verified:**
  - `npm run build`, and `npm test` (661 tests, all passing). The Home h1 test changed; one new test (next scheduled day focuses its heading); the four greeting tests are removed.
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes, on Home, an empty Today, the timeline and the map: no overflow, no target under 44px, lowest contrast 5.2:1. Focus lands on "Monday, October 19" at every width. No console errors. Contractor screens unchanged.
- **Correction:** [[fieldwork]] still said ADR 091's PR was open. It merged as PR #69 (`0a2cda3`).
- **Deferred:** Walkthroughs' `urgent` count (out of scope); the unused `--map-label` token; `RouteMap` declared inside `OperatorWorkspace`; the Provider and Date fields at 320px.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 091: the operator's request detail in the register

- **Completed:**
  - A register audit of the operator's request detail, its four tabs and the fulfilment screen, with the remit "the operator sees what this request needs, decides in one step, and books it". It found 12 issues, 1 P1, 5 P2 and 6 P3, plus 7 under "Also found". All 12 are fixed, with five of the seven.
  - P1: "Remove visit / regroup tasks" removed a visit and its offer in one click, with no undo. It is "Remove visit" and asks first. "Withdraw offer" and "Cancel question" ask too. The three dialogs live in the modal host in `Workspace.tsx`.
  - Accent follows whose move it is: the status chip uses ADR 090's rule, the booking mode is text, visit and offer chips are neutral (the scoped `.badge.quiet` rule now covers `.operator-summary`, `.visit-card` and `.assignment-row`), and the fulfilment summary is on `--surface-raised`.
  - Said once: "Open in Maps ↗", no "Tasks 4" h3, "Select for a separate visit", no task list on contractor cards, one line for the slots' buffer and fit, "min" everywhere, no "0" tab counts.
  - A rejected override time is an inline field error, not a toast.
  - Sentence case: the eyebrows (untracked by a rule scoped to `.operator-concept`), "Offer to a contractor" / "Do it myself", "Ask the customer", "Review tasks". The chosen slot carries a check mark.
  - `DESIGN.md`'s register paragraph adds: a shared fact is said once, an error is said at its field, and a removal whose toast has no undo asks first.
- **Verified:**
  - `npm run build`, and `npm test` (664 tests, all passing). Two tests changed (the fulfilment headings, the withdraw confirmation), two new (removing a visit asks and survives Close; withdrawing a question asks).
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes, on the detail with Tasks open and on fulfilment: no overflow, no target under 44px. Accent chip 5.2:1 light and 8.7:1 dark; neutral chips and muted lines 6.1:1 and 7.7:1; eyebrows 5.9:1 and 10.9:1. The dialogs, the inline override error and the focus ring checked. No console errors.
- **Correction:** [[fieldwork]] still said ADR 090's PR was open. It merged as PR #68 (`1fd0181`).
- **Deferred:** a draft request offering "Assign this job" (a product question); the classification options (system taxonomy); the README's "Do It Myself"; focus returning to the heading rather than the trigger after a dialog; the shared `.eyebrow`, `.note` and `badgeTone`.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 090: the operator's request list in the register

- **Completed:**
  - A register audit of the operator's Requests page, with the remit "the operator sees what is theirs to act on, finds any request in one step, and opens it". It found 10 issues, 1 P1, 7 P2 and 2 P3, and all 10 are fixed. PR #68, open.
  - P1: the search input had only a placeholder; it has `aria-label="Search requests"`.
  - The page names itself: the h1 is "Requests", as in the sidebar. The eyebrow "INTAKE & FULFILLMENT", the slogan and the accent count badge are gone; one line says how much of the list shows ("4 of 7 requests").
  - Accent follows whose move it is: rows in Needs Action keep the accent chip, every other status sits on `.badge.quiet` (scoped to `.queue-item` in `operator-concept.css`). `Review` is out of `badgeTone`'s red pattern, so "Needs Review", and the customer's "In review" over the same status, are no longer red.
  - "All requests" sorts by bucket, Needs Action first and History last (`BUCKET_ORDER`, stable sort, display only; `bucket()` unchanged, ADR 011).
  - An empty search or filter says "No requests match." and offers "Show all requests", which resets both and hands focus to the search.
  - The detail's "← All requests" / "Request Details" header is gone: it duplicated the list when wide and "Browse requests" when narrow.
  - Filter options are sentence case, with the bucket strings as values.
  - `DESIGN.md`'s register paragraph adds: accent in a list marks only what is the person's to act on, red is for errors not review, and an empty filtered list offers the way back.
- **Verified:**
  - `npm run build`, and `npm test` (662 tests, all passing). One test rewritten (no back button beside the list), three changed (the h1 twice, the count line), two new (the empty state, and the order with its chip colours).
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes, on the list, the detail and the empty state. Nothing overflows. Accent chips 5.2:1 light and 8.7:1 dark; quiet chips 5.7:1 and 8.6:1, 5.4:1 and 6.1:1 on the selected row. The focus ring shows on "Show all requests". No console errors. Contractor screens unchanged; the customer's only change is the "In review" chip.
- **Correction:** [[fieldwork]] still said ADR 089's PR was open. It merged as PR #67 (`597edd3`).
- **Deferred:** the draft reference "JALS3PZ3" shown as a request's name; a narrow screen opening on a request rather than the list; red for Declined and Cancelled, which are outcomes, not errors; the "All Requests" button on operator Home, in title case; the status-dictionary words in title case (left as the system's names); the badges on the request detail.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 089: the contractor workspace in the register

- **Completed:**
  - A register audit of the contractor workspace (Your work, its job detail, the offer queue, the identity switcher, Earnings), with the remit "the contractor sees the next job and what it pays, and answers each offer in one step". It found 11 issues, 6 P2 and 5 P3, and all 11 are fixed.
  - One action, one colour: Accept was green on the detail (from `.contractor-accept` in both `contractor-concept.css` and `cards.css`) and amber in the queue. Both green rules are gone, so Accept is a plain `.primary`.
  - One primary per screen: "Review N offers" steps aside while an offer is open on the detail; "View job" on each card is `.secondary`; the "New offers" count is no longer `urgent`.
  - Pay: an accent fill on every card is decoration, so pay sits on `--surface-raised` with tabular figures. `payLabel` (`ContractorQueue.tsx`) words it once, "Your pay: $110 CAD", replacing three wordings.
  - Headings: the h1 is "Your work" with no slogan (the page key stays "Your Work"). Job titles, week headings and Earnings totals drop from `--text-h2` (31.25px) to `--text-intro` (20px), below the 25px h1. "VIEWING AS" and "NEXT JOB" are sentence case, untracked, via contractor-scoped rules.
  - Said once: a one-task job has no task list on its card, and its disclosures read "Task details". An unrestricted task renders no empty paragraph.
  - An empty Today says "No jobs today." "You're done for today." is kept for a day whose jobs are finished.
  - Past work appears only when there is some, newest first, and a finished job reads "Completed", not "Accepted".
  - `DESIGN.md`'s register line now says one action has one colour, a screen has one primary, and headings sit below the h1.
- **Verified:**
  - `npm run build`, and `npm test` (660 tests, all passing). Three tests changed (the h1, "Switching roles", and the queue-focus test, which now steps back to the list first). Two are new: Review is the list's one primary, and past work stays hidden until it exists.
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes, on the list, the detail, Earnings and Availability. Nothing overflows. Pay is 14.1:1 in light and 12.8:1 in dark; View job 16.5:1 and 14.6:1; "Viewing as" 5.5:1 and 12.1:1. The focus ring shows on every button. Operator screens are unchanged, their pending counts still red. No console errors.
- **Left alone:** shared code: `GlanceCard`, the global `.eyebrow` and `.note`, the customer's "VIEWING AS", `JobWork` and `.contractor-success`, `.time-pill`.
- **Correction:** [[fieldwork]] still said ADR 088's PR was open. It merged as PR #66.
- **Deferred:** the customer's "VIEWING AS" switcher; `GlanceLead` tracking on operator screens; the accent fills on `.message-bubble.sent` and `.notification-link.unread`; the "Messages" in-app simulation summary; the `GlanceCard` doc comment on `urgent`; the now-dead `.contractor-success` check shared with `JobWork`; the glance's "City · $110", which does not use `payLabel`; a light-theme review of the pills.
- **Pages touched:** [[fieldwork]].

## [2026-10-16] session | ADR 088: the customer workspace home in the register

- **Completed:**
  - A register audit of the customer workspace home, with the remit "the customer sees what needs them, what's coming, and how each request stands". It found 9 issues, 6 P2 and 3 P3, and all 9 are fixed.
  - The P2s: "Waiting on you" is not red, and when the waiting item is an assessment it opens the review queue. Notes inside a customer request sit on `--surface-raised`, not the accent fill. The h1 is "My bookings", and the slogan and subline are gone. A draft's title no longer repeats "Draft". Requests are ordered by what the customer acts on first (display only; `ownRequests` keeps creation order for `startOrResumeRequest`). The row header is a grid, so the badge and chevron hold the edge, and under a 420px container the badge drops under the place line.
  - The P3s: labels are sentence case with no tracking. Task icons are `--muted`. `Submitted` maps to "Received" in `customerStatusText`, and `docs/status-dictionary.md` records it.
  - The fallback title "Request · ID" is now "Your request".
  - `DESIGN.md`'s register line now says a customer's own list runs in the order they act on it, each state has one word, and labels are sentence case.
- **Verified:**
  - `npm run build`, and `npm test` (658 tests, all passing). Three assertions changed: two for the h1, one for the "Additional charge" label.
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes. Nothing overflows. Notes are 14.1:1 in light and 12.8:1 in dark; labels 5.9:1 and 10.9:1; task icons 5.2:1 and 6.8:1. The "Waiting on you" button opens the queue and moves focus to its heading. The focus ring shows on the count and the row heads. No console errors. The quote, charge and question panels are not in the seed, so they were checked in code only.
- **Left alone:** `GlanceCard`, shared by every role, and the global `.note` rule in `primitives.css`.
- **Correction:** [[fieldwork]] still said ADR 087's PR was open. It merged as PR #65.
- **Deferred:** the shared "Today at a glance" heading when the next visit is days away; the global `.note` accent fill on operator screens; the status dictionary's Draft row, which says the customer sees no status; tests for the list order and for the count opening the queue.
- **Pages touched:** [[fieldwork]].
## [2026-10-16] session | ADR 087: the customer intake in the register

- **Completed:**
  - A register audit of the customer intake (address, tasks, timing). The intake may speak warmly but does not sell. The audit found 11 issues, 2 P1, 3 P2 and 6 P3, and all 11 are fixed.
  - The P1s: Instant Book shows the real appointments before the timing constraints, so they are no longer below the fold on a phone, and the step h1 is `--text-h2`. The times read in order: the best fit first, then time order, and "See more times" is grouped by day. Only the display order changed, not the scoring in `intakeOptions`.
  - The P2s: there is no review badge or booking-mode badge on customer surfaces. The copy that used internal vocabulary is rewritten. `.time-pill` is 44px.
  - The P3s: "Recommended" appears once, as a muted label. The visit length is said once. The 150px gradient is now a one-line address confirmation, and its four tokens are removed. The photo button no longer uses accent. The dialog h2 is `look-h3`.
  - `DESIGN.md`'s register line now says customer surfaces never show the operator's working state, and compared lists come in a readable order.
- **Verified:**
  - `npm run build`, and `npm test` (658 tests after merging ADR 086, all passing). No assertions changed.
  - Live at 320, 375, 768, 1024, 1280 and 1440px in both themes, on all three steps. Nothing overflows. "Recommended" is 6.1:1 in light and about 7.5:1 in dark. Time pills are 44px. No console errors. Request to Book was checked by marking the task unreviewed in the demo state.
- **Correction:** the audit listed `.task-number` as an intake element. It is only used by `OperatorRequests`, so it is untouched.
- **Deferred:** a regression test for the time order; the "Send for referral review" copy; the customer workspace's "Home, handled." and its eyebrows; offering the soonest times as well as the best-scored ones.
- **Pages touched:** [[fieldwork]], [[index]].
## [2026-10-16] session | ADR 086: the seeded offer v5 in Toronto time, on a weekday

- **Cause:** `seed()` placed marcus's offer v5 with machine-local `setHours(10)`, three days after the clock. In UTC it showed at 06:00 Toronto time. On a Wednesday or Thursday it fell on a weekend, outside marcus's default Mon–Fri hours.
- **Completed:**
  - v5 starts at `localTime(day, 10)`, where `day` is the first Toronto weekday at least three days out.
  - One test in `model.test.ts` fakes `Date.now` for each day of a week under UTC, America/Toronto, Asia/Tokyo and Pacific/Honolulu (via `vi.stubEnv("TZ")`). It checks the day, 10:00, and that `available()` accepts the offer for marcus. It fails on the old seed even on a Toronto machine.
  - r3's preference stays three days out, weekend or not. It is the customer's choice, intake offers weekends, and nothing books it.
- **Verified:** `npm test` (658 tests, all passing), and the vitest suite under `TZ=UTC` and `TZ=Asia/Tokyo`. `npm run build` is clean.
- **Closes:** the `seed()` item deferred by the `concurrency.test.ts` session below.
- **Deferred:** `model.ts` is not Prettier-clean on `main`. Only the changed lines were formatted.
- **Pages touched:** [[fieldwork]].

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
