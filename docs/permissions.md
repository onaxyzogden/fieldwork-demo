# Permissions

Who may do what, and — more importantly for a prototype — **where the check
lives**.

Both audits raise the same warning, and it is the right one: *"without a
permission matrix, UI hiding alone can become the access-control model."* That
is exactly what this prototype is. It has no server, so nothing here is
enforced against an attacker. The value of this page is naming the seams a
backend would enforce at, so the rules are not reinvented later from screens.

## The honest statement first

**There is no authentication and no authorization.** Roles are a demo switcher
in the top bar. Any visitor can be any role. The guest assessment link is a URL
parameter and the page says so on itself. This is recorded as a production gap
in `blueprint-data.ts` and is not an oversight.

What *does* exist is a set of functions that decide whether an action is
allowed, used by the UI to hide or refuse. Those are the seams: a backend
should call the same rules, and the UI should stop being the only caller.

## Matrix

`Yes` = the app permits it. `—` = no affordance exists. Every row is
client-side today.

| Action | Guest (assessment link) | Customer | Operator | Contractor | Enforced by |
|---|---|---|---|---|---|
| View an assessment | Yes, with the id | Yes | Yes | — | `assessmentId` lookup; `Draft` is refused |
| Approve / defer a finding | Yes | Yes | — | — | `decide()` — refuses anything not `quotable()` |
| Edit a finding's scope or price | — | — | Yes | — | Walkthrough must be `Draft` |
| Send an assessment | — | — | Yes | — | `sendWalkthrough()` → `sendBlockers()` |
| Convert approved findings to work | — | — | Yes | — | `convertApproved()` |
| Submit a request | — | Yes | Yes | — | intake validation |
| Review / reclassify a task | — | — | Yes | — | `t.reviewed` gates scheduling |
| Choose a provider and create a visit | — | — | Yes | — | `scopeMatch()`, `available()` |
| Assign restricted work | — | — | Only to an eligible provider | — | `scopeMatch()`: `qualified = !t.restricted \|\| p.eligible` |
| Accept / decline an offer | — | — | — | Yes, if it is theirs | `respondToOffer()` matches `providerId` |
| Start / progress / complete work | — | — | — | Yes, if assigned | `canWork()` |
| Record a task outcome | — | — | — | Yes, if assigned | `canWork()` |
| Change customer price | — | — | Yes | — | quote creation is operator-only |
| Change contractor pay | — | — | Yes | — | offer creation is operator-only |
| Approve a quote | — | Yes | — | — | `approveQuote()` — records the contact, role, amount and scope, and refuses a second approval |
| Cancel or reschedule | — | Yes, request | Yes | — | 24-hour policy note; operator override |
| See internal notes | — | — | Yes | — | `internalNotes` is never rendered on the assessment or print |

## The seams worth keeping

`canWork()` (`work.ts`) is the strongest one. A contractor may act on a visit
only when the request is live, the visit is theirs, its status is `Confirmed`
or `In Progress`, work is unfinished, **and** an `Accepted` assignment exists
for them. Five conditions, one function, every contractor action behind it.

`scopeMatch()` (`model.ts`) is the restricted-work gate both audits demand:
`qualified = !t.restricted || p.eligible`, and `fits` requires `qualified`. An
ineligible provider cannot be assigned restricted work, and `instantEligible()`
separately refuses to let restricted work be booked instantly at all.

`sendBlockers()` (`pmw.ts`) sits in the data layer rather than the screen, so
no surface can send an assessment carrying a finding the customer could not
identify. ADR 028 records why it was moved there.

## What is missing

| Gap | Consequence | Both audits |
|---|---|---|
| No authentication | Every row above is advisory | PMW G, HandyFlow #19 |
| Server-side enforcement | The UI is the only check | PMW G (CRITICAL), HandyFlow #33 |
| Guest-link security | No expiry, revocation, entropy or access log; it is a plain URL parameter | PMW G (CRITICAL) |
| No approval authority | Anyone with the link can approve. The approval now records **who** (`Quote.approval`, `Walkthrough.authorization`), but nothing checks they were entitled to — recording and enforcing are different problems, and `docs/decisions.md` #2 takes them in that order deliberately | PMW C, decision 2 |
| Audit log is partial by coverage | `events` now records actor, field and before/after for price, booking mode, materials, review, assignment, approval and merges. Writes outside that list still log only their narrative line | PMW B, HandyFlow #33 |
| Contractor sees the whole request | `canWork()` gates *actions*, not *reads* — an assigned contractor can see the full request record | HandyFlow #8 |

The last one is worth separating from the rest: it is not an authentication
problem, it is a data-shaping one, and it is the kind of thing that is cheap
now and expensive after a backend exists.

## Read this with

- `docs/status-dictionary.md` — the states these actions move between
- `docs/audit-reconciliation.md` — the full item-by-item status
- `docs/decisions.md` — #5 decides guest-link policy, #2 approval authority
