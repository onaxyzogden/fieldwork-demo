---
title: "Wiki Index"
type: index
updated: 2026-10-18
---

# Wiki Index

A catalog of every wiki page. Read this first at the start of each session. Conventions are in [[SCHEMA]]. Product decisions (ADR 001–103) are in `docs/design-decisions.md`.

## Entities

| Page | Summary |
|---|---|
| [[fieldwork]] | The prototype: its stack, gates, deploy, source map, current status and history |

## Concepts

| Page | Summary |
|---|---|
| [[focus-first]] | The design method: 12 rules, five patterns, design and audit modes; also a claude.ai skill, `focus-first-ui`. Rule 5 is the **register** (operational or persuasive), Fieldwork's own and not a layer of the house methodology (ADR 085–094, 101–103) |
| [[one-at-a-time]] | Every role's queue shows one item per screen, in a fixed order, read live (ADR 057–062, 068–069) |
| [[customer-chosen-time]] | Holds and `preferredSlot`: the customer's pick comes first while it still fits (ADR 071–072) |

## Decisions (process and tooling only)

| Page | Summary |
|---|---|
| [[2026-10-07-wiki-in-repo]] | The wiki lives in this public repo. Product ADRs stay in `docs/` |

## Sources

| Page | Summary |
|---|---|
| [[customer-ux-audit-2026-10]] | 12 findings, P0–P3, all fixed across ADR 069, 070 and 073 |
| [[platform-ux-audit-2026-10]] | Every role plus the shell: 8 P1s (focus loss, destructive actions with no friction, the role switch's state), all fixed in ADR 079. P2s fixed in ADR 080. P3s and the Offer's Undo fixed in ADR 083 |
| [[accessibility-audit-2026-10]] | WCAG 2.1 AA, every role, both themes: 0 critical, 6 major (field borders, colour-only selection, unexposed state, two dialogs without a trap, toasts that time out), 17 minor. Text contrast and reflow pass. Majors fixed in ADR 081, minors in ADR 082 |

## Synthesis

None yet.
