# Design consolidation verification — 2026-09-13

- Design validator passes; the production build runs it before catalogue validation and compilation.
- Catalogue: 81 issues / 268 questions validated; 8 catalogue tests and 205 application regression tests pass in the clean publishing checkout. These cover intake, decline/Yousef takeover, matching, quote/payment gates, execution, notifications and blueprint behavior.
- Customer portal, contractor work and operator Home were inspected with existing populated demo records. Blueprint and contractor views were checked in both themes at 320, 390, 461, 768 and 1280px; operator Home also passed both themes at those widths. Customer portal passed those widths and both themes were visually inspected. No horizontal page overflow was measured on these screens.
- Corrected operator status-icon contrast found during visual review. Dark/light semantic surfaces, visible focus and reduced-motion rules are centralized. Native dialog top-layer behavior is unchanged.
- Model, dispatch, execution, notification and intake logic files are unchanged. TSX changes are styling classes, icon sizes, stylesheet imports and SVG color tokens.
- Remaining manual verification: exhaustive dialog/long-content coverage, actual browser 200% zoom, reduced-motion emulation and printed PDF pagination. The environment blocked the headless browser print launch, so a fresh PDF could not be inspected. This is not a claim of complete visual coverage.

Reference documents and synced sources were not modified. Loading/offline guidance is documentation only; no delays, autosave or navigation behavior were added.

# Redesign verification — 2026-09-21

- `design:check`, 214 application tests (205 prior plus 9 new) and 8 catalogue tests pass; production build passes.
- New tests cover the load-bearing behaviors: a contractor decline reverting `coordinated`, a quote staying withheld until coordination holds, confirmation needing a time as well as approval and acceptance, the operator note replacing rather than appending, per-field address validation including postal format, and the ten-day preference window.
- Browser-driven checks: all three roles at 320, 390, 461, 768 and 1280px in both themes — 30 combinations, no horizontal page overflow and no page errors.
- Automated contrast audit over every rendered text node, both themes, all three roles plus all three intake steps and the field-error state: zero elements below WCAG AA (4.5:1, or 3:1 for large text).
- Walked end to end: address validation blocking and focusing the offending field, task clarify with "Not sure" routing to Needs Review, timing capture, submission with no timing chosen, and the decline path — contractor declines, customer sees no trace and falls back to "we're matching your request", operator is told who declined.
- Remaining manual verification is unchanged from the previous round: actual browser 200% zoom, reduced-motion emulation and printed PDF pagination. The blueprint's documented stage content was not re-authored and may now describe intake in its previous three-screen order.

# Narrow-layout verification — 2026-09-27

Three defects were reported from a narrow viewport on the live site: inconsistent
vertical spacing between boxes, text stacking in columns too narrow to read, and
status chips sitting at the end of the text instead of the right edge. The second
was a repeat of Round 4 feedback, so this round's first job was to explain how it
had been passing.

**It passed because the sweeps measured the wrong thing.** Every responsive check
since Round 4 measured horizontal overflow. All three defects pass that: nothing
spills, nothing clips, no scrollbar appears. A new probe measures the share of
available width a block uses while wrapping — see ADR 049 for why characters per
line is the wrong metric — across 360, 480, 600, 878 and 1280 in both themes, on
every role and screen plus one list row opened on each.

Findings before and after, same sweep both times:

| Probe | Before | After |
| --- | --- | --- |
| Text squeezed into a narrow column | 4 | 0 |
| Trailing chip not at its row's right edge | 86 | 30 |
| Stacks using more than one gap between boxes | 50 | 14 |

What the remaining numbers are. The 30 chips are all the identity switcher's
pills, which are choices to read across rather than a status ending a row. The 14
stacks are two patterns, both *inside* a card — a list's rows against the panel
title above them, and the request queue's search and filter — which is the card's
own spacing and was not what was reported. Every page-level stack now measures a
single 20px between boxes at all five widths in both themes.

Also checked:

- 381 tests, `design:check`, `catalogue:check`, `status:check` and the production
  build pass; `prettier --check` passes on every file this round touched.
- The full screen crawl at 1440 reports no console or page errors.
- All five sample scenarios opened at 390px: no horizontal overflow, no errors.
  Scenario 05 is what found the last defect — "Awaiting Provider Acceptance" is
  long enough to wrap its panel title, where the chip dropped to the left. The
  seeded data's shorter statuses never wrapped, so no sweep could have found it.

