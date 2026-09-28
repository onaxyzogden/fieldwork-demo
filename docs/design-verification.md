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

