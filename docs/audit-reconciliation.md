# Pre-implementation audit reconciliation

Two audits arrived before implementation:

- **Fieldwork x PMW Pre-Implementation Product Audit** — the walkthrough
  product. Referenced below as **PMW**.
- **HandyFlow Pre-Implementation Product Integrity Audit** — the core booking
  and dispatch platform, 40 sections. Referenced as **HF**.

They overlap heavily — state machines, permissions, payments, partial
completion, notifications, edge cases — so they are merged into one list here
rather than answered twice.

## Why this document exists

Both audits say plainly what they are. The PMW audit's own scope note:

> This is a product/specification audit based on the current prototype
> screenshots and briefs, **not a source-code, database, security, or
> infrastructure penetration review.**

Neither author had the repository. Checking their claims against it changes the
picture: a substantial number are already resolved, several by a different
mechanism than proposed, and a smaller number are genuinely open.

That distinction matters more than it sounds. The HF audit opens by naming the
risk it is trying to prevent — *"the developer fills unresolved gaps with
reasonable-but-different assumptions"* — and handing a developer ~100
unqualified items produces exactly that, because they will re-open decisions
that are already made, tested and documented, and arrive somewhere different.

**Every row below cites a file or a test that was read to write it.** Where the
audits are right, this says so; where the code already answers them, this shows
how; where the audits are wrong about the current build, this says that too.

## Status key

| | Meaning |
|---|---|
| **Resolved** | Implemented and covered by tests |
| **Resolved differently** | The concern is addressed by another mechanism; an ADR records why |
| **Partial** | Real but incomplete |
| **Open** | Genuinely missing. Both audits right |
| **Declared gap** | Deliberately out of scope for a prototype, already labelled in `blueprint-data.ts` |
| **Business decision** | Not a code question. See `docs/decisions.md` |

---

## A. Lifecycle and state

| # | Item | Status | Evidence |
|---|---|---|---|
| HF 5, PMW A | "Define separate state machines" — request, task, visit, assignment, quote, payment | **Resolved differently** | All six have their own status. But request, visit and task are **derived**: `reconcile()` (`model.ts`) recomputes them from child facts on every write, inside `commit()` (`store.ts`). See `docs/status-dictionary.md` |
| PMW (CRITICAL) | "Impossible combinations such as 'Completed' work with an unpaid or unapproved scope" | **Resolved differently** | Not a transition to forbid — a value `reconcile()` will not compute. `r.status = "Completed"` requires every visit completed and every task completed; `"Confirmed"` requires quote approved, payment satisfied and an `Accepted` assignment. Guarding transitions rejects a bad state after someone asks for it; deriving means nobody can ask |
| HF 5, PMW A | "Explicit transition diagram" | **Partial** | The transitions are in `reconcile()` and documented per object in `docs/status-dictionary.md`, checked against the source by `npm run status:check`. There is no diagram |
| HF 14, PMW A | Partial completion — "a visit may contain four tasks and only three completed" | **Resolved** | Outcomes are per task inside a visit (`work.ts` `saveOutcome`, `outcomes`). Completing a visit does **not** complete its tasks; `reconcile()` marks a task `Completed` only when its own outcome says so |
| HF 14, PMW A | "No explicit Unable to Complete outcome" | **Resolved** | `work.ts:10` already lists exactly what both audits ask for: `Completed`, `Needs return visit`, `Unable to complete`, `Customer declined`, `Materials required` |
| PMW A | `Partially Completed` visit label | **Open** | Derivable from per-task outcomes but has no label, so no screen shows it and no query filters on it. Recorded as a gap in the status dictionary |
| PMW I | Visit outcome `Access Unavailable` | **Open** | Must be recorded as a per-task outcome today, which mislabels a visit-level fact |
| HF 12 | "On My Way / Arrived / Start Job are separate events" | **Resolved**, minus `Arrived` | Three timestamps — `onWayAt`, `startedAt`, `finishedAt` (`work.ts`); `workStatus()` derives the label. `Arrived` is deliberately absent — `docs/decisions.md` #10 |
| HF 15, PMW A | Return visits | **Partial** | `Needs return visit` outcome exists and keeps the task live. No flow creates the follow-up visit |
| HF 16, PMW A | Reschedule and cancellation | **Partial** | Both exist with a 24-hour policy note and operator override. Reason codes, deposit consequences and post-departure rules are not defined |
| PMW A | "No 'no issue found' resolution" | **Open** | A follow-up walkthrough cannot record that the original concern no longer exists |
| PMW A | Deferred findings go stale | **Partial** | `carryForward()` + the **Still open from earlier visits** panel move a deferred or unpriced finding into a later walkthrough and supersede the original (ADR 034). No follow-up date, no archive reason |