Not verified: 200% browser zoom, reduced-motion emulation and printed PDF
pagination remain unchecked, unchanged from previous rounds. The live site could
not be reached from this environment, so these results are from the local build.

# Glance, controls and the notifications panel — 2026-09-27

- 394 tests (381 prior plus 13 new in `glance.test.ts`), `design:check`,
  `catalogue:check`, `status:check` and the production build pass.
  `prettier --check` passes on every file this round touched.
- **Every guard in `glance.ts` removed in turn**, five of five now caught by the
  suite. The first pass caught four: the sixth attempt, dropping `&& !running`
  from the Upcoming filter, changed no test, and the missing case — a job
  started ahead of its scheduled date — was added before the rule was kept.
- **The contractor's counts equal its tabs by construction**, not by agreement:
  the tabs call the same `tabWork()` the counts do, and a test asserts each
  count against the length of the list its tab renders.
- **Computed treatment of every choice control, both themes**, before and after.
  Before: four different selected states, and the identity pills' selected and
  unselected states byte-identical. After: one pair, applied to all four.
  `.bp-stage-nav` confirmed to keep its underline.
- **The notifications panel in three states**: nothing unread (no button, one
  heading), something unread (button, two rows), and after marking all read
  (button gone, rows remain) — which is what shows the gate is on unread-ness
  rather than emptiness.
- **The glance's lead line in both states**, populated and empty, for both new
  roles. Populated reads "Wed, Sep 30, 6:00 a.m. / Marcus Chen / 90 Rebecca
  Street" for the customer and "… / TV mounting / Oakville · $110" for the
  contractor; empty reads "Nothing scheduled yet." / "Nothing accepted yet."
- Last round's narrow-layout harness re-run across 360/480/600/878/1280 in both
  themes: 0 squeezed-text findings, and the chip and gap counts unchanged at 30
  and 14 — the same two known patterns, so the new card introduced nothing.
- Screen crawl at 1440: no console or page errors. All five sample scenarios
  open at 390px with no horizontal overflow and no errors.

Not verified: 200% browser zoom, reduced-motion emulation and printed PDF
pagination, unchanged from previous rounds. The live site is unreachable from
this environment, so these results are from the local build.

# Glance counts and click-through — 2026-09-27

- 396 tests (394 prior plus 2 new), `design:check`, `catalogue:check`,
  `status:check` and the production build pass; `prettier --check` passes on
  every file touched.
- **The reported defect reproduced first.** Seed account `c5` — one request,
  `Awaiting Provider Acceptance`, one visit — read `waiting 0 / upcoming 1 /
  open 1`, the same job counted twice. After: `0 / 1 / 0`.
- **Disjointness is asserted, not described.** The test sweeps all ten request
  statuses `reconcile()` can produce, each with and without a visit, and checks
  the id sets do not intersect and that every count equals the length of its
  own list.
- **Break test, five rules removed in turn**: four caught. The two that were
  missed the first time exposed a real bug — a closed request's leftover visit
  counted as upcoming — which is fixed and now caught. The fifth changes no
  behaviour and is documented in the source as unreachable rather than claimed
  as covered.
- **Click-through walked in the browser**, both empty and populated:
  - Customer, nothing booked: only "In progress" is a button; it opens the
    right accordion row. The two zero counts render as plain text.
  - Customer, one visit booked: "Upcoming visits" and the lead line both open
    `90 Rebecca Street`.
  - Contractor: each count switches to its tab; the lead line moves the tab
    from Offers to Upcoming and selects the TV mounting job.
  - Operator: unchanged, all three still navigate.
- Narrow-layout harness re-run at 360/480/600/878/1280 in both themes: 0
  squeezed-text findings, chip and gap counts unchanged at 30 and 14, so the
  lead-line button introduced nothing.
- Screen crawl at 1440: no console or page errors. All five sample scenarios
  open at 390px with no horizontal overflow and no errors.

Not verified: 200% browser zoom, reduced-motion emulation and printed PDF
pagination, unchanged from previous rounds. The live site is unreachable from
this environment, so these results are from the local build.

# The date input, and what the checks actually cover — 2026-09-27

- 396 tests, `design:check`, `catalogue:check`, `status:check` and the
  production build pass; `prettier --check` passes on the touched file.
