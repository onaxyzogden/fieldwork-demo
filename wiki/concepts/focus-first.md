---
title: "Focus first"
type: concept
created: 2026-10-18
updated: 2026-10-18
tags: [method, ux, register, audit]
sources: 1
---

# Focus first

Fieldwork's way of designing a working screen: each person sees what is theirs to act on, in the order they act on it, with one obvious next step, and everything else reachable but out of the way. Nobody is told they are finished when they are not.

## Core Idea
The method was never written down in one place. It grew across the register audits (ADR 085–094) and the queue decisions before them, and `DESIGN.md`'s Register paragraph holds it only as a list of rules. On 2026-10-18 it was drawn out into a claude.ai account skill, `focus-first-ui`, with two modes: design a new operational screen, or audit an existing one. Every rule is stated in general terms first, with a Fieldwork screen as its worked example, so it carries over to other products.

Every run starts with intent, per role: who they are, what they come to do (one verb, the screen's remit), and the worst mistake they could make. The worst mistake is designed against first.

## The rules
1. **One decision per screen.** Pick the one decision an item needs from its state, and show it once (ADR 010).
2. **One at a time, in an order fixed when the queue opens.** Skip on every screen; items re-read live; an acted-on item goes to the back. See [[one-at-a-time]] (ADR 057–062, 079).
3. **Open on what needs attention now.** What is running, then what waits, then what is next; one item opens straight on that item (ADR 012, 068).
4. **Reachable, not in the way.** Only what needs attention sits above the fold; the rest moves one step down, behind a tab, Details or "Why this…?" (ADR 010, 059, 068).
5. **Declare the register.** Operational or persuasive. Operational: the page names itself in the nav's word, facts not slogans, values that people compare in rows, accent only for the one primary and for state, motion only as feedback (ADR 085, 087, 088).
6. **Accent means "yours to act on".** Green is done, red is an error, late is accent with a word and an icon, and a count is not an alarm. A page with nothing to act on spends no accent (ADR 089, 090, 092, 101).
7. **Order by when the person acts.** Waiting on them, dated, in hand elsewhere, drafts, closed. A record runs newest first under day headings, with the time alone per row (ADR 072, 088, 090, 101).
8. **Each role sees its own world.** No other role's working state, vocabulary or history (ADR 013, 062, 068, 100).
9. **Suggest the answer, on one button.** Verb, who, when, how much; one primary per screen (ADR 059, 062, 070, 089).
10. **The count you see is the queue you get.** Counts are built from the list they open and don't overlap (ADR 051, 062, 080, 096).
11. **Never falsely done.** An end screen says what is still waiting and where; "All caught up" only when nothing is left (ADR 093, 094).
12. **Say what happened, once, where it can be read.** One word per state, a shared fact said once, an error beside its field, a dead link not offered (ADR 026, 088, 091, 092, 095).

Friction goes only where it is needed: what reaches another person asks first; what is local gets an undo (ADR 079, 091, 093).

## Patterns
- **The work-through button.** One primary under the glance, "Work through N decisions" (operator) or its counterpart per role, opens the queue and leaves the counts and the list for looking (rules 2, 9, 10; ADR 059, 062). The owner names it the method's signature move (2026-10-18): it takes the person straight to what needs doing, past everything that is only there to observe.
- The decision queue with a side panel (rules 1, 2, 8, 9, 10).
- A glance card whose counts open what they counted (rules 6, 10).
- Needs action / All, with Needs action the default (rules 6, 7).
- The end screen that says what is still waiting (rule 11).
- The one-step job flow on a phone (rules 2, 3, 11).

## Application
- **Audit mode, first run in the repo:** the operator's Activity page, shipped as ADR 101. The h1 became "Activity" with a count line, entries are grouped by Toronto day with the time alone, the dot lost its accent, and a linked entry shows a chevron. The dry run's proposed filter by request was dropped in the full audit: each request's History tab is already that view (ADR 068).
- **Design mode, dry run:** a physiotherapy clinic's front-desk day view, outside Fieldwork, to check the rules carry over. The run added rule 6's late case and rule 7's record case.
- The skill points to `state-completeness`, `form-ux` and `feedback-and-affordance` for empty and error states, forms, and destructive actions, rather than copying them.

## Connections
- [[fieldwork]]: where the method comes from, and where it is applied.
- [[one-at-a-time]]: rule 2 in full.
