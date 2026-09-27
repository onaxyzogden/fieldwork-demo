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