- **Measured before changing anything.** In Chromium at 320/360/390px the date
  input's right edge equals the card's content edge exactly and page overflow is
  0 — it does not overflow in this engine. Its min-content width is 170px
  against a 294px column, so the intrinsic-width theory was wrong too.
- **The reported screenshot is iOS Safari**, confirmed by rendering: it shows
  `Sep 30, 2026` centred with no calendar affordance, where Chromium shows
  `09/27/2026` left-aligned with one.
- **Not verified on the engine that has the defect.** Playwright's WebKit cannot
  be downloaded in this environment. The fix is the documented iOS remedy and is
  measured inert in Chromium — same width, same height, calendar indicator
  intact — but it has not been seen to work on iOS.
- **New probe: an element wider than the box that contains it.** Every visible
  element's border box against its parent's content box, excluding parents that
  scroll or clip deliberately, across 320/360/480/600/878/1280 and every role
  and screen. Zero findings before and after the change. It would not have
  caught this defect, since the engine with the bug is not available here.
- The other three probes unchanged at 0 / 30 / 14. Console crawl at 1440: no
  errors.
- Noticed and **not** changed: the date input renders 54px tall against the
  select's 49px in the same toolbar. Pre-existing, unrelated to the overflow,
  and outside what was reported.

Standing caveat, true of every verification note above and never stated until
now: **all of these measurements are Chromium.** Safari and Firefox are not
covered by anything in this repository.

# One height for the form controls — 2026-09-27

Asked to even up the date input and the select in the Today toolbar. Measuring
every control on every screen first showed the family disagreed four ways, not
two:

| | before | after |
| --- | --- | --- |
| `input[type="text"]` | 52px | 52px |
| `input[type="date"]` | 54px | 52px |
| `select` | 49px | 52px |
| `input[type="number"]` (`.mini-field`) | 44px | 44px |
| `textarea` | 110px | 110px |
| `input[type="checkbox"]` | 16px | 16px |
| `input[type="file"]` | 26px | 26px |

Each took its line height from a different place: the date inherited the body's
1.6, the select used the UA's `normal`, and the date's internal editor added two
more on top. Four candidate rules were injected and measured; the one kept sets
both the line height and a floor, so the height is decided by the stylesheet
rather than by each control's internals — the same reasoning as the iOS
appearance fix in ADR 052.

`.mini-field` keeps its own smaller height. It is a deliberate second size, not
one of the four accidental ones, and the first attempt flattened it to 52px
before the general rule was carved to exclude it.

- 396 tests, `design:check`, `catalogue:check`, `status:check` and the
  production build pass; `prettier --check` passes on the touched file.
- All four harness probes unchanged at 0 / 30 / 14 / 0. Console crawl at 1440:
  no errors.
- Still Chromium only, per the standing caveat in ADR 052.

# Leftover findings no longer stranded — 2026-09-27

The gap ADR 053 recorded. A finding still undecided when an assessment was
converted appeared nowhere: the customer page had locked it, no count included
it, and the carry-forward list did not offer it. Fixed per ADR 054.

- **Five new tests** in `pmw.test.ts`:
  - The customer's close-out defers only undecided findings.
  - Nothing is stranded after a customer submit.
  - The operator's early convert leaves the finding undecided but carryable.
  - An undecided finding is not carryable while the walkthrough is still with the customer.
  - A carried finding stops being offered.
- **Every new guard was broken on purpose, and each one fails a test:**
  - dropping the stranded findings from `carryCandidates`;
  - dropping its converted-only filter;
  - widening `undecided()` past "Pending decision";
  - `closeOutUndecided` deferring nothing;
  - removing the `resolvedBy` exclusion.

  The one not reachable by a unit test is the call itself inside the customer's
  submit in `Assessment.tsx`. The browser walk below covers it.
- **Browser walk at 390px, both themes**, starting from a fresh seed.
  - Customer path: approve one item, leave one undecided.
    - The note ("1 item you haven't decided will be kept as "Not now"…") shows before submit.
    - After submit the finding is "Not Now", the walkthrough is Converted, and the note is gone.
    - A new walkthrough for the property offers the finding.
  - Operator path: the customer approves one and stops.
    - The Sent card warns before converting.
    - After converting, the finding is still "Pending", never deferred for them.
    - The Converted card shows the leftover line, and the customer page offers no decision buttons.
    - The next walkthrough offers the finding. Carrying it marks the original resolved and drops it from the list (2 → 1).
  - No console errors.
