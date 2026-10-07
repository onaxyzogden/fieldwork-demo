# Status dictionary

Every status value in Fieldwork: which object owns it, whether it is **stored or
derived**, what causes it, and who sees it.

Both pre-implementation audits ask for this. Both also assume every status is a
stored field guarded by transition rules. In this codebase most are not, and the
difference is the most important thing on this page — so it is the second column.

**This file is checked by `npm run status:check`**, which runs in `build` and
`test`. A status that exists in the code but not here fails the build, and so
does one listed here that no code produces. The dictionary cannot quietly drift
from the app; if you add a status, you say what it means in the same commit.

---

## The three layers

**1. Stored.** A `status` string on a record in `State`. Seven objects have one:
Request, Task, Visit, Assignment, Quote, Payment, Walkthrough.

**2. Derived by `reconcile()`** (`model.ts`). Runs on every write, inside
`commit()` (`store.ts`). It recomputes Request, Visit and Task status from the
facts underneath them — quotes, payments, assignments, per-task outcomes — and
**overwrites the stored field**. So those three are stored in the sense that
they are persisted, and derived in the sense that nothing may set them directly
and expect the value to survive the next write.

This is why the combination both audits name as CRITICAL — *"'Completed' work
with an unpaid or unapproved scope"* — is not a transition this system has to
forbid. It is a value `reconcile()` will not compute. Guarding transitions
rejects the bad state after someone asks for it; deriving the value means nobody
can ask.

**3. Derived for display only.** `workStatus()`, `dispatchStatus()` and
`findingState()` return a label from current facts and store nothing. Two
records with identical fields always produce the same label, and a stale label
cannot exist.

A fourth thing that is *not* a status: `customerStatusText()`,
`customerQuoteText()`, `customerVisitText()` and `customerAssessmentText()`
(`customerText.ts`) translate
internal statuses into customer language, on badges and in the customer's
notifications alike (ADR 061). The colour still keys off the real status; only
the words change.

| Customer sees | Internal status |
|---|---|
| `In review` | Needs Review |
| `Matching you with a provider` | Awaiting Provider Acceptance |
| `Quote ready` | Awaiting Quote Approval |
| `Payment due` | Awaiting Payment |
| `Waiting on your reply` | Information requested |
| `Awaiting your approval` | Quote `Sent` |
| `Awaiting confirmation` | Visit `Proposed` |
| `On the way` | Visit `On the Way` |
| `In progress` | Visit `In Progress` |
| `Follow-up needed` | Visit `Issue` |
| `Being prepared` | Walkthrough `Draft` |
| `Approved` | Walkthrough `Converted` |

This is the mechanism behind the HandyFlow audit's rule *"never tell the
customer something is confirmed while provider acceptance is still pending"* —
the customer is never shown the operator's vocabulary at all. Anything without
a row here is shown to the customer unchanged.

---

## Request

Stored on `Request.status`. **Written only by `reconcile()`** except the initial
`"Draft"` and the explicit customer/operator terminal actions.

| Status | Set by | Condition | Customer sees |
|---|---|---|---|
| `Draft` | intake | Created, not yet submitted | *(not shown; the request is still being written)* |
| `Submitted` | `reconcile()` | Submitted, nothing else true yet | `Submitted` |
| `Needs Review` | `reconcile()` | Any task unreviewed or needing clarification | `In review` |
| `Information requested` | `reconcile()` | Operator asked a question, customer has not replied | `Waiting on your reply` |
| `Awaiting Quote Approval` | `reconcile()` | A live quote exists, not yet approved | `Quote ready` |
| `Awaiting Payment` | `reconcile()` | Quote approved, payment required and not yet `Paid` | `Payment due` |
| `Awaiting Provider Acceptance` | `reconcile()` | Visit exists, no accepted assignment yet | `Matching you with a provider` |
| `Confirmed` | `reconcile()` | Scope reviewed, quote and payment satisfied, assignment accepted | `Confirmed` |
| `Completed` | `reconcile()` | Every visit completed and every task completed | `Completed` |
| `Cancelled` | customer or operator | Explicit cancellation | `Cancelled` |
| `Declined` | operator | Operator declined the request | `Declined` |

