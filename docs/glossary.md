# Glossary

One term, one object. Both pre-implementation audits name terminology collision
as a HIGH risk — *"assessment, walkthrough, finding, issue, task, job, request,
visit and work order can blur together"* — and they are right that it is worth
fixing before several people start writing code against the same words.

Written from `model.ts` and cross-checked against `blueprint-data.ts`, which
lists the same records for the in-app developer handoff.

## The chain

```
Customer → Property → Request → Task → Visit → Assignment → Quote → Payment
                   ↘ Walkthrough → Finding ↗
```

A walkthrough is the proactive way in; a request is the reactive way in. They
converge: approved findings become ordinary tasks on an ordinary request, and
everything downstream is shared. That convergence is the point — ADR 020.

## Records

| Term | Is | Is not | Key fields |
|---|---|---|---|
| **Account** | Who the work is billed to. A homeowner or a property management company, told apart by `type` | Two tables. One record covers both, so a Property belongs to an Account either way and nothing downstream branches | `id`, `type`, `name` |
| **Contact** | A person who acts for an account. An individual account has exactly one; an organization has several with roles | An account, or a login. `inactiveAt` retires one without deleting the approvals that point at them | `id`, `accountId`, `name`, `role?`, `inactiveAt?` |
| **Customer** | The *role*, not a record. The person using the customer workspace | An object. What used to be `customers` is now Account plus Contact | — |
| **Property** | A location, persisting across jobs. The thing a maintenance history belongs to | An address string on a request. Linked by foreign key, never matched by address text (ADR 018) | `id`, `customerId`, `address`, `city`, `unit?`, `postalCode?` |
| **Request** | One customer asking for work at one property, on one occasion | A job, a booking, or a unit of work. It is the container | `id`, `customerId`, `propertyId`, `status`, `mode`, `timing` |
| **Task** | One discrete piece of work: adjust the door, patch the drywall | A visit. Three tasks can be one visit, or three | `id`, `requestId`, `description`, `category`, `duration`, `reviewed`, `restricted`, `status` |
| **Visit** | One provider at one property at one time, carrying one or more tasks | A task, or a request. It is the scheduling object | `id`, `requestId`, `taskIds[]`, `providerId`, `start`, `duration`, `status`, `execution?` |
| **Assignment** | An offer of a visit to a provider, and their answer | The visit. A visit can have several assignments over its life | `id`, `visitId`, `providerId`, `status`, `pay`, `expiresAt` |
| **Quote** | A price for a request, shown to the customer | An invoice, a payment, or a list of tasks — a quote is priced against its request, and the scope is frozen only on approval | `id`, `requestId`, `amount`, `high`, `status`, `approval?` |
| **Payment** | A simulated transaction against one quote | A payout to a contractor. Contractor pay lives on the assignment | `id`, `quoteId`, `status`, `amount`, `reference` |
| **Walkthrough** | One dated assessment of one property, by an operator | A request or a visit. Nothing is scheduled by it | `id`, `assessmentId`, `propertyId`, `date`, `status`, `taxRate` |
| **Finding** | One observed issue, recorded during a walkthrough | A task. A finding becomes a task only if the customer approves it (ADR 019) | `id`, `walkthroughId`, `number`, `title`, `observed`, `proposed`, `pricing`, `price?`, `decision`, `taskId?` |
| **Provider** | Someone who can be assigned work, including the operator | A user account. It is a roster entry | `id`, `name`, `skills`, `city`, `rate`, `eligible` |
| **Execution** | What happened on a visit: timestamps and per-task outcomes | A status. `workStatus()` derives the label from it | `onWayAt?`, `startedAt?`, `finishedAt?`, `outcomes{}` |

## Words used precisely

- **Assessment** — the customer-facing document produced by a walkthrough. It
  carries an `assessmentId` (`PMW-0001`), which is what the customer and the
  guest link refer to. The *walkthrough* is the operator's working record; the
  *assessment* is what leaves the building. Same object, two audiences.
- **Outcome** — a per-task result recorded inside a visit's execution:
  `Completed`, `Needs return visit`, `Unable to complete`, `Customer declined`,
  `Materials required`. Not a status; the two must not be conflated, because
  the separation is what makes partial completion work.
- **Booking mode** — `Request.mode`, either `Instant Book` or `Request to
  Book`. The HandyFlow audit's P0 #2; it exists and is gated by
  `instantEligible()`.
- **Restricted** — `Task.restricted`, set by the classifier when a description
  trips the safety rule (`SAFE-01`). It means: not instantly bookable, and only
  assignable to an eligible provider.
- **Reviewed** — `Task.reviewed`. An operator has confirmed the classification.
  Unreviewed tasks cannot be scheduled.
- **Finding pricing vs decision** — two fields, deliberately. `pricing` is the
  operator's classification (`Quoted` or `Further Assessment Required`);
  `decision` is the customer's (`Pending`, `Approved`, `Not Now`). One enum
  would have made "you cannot approve unscoped work" a UI rule; two make it a
  data rule (ADR 019).

## Words to avoid

| Avoid | Because | Say |
|---|---|---|
| Job | Used loosely for request, task and visit | Whichever one is meant |
| Work order | No such object exists | Visit, or Task |
| Issue | Collides with the classifier's issue catalogue and with `workStatus()`'s `Issue` label | Finding, or Task |
| Booking | Ambiguous between request and visit | Request, or Visit |
| Appointment | Customer-facing word for a visit; fine in UI copy, confusing in code | Visit |

## Where the code disagrees with itself

Worth recording rather than smoothing over, because a developer will meet both
names and assume they are two things.

| Term here | `blueprint-data.ts` calls it | Why the difference |
|---|---|---|
| Request | **Service Request** | The longer name is customer-facing framing in the blueprint's prose. Same record, `Request` in every type and variable |
| Visit | **Visit / Booking** | The blueprint pairs the internal word with the customer-facing one. `Booking` is not a type and should not become one |
| Assignment | **Assignment / Offer** | Same pairing. The offer is what the contractor sees; the assignment is the record, and it outlives the offer |
| Execution | **Visit execution & messages** | The blueprint groups the message thread with execution because they share a screen. In `model.ts` they are separate fields |
| — | **Operator notification** | The blueprint names only the operator's, because that is the one its stages turn on. `notifications.ts` emits to all three roles |

Two records in this glossary have no blueprint entity at all: **Customer** and
**Provider**. The blueprint describes stages, and neither is a stage — but their
absence there is part of why the missing Organization object below went
unnoticed for so long.

## The gap this closed

Both audits raised the same thing independently — PMW section B, *"Business vs
property is under-modeled"*, and the HandyFlow open decision *"What exactly is
the unit of a 'customer': person, organization, or both?"* It was the largest
genuinely-open item, and `customers` really was a flat `{ id, name }` list.

Account and Contact now exist (decision 1 in `docs/decisions.md`). What is still
open is **enforcement**: nothing checks that the contact who approved was
entitled to. The approval records who, and that is a different thing from
deciding whether they were allowed. See `docs/permissions.md`.