- 409 tests, `design:check` and the production build pass. `prettier --check`
  reports the same pre-existing lines as `main` on the three touched source
  files, and none on the added lines.
- The four harness probes are unchanged at 0 / 30 / 14 / 0. Console crawl at
  1440: no errors.
- Still Chromium only, per the standing caveat in ADR 052.

# Columns that changed width between tabs — 2026-09-28

Reported from a phone: the contractor's Your Work column was a different width
on Today than on Offers. The cause was the ADR 049 regression described in
ADR 055.

- **Measured, then fixed.** Column width against the width available, at 430px:
  - contractor Offers / Today / Upcoming: 360 / 364 / 398 of 398 before, and 398 on every tab after;
  - operator Home: 381 of 398 before, 398 after.

  At 1280px:
  - operator Home: 624 before, 944 after;
  - contractor: 360–474 before, 760 after;
  - New request form: 444 before, 760 after.

  Every "after" value equals the commit before ADR 049, measured by running that
  commit side by side.
- **Width across states probe:** 24 findings before (contractor at 430 and
  wider, operator Home at 878 and wider, both themes), 0 after, and 0 on the
  commit before ADR 049.
- **Shrink-wrap probe:** fired on `.customer-intake` after the first three
  columns were fixed. 0 after, and 0 on the commit before ADR 049.
- **Existing probes:** the four existing probes are unchanged at 0 / 30 / 14 / 0.
  Console crawl at 1440: no errors.
- **Visual check:** the three contractor tabs at 430px in both themes, side by
  side, are the same width. Operator Home at 1280px shows the two-column request
  grid again.
- **Repo checks:** 409 tests, `design:check` and the production build pass;
  `prettier --check` passes on the four touched stylesheets.
- Still Chromium only, per the standing caveat in ADR 052.

# Walkthrough captured on site, priced afterwards — 2026-10-05

ADR 056. The same task was measured through the old screens and the new ones
by a scripted run at 390px: three items, each with a photo, a note and a room,
then priced and sent.

|                                 | before | after                                                    |
| ------------------------------- | ------ | -------------------------------------------------------- |
| taps                            | 26     | 24                                                       |
| typed characters                | 264    | 153, of which 145 are notes that can be dictated on site |
| most controls on screen at once | 37     | 19                                                       |
| titles typed                    | 3      | 0, all three accepted as suggested                       |

- **Taps barely moved, and that is reported as measured.** The saving is in
  what is typed and in what is on screen at once.
  - The first version took 27 taps: each pricing screen cost a tap on the
    price box before typing. Opening that screen with the box focused brought
    it to 24.
  - Elapsed time is not reported, because a scripted run's time says nothing
    about a person's.
- **Five new tests** cover the seed type, room sets with history merged, an
  untyped property, title suggestion, and capture-then-price-then-send.
  Eight guards were broken on purpose, and each break fails a test:
  - other properties' areas leaking in;
  - case-sensitive de-duplication;
  - blank areas;
  - the type's rooms;
  - the full stop rule;
  - the 60-character cap;
  - the `needsPricing` filter;
  - the seed type.
- **The browser walk passed all 21 checks in both themes**, with no console
  errors:
  - the type picker appears only for an untyped property, the type is stored,
    and the Townhouse rooms are offered;
  - an empty save is refused and saves nothing;
  - a note-only item with a typed room saves, and the room becomes its own
    button for the next item;
  - photos can be added and removed;
  - Finish saves the item in hand;
  - the title is suggested, and written on Next;
  - "Needs a closer look" passes without a price;
  - Back and Close work, and the draft card leads with the right action in
    each state;
  - the earlier-visit reminder appears and expands.

  The customer's link opens with the three sent items.

- **No horizontal overflow** on the overlay's capture, filled capture, pricing
  and send screens at 320px and 360px.
- **Repo checks:** 414 tests, `design:check`, `catalogue:check`, `status:check`
  and the build pass. New files are prettier-clean. Touched files carry exactly
  the pre-existing prettier drift of `main`.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, and the console crawl has no
  errors.
- **Not verified here:** whether `capture` opens the camera, and whether a
  focused price box raises the number pad on iOS, both need a real phone.
  Still Chromium only, per the standing caveat in ADR 052.

# Contractor job mode — 2026-10-05

ADR 057. The same job was measured through the old page and job mode by a
scripted run at 390px. It was a four-task job, confirmed and accepted for
today. Each task got a before and an after photo. Three tasks were done as
described, and one was "Materials required" with the note "Need a longer
bracket".

