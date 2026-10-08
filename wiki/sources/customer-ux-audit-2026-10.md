---
title: "Customer UX audit (2026-10)"
type: source
ingested: 2026-10-07
created: 2026-10-07
updated: 2026-10-07
source_path: "session transcript (ux-engine:ux-auditor report)"
source_type: conversation
tags: [audit, ux, customer]
---

# Customer UX audit (2026-10)

## Summary
A report-mode UX audit of the customer portal. It found 12 issues, ranked P0 to P3. All 12 are fixed.

## Key Extractions
- **P0/P1** (flows that dead-ended or failed silently, and the modal focus problems): fixed in ADR 069, PR #43.
- **P2 #5–9:**
  - two "Continue" buttons;
  - a home page whose main button didn't say what was waiting;
  - a badge that disagreed with its status line;
  - generic task titles;
  - an inert days picker under Instant Book.

  Fixed in ADR 070, PR #43.
- **P3 #10–12:** the hardcoded "SM" avatar, the breadcrumb switching between "Home" and "My bookings", and text buttons under 44 px. Fixed in ADR 073, PR #44.
- **Found while fixing it:** a hold bug in the operator scheduler, and the customer's chosen time not being offered first. Fixed in ADR 071 and ADR 072. See [[customer-chosen-time]].

## Notable Claims
- Decline in the customer queue was not seen live after ADR 073, because the seed data has no quote waiting. It shares the `.text-button` rule that was checked.

## Connections
- [[fieldwork]]
