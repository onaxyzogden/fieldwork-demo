# Notification matrix

Event → recipient → channel → message → what happens when it fails.

Both pre-implementation audits ask for this and both note the same risk: the
workflow depends on people learning that something needs them, and notification
is usually treated as magic. This is what the prototype actually emits, from
`notifications.ts` and `dispatch.ts`.

## How delivery works today

Every write goes through `commit()` (`store.ts`), which calls
`deliverUpdates(previous, draft)` — a **diff** between the state before and
after. Notifications are therefore derived from what changed, not raised by
hand at each call site, so an action taken from two different screens cannot
notify twice or differently.

`emit()` writes to `state.notifications` with a `recipient` string:
`"Operator"`, `"Customer:<customerId>"` or `"Contractor:<providerId>"`. The
in-app bell reads them back through `inbox(state, recipient)`.

**There is one channel: in-app.** No email, no SMS, no push. That is a declared
production gap, already recorded in `blueprint-data.ts`.

## The matrix

| Event | Trigger | Recipient | Channel | Message | On failure |
|---|---|---|---|---|---|
| `information` | Operator asks a clarifying question | Customer | in-app | The question, with the request it belongs to | — |
| `information` | Customer replies | Operator | in-app | The reply | — |
| `request` | Request submitted or its scope changes | Operator | in-app | What changed | — |
| `offer` | Assignment created | Contractor | in-app | Job, time, pay, expiry | — |
| `offer` | Contractor accepts or declines | Operator | in-app | Which, and by whom | — |
| `declined` | Assignment declined | Operator | in-app | `<provider> declined` — the actionable alert that drives reassignment | — |
| `visit` | Visit scheduled, moved or cancelled | Operator, Customer, assigned Contractor | in-app | The change and the new time | — |
| `message` | Message sent on a visit thread | The other parties on that thread | in-app | Sender and text | — |
| `quote` | Quote sent, approved, declined or superseded | Operator, Customer | in-app | Amount and new state | — |
| `payment` | Payment recorded or fails | Operator, Customer | in-app | Amount and outcome | Failed payments keep the entry for retry |

The operator is a recipient of almost everything, deliberately: they are the
only role that can act when something stalls.

## Suppression

`notification()` in `dispatch.ts` refuses to write a second notification with
the same `assignmentId` and `kind`. Without it, the decline alert would be
re-emitted on every subsequent `reconcile()` — the duplicate-suppression both
audits ask for, at the one place it currently matters.

## What is missing

## The decided target

Channel follows **urgency**, not role — `docs/decisions.md` #11. An earlier
version of this page implied role, because the taxonomy was read off `emit()`'s
recipient strings, which are roles. A cancellation two hours out is urgent
whoever receives it.

| Class | Channels | Events above |
|---|---|---|
| Time-sensitive | SMS + in-app | `offer`, offer expiry, `visit` changes and cancellations, On My Way, a `message` or `information` reply someone is waiting on |
| Durable / documentary | Email + in-app | `quote`, `payment`, the assessment, the approval record, the completion summary |

Every event must land in one of the two, including future ones.

## What is missing

| Gap | Why it matters | Both audits |
|---|---|---|
| No channel but in-app | A contractor who is not looking at the app never learns an offer arrived, and offers expire | HandyFlow #29, PMW section H |
| No delivery state | Nothing records sent / delivered / read / bounced, so "contractor has not viewed the offer" cannot be asked | HandyFlow #29 |
| No retry or fallback | With one channel there is nothing to fall back to | HandyFlow #29 |
| No per-event preferences | Which events reach which channel is not configurable | PMW section H |
| Walkthrough events emit nothing | Sending an assessment, a customer approving or deferring a finding, and conversion to tasks are all silent — the PMW flow leans on the guest link being opened | PMW section H |

The last row is the one to fix first if PMW is going to be used for real: the
assessment is sent by giving someone a URL, and nothing tells the operator
whether it was ever opened.

## Read this with

- `docs/status-dictionary.md` — the states these events announce
- `docs/permissions.md` — who may see each notification
- `docs/decisions.md` — #11 decides the channel split; none of it is built