The job was built from the app's own rules. The harness imports `eligible()`
and `reconcile()` from the dev server, so the visit stays confirmed rather than
being reset by the next save.

|                                 | before | after |
| ------------------------------- | ------ | ----- |
| taps                            | 36     | 29    |
| typed characters                | 21     | 21    |
| most controls on screen at once | 41     | 15    |

- **Five new tests** cover the note rule on finish (no note, a whitespace-only
  note, then a real note), `needsNote()` across outcomes, and `openTasks()`
  order. Four guards were broken on purpose, and each break fails a test:
  - finishing without the note check;
  - whitespace counting as a note;
  - Completed needing a note;
  - `openTasks()` ignoring outcomes.
- **The browser walk passed all 17 checks in both themes**, with no console
  errors:
  - today's job opens in job mode at arrival, and "Already here? Start" skips
    on-the-way;
  - an empty exception and a whitespace-only note are refused, and nothing is
    saved;
  - Skip, Done and Back each land on the right task;
  - Close leaves, and reopening resumes at the first open task;
  - the finish list shows the skipped task as not done, and offers it instead
    of "Finish job";
  - a finished task can be changed to an exception from the list;
  - Messages opens the thread inside job mode;
  - finishing succeeds once every exception has a note;
  - a job on another day keeps the page;
  - the operator's own job page asks for the note on the exception task
    instead of finishing.
- **No horizontal overflow** at 320px or 360px on arrival, on the way, a task
  with photos, an exception, messages, or finish.
- **Repo checks:** 417 tests, the build, `design:check`, `catalogue:check` and
  `status:check` pass. New files are prettier-clean. `ContractorWork.tsx`
  carries exactly the pre-existing drift of `main`.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, and the console crawl has no
  errors.
- **Not verified here:** the camera opening directly needs a real phone.
  Chromium only, per ADR 052.

# Customer one-decision-at-a-time approval — 2026-10-05

ADR 058. The same approvals were measured on the seeded assessments through
the old page and the new flow, by a scripted run at 390px.

- **Individual (PMW-0001):** approve two priced findings and request
  assessment on the third.
- **Organisation (PMW-0002):** choose the approver and approve two findings.

|                                 | before            | after                      |
| ------------------------------- | ----------------- | -------------------------- |
| taps, individual                | 7                 | 5                          |
| taps, organisation              | 7                 | 5                          |
| typed characters                | 9 (the name)      | 0                          |
| most controls on screen at once | 10–11             | 6–7                        |
| height at 390px                 | 3,957px, one page | at most 1,236px per screen |

The new count includes the one tap that saves a card. The next assessment on
the same account skips it.

- **Tests:**
  - Seven new tests cover `approveAssessment()`: its order of refusals, the
    undecided close-out, refusing a second approval, organisation authority,
    and the payment naming the saved card. Seven guards were broken on
    purpose, and each break fails a test.
  - The render tests now check that the flow opens on item 1 of 3 for an
    individual and on "Who is approving?" for an organisation. They also check
    that the review signs without typing and has no checkbox, and that a
    closer-look finding has no price and no Approve.
- **Browser walk: 20 checks in both themes, with no console errors.**
  - On the organisation's screen, a contact without authority is refused and
    an authorized one moves on.
  - Moving between items works: Not now, Back (with the earlier answer
    shown), Skip, and reopening an item from the review.
  - Reloading resumes in the right place.
  - Approving with nothing approved, or with no card, explains itself.
  - The card is saved to the account, and Change removes it.
  - Changing the name lands in the approval record.
  - After approval, the page becomes the record, the print document is still
    present, and the payment names the card.
- **Layout:** no horizontal overflow at 320px or 360px on any screen: who,
  item, closer look, review, review while editing the name, and record.
- **Repo checks:** 423 tests, the build, `design:check`, `catalogue:check`
  and `status:check` pass. New files are prettier-clean, and the touched
  files carry exactly `main`'s drift.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, and the console crawl is clean.
  Chromium only, per ADR 052.

# Operator decision queue — 2026-10-05

ADR 059. Every seeded Needs-attention request was taken as far as the operator
can take it, first through the request pages and then through the queue, by a
scripted run.

- **Request pages:** Review tasks, open each unsure task, Mark reviewed;
  Offer to a contractor, Create visit & send offer, Back to request; Send
  quote; Back to Home.