## B. Data model and integrity

| # | Item | Status | Evidence |
|---|---|---|---|
| HF 4 | "Preserve the correct data model — entities must not collapse" | **Resolved** | Customer → Property → Request → Task → Visit → Assignment → Quote → Payment, each its own record (`model.ts`). One request, three tasks, two visits, two providers is representable |
| PMW B | Finding-to-task traceability | **Resolved** | `Finding.taskId` and `Task` carry the link; `convertApproved()` sets it. `carriedFrom` / `resolvedBy` record lineage across walkthroughs |
| PMW (HIGH), HF "customer unit" | Business vs property under-modelled | **Resolved** | Was the largest genuinely-open item. `Account` (`type: individual \| organization`) and `Contact` now exist in `model.ts`, with `migrateAccounts()` renaming `customerId` on saved states. Authority to approve is still unenforced — `docs/decisions.md` #1, #2 |
| PMW B | Duplicate properties and contacts | **Open** | `propertyKey()` normalizes address for the one-time migration, and ADR 018 explains why it deliberately never re-derives. No detection, no merge |
| PMW B | Photo object ownership | **Partial** | Photos hang off the task or the finding that owns them. No uploader, timestamp, visibility or before/after category |
| PMW B | "History should be append-oriented" | **Partial** | `events` is append-only; quotes supersede rather than mutate. Scope and price edits overwrite |
| PMW B | Archive / deletion policy | **Open** | Nothing is soft-deleted |
| PMW B | Timezone handling | **Resolved** | ISO timestamps throughout; `torontoParts()` / `localTime()` render in the property's zone (`model.ts`) |
| PMW (HIGH) | Approval needs a version | **Resolved** (was wrongly marked Partial — see the correction below) | `Quote.approval` is written by `approveQuote()` (`model.ts`) and freezes the approver, their role, the amount and the task ids as they stood. A task added afterwards is outside what was approved, and a second approval is refused rather than re-stamping the first |

## C. Booking, scheduling and dispatch

| # | Item | Status | Evidence |
|---|---|---|---|
| HF 2 (BLOCKER) | "Every request needs an explicit `booking_mode`" | **Resolved** | `Request.mode` is `Instant Book` or `Request to Book`. `instantEligible()` (`model.ts`) gates instant on eight conditions: single task, doors category, reviewed, no open clarification, one door, not exterior, **not restricted**, and no damage/replacement language |
| HF 2 | "Never tell the customer something is confirmed while acceptance is pending" | **Resolved** | `customerStatusText()` (`main.tsx`) translates internal statuses; the customer sees `Matching you with a provider`, never `Awaiting Provider Acceptance`, and `Confirmed` only when `reconcile()` computes it |
| HF 6 (BLOCKER) | "Who first or when first?" — evaluate provider + slot together | **Resolved** | `suitableProviders()` (`suitability.ts`) returns `{ provider, match, appointments }` per candidate, sorted by whether they have appointments, then travel. The operator picks a combination, exactly as the audit proposes |
| HF 26 (BLOCKER) | Route-optimization contract | **Partial** | `slots()` accounts for provider city, travel allowance, 15-minute buffer, existing visits, working hours and customer timing preference, and returns scored options with reasons. No traffic model, no end-of-day destination, no written contract document |
| HF 7 (BLOCKER) | Slot holding and double-booking | **Resolved** | `Hold` records take a slot while someone books it, `available()` honours other requests' live holds, and `bookVisit()` re-checks availability **inside** the write rather than before it. The audit called this a blocker and was right |
| HF 31 | Idempotent booking actions | **Resolved** | Each booking press carries an `opKey`, stored on the visit it creates. A repeat returns the same visit instead of a second one |
| HF 27 | Overrun logic | **Open** | No "schedule at risk" flag |
| HF 28 | External calendar sync | **Declared gap** | Availability is managed inside the app. `blueprint-data.ts` |
| HF 9 | Operator-as-provider | **Resolved** | Yousef is a `Provider` roster entry (`model.ts`); "Do it myself" creates an ordinary assignment to that profile. Scheduling is not special-cased on a user id — though `dispatch.ts` does exclude `"yousef"` from automatic reoffers by id, which is the one place the audit's warning still bites |

