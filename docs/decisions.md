# Decision record

The fifteen questions `docs/audit-reconciliation.md` isolated as business calls,
and what was decided about each.

This file used to be `open-decisions.md`, a list of recommendations. It was
reviewed, five recommendations were modified, and it became this. The rename is
the point: a question document has done its job once the questions are answered,
and what needs to survive afterwards is **what we decided and why**, not what
was once proposed. A decision recorded with its reasoning and its consequences
is much harder to quietly reopen than one that lives in a chat log.

Each entry carries the same five fields:

| Field | What it is |
|---|---|
| **Decision** | What was decided. Stated as a rule, not a preference |
| **Rationale** | Why. Including the option rejected, where that is the informative part |
| **Consequences** | What follows, including what it costs |
| **Implementation impact** | What the code has to do. Names files where the work has landed |
| **Status** | Decided · Decided with modification · Deferred, and whether it is built |

**Status summary**

| # | Decision | Status | Built |
|---|---|---|---|
| 1 | Account is a person *or* an organization | Decided with modification | Yes |
| 2 | Capture the approver, defer enforcement | Decided | Yes |
| 3 | Tokenize early, authorize near service, capture at completion | Decided with modification | No |
| 4 | Card before scheduling, never before approval | Decided | Partly |
| 5 | Guest links expire, revocable, logged | Decided | No |
| 6 | No deposits in v1 | Decided | n/a |
| 7 | Materials responsibility is a per-task field | Decided with modification | Yes |
| 8 | Contractor pay is fixed on acceptance | Decided | Wording only |
| 9 | ETA only, no live tracking | Decided | Yes |
| 10 | No separate `Arrived` event | Decided | Yes |
| 11 | Channel follows urgency, not role | Decided with modification | No |
| 12 | Customer payment and contractor payout stay separate | Decided with modification | Structurally |
| 13 | Multi-property dashboards not in v1 | Decided | n/a |
| 14 | Rework is new linked work | Decided | Yes |
| 15 | Rules, not AI, for v1 classification | Decided | Yes |

---

## 1. Is a customer a person or an organization?

**Decision.** Both, in one record. `Account` carries `type: "individual" |
"organization"`. A Property belongs to an Account. Every account has at least
one `Contact`; an individual account has exactly one, which is that person.

**Rationale.** Three shapes were considered.

The original recommendation — an Organization record with an invisible one
manufactured for every homeowner — stores a fiction, and the review was right to
say so. Nobody wants "Yousef Homeowner Inc." in their database.

The review's own proposal gave individuals no Contact row at all. That is fewer
rows, but it makes *"who raised this request"* and *"who approved this work"* a
Contact sometimes and an Account other times, so every reader of those fields
branches on account type. The branch would be in dozens of places and wrong in
one of them.

Giving individuals exactly one Contact costs one row per homeowner and removes
the branch entirely. It also means the field that matters — who the human was —
is answerable uniformly, which is what decision 2 depends on.

**Consequences.** One extra row per individual account. The commercial case the
PMW product is aimed at works: an organization holds many properties, several
contacts act for it, one contact raises and another approves, and a contact who
leaves is retired with `inactiveAt` rather than deleted, so the history keeps
reading true.

**Implementation impact.** `Account` and `Contact` in `model.ts`.
`Request.customerId` and `Property.customerId` became `accountId`;
`Request.contactId` records who raised it. `migrateAccounts()` renames the field
on saved states and attributes every pre-existing request to its account's one
contact — unambiguous, because before this every account was an individual. The
seed carries one organization, Northline Property Management, with two contacts
in different roles; without it `Account.type` would have a branch nothing takes.

**Status.** Decided with modification. Built.

---

## 2. Who is authorized to approve?

**Decision.** Record who approved — name, role, timestamp — and bind it to the
exact version and amount approved. Do **not** yet enforce that they were
entitled to.

**Rationale.** The record is worthless without the identity, and capturing it
costs almost nothing. Enforcement is a different problem: it needs authentication
(decision deferred to the backend) and an authority model on top of decision 1.
Capturing now and enforcing later is safe in that order; the reverse is not,
because an enforcement rule with no recorded history has nothing to check
against.

The review added the binding requirement, and it turned out to matter more than
either of us expected — see the correction in `audit-reconciliation.md`. There
was no approval snapshot at all.

**Consequences.** An approval answers "who agreed, to what, for how much, when".
It does not answer "were they allowed to". An operator can still be handed an
approval from someone with no authority, and nothing will object.