- **Queue:** Work through 4 decisions, the suggestion on every screen, Back
  to Home.

|                                 | request pages     | queue |
| ------------------------------- | ----------------- | ----- |
| decisions completed             | 5 (and 1 refused) | 7     |
| taps                            | 26                | 9     |
| typed characters                | 0                 | 0     |
| screens visited                 | 12                | 8     |
| most controls on screen at once | 48 (52 at 1280px) | 12    |

The request pages could not book 14 Iroquois Shore Road. No contractor can
take every task there, and the panel refuses with "This provider is not
eligible for every selected task". The queue offers Do it myself and goes on
to quote it, which accounts for the two extra decisions.

- **Tests:**
  - Twelve new tests cover `decisions.ts`: the seeded queue and what stays out
    of it, scope approval, no eligible contractor, nobody with a free time,
    the pay floor and a repeated press, quote and revise, a re-offer at no
    less pay, the operator never suggested as the replacement, a follow-up
    first, oldest first, the quote formula, and a request waiting on the
    customer.
  - One new test in `work.test.ts` covers a declined quote landing in Needs
    Action.
  - Twenty-one guards were broken on purpose. Twenty fail a test. The
    twenty-first, a Confirmed request returning nothing, cannot be reached:
    the checks after it return nothing for it anyway. It stays to keep the
    decision card's order, and the source says so.
- **Browser walk, 390px and 1280px in both themes, with no console errors:**
  - every kind: check the scope, book the work (contractor and Do it
    myself), send the quote, quote declined, contractor declined (re-offer to
    another contractor, and Do it myself when nobody else is free), follow up
    the job;
  - Skip moves on without writing; Change and Open request land on that
    request; Close leaves; reopening shows the same count;
  - a request acted on comes round again with its next decision;
  - a $0 revision is refused on the field and clears as the price is typed;
  - the re-offer pays $120 after a $110 decline (the new contractor's
    floor), and the operator covering a job is paid nothing;
  - the assign panel defaults to $240 (Nina Patel, 300 minutes), refuses
    $239 on the field without booking, and sends $260 when typed. A pay
    typed for one contractor gives way to the next one's own rate when
    another is picked.
- **Layout:** no horizontal overflow at 320px or 360px on any queue screen,
  with Details open.
- **Repo checks:** 436 tests, the build, `design:check`, `catalogue:check`
  and `status:check` pass. New files are prettier-clean, and `main.tsx`
  carries less than `main`'s drift: the replaced block was part of it.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, and the console crawl is clean.
  Chromium only, per ADR 052.

# Delivery log replaced — 2026-10-06

ADR 060.

- **Tests:**
  - Four new tests in `channels.test.ts` cover the following:
    - a waiting offer before and after it is opened;
    - the bell inbox counting the same;
    - stand-in notices (the operator's copy of the offer, a message to the
      contractor) never read as the offer;
    - one warning per person and channel by name, leaving out the operator's
      own bounce and another request's bounces.
  - The notices are raised by `deliverUpdates()` on a real booking, not
    written by hand.
  - Seven guards were broken on purpose. Each break fails a test. Four of
    them failed nothing until the stand-in cases were added.
- **Browser walk:** 390px and 1280px in both themes, plus 320px, with no
  console errors.
  - An offer to Nina Patel reads "not opened yet". It reads "Opened …" once
    she views Your Work, which opens on her only offer.
  - Marcus Chen has two offers. His list showing them does not count; opening
    the notice from the bell does.
  - Booking 62 Thompson Road shows "Couldn't text James Carter: no mobile
    number on file. Call or email them about this request." No warning
    appears on 38 Lakeshore Road West.
  - No Delivery section appears on any request, and the card does not
    overflow.
- **Repo checks:** 440 tests, the build, `design:check`, `catalogue:check`
  and `status:check` pass. New lines are prettier-clean, and the touched
  files keep exactly `main`'s drift.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, and the console crawl is clean.
  Chromium only, per ADR 052.

# Customer view reads as production — 2026-10-06

ADR 061.

- **Tests:**
  - Three new tests in `channels.test.ts` cover the customer's notices for a
    booking, a quote, a payment received and failed, a message from the
    business and a question, each beside the operator's unchanged wording.
  - Eight customer-wording branches were broken on purpose, and each break
    fails a test.
  - `status:check` now reads all four customer maps from `customerText.ts`.
    Removing a label's dictionary row fails it.
