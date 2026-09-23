# Open decisions

The questions neither the code nor I can settle. Both audits list these; this
page adds what the prototype currently assumes, what depends on the answer, and
a recommendation — so the decision starts from a position rather than a blank
page.

A recommendation is not a decision. Every one of these is yours.

---

## 1. Is a customer a person or an organization?

**Today:** a person. `customers` is `{ id, name }` (`model.ts`). No Account, no
Contact, no authority relationship.

**Depends on it:** who may approve work; whether one company can hold several
properties; whether a property can have several managers; duplicate detection;
who keeps access when a contact leaves.

**Recommendation — model both, use one.** Add `Organization` and `Contact`, and
let a Property belong to an Organization while a Request is raised by a Contact.
For residential work the organization is implicit and never shown. Retrofitting
this after a backend exists means migrating every foreign key; adding it now
costs a type and a migration function, which `migratePmw()` already demonstrates
the shape of.

**If deferred:** PMW is unusable for commercial property management, which is
the market the walkthrough feature is aimed at.

---

## 2. Who is authorized to approve?

**Today:** anyone holding the assessment URL. There is no approver identity
beyond a typed name on the authorization line.

**Depends on it:** whether an approval is binding; what happens when two
managers disagree; what happens when the person who approved has left.

**Recommendation — capture the approver, defer the enforcement.** Record who
approved (name, role, timestamp) on the approval snapshot now, since it costs
almost nothing and the record is worthless without it. Enforcing *designated*
authority needs decision 1 first.

---

## 3. Payment provider, and the authorization model

**Today:** simulated. Payment has `Paid`, `Failed`, `Refunded` — no
authorization, no capture, no outstanding balance.

**Depends on it:** when a card is required; deposits; change orders; failed
final charges; refunds; the whole commercial flow.

**Recommendation — authorize at approval, capture at completion.** It is the
model that matches the work: the customer commits when they approve a scope and
price, and money moves when the work is done. It also gives the failed-charge
path somewhere to live, which today it does not have. Provider choice is
secondary; Stripe supports this shape and is the default assumption unless
there is a reason otherwise.

**Needed either way:** `Authorized` and `Outstanding` statuses. They are already
written into `docs/status-dictionary.md` as recorded gaps, so `status:check`
will notice when they arrive.

---

## 4. When is a card required?

**Today:** at simulated checkout, after quote approval.

**Recommendation — before scheduling, not before approval.** Asking for a card
to see a price is friction on the one step where the customer is deciding
whether to trust you. Asking before a contractor is dispatched is reasonable
and protects the no-show case. For PMW this also keeps the guest-first flow the
brief asks for.

---

## 5. Guest-link lifetime and revocation

**Today:** a URL parameter with no expiry, no revocation, no entropy. The page
says so on itself, which is honest but is not a policy.

**Depends on it:** how long an assessment stays openable; what happens when a
contact leaves; whether photos of a property's weaknesses are reachable by
anyone who has ever had the link.

**Recommendation — high-entropy token, 30-day expiry, operator-revocable, and a
"send me a fresh link" path.** Thirty days is long enough for a commercial
approval cycle and short enough to bound exposure. Add access logging at the
same time; it costs one row per open and answers "did they ever look at it",
which the operator currently cannot ask.

---

## 6. Deposits and material prepayment in v1?

**Today:** neither exists.

**Recommendation — no.** Every job in the seed data is a single visit under
half a day. Deposits matter when the provider is out of pocket before work
starts; materials policy matters more (decision 7) and is cheaper.

---

## 7. Materials: included, reimbursed, or customer-supplied?

**Today:** undefined. Contractor pay is a flat figure on the assignment; there
is no material line anywhere.

**Depends on it:** contractor compensation, change orders, invoice shape, tax.

**Recommendation — operator-supplied for v1, with an explicit allowance line on
the quote.** It avoids contractor expense claims, keeps one invoice, and makes
the "materials required" outcome — which already exists in `work.ts` — mean
something actionable rather than just a stall.

---

## 8. Is contractor pay fixed or estimated?

**Today:** the contractor sees **"Your pay: $110"**, which reads as a
commitment, and nothing defines when it locks.

**Recommendation — fixed on acceptance.** Say "Your pay" and mean it: the
figure in the offer is what is paid if the work is completed as scoped. If the
scope changes, that is a change order with a new figure and a new acceptance.
The alternative — "Estimated pay" — is honest but makes the offer weaker at the
moment you most want it accepted.

This one is cheap to act on now: it is a wording and a rule, not a schema.

---

## 9. Live tracking, or ETA only?

**Today:** ETA only. `workStatus()` reports `On the Way` from a timestamp;
there is no GPS.

**Recommendation — keep ETA only.** The HandyFlow audit lists what live
tracking drags in — permissions, privacy, battery, background behaviour,
retention, consent — and none of it is load-bearing for a handyman visit where
the window is measured in hours. Revisit if customers ask, not before.

---

## 10. Is `Arrived` a separate event in v1?

**Today:** no. Three timestamps — `onWayAt`, `startedAt`, `finishedAt`.

**Recommendation — no, and say so.** "Started" is the fact that matters for
billing and for the customer. Arrival without a start is a state nobody acts on,
and a fourth button on a phone in a doorway is a real cost. Recorded as a gap in
the status dictionary so the decision is visible rather than forgotten.

---

## 11. Notification channels

**Today:** in-app only. No email, SMS or push.

**Depends on it:** whether contractor offers expire unseen — which is the one
place the current design actually breaks in the field.

**Recommendation — SMS for contractor offers, email for customer documents.**
A contractor is not looking at a dashboard; an offer with an expiry needs to
reach a phone. A customer receiving an assessment needs something durable and
forwardable. In-app for everything else. This is the highest-value item on this
page after the payment model.

---

## 12. Merchant of record, and contractor payouts

**Today:** not modelled. `Payment` is against a quote; contractor pay is a
number on an assignment. They are deliberately not the same transaction.

**Recommendation — platform as merchant of record, payouts as a separate
ledger.** The separation already exists in the data and is worth preserving:
the customer's payment and the contractor's payout have different timing,
different failure modes and different tax treatment. Do not let them collapse
into one object.

---

## 13. Multi-property dashboards in v1?

**Today:** one property at a time. `PropertyRecord` shows a single property's
history.

**Recommendation — not in v1, but do not block it.** Decision 1 is what makes
it possible; if Organization exists, the dashboard is a query, not a rebuild.

---

## 14. Warranty and rework

**Today:** `Completed` is terminal. There is no reopen, no dispute, no rework
path.

**Recommendation — a linked new task, not a reopened old one.** Rework is new
work with its own scope, cost and outcome; reopening destroys the record of
what was completed and when. Link it to the original so the property history
tells the truth. A minimal "Report an issue" entry point is enough for v1 — but
the state model should carry the link from the start, because adding lineage
retrospectively is guesswork.

---

## 15. Classification: rules or AI?

**Today:** rules. `classify()` is weighted phrases with precedence, exclusions,
a restricted-work override and a `reason` on every match.

**Recommendation — keep rules, and remove "AI" from developer-facing
descriptions.** The HandyFlow audit is right that the word appears in concept
material and not in the build. The rule engine is explainable, testable and
correctable by an operator, and it already produces the match reasoning the
audit asks for. AI is a later upgrade, not a v1 dependency.

---

## Where these came from

PMW audit: "Open Product Decisions Requiring an Explicit Answer".
HandyFlow audit: sections 2, 10, 11, 13, 19, 28, 29, 34, 35, 38.
Item-by-item status in `docs/audit-reconciliation.md`.
