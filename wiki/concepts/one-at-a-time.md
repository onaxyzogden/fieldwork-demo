---
title: "One at a time"
type: concept
created: 2026-10-07
updated: 2026-10-16
tags: [pattern, ux, queues]
sources: 1
---

# One at a time

Every role works through what is waiting on it one item per screen. The operator's decision queue, the customer's "Waiting on you" queue, the contractor's queue and the on-site job all work this way.

## Core Idea
The order is fixed when the queue opens, so the list doesn't reshuffle under the user's thumb. Each item is still read live: anything already handled elsewhere is skipped. An item that was acted on moves to the back, so if it now needs something else (approved, so now it needs paying) it comes round again.

## Application
- `useOneAtATime` and `QueueLayer` in `src/QueueLayer.tsx`. The layer is a real modal (ADR 069): Escape closes it, focus is trapped and then returned, and the rest of the page is inert. All three queues use it; the operator's `DecisionQueue` had its own copy until ADR 079. If the button that opened a queue is gone when it closes, focus goes to the page's `main h1`. A Decline inside a queue swaps to its reasons with `useSwapFocus`, so focus follows the swap both ways.
- The operator's queue ends on "All caught up" only when nothing live is left. After skips it says "End of the queue" and how many still need a decision, under Needs action on Home (ADR 093). The customer's and contractor's queues make the same distinction through the shared `AllCaughtUp`: each passes how many still wait, and after skips it says "End of the queue" and "2 still waiting on you, on Home." or "2 offers still waiting, under Offers." (ADR 094).
- ADR 057 (today's job), ADR 058 (customer approvals), ADR 059 (operator decisions), ADR 062 (customer and contractor queues), ADR 068 (desktop side panel), ADR 079 (the operator's queue on the shared layer, and the focus fallbacks), ADR 093 (the operator's end screen), ADR 094 (the customer's and contractor's end screens).

## Connections
- [[fieldwork]]: where the pattern lives.