- **Browser crawl of the customer view:** 390px and 1280px in both themes,
  45 screens each, with no console errors. It covers:
  - every account, in the seed state and after the operator's queue sends
    quotes;
  - each request expanded, and the inbox and the new-notice popup;
  - approving a quote, then checkout with Demo settings' "Customer payments
    fail" on, then paying for real;
  - sending a message;
  - a visit on the way, and one finished with an unresolved task;
  - New request;
  - both sent guest assessments.

  No visible text outside the banner and the "Viewing as" switcher matches
  `demo`, `simulat`, `prototype`, `test card`, `manual quote`, `in-app`,
  `integration` or `operator`. None of the raw statuses `Proposed`, `Sent`,
  `On the Way`, `In Progress`, `Converted` or `Awaiting …` appears either,
  apart from a chat bubble's own "· Sent".

- **Staff views:** the operator's inbox keeps its note, delivery rows and
  "Quote sent · …", and its popup keeps "in-app simulation".
- **Repo checks:** 443 tests, the build, `design:check`, `catalogue:check`
  and `status:check` pass. New files are prettier-clean, and touched files
  carry no new drift beyond the dictionary's existing table style.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, and the console crawl is clean.
  Chromium only, per ADR 052.

# Customer and contractor queues — 2026-10-06

ADR 062.

- **Tests:**
  - Six new tests in `roleQueues.test.ts` cover the following:
    - the customer's queue equals the glance's "Waiting on you" for every
      account;
    - quote, then pay (failure first), ahead of the assessment;
    - a declined quote leaving with its reason;
    - a question asked while a contractor is still being found;
    - an answered question;
    - the contractor's queue equals the Offers tab.
  - Eleven guards were broken on purpose, and each break fails a test.
  - Two conditions in the queue builder could not be broken without the glance
    already excluding the same case, so they were removed rather than kept
    untested.
- **Before and after (390px):**

  |                                  | today     | queue              |
  | -------------------------------- | --------- | ------------------ |
  | contractor, two offers (taps)    | 6         | 4                  |
  | customer, approve and pay (taps) | 3         | 3                  |
  | customer, sent assessment        | no way in | 2 taps to its flow |

  For the customer the gain is not taps. One request's to-dos were already
  one tap each, because the portal opens that row. The gain is that
  everything waiting is in one place, and the assessment is reachable at all.

- **Browser walk:** 390px and 1280px in both themes, with no console errors.
  - **Sarah Lin:** her assessment, Skip, then "All caught up · 0 done".
  - **Northline:** the quote; approving brings the payment next, ahead of the
    assessment. A failed payment stays and says so; reopening lands on it;
    paying moves on.
  - **Marcus:** "Review 2 offers", both accepted, and the button goes.
  - **Elias:** Decline, then "Too far", which is stored on the assignment.
  - **Priya:** the quote declined with "Too expensive". It leaves her queue,
    and the operator's queue reads "The customer declined $285 · Too
    expensive."
  - **James Carter:** a question asked from the request page; an empty reply
    is refused; the reply is stored.
  - **Seen:** the queue marks only the offer it shows as seen.
  - **Wording:** no demo or internal wording on any customer queue screen.
- **Layout:** no overflow at 320px or 360px on the quote, its reasons, the
  payment, the assessment, an offer or its reasons.
- **Repo checks:** 449 tests, the build, `design:check`, `catalogue:check`
  and `status:check` pass. New files are prettier-clean, and touched files
  carry no new drift.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, the console crawl is clean, and
  the ADR 061 customer crawl finds no demo wording. Chromium only, per
  ADR 052.

# Quick wins (batch 1) — 2026-10-07

ADR 063.

- **Tests:**
  - `countdown.test.ts`: days, hours and minutes; under an hour; rounding a
    part-minute up; null once passed.
  - `decisions.test.ts`: fallback titles named on review, from the
    suggestion or the operator's title, with an emptied title falling back;
    an ordinary title untouched; titles passed through `approveScope`.
  - `payments.test.ts`: `readyToPay` before approval, after approval, on
    completion with no, some and all visits finished, a cancelled visit, and
    once paid.
  - `pmw.test.ts`: long titles cut at a joining word, or at a word when
    none fits.
  - 16 guards were broken on purpose, and each break fails a test.