## D. Classification and safety

| # | Item | Status | Evidence |
|---|---|---|---|
| HF 25 (BLOCKER) | "Licensed/restricted work requires a hard safety gate" | **Resolved** | `scopeMatch()` (`model.ts`): `qualified = !t.restricted \|\| p.eligible`, and `fits` requires `qualified`. `instantEligible()` separately refuses restricted work. An ineligible provider cannot be assigned it. Covered by `suitability.test.ts` |
| HF 23 | "Remove AI from developer-facing descriptions; rules need weighting, precedence, overrides, reasoning" | **Resolved** | `classify()` is rule-based with weighted phrases, precedence, exclusions, a restricted-work override (`SAFE-01 · restricted phrase overrides ordinary matches`) and a `reason` on every match. 137 tests in `clarification.test.ts`. The word "AI" appears nowhere in the source |
| HF 24 | Pricing suggestions: manual, rule-based or automated? | **Partial** | Fixed-price rules where they apply, operator pricing elsewhere — which is the audit's own preference. Not documented as a policy |
| HF 3 | Reconcile the three-screen customer flow; clarification inline, not another step | **Resolved** | Clarification is inline in the task card (`clarification.ts`, `CustomerIntake.tsx`); operator review catches what the customer did not answer. No separate confirm-our-understanding screen |

## E. Payments

| # | Item | Status | Evidence |
|---|---|---|---|
| PMW F (CRITICAL) | "Card on file is not sufficient payment logic" | **Open, model decided** | `Payment.status` is `Paid`, `Failed`, `Refunded`. No authorization, capture, deposit or outstanding balance. The sequence and the authorization-timing rule are decided — `docs/decisions.md` #3 — and unbuilt |
| PMW F (CRITICAL) | Failed charge path | **Partial** | `Failed` exists and the entry is preserved for retry (`blueprint-data.ts`). No `Outstanding` state, no alternate-payment request, no operator alert |
| PMW F, HF 10 | Price increases and change orders | **Partial** | A new quote supersedes the old; the customer must approve the new one. Nothing prevents an operator editing a price in place, and nothing produces a change-order record |
| PMW F | Refunds and partial refunds | **Partial** | `Refunded` exists; partial refunds do not |
| PMW F, HF 10 | Tax | **Resolved for PMW, open elsewhere** | Walkthroughs snapshot `taxRate` at send time, deliberately, so an old assessment keeps matching its own total (`pmw.ts`, ADR 021). Reactive quotes have no tax breakdown |
| HF 11 | Is contractor pay fixed or estimated? | **Decided** | Fixed on acceptance, and inclusive of ordinary consumables per decision 7. The UI already says "Your pay" and now means it. `docs/decisions.md` #8 |
| HF 34 | Merchant of record, payouts | **Decided** | The ledger separation is kept and already true in the data; the legal designation is deliberately not encoded until the structure is confirmed. `docs/decisions.md` #12 |