**Implementation impact.** `Quote.approval` is written by `approveQuote()`
(`model.ts`) and freezes contact, name, role, timestamp, amount, high and the
task ids as they stood. Amounts are copied rather than read back off the quote:
a quote is superseded rather than edited, so today they agree, but "what did
they approve" must not depend on that staying true. A second approval is refused
rather than re-stamping the first. `Walkthrough.authorization` gained `role`, and
the assessment page requires it when the account is an organization — a name
alone does not identify an approver once several people could be the approver.

**Status.** Decided. Built.

---

## 3. Payment provider and the authorization model

**Decision.**

```
quote approved → payment method collected and tokenized
               → appointment and provider confirmed
               → authorization placed (timing per the rule below)
               → work completed
               → capture
```

Authorization timing is a **threshold rule, held in config**: if service falls
within the window, authorize at confirmation; otherwise store the tokenized
method and place the authorization a fixed lead before the appointment.

**Rationale.** The previous recommendation — "authorize at approval, capture at
completion" — was wrong twice over.

It contradicted decision 4. Approval precedes scheduling, and decision 4 says no
card is collected until scheduling, so there was nothing to authorize with at
the moment authorization was supposed to happen. The two sections were written
against different mental timelines and never read side by side.

It also ignored authorization lifespan. Card authorizations expire on a
timescale of days; a job booked three weeks out cannot be covered by a hold
placed at approval. Tokenize-then-authorize-near-service is the mechanism that
actually matches work scheduled in the future.

The window is a config value rather than a constant because the real expiry
behaviour varies by network and merchant category, and must be verified against
the provider's documented rules at integration rather than asserted from memory.
Stripe is the working assumption; it is not a settled premise.

**Consequences.** A stored payment method is a liability with its own handling
requirements. A deferred authorization can fail days after the customer thought
they were booked, so there must be a path for "authorization failed, appointment
at risk" — which is the failed-charge case that today has nowhere to live.

**Implementation impact.** `Authorized` and `Outstanding` are needed, plus
`Partially Refunded` for decision 12's refund cases. All three are already
written into `docs/status-dictionary.md` as struck-through recorded gaps, so
`npm run status:check` fails the build the day one is implemented without being
documented. Nothing else is built: payment is simulated.

**Status.** Decided with modification. Not built.

---

## 4. When is a card required?

**Decision.** Never to see or approve a quote. Required before the appointment
is confirmed and a provider is dispatched.

**Rationale.** Asking for a card to see a price is friction at the one step
where the customer is deciding whether to trust you at all. Asking before
someone is sent to their door is reasonable and covers the no-show case. It also
preserves the guest-first assessment flow the PMW brief asks for.

**Consequences.** Consistent with decision 3, which is the point — this pair was
the contradiction.

**Implementation impact.** The assessment page already says "A payment method is
authorized, not charged, before work is scheduled", which is the correct
sequence. The simulated checkout still collects at approval time and would move.

**Status.** Decided. Copy is right; the simulated flow is not yet.

---

## 5. Guest-link lifetime and revocation

**Decision.** High-entropy token, expiry defaulting to 30 days and configurable,
operator-revocable, access-logged, with a "send me a fresh link" path.

**Rationale.** 30 days covers a commercial approval cycle and bounds exposure.
Access logging costs one row per open and answers "did they ever look at it",
which the operator currently cannot ask at all — and which is the one question
that makes the PMW send flow supervisable.

**Consequences.** Assessments stop being permanently reachable by anyone who
ever had the URL. Customers will occasionally hit an expired link, which is why
the fresh-link path is part of the decision and not an enhancement.

**Implementation impact.** Today the link is a URL parameter with no expiry,
revocation or entropy, and the page says so on itself. Honest, but not a policy.
Needs a backend.

**Status.** Decided. Not built.

---

## 6. Deposits and material prepayment in v1

**Decision.** No. Keep the schema capable of them.

**Rationale.** Every job in scope is a single visit under half a day. Deposits
matter when the provider is out of pocket before work starts, which materials
policy (decision 7) addresses more cheaply.

**Consequences.** Larger jobs will need this before they can be taken on.

**Implementation impact.** None now. Do not let payment collapse into a single
"the customer paid" boolean, or adding deposits later means reshaping it.

**Status.** Decided. Nothing to build.

---

## 7. Materials: who supplies them?

**Decision.** A per-task field with four values: **Customer supplied**,
**Provider standard supplies**, **Operator supplied**, **To be confirmed**.
Quotes distinguish labour from significant job-specific materials. Contractor
expense reimbursement stays out of v1.