`Draft`, `Cancelled`, `Declined` and `Completed` are terminal to `reconcile()` —
it returns early rather than recomputing them (`model.ts`).

## Task

Stored on `Task.status`, recomputed by `reconcile()` from the visit's per-task
outcomes. Four values, lower-cased for two of them because they describe
where the task sits rather than naming a lifecycle stage.

| Status | Condition |
|---|---|
| `Completed` | The visit's execution records outcome `Completed` for this task |
| `Not done` | A finished visit left it undone and the operator closed it (ADR 065) |
| `assigned to visit` | On a live visit that has not finished |
| `unassigned` | Not on any unfinished visit — including a task a finished visit left undone, until a return visit holds it |

Both audits propose a longer task lifecycle — `Open`, `Needs Clarification`,
`In Progress`, `Needs Return Visit`, `Unable to Complete`. Those are not task
*statuses* here. Clarification is a property of the task's answers
(`needsClarificationReview()`), progress belongs to the visit, and the last two
are **outcomes**, recorded per task inside a visit. That separation is what
makes partial completion work; see the outcome table below.

The first draft of this page listed `Open` as the default, copied from the
audit's suggested lifecycle rather than read from the source. `status:check`
rejected it on the first run.

## Visit

Stored on `Visit.status`; `reconcile()` keeps it in step with the request.

| Status | Condition |
|---|---|
| `Proposed` | Created, fulfillment conditions not yet met |
| `Confirmed` | Request is ready — scope, quote, payment and acceptance all satisfied |
| `In Progress` | Contractor started work (preserved by `reconcile()`, not overwritten) |
| `Completed` | Contractor completed the visit (likewise preserved) |
| `Cancelled` | Visit removed; its tasks return to the pool |

## Assignment (contractor offer)

Stored on `Assignment.status`. The one lifecycle in the app that is a true
stored state machine, because it records what a *person* did and when.

| Status | Set by | Notes |
|---|---|---|
| `Offered` | operator | Carries `expiresAt` |
| `Accepted` | contractor | Gates `canWork()` |
| `Declined` | contractor | May trigger a reoffer when the operator has enabled it |
| `Expired` | `reconcile()` | `expiresAt <= clock`; does **not** auto-reoffer |
| `Reassigned` | operator | Superseded by a new offer |

## Charge

Stored on `Charge.status` (ADR 065): an additional charge for a return visit
whose scope changed, which the customer approves and pays before the return
visit is offered.

| Status | Set by | Notes |
|---|---|---|
| `Sent` | `requestExtraCharge()` | With the customer; the request waits on them |
| `Approved` | `approveCharge()` | Paid; the return visit is booked, or goes back to the operator if its time has gone |
| `Declined` | `declineCharge()` | Back to the operator, to close the task or come back at no charge |

## Quote

Stored on `Quote.status`. A quote is priced against its **request**, not against
a list of tasks — an earlier version of this page said otherwise, and was wrong.
The approval snapshot lives on `Quote.approval`, written by `approveQuote()` at
the moment of approval and never rewritten.

| Status | Notes |
|---|---|
| `Draft` | Not sent |
| `Sent` | With the customer |
| `Approved` | Customer approved this scope at this price |
| `Declined` | Customer declined |
| `Superseded` | Replaced by a newer quote; excluded from every "live quote" lookup |

## Payment

Stored on `Payment.status`.