## F. Permissions, privacy, security

| # | Item | Status | Evidence |
|---|---|---|---|
| PMW G (CRITICAL), HF 33 | Backend-enforced permissions | **Declared gap** | No server, so nothing is enforced. The rules that exist — `canWork()`, `scopeMatch()`, `sendBlockers()`, `decide()` — are the seams a backend should enforce at. `docs/permissions.md` |
| PMW G (CRITICAL) | Guest-link security | **Declared gap, policy decided** | A URL parameter with no entropy, expiry or revocation. The page says so on itself. Policy decided — token, 30-day configurable expiry, revocation, access log — and unbuilt. `docs/decisions.md` #5 |
| HF 8 (BLOCKER) | "Contractor visibility must begin only when relevant" | **Partial** | A contractor only sees offers and assigned work — there is no browse. But `canWork()` gates *actions*, not *reads*: an assigned contractor sees the whole request record |
| PMW G | Internal vs customer-visible notes | **Resolved** | `internalNotes` and `customerNotes` are separate fields and `internalNotes` is rendered on neither the assessment nor the print document. `assessment.test.ts` asserts the printed and on-screen documents carry the same data |
| PMW G | Photo privacy and consent | **Open** | No capture guidance, no redaction |
| HF 19 | Customer authentication | **Declared gap** | None. Guest-first is the intended v1 shape |
| PMW B, HF 33 | Audit log | **Partial** | `events` records activity; it does not record who changed a price, scope or assignment |

## G. Content, states and accessibility

| # | Item | Status | Evidence |
|---|---|---|---|
| HF 30 (BLOCKER), PMW H | Empty, error and recovery states | **Largely resolved** | An error boundary and recovery screen for unusable saved state (ADR 027); a persistent banner when a write cannot be stored (ADR 026); failed payment preserved for retry; no-availability, no-eligible-provider, declined and expired all have designed states. `docs/loading-states.md`. Offline and network-loss are not designed, because there is no network |
| HF 18, PMW C | Accessibility baseline | **Largely resolved** | Every interactive control has an accessible name; every form field is labelled; contrast passes WCAG AA in both themes at 390/768/1280 (56 automated checks); `prefers-reduced-motion` honoured; status is never conveyed by colour alone — badges carry text. Not formally specified as a standard |
| PMW H, HF 37 | Terminology is not standardized | **Resolved by this pass** | `docs/glossary.md` |
| PMW H | Status labels need one canonical set | **Resolved by this pass** | `docs/status-dictionary.md`, machine-checked by `npm run status:check` |
| PMW H, HF 29 | Notifications undefined | **Resolved by this pass** | `docs/notifications.md`. The matrix also makes visible that PMW events emit nothing at all |
| PMW H | Reason codes | **Open** | Decline has a reason picker; cancellation, deferral and archive do not |
| PMW C | Too many decisions on one assessment | **Open** | A 20-finding assessment is one scrolling surface. No grouping, filtering or save-and-resume |
| HF 17 | "No scroll" as a goal, not a constraint | **Resolved** | Layout answers to the content area via container queries (ADR 024); nothing is truncated to preserve a viewport |
| PMW H | Legal/service language | **Business decision** | Draft wording is in the UI; not versioned or configurable |

## H. Process items

| # | Item | Status |
|---|---|---|
| HF 1 | Establish the source of truth hierarchy | **Resolved by this pass** — state model → this reconciliation → ADRs → prototype. 34 ADRs in `docs/design-decisions.md` record why each decision was made |
| HF 38 | Required deliverables: ERD, state diagrams, permission matrix, notification matrix, glossary | **Partial** — glossary, status dictionary, permissions and notifications now exist. No ERD or transition diagram as pictures |
| HF 38 I | Prototype covering owner-performs, contractor-performs, decline, multi-task, partial completion, quote-required, reschedule, restricted | **Resolved** | All eight are in `blueprint-data.ts` as example paths, reachable in the app at `?view=blueprint` |
| HF 39 | "Ready for implementation" test — what entity changes, what state changes, who may act, what each person sees, what happens on failure | **Answerable for most flows** — the five questions can be answered from the status dictionary, permissions matrix and notification matrix together. Not for payments, which is the one area where "we'll figure it out while coding" still applies |