**Rationale.** The previous recommendation, "operator-supplied for v1", is clean
in the schema and wrong in the world: it makes the operator the delivery driver
for every box of screws, caulk tube and bracket for every contractor in the
region. The review is right that this should not be encoded into the domain
model.

Per task rather than per job, because a customer-supplied TV and a
provider-supplied box of anchors routinely sit in the same visit.

**Consequences.** This interacts with decision 8, and the interaction has to be
said out loud: **"Provider standard supplies" means ordinary consumables the
contractor carries, and because pay is fixed on acceptance, that pay includes
them.** Otherwise the fixed-pay promise quietly erodes on exactly the jobs that
need the most patch material. A job-specific purchase is "Operator supplied" and
appears as its own quote line, not as a contractor expense claim.

**Implementation impact.** `Task.materials` and `materialsResponsibilities` in
`model.ts`, defaulted to "To be confirmed" by `migrateAccounts()` and set by the
operator during task review. This is what turns the existing "Materials
required" visit outcome from a stall into something actionable: it now has a
field saying whose problem it is.

**Status.** Decided with modification. Built, except the quote line split.

---

## 8. Is contractor pay fixed or estimated?

**Decision.** Fixed on acceptance. The figure in the offer is what is paid if
the work is completed as scoped. A scope change is a change order with a new
figure and a new acceptance.

**Rationale.** The app says **"Your pay: $110"**. That should mean what it says.
"Estimated pay" is honest but weakens the offer at the moment you most want it
accepted, and a fixed figure is what makes a contractor answer an SMS.

**Consequences.** Scope discipline becomes the operator's problem, which is
where it belongs. Per decision 7, the figure is understood to include ordinary
consumables.

**Implementation impact.** A rule and a wording, not a schema. Change orders
need the new-figure path; today a scope change has no formal route.

**Status.** Decided. Wording already correct.

---

## 9. Live tracking, or ETA only?

**Decision.** ETA only.

**Rationale.** Live tracking drags in location permissions, privacy policy,
battery, background behaviour, retention and consent. None of it is load-bearing
for a visit whose window is measured in hours.

**Consequences.** Revisit if customers ask. They have not.

**Implementation impact.** `workStatus()` already derives `On the Way` from a
timestamp. Nothing to build.

**Status.** Decided. Built.

---

## 10. Is `Arrived` a separate event?

**Decision.** No. On My Way → Start Job → Complete.

**Rationale.** "Started" is the fact that matters for billing and for the
customer. Arrival without a start is a state nobody acts on, and a fourth button
on a phone in a doorway is a real cost.

**Consequences.** "They are here but have not begun" is not representable. That
is acceptable; it is also not currently askable, so nothing is lost.

**Implementation impact.** Three timestamps — `onWayAt`, `startedAt`,
`finishedAt`. `Arrived` is recorded as a struck-through row in the status
dictionary so the decision stays visible rather than being forgotten and
re-litigated.

**Status.** Decided. Built.

---

## 11. Notification channels

**Decision.** Channel follows **urgency**, not role.

| Class | Channels | Examples |
|---|---|---|
| Time-sensitive | SMS + in-app | Contractor offer, offer expiring, appointment change, cancellation, On My Way, a customer reply the operator is waiting on |
| Durable / documentary | Email + in-app | Assessment, quote, approval record, invoice, receipt, completion summary |

**Rationale.** The previous recommendation — SMS for contractor offers, email
for customer documents — was right in direction and too narrow, and it was
derived from the wrong axis. It came from reading `notifications.ts`'s recipient
strings, which are roles, so the taxonomy came out role-shaped. A cancellation
two hours before an appointment is urgent whoever receives it.

**Consequences.** Every event must be classified into one of the two, including
future ones. Delivery state — sent, delivered, read, bounced — becomes necessary,
because "the contractor has not seen the offer" is the question that makes the
offer expiry safe.

**Implementation impact.** One channel exists: in-app, via `emit()` writing to
`state.notifications`. Both a channel abstraction and delivery state are absent.
`notification()` in `dispatch.ts` already suppresses duplicates per assignment
and kind, which is the one place it currently matters.

**Status.** Decided with modification. Not built.

---

## 12. Merchant of record and contractor payouts

**Decision.** The customer's payment and the contractor's payout are separate
objects on separate ledgers, permanently. The **legal** merchant-of-record
designation is deferred to the accountant and is deliberately not encoded.

**Rationale.** The structural half is the important half and the code already
has it: `Payment` is against a quote, contractor pay is a figure on an
assignment, and they were never the same transaction. Different timing,
different failure modes, different tax treatment.

