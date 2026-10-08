---
title: "Platform UX audit (2026-10)"
type: source
ingested: 2026-10-08
created: 2026-10-08
updated: 2026-10-08
source_path: "session transcript (ux-engine:ux-auditor report, four phases)"
source_type: conversation
tags: [audit, ux, operator, contractor, customer, accessibility]
---

# Platform UX audit (2026-10)

## Summary
A report-mode UX audit of the whole platform, run on `vite preview` after ADR 078 and backed by a code read and a mechanical pass. There is one report per role (Operator, Contractor, and a re-check of Customer), plus a cross-cutting report on the shell. No source was changed by the audit itself. **The 8 P1s are fixed in ADR 079**, each pinned by a screen test. The P2s and P3s are open.

The 12 fixes from [[customer-ux-audit-2026-10]] (ADR 069, 070 and 073) all hold, with no regressions.

## Key Extractions

### Operator
| # | Sev | Finding |
|---|---|---|
| 1 | P1 | `DecisionQueue` isn't on `QueueLayer`: no Escape, no Tab trap, the page behind isn't inert, and focus goes to `<body>` on close. **Fixed, ADR 079** |
| 2 | P2 | The one-tap Offer leaves no record of what was sent, and no Undo |
| 3 | P2 | Three counts of the same work disagree (5, 6 and 4) |
| 4 | P2 | On mobile, the request detail's heading sits at y≈680, below the fold |
| 5 | P2 | "← Back to Home" over a request's detail leaves Requests |
| 6 | P2 | Contractors and Activity have no active sidebar item |
| 7 | P3 | "Needs Attention" and "Needs Action" name the same bucket |
| 8 | P3 | Unpluralised counts |
| 9 | P3 | The Details summary is 26 px tall |
| 10 | P3 | Activity entries can't be opened |

Also: Demo settings appears twice, and the nav count has no text alternative.

### Contractor
| # | Sev | Finding |
|---|---|---|
| 1 | P1 | Availability's Save withdraws open offers with no warning and no undo. **Fixed, ADR 079:** a dry run counts them and asks first |
| 2 | P2 | The glance shows a finished job as next |
| 3 | P2 | After Accept, the waiting copy still asks for acceptance, and the badge says "Proposed" |
| 4 | P2 | A photo can't be removed in `JobMode` |
| 5 | P2 | Unsaved Availability changes are lost silently |
| 6 | P3 | Two different Decline UIs |
| 7 | P3 | Chips are 31 px tall |
| 8 | P3 | Unpluralised counts |
| 9 | P3 | "0 photos" is ambiguous |
| 10 | P3 | "Remove" buttons don't say what they remove |

### Customer (re-check)
| # | Sev | Finding |
|---|---|---|
| 1 | P1 | The quote card's Decline is one tap, with no confirmation, reason or undo (`CustomerWorkspace.tsx:240`). **Fixed, ADR 079:** it asks why, as the queue does |
| 2 | P1 | The charge Decline is the same (`CustomerWorkspace.tsx:179`). **Fixed, ADR 079:** it confirms, with Keep it focused |
| 3 | P2 | After a decline, the badge says "Quote ready" and the line still mentions approval and payment. The reconciler (`model.ts:1613–1622`) maps any unapproved quote, Declined included, to "Awaiting Quote Approval" |
| 4 | P2 | Intake step changes drop focus to `<body>`. **Fixed, ADR 079**, with cross-cutting 1 |
| 5 | P2 | Instant Book's payment shows no confirmation |
| 6 | P2 | Continue with an empty task gives only a toast (`CustomerIntake.tsx:342`) |
| 7 | P3 | Two primary buttons on home |
| 8 | P3 | The provider is named before they accept |
| 9 | P3 | A task's "Remove" doesn't say which task |

Also: a toast persists across an identity switch.

### Cross-cutting
| # | Sev | Finding |
|---|---|---|
| 1 | P1 | Focus drops to `<body>` platform-wide: `QueueLayer` returns focus only if the trigger is still connected, the queues' decline swap removes it, and intake steps don't move it. **Fixed, ADR 079:** the `main h1` fallback, `useSwapFocus`, and each step's h1 |
| 2 | P1 | Reset all demo data has no confirmation (`Shell.tsx:438`). **Fixed, ADR 079** |
| 3 | P1 | Remove finding has no undo (`Walkthroughs.tsx:528`). **Fixed, ADR 079:** an inline Undo |
| 4 | P1 | The role switch marks the current role with `.chosen` only, with no `aria-pressed` (`Shell.tsx:238`). **Fixed, ADR 079** |
| 5 | P2 | Toasts: errors carry the success icon, the `role=status` region mounts only with a toast, and the 3.5 s timer is never cleared, so a new toast can vanish early (`Workspace.tsx:243`, `useWorkspaceState.tsx:182–193`) |
| 6 | P2 | The sidebar says "YH Yousef's workspace" for every role (`Shell.tsx:145`) |
| 7 | P3 | Demo-bar targets are 37 and 31 px |
| 8 | P3 | The brand link is `href="#"` |
| 9 | P3 | The `job-details` summary is 26 px |

Clean: contrast in both themes on every screen checked, the modals, focus styles, Assessment and Recovery. Blueprint has P3s only.

## Recommended order
Steps 1 and 2, and the role switch, are done in ADR 079. Friction there is a confirmation where the effect reaches someone else, and an inline Undo where it stays in a draft, rather than one undoable toast: a snapshot undo would retract notifications and holds already sent. The Offer's undo stays open.

1. **Focus always lands somewhere.** `QueueLayer` falls back to the queue's own heading or the page's h1. Move `DecisionQueue` onto `QueueLayer`. Intake moves focus to each step's h1.
2. **Destructive actions get friction.** One undoable toast for Decline (quote and charge), Remove finding, Availability's withdrawals and the Offer. Reset all demo data gets a confirmation.
3. **Honest state and announcements.** A Declined quote gets its own status and wording in `customerText.ts`. Toasts get a tone, an always-mounted live region and a cleared timer. The role switch gets `aria-pressed`.

## Notable Claims
- An earlier draft said the `DecisionQueue` "probably" uses the decline swap too. It doesn't: only the customer and contractor queues do (`CustomerQueue.tsx:331`, `ContractorQueue.tsx:154`).
- A scripted `el.click()` doesn't move focus. The focus-loss findings were re-checked with `el.focus()` first.
- `decisions.ts:304` offers the operator "revise" for a Declined quote, which is the right next step. Only the customer's side reads it wrong.

## Connections
- [[fieldwork]]
- [[customer-ux-audit-2026-10]]: the earlier customer audit, re-checked here
- [[one-at-a-time]]: the queues and `QueueLayer` behind finding 1
