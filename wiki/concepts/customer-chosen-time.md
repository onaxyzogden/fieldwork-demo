---
title: "The customer's chosen time"
type: concept
created: 2026-10-07
updated: 2026-10-07
tags: [scheduling, holds, principle]
sources: 1
---

# The customer's chosen time

When a Request to Book customer picks a time with a provider, that pick is a commitment the operator should honour first. It is not just one candidate among the best-route times.

## Core Idea
- `holdSlot` holds the pick for 10 minutes. The pick is kept on the request as `preferredSlot`.
- A request's own hold never hides that request's own time from the operator (ADR 071). Scheduling calls pass `forRequest`.
- `chosenStart(s, r, providerId, duration)` returns the pick only while it still fits: the same duration, and the provider is free apart from the request's own hold. Otherwise best route decides, and no message is shown (ADR 072).
- Where it fits, the operator sees the pick first: the provider is preselected, the time is listed first as "Customer’s choice", the provider card says "Customer’s choice", and the decision queue suggests that time first.

## Connections
- [[fieldwork]]: `src/model.ts`, `src/decisions.ts` and the scheduler in `src/main.tsx`.