The sequence is approve → method stored → confirm → authorize near service →
capture at completion (`docs/decisions.md` #3, ADR 044). **No money moves**: the
whole lifecycle is simulated, and `payments.ts` says so at the top.

| Status | Set by | Notes |
|---|---|---|
| `Authorized` | `authorizePayment()` | A hold. Money has **not** moved. Placed at confirmation when service is within `AUTHORIZE_WITHIN_DAYS`, otherwise scheduled for that many days before |
| `Paid` | `capturePayment()` | Captured at completion. The simulated checkout still writes this directly, which is the shortcut the demo scenarios take |
| `Failed` | simulated checkout | A charge that never started |
| `Outstanding` | `capturePayment(…, fail)` | The work was done and the capture failed. Deliberately not `Failed`: somebody owes for finished work, which is the operator's to chase |
| `Refunded` | `refundPayment()` | The whole amount went back |
| `Partially Refunded` | `refundPayment(…, amount)` | Some of it did. Its own status rather than `Paid` with a number beside it, because an operator filters on it |

All six were recorded here as struck-through gaps before they existed, and
`status:check` refused the build the moment `Authorized` appeared in the source
with this table unchanged. That is the mechanism working: the rows below are
what remain unimplemented.

| Status | Why it should exist |
|---|---|
| ~~Disputed~~ | A chargeback is neither a refund the operator chose nor an outstanding balance they can chase |

See `docs/decisions.md`.

## Walkthrough (PMW)

Stored on `Walkthrough.status`; the only one declared as a TypeScript union
(`model.ts`) rather than a bare `string`.

| Status | Set by | Gate |
|---|---|---|
| `Draft` | `createWalkthrough()` | — |
| `Sent` | `sendWalkthrough()` | Refuses unless `sendBlockers()` is empty: every finding needs a title, and either a price or the further-assessment classification |
| `Converted` | `convertApproved()` | Approved findings became tasks on a request |

---

## Derived labels (stored nowhere)

### `workStatus(visit)` — `work.ts`

Falls through to `visit.status` when none of the execution facts apply.

| Label | Condition |
|---|---|
| `Issue` | An unresolved task outcome needs operator follow-up |
| `Completed` | `execution.finishedAt` set |
| `In Progress` | `execution.startedAt` set |
| `On the Way` | `execution.onWayAt` set |
| *(visit status)* | None of the above |

`On the Way`, `In Progress` and `Completed` are three distinct timestamps, not
one field — which is the HandyFlow audit's item 12. `Arrived` is deliberately
absent; see `docs/decisions.md`.

### `dispatchStatus(state, visit)` — `dispatch.ts`

The operator's reassignment banner. Empty string means nothing to show.

| Label | Condition |
|---|---|
| `Replacement offer pending` | A fresh offer is out after a decline or expiry |
| `Offer expired · Needs reassignment` | Last assignment expired |
| `Contractor declined · Needs reassignment` | Last assignment declined |

### `findingState(state, finding)` — `pmw.ts`

| Label | Condition |
|---|---|
| `Further assessment required` | Pricing is `Further Assessment Required`, not yet superseded |
| `Superseded` | Carried forward into a later walkthrough |
| `Deferred` | Customer chose "Not now" |
| `Pending decision` | Sent, no decision yet |
| `Approved` | Approved; no task yet, or a task with no live visit |
| `Scheduled` / `On the Way` / `In Progress` / `Issue` | Borrowed from `workStatus()` of the visit carrying its task |
| `Completed` | Its task is complete |

### Task outcomes — `work.ts`

Not a status. Recorded per task inside a visit, so one visit can finish with a
different answer for each task. This is both audits' "partial completion" and
"Unable to Complete" requirement, and the list already matches what they ask
for.

| Outcome | Meaning |
|---|---|
| `Completed` | Done; `reconcile()` marks the task `Completed` |
| `Needs return visit` | Attempted, not finished; the task stays live |
| `Unable to complete` | Could not be attempted or finished |
| `Customer declined` | The customer declined this task on site |
| `Materials required` | Blocked on parts |

Completing a visit does **not** mark its tasks complete. `reconcile()` marks a
task `Completed` only when its own outcome says so, and `workStatus()` reports
`Issue` while any task carries an outcome needing operator follow-up.

---

## Recorded as missing

Struck-through rows above, plus these. Same rule: the check fails if one
appears in the source without its row being updated.

| Status | Object | Why it should exist |
|---|---|---|
| ~~Access Unavailable~~ | Visit | The contractor arrived and could not get in. Today this has to be recorded as a per-task outcome, which mislabels a visit-level fact |
| ~~Partially Completed~~ | Visit | Derivable from per-task outcomes, but has no label, so no screen can show it and no query can filter on it |
| ~~Arrived~~ | Visit execution | `On the Way`, `In Progress` and `Completed` are three timestamps; arrival is not separately recorded. The HandyFlow audit asks whether V1 needs it — see `docs/decisions.md` |