- **Browser walk:** 390px and 1280px in both themes, with no console errors.
  - Sarah opens her assessment from My bookings in the same tab, and
    "← My bookings" brings her back as Sarah; an unknown account in the URL
    is ignored.
  - In the operator queue, "Check the scope" prefills "Replace four damaged
    ceiling tiles in the second-floor"; edited, it is saved; the restricted
    task is renamed by default, and Elias's offer is headed with the new
    title.
  - Countdowns: "Expires in 2 h · …" on the offer and in the queue, "Starts
    in 1 day · …" on the job card, "· expires in 2 h" on the operator's
    card; at 25 minutes left, both turn the warning colour.
  - A pay-on-completion quote has no "Pay now" after approval and says
    payment is due on completion; once the visit is finished, "Pay now"
    appears.
- **Layout:** no overflow at 320px or 360px on the customer's record, the
  assessment page or the queue's scope screen. The only element past the
  edge is the demo bar's "Side by side", which scrolls inside that bar and
  is unchanged.
- **Repo checks:** 460 tests, the build, `design:check`, `catalogue:check`
  and `status:check` pass. New files are prettier-clean, and touched files
  carry no new drift.
- **Sweeps:** the narrow-layout probes are unchanged at 0 / 30 / 14 / 0, the
  tab-width and shrink-wrap probes are at 0, the console crawl is clean, and
  the ADR 061 customer crawl finds no demo wording. Chromium only, per
  ADR 052.

# Polish (batch 2) — 2026-10-07

ADR 064.

- **Tests:**
  - `lateChanges.test.ts`:
    - an on-time cancellation refunds;
    - a late one holds the payment and leads the queue;
    - cancelling twice refuses, and declined offers keep their status;
    - a cancelled or finished visit does not make a cancellation late;
    - waiving refunds in full, a fee refunds the rest, a larger fee charges
      the difference, nothing paid charges the whole fee (or leaves it
      `Outstanding` with no card), and settling twice refuses;
    - the call-back is two hours out, once; it leads the queue and is
      closed by a call or by moving that visit, at the accepted pay;
    - the customer's and operator's texts.
  - `inboxWording.test.ts`: each offer status for the contractor and the
    operator, a renewed offer not called withdrawn, request texts, and the
    on-the-way and moved-visit texts.
  - `pmw-migrate.test.ts`:
    - a draft gets no property until it is submitted, then is linked by
      address;
    - saved addresses come most recently booked first, ignoring drafts,
      blanks and other accounts.
  - Two existing notification tests were updated to the new wording.
  - 32 guards were broken on purpose. 30 fail a test. The two that did not
    were redundant and were removed: a zero refund, which `refundPayment`
    already refuses, and an offer-status check on a renewed offer.
- **Browser walk:** 320px, 360px, 390px and 1280px, in both themes, with no
  console errors and no element past the edge.
  - Priya reschedules within 24 hours and sees "Expect a call by …".
    Reschedule is gone. The queue opens on "Call back" with her number. The
    request page card's "Reschedule visit" opens the panel in the operator's
    words, and moving the visit closes the call.
  - Priya cancels within 24 hours. The modal names the fee, the request is
    cancelled at once, and her payment stays `Paid`. The queue opens on
    "Late cancellation" with 25% of $285 ($71) prefilled. A zero fee is
    refused inline. A $50 fee leaves the payment `Partially Refunded` by
    $235, and she sees "Late-cancellation fee: $50".
  - From the Home row, which reads "Late cancellation · $285 held · decide
    the fee", waiving on the request page refunds in full.
  - Daniel starts a new request on his one saved address, preselected. "A
    different address" shows empty fields with the street focused.
    Continuing on the saved one links his property, and no empty-address
    property is made.
- **Contrast:**
  - The sweep covers every role's screens, the request page, the decision
    and offer queues, notifications and the intake, in both themes. It
    found four colour pairs under AA before the fix and none after.
  - The walk audits each new screen at 390px in both themes.
- **Repo checks:** 488 tests, the build, `design:check`, `catalogue:check`
  and `status:check` pass. New files are prettier-clean, and touched files
  carry no new drift.
- **Sweeps:**
  - The narrow-layout probes are unchanged at 0 / 30 / 14 / 0.
  - The tab-width and shrink-wrap probes are at 0.
  - The console crawl matches `main`.
  - The ADR 061 customer crawl finds no demo wording.
  - Chromium only, per ADR 052.