The review is right that "merchant of record" is a legal and commercial
designation rather than a database decision. The intended arrangement — the
customer hires the company, the company decides who fulfils — is modelled. The
label is not, and should not be, until the structure is confirmed.

**Consequences.** Refunds, chargebacks and payout timing are three separate
problems and will stay that way. `Partially Refunded` becomes necessary when one
task in a multi-task visit is disputed.

**Implementation impact.** Nothing to change; something to protect. Do not let a
future "settle the job" action collapse the two into one object.

**Status.** Decided with modification. Structurally already true.

---

## 13. Multi-property dashboards in v1

**Decision.** Not in v1. Do not block it.

**Rationale.** Decision 1 is what makes it possible. With Account in place, the
dashboard is a query rather than a rebuild.

**Consequences.** A property manager works one property at a time for now.

**Implementation impact.** `PropertyRecord` shows a single property's history.
The Account link it would group by now exists.

**Status.** Decided. Unblocked, not built.

---

## 14. Warranty and rework

**Decision.** Rework is **new linked work**, never a reopened old task. Whether
it is chargeable is adjudicated and recorded, not defaulted.

**Rationale.** If task A completed on 1 September and the customer reports a
problem on the 8th, rewriting A into an unfinished state destroys the record of
what was finished and when. Rework is new work with its own scope, cost and
outcome; the link is what keeps the property history true.

The review proposed `billable = false` at creation. That is the right field and
the wrong lifecycle: whether rework is warranty is a judgement someone makes,
sometimes days later and sometimes after looking at the property. A default
written at creation is wrong for half the cases, and silently.

**Consequences.** There is a period where rework exists and nobody has said who
pays. That is a true state, and it is better visible than guessed.

**Implementation impact.** `Task.originTaskId`, `Task.reworkReason` and
`Task.warranty` (`{ billable, decidedBy, decidedAt }`, absent until decided) in
`model.ts`. `createRework()` puts the rework on a **new request**, because
adding a task to a finished one would make `reconcile()` derive that request
back out of `Completed` — the same destruction by a different route, since
request status is computed rather than stored. `adjudicateWarranty()` records the
call and refuses a task that is not rework. There is no UI entry point yet; a
"Report an issue" control on the property record is the next increment.

**Status.** Decided. Data layer built, no entry point.

---

## 15. Classification: rules or AI?

**Decision.** Rules for v1. Remove "AI" from developer-facing material.

**Rationale.** `classify()` is weighted phrases with precedence, exclusions, a
restricted-work override and a `reason` on every match. It is explainable,
testable and correctable by an operator, and it already produces the match
reasoning the HandyFlow audit asks for. AI is a later upgrade, not a v1
dependency.

**Consequences.** New issue types need a catalogue entry rather than a model. The
catalogue is CSV, generated and checked, so that is a feature.

**Implementation impact.** Already the case. The word "AI" appears in concept
material, not in the source.

**Status.** Decided. Built.

---

## What is still open

Not decisions — work the decisions imply, in priority order:

1. ~~**Slot holds and booking idempotency.**~~ **Done, and it was not what this
   entry said it was.** "Invisible at demo scale" was wrong: `commit()` applied
   changes to the state the calling tab had rendered from, so the second of two
   tabs erased the first one's booking rather than clashing with it. Fixed by a
   version check at the write boundary, holds, and an `opKey` per booking —
   ADR 039, and the correction in `audit-reconciliation.md`.
2. **The payment lifecycle** (decision 3), including the failed-authorization
   path.
3. **Notification channels and delivery state** (decision 11).
4. **Guest-link security** (decision 5).
5. **Authorization enforcement** — decision 2 records who approved; nothing
   checks that they were entitled to.
6. ~~**Duplicate account and property detection and merge.**~~ **Done for
   properties** (ADR 041). Not for accounts, and not as an oversight:
   `accounts` is a module-level roster with no creation path, so a duplicate
   account cannot exist and a merge for one would be code nothing could reach.
   It becomes real the moment accounts are created — and the trap waiting there
   is that account ids are stored *inside strings*
   (`notification.recipient` is `"Customer:<accountId>"`), so a merge that
   rewrites only the typed fields would silently orphan the notification
   history rather than error.
7. **An audit log** for price, scope and assignment changes. `events` records
   activity but not who changed what.

## Read this with

`docs/audit-reconciliation.md` — the item-by-item audit status, including a
correction to a claim this file previously relied on ·
`docs/status-dictionary.md` · `docs/glossary.md` · `docs/permissions.md` ·
`docs/notifications.md` · `docs/design-decisions.md`