---

## What is genuinely open, in priority order

1. **Organization / Contact / approval authority** — blocks commercial PMW, and gets more expensive with every week of schema built on top of it.
2. **Payment authorization model** — `Authorized`, `Outstanding`, change orders. The area where the least is decided and the most is at stake.
3. **Notification channels** — contractor offers expire unseen today. The one place the current design breaks in the field rather than in theory.
4. **Guest-link policy** — expiry, revocation, access logging.
5. **Duplicate detection and merge** — cheap now, painful after real data.
6. ~~**Slot holds and idempotency** — matters at volume, not at demo scale.~~ **Wrong on both counts, and now fixed.** It mattered at demo scale: two tabs could double-book, and worse, the second tab's write erased the first tab's booking outright. See the correction below.
7. **Audit log of material changes** — who changed a price, and when.

## What the audits got wrong about the current build

Recorded plainly, because a developer reading the audits without this page would
act on them:

- Both treat state machines as undefined. Six exist; three are derived, which is
  a stronger guarantee than the transition guards proposed.
- Both ask for task outcomes including `Unable to Complete` and `Materials
  Required`. That exact list already ships.
- HF #2 asks for an explicit `booking_mode`. It exists, and is gated by a
  predicate covering eight conditions.
- HF #25 asks for a hard restricted-work gate. It exists in two places.
- HF #23 asks for "AI" to be removed from workflow descriptions. It is not in
  the source.
- HF #30 asks for empty and error states to be designed. Most are, including two
  that were built specifically because an earlier audit found them missing.

## A second correction to this document

This page listed slot holds and idempotency as something that "matters at
volume, not at demo scale", and `decisions.md` repeated it. Both were wrong, and
a five-minute check of `store.ts` before planning the work is what showed it.

`save()` did a blind `localStorage.setItem` and `commit()` cloned the state the
calling tab had *rendered from* rather than what was on disk. So two tabs did
not merely risk a double-booking at volume — the second tab's save silently
erased the first tab's, today, with two tabs and no load at all. The reproduction
is in `src/concurrency.test.ts` and failed on the build before the fix:

```
× does not let the second tab's write erase the first tab's
    → expected '' to be 'written by tab A'
```

The customer-visible symptom was not a clash an operator would notice. It was a
confirmed appointment disappearing. Writing "not at demo scale" about code I had
not opened is the same failure mode as the `taskIds` claim below: an assertion
about the source that the source did not support.

## A correction to this document

The first version of this page claimed, in this section, that the PMW audit was
wrong about approval having no version — on the grounds that *"a `Quote` carries
`taskIds`"*.

It does not. `taskIds` is a field on **Visit**, not Quote. A quote was priced
against its whole request and carried no scope of its own, no approver and no
frozen amount. The audit was right and this document was wrong, in the one
section reserved for saying the audit was wrong.

The claim was repeated in `glossary.md`, `status-dictionary.md` and the pull
request description before anyone caught it. What caught it was not re-reading
the document — it was opening `model.ts` to add a field next to the one I had
described, and finding the description did not match. Every row here cites a
file; this one cited a file that says something else.

`Quote.approval` now exists and the row above is Resolved. The rest of the
reconciliation has been re-checked against the source for the same failure mode,
which is how the `Superseded` half of the original claim survived: quotes really
are superseded rather than edited.

## Read this with

`docs/glossary.md` · `docs/status-dictionary.md` · `docs/permissions.md` ·
`docs/notifications.md` · `docs/decisions.md` · `docs/design-decisions.md`
(34 ADRs) · the in-app blueprint at `?view=blueprint`
