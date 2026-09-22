# Fieldwork — Interactive Handyman Platform Prototype

[Open the demo](https://onaxyzogden.github.io/fieldwork-demo/)

A responsive prototype for evaluating customer intake, operator scheduling and dispatch, and contractor job offers. All sample names, properties, prices, and transactions are fictional. This is a demonstration, not a live booking or payment service.

## Try the demo

Open the link on a computer, tablet, or smartphone. Use the role switcher and five scenario shortcuts:

1. **Door adjustment:** Customer → describe/clarify/confirm → address → approved appointment → simulated payment → confirmed visit.
2. **Four-task visit:** Operator → Do It Myself → create a bundled visit → send quote. Customer approves and pays in the simulation.
3. **Delegate a job:** Operator selects a contractor and sends an offer. Contractor accepts. Customer approves the quote and pays before confirmation.
4. **Needs review:** Restricted work requires operator review and an eligible specialist; ordinary Instant Book is blocked.
5. **Decline & reassign:** Contractor declines the TV mounting offer. The operator sees an actionable alert and can choose another contractor or Do It Myself.

Optional automatic reoffers are in Operator → Demo settings. They retain the appointment and pay, notify the operator, and require an eligible contractor. No suitable replacement leaves the operator an action-required alert.

The sun/moon button switches themes. Demo settings can reset sample data or advance the simulated clock. Requests, offers, payments, settings, and notifications are saved in each browser independently. They do not synchronize between devices. Visitors never receive another visitor's locally entered information.

## Run locally

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite with `/fieldwork-demo/` as the path. Run `npm test` for the business-rule tests and `npm run build` to generate the static site in `dist/`.

## Deployment

Push changes to `main`. GitHub Actions installs dependencies, runs tests, builds the site, and publishes to GitHub Pages. The workflow can also be started manually from Actions. Pages must use **GitHub Actions** as its build source.

`vite.config.ts` sets the base path to `/fieldwork-demo/`. If the repository is renamed, update that value and the demo link.

## Prototype boundaries

- Service Request → Tasks → Visit → Assignment are separate records; quotes and payments have independent state.
- Rule-based classification and deterministic scheduling; no external AI, geocoding, or traffic service.
- CAD prices and America/Toronto appointment times; sample dates are relative to initial load.
- Payments and notifications are simulated. No real charges, messages, authentication, or credential verification.
- Role switching demonstrates workflows; it is not a security boundary.
- Optional photos stay in browser storage. Only use non-sensitive test data.
- No offline installation or service worker. An internet connection is required to load the app.
- Light/dark themes and responsive layouts support phones, tablets, and desktops.

## Source guide

- `src/main.tsx`: role workspaces and UI interactions.
- `src/model.ts`: classification, scheduling, eligibility, and lifecycle state.
- `src/dispatch.ts`: decline handling, replacement offers, and operator notifications.
- `src/style.css`, `src/light.css`: responsive layouts and themes.
- `src/*.test.ts`: regression tests.

## Typography verification

Shared rem sizing is defined in `src/typography.css`: body/form values 16px, introductory text 18px, headings 32–40/28–30/24px, labels 14px, compact captions 12px. Body line height is 1.6; headings and labels use 1.5. Layouts wrap and stack around larger text without page-wide overflow clipping.

Checked all three roles in both themes at 320, 390, 461, 768, and 1280px, including intake steps, request detail, routes, contractor offers/assignments, and a completed simulated booking. Checkout was checked at those widths and 640px. No horizontal page overflow was found in these checks. All 26 regression tests and the production build pass.

Browser zoom remains unrestricted. A 640px viewport checks the reflow width equivalent to 200% zoom on a 1280px window; actual browser-chrome 200% zoom was unavailable in the automated browser and remains a manual verification item.

## Issue-specific clarification

The intake library now covers 25 handyman and specialist issue types. See [the question table](CLARIFICATION-CATALOGUE.md). Customers get relevant choices, editable explicit details, optional photos, and conditional drain-product follow-ups. Answers remain attached to individual tasks and appear in customer, operator, and contractor details. Specialist intake stays on Request to Book and requires review. Existing saved answers remain compatible; no reset is needed.

Validation: 67 tests pass, including all 25 issue matches, drainage/leak distinctions, ambiguous and negative phrases, saved legacy answers, specialist booking restrictions, and door scope limits. The clogged-sink request was exercised through submission and refresh into operator Needs Review. Clarification controls fit 320, 390, 461, 768, and 1280px in both themes.

## Expanded editable catalogue

The matrix is now merged into 81 canonical issues and 268 questions. See [the full table](CLARIFICATION-CATALOGUE.md) and [editing instructions](catalogue/README.md). The two CSV files are the source of truth; generated data is checked before tests and deployment. Source row numbers preserve traceability across all 78 imported rows. No supplied licensing flag is treated as a verified qualification.

Validation includes 163 application tests and eight CSV/compiler tests. Representative checks cover specific-vs-generic matches, every canonical example, negative phrases, source coverage, saved answers, and referral-only assignment rejection. Referral intake explicitly states that the service is not bookable through the platform.

## Three-screen customer intake

_(Superseded by the redesign section at the end of this file; intake is now Address → Tasks → Timing.)_

Customer intake previously used Tasks → Where and when → Done. One editor is open at a time; saved tasks collapse to short rows. Save task opens its catalogue questions; Done with this task saves customer entry without approving operator scope. Unanswered details can explicitly be marked Not sure. Remove offers Undo. The address and optional draft progress persist without resetting old records.

The combined booking screen offers up to three slots plus More times, using one eligible provider and the total task duration. Request to Book options remain preferences. Uncertain or oversized scope uses general timing; referral-only work has no bookable slots. Instant Book uses the existing simulated checkout with availability revalidation. The receipt distinguishes requests from confirmed appointments.

Verified: six-task entry, removal/Undo, reopened drafts after refresh, a four-task 240-minute recommendation, address changes, uncertain multi-visit scope, and Instant Book with a More times selection and failed-payment retry. Task, booking, and dialog layouts were checked at 320, 390, 461, 768, and 1280px. Photos retain task IDs and are covered by persistence checks. Browser-chrome 200% zoom remains unavailable in the automated browser; narrow-width reflow was checked, and actual zoom remains a manual check. The bottom action area stays in document flow so it cannot cover the keyboard or form content.

Validation: 173 application tests plus eight catalogue/compiler tests; production build passes. `src/CustomerIntake.tsx` owns the customer screens, and `src/intake.ts` contains draft completion and recommendation helpers. Scheduling retains its existing default limit, with an optional larger result limit for More times.

## Operator and contractor workflow update

Operator navigation is Home, Requests, Today, and More. Home prioritizes declines and unresolved work, with waiting items separate. Requests filters by the five derived buckets. Expand a task row to read its answers and mark it reviewed; classification internals and scope authoring sit behind per-task disclosures. Dispatch and pricing are one decision card — see the operator simplification round below. Today defaults to a timeline with optional illustrative map and external map links.

Contractor walkthrough: choose a demo contractor; Your Work opens straight to whatever needs attention — a running job, a single pending offer, or a list when more than one thing is open — rather than a remembered tab. View the exact pay and task list, then accept or decline with an optional reason; accepting drops straight into the job (a toast confirms it, not an extra screen) and shows a plain note when customer confirmation is still pending. Once confirmed, On my way and Start job are one primary action at a time, not two peers — the status line above them already says "On the Way" once pressed, so the button doesn't repeat it. Open each task and choose an outcome; before/after photos and notes are optional. Complete job opens a review dialog; Finish job ends the visit. Unresolved tasks create operator attention without another appointment or payment. Yousef has the same execution controls in confirmed request details and Today. See the contractor simplification round below.

Execution data is optional and persisted per visit/task. Customer reference photos remain separate. Messages and notifications are in-app simulations; navigation opens external maps only. ETA uses the simulated clock and travel allowance, not GPS. Demo users can exercise a future confirmed assignment without waiting for its calendar date. Browser storage remains local and is not shared across devices.

Validation: 183 application tests plus 8 catalogue tests passed; production build passed. Browser checks exercised decline/reassignment visibility, self-assigned start, outcome gating, partial completion, and refresh persistence. Home, review, contractor views, and completion dialog were checked at 320/390/461/768/1280px; contractor layouts in both themes. Actual 200% browser zoom and real mobile keyboard/photo-picker behavior require manual device checks. No production messages or payments were sent.

## Developer blueprint

Open `?view=blueprint` or Demo settings → Developer blueprint. This separate view does not mount the booking app and does not write browser storage, even when its theme or filters change. It documents eight stages across Customer, Operator, Contractor and System, with six read-only example paths, linked entity/state references, and explicit implementation gaps. It does not execute scenarios.

Use Print / Save PDF for the complete landscape overview, all eight stage detail pages, and state/exception references. Print content is independent of the selected role or example. The checked Edge export is 15 A4 landscape pages. Browser print settings can change pagination.

Verification: direct link and refresh; role/path selection and stage focus; light/dark layouts at 320, 390, 461, 768 and 1280px. An isolated browser check loaded the actual entrypoint, exercised filters/stage selection, and confirmed zero storage writes with the demo record string unchanged. The printed overview, stage pages and reference/exception pages were visually inspected. Existing booking data and synced references were not changed.

### Operator layout

_(Palette superseded: see the redesign section below.)_ Operator Home uses separate attention cards and daily metric tiles. Mobile navigation is in the header drawer; sample scenarios are under Demo settings. Contractor recommendations match all selected tasks using the same scope rules as offer eligibility, with availability shown separately.

## Redesign round

The brand is a refined amber in both themes. `src/tokens.css` remains the only palette owner, and tokens now carry a role: `--accent`, `--success-fill` and `--danger-fill` are fills that pair with the dark `--on-accent`; `--accent-text`, `--success` and `--danger` are text and flip per theme. With an amber brand a separate amber `warning` would be unreadable as a distinct signal, so attention states use the urgent ramp and are told apart by the word and icon beside them. Radius is 6/10/16px. The rem-based 1.25 type scale is unchanged — see `docs/design-decisions.md` ADR 007 for why the handoff's px scale was declined.

Customer intake is **Address → Tasks → Timing**. Finished steps collapse to a summary row with an Edit that reopens them without discarding later work. Timing is optional: a flat list of the next ten days as tap-to-select chips, each revealing Morning/Afternoon/Evening, plus free-text constraints. Sending with nothing chosen is valid. A stated preference is stored separately from a chosen appointment and is never rendered as one. Tasks have two edits — Edit answers keeps the description, Edit description keeps the answers.

Customer Home is an accordion. A request expands in place; there is no separate detail screen. The status track is three steps — Received / Quote / Confirmed. "Provider coordinated" was internal handoff the customer could not act on and survives only as the contextual line beneath.

**A contractor decline is never visible to the customer.** On a decline the request falls back to "we're matching your request with a provider", exactly as if nothing had happened; reassignment is the operator's to solve. The assignment is deliberately left in place so the operator can see who declined.

The operator can ask the customer **one** question at a time. One question, one reply; asking again replaces the pair rather than appending. This is not a chat, and is deliberately not growing into one — the per-visit message thread already exists for real back-and-forth.

Customer and contractor screens carry a "Viewing as" pill switcher, since the prototype has to simulate several people to be testable. Every request traces to a real customer in the roster, so no record belongs to nobody.

**No submit-type button in this app is disabled.** Each stays enabled, validates on click, marks the specific blocking field, writes the reason beside it and moves focus there. A disabled button drops out of tab order, is silent to screen readers and fires no pointer events, so the tooltip explaining the block never reaches the person who needed it.

Validation: `design:check`, 214 application tests and 8 catalogue tests pass; production build passes. All three roles checked at 320, 390, 461, 768 and 1280px in both themes with no horizontal overflow, and an automated contrast audit over every rendered text node found nothing below WCAG AA. See `docs/design-verification.md`.

Not adopted from the handoff: its stub slot generator and its five-category matcher. The existing scheduler and the 81-issue catalogue already do more, and swapping them in would be a regression.

## Operator simplification round

The operator's remit is written down first, because the screen's density came from
never having decided it: **triage** the scope, **author** it when it is wrong,
**decide who** does the job, **decide the price**, and **unblock** declines and
ambiguity. Everything on the request detail now maps to one of those five, and
anything that mapped to none of them is gone.

**One decision per state.** A declined job used to offer the same
"who does this now?" choice through five separate control clusters — a top action
row, a dispatch alert, a Reassign button in the assignment history, a segmented
control inside the fulfillment panel, and the reassign modal itself — announced by
six different badges. The request detail now renders exactly one decision card, and
which card appears is derived state: Scope needs review, Assign this job, Offer
sent, **Contractor declined**, Send the quote, Quote sent, Confirmed. `Need More
Info` is available in every state; `Decline request` and the booking mode stay under
`More actions`.

Two behaviour bugs went with the duplication. The two Do It Myself paths guarded
differently and reported different reasons for the same refusal. And the top-row
buttons silently did two different things depending on which task checkboxes were
ticked — reassigning on an exact scope match, otherwise opening the fulfillment
panel to dead-end on "these tasks already belong to a visit". The decision card is
authoritative regardless of selection.

**Triage inline, authoring behind a disclosure.** A task row shows its summary,
description, clarification answers, photos, any restricted-work warning and
`Mark reviewed`. Classification confidence and reason moved behind
_Why this classification?_; category, duration and split moved behind
_Adjust scope_, which now states that reclassifying to restricted work clears the
review flag and returns the request to Needs Review. Merge still appears only when
more than one task is selected.

**Pricing is one control.** `Send quote` with an amount suggested from the
estimated duration, and `Adjust` for pricing path, amount and pay-on-completion.
The separate Customer pricing & quotes panel is gone.

**Cut from the detail:** the simulated map card (the address carries the Maps link),
the request-level photo gallery (photos belong to the task rows that already render
them), the "Estimated visit" card (it duplicated the summary line verbatim), and the
embedded execution panel (execution belongs on Today). Visits & assignment history
collapses to one line — it is an audit trail, not a decision surface.

**Queue filter** is the five derived buckets from `src/work.ts` plus All requests.
It previously mixed buckets, raw `Request.status` values and one dispatch string
across twelve overlapping options. Queue rows carry one badge instead of three.

**Information requested is no longer a phantom status.** `bucket()` has always
routed it to Waiting, but nothing ever set it, so "Need More Info" left the request
sitting in Needs Action. `reconcile()` now sets it while an operator question is
outstanding and clears it when the customer replies, and the notification keys off
`operatorNote` rather than a `notes` prefix nothing has written since the Q&A slot
was introduced.

Dead code removed: `respond()`, `routeVisits`, `attentionRequests`, `routeDay`,
the `dispatchPanel` renderer and the `.dispatch-alert` / `.status-stack` /
`.operator-location-card` / `.operator-thumbnails` / `.operator-primary-actions`
rules that served them. The `order:` juggling in `operator-concept.css` is gone —
DOM order is the reading order.

Validation: 218 application tests plus 8 catalogue tests; `npm run design:check`
and the production build pass. Browser checks walked every decision state
(needs review, unassigned, offer pending, declined, assigned-unquoted, quoted) and
confirmed one card and one instance of each action in each. The declined scenario
was audited at 390/768/1280px in both themes: zero horizontal overflow and zero text
nodes below WCAG AA.

## Contractor simplification round

Audited against the same procedure as the operator round: the role's remit was
already written down (`src/blueprint-data.ts`'s Contractor lane on every stage —
decide whether to take the job, signal travel, work the list, close out, communicate),
so this round mapped every control against it directly. The contractor screen was in
much better shape going in — accept/decline lives in exactly one place and
`canWork()` guards every execution action at the model layer — so the changes here
are five defects and two structural fixes, not a five-cluster collapse.

**One state opens the screen, not a remembered tab.** The tab default used to be
computed once and then thrown away — a running job, a pending offer, something
scheduled today, or Upcoming, in that priority. It's now also the initial selection:
a running job or a single unambiguous offer opens directly, instead of requiring a
"View job" click on a list that already had exactly one thing to show. Tabs still
work exactly as before for deliberate navigation.

**Accepting drops into the job, not a receipt.** The "Job accepted!" interstitial
behind its own "View job" click is gone; accepting now shows a toast and goes
straight to the job, which already renders its own "confirmation pending" note via
the existing allowed-gate when the customer hasn't confirmed yet — no information
was lost, one screen was.

**One primary action per execution stage.** `On my way` and `Start job` rendered as
equal-weight peers, and the job status badge separately repeated "On my way" as its
own badge once pressed. Now the badge is the single status line, and only one button
is primary at a time: `On my way` before it's pressed, `Start job` once it has been.
The same principle removed the redundant "Visit finished" heading once the top badge
already reads Completed.

**Two defects fixed:** `declineReason` was written twice (`respondToOffer()` already
records it; the UI wrote it again immediately after — dead duplication, removed).
"Past offers & completed work" is a completed/declined/expired list — but the filter
that fed it (`a.status !== "Offered"`) accidentally admitted every in-progress
Accepted job too, so today's live work showed up doubled: once as the current job,
once labelled "past". Fixed to genuinely finished/declined/expired only.

**The Upcoming tab no longer tells you to check Upcoming.** Its empty state shared
text with Today's ("Check your upcoming work for the next appointment"), which read
fine on Today but pointed at itself when it was the tab showing. Each of the three
tabs now has its own empty-state copy.

**Address surfaces earlier.** An accepted-but-not-yet-startable visit (planning
tomorrow, before the day-of execution controls unlock) now shows its address and a
Navigate link on the list card — previously that required opening the job. An
unaccepted offer stays city-only, unchanged, since the exact address isn't needed to
decide whether to take the job.

Files: `src/ContractorWork.tsx` only. `src/work.ts` and `src/dispatch.ts` were not
touched — the model layer already enforced everything correctly; this was a UI
consolidation.

Validation: 218 application tests plus 8 catalogue tests (unchanged — confirming the
model layer wasn't touched), `npm run design:check` and the production build pass.
Browser checks walked offer → accept → on my way → start → outcomes → complete →
finish for all four demo identities, confirming one primary action and one status
line at each stage, and re-ran the contrast/overflow audit at 390/768/1280px in both
themes: zero horizontal overflow, zero text nodes below WCAG AA.

## Customer simplification round

Audited against the same procedure as the operator and contractor rounds: the
role's remit was already written down (`src/blueprint-data.ts`'s Customer lane
on every stage — describe the job, answer and clarify, decide on price, track
status, adjust a confirmed visit, communicate), so this round mapped every
control against it directly. The screen was already close to sound — no
five-cluster redundancy, ADR 008 validation applied everywhere, the two
task-edit paths and the Q&A-vs-message-thread split were already correct — so
the changes here are about the vocabulary and consistency of what's shown,
not the structure.

**The header badge stops speaking dispatch jargon.** It used to render the
raw internal status verbatim — "Awaiting Provider Acceptance", "Awaiting
Quote Approval" — directly above a hand-written, friendly note explaining the
same fact in plain language a few lines down. The badge now uses the same
vocabulary as the note ("Matching you with a provider", "Quote ready",
"Waiting on your reply"), coloured by the real underlying status so nothing
about the colour logic changed, just the words.

**A cancelled or declined request stops looking like a paused pipeline.** The
Received → Quote → Confirmed tracker only ever shows forward progress, so a
terminated request rendering it looked like work-in-progress. It's replaced
with a single terminal line for Cancelled/Declined requests. The plain-language
note's suppression list was also missing "Declined" — a declined request was
still shown "We're matching your request with a provider," which is worse than
unhelpful, it's wrong. Both terminal statuses now read as red, extending the
same badge colour rule used everywhere else in the app.

**Two "New request" entry points now agree.** The nav button used to resume
the customer's active request only if it happened to already be a Draft; the
trailing "+ New request" button at the bottom of Home always created a fresh
one regardless — so a customer sitting on an unfinished draft could end up
with a second, orphaned one depending on which button they happened to press.
Both now call one helper that checks for _any_ existing incomplete draft
before ever creating a new one.

**Cut:** `completeEntry()`'s `uncertain` bulk-complete parameter. It let a
caller mark every missing question "Not sure" and force-complete a task in
one call, and was exercised only by its own test — the actual UI only ever
uses the already-shipped per-question inline "Not sure" button, which
satisfies the same requirement one answer at a time. The bulk path didn't add
a capability; it duplicated one that already existed through a different
route.

Files: `src/main.tsx` (badge vocabulary, tracker terminal state, the two
`New request` entry points), `src/intake.ts` and `src/intake.test.ts`
(`completeEntry`'s signature). `src/CustomerIntake.tsx`, `src/work.ts` and
`src/dispatch.ts` are untouched — the intake wizard itself was the cleanest
part of the surface, and every fix here was presentation or a request-creation
guard, never dispatch or execution logic.

Validation: 218 application tests plus 8 catalogue tests (unmodified except
the one test whose assertions now route through the same per-question path
the UI actually uses), `npm run design:check` and the production build pass.
Browser checks walked a request through Submitted, Needs Review, Awaiting
Provider Acceptance/Quote Approval, Confirmed, Cancelled and Declined,
confirming the badge and note always agree and a terminated request never
shows the progress tracker; confirmed both "New request" entry points resume
the same draft rather than creating a second; re-ran the contrast/overflow
audit at 390/768/1280px in both themes: zero horizontal overflow, zero text
nodes below WCAG AA.

## Side by side

A fourth entry in the role switcher — **Side by side** — renders Customer,
Operator and Contractor side by side as three full, independently
navigable copies of the app, so a reviewer can watch one action ripple
across all three roles without switching back and forth.

**Architecture.** The whole existing app body (sidebar, topbar, every
role's screens, every modal) was already one component; it's now called
`Workspace` and takes its shared document store (`s`/`setS`) and theme as
props instead of owning them. Normal mode renders one `Workspace`, exactly
as before. Side-by-side mode renders three — one per role, each with its own
internal `page`/`active`/`modal`/`toast` state via React's ordinary
per-instance hooks — sharing the same `s`/`setS`, so an action taken in one
column (a quote sent, a question asked) is visible in the others the
moment it happens, no reload or manual sync involved. This was chosen over
hand-splitting the Operator and Customer views into new components: it
reaches the same "fully independent columns" outcome with far less
surface area rewritten, since each column is simply a second (or third)
copy of code that already works, rather than a new decomposition of it.

**Reused, not rebuilt: the mobile drawer.** `.sidebar` is `position: fixed`
to the browser viewport — correct when one Workspace owns the page, wrong
once three share it. Rather than inventing a new compact nav for compare
columns, each column gets a `transform: translateZ(0)` box, which the CSS
spec makes the containing block for its own `position: fixed` descendants
(`.sidebar`, `.modal-backdrop`, `.drawer-backdrop`, `.toast`). Every one of
those rules pins to its own column instead of the shared viewport with no
change to any of them, and the column reuses the exact narrow-viewport
drawer treatment already built for phones (`.mobile-menu`, the slide-in
`.sidebar`, the focus trap) instead of a bespoke compare-mode nav.

**The one real risk with three instances mounted at once: shared DOM ids.**
`document.querySelector`/`getElementById` calls that assumed a single
Workspace on the page (`.sidebar`/`.shell` in the drawer's focus trap,
`[role=dialog]` in the modal's focus trap) are now scoped to each
instance's own root via a ref, so opening a dialog in one column can't trap
focus in another's. `id="workspace-navigation"` and each visit card's id
are prefixed by role only in compare mode, so three simultaneously-mounted
copies never collide; ids gated by role already (`#fulfillment`,
`#decision`, ContractorWork's `#outcome-*`) needed no change, since compare
mode never mounts two columns of the same role. The sidebar drawer's
existing body-scroll lock is now reference-counted rather than a plain
boolean, so two columns' drawers opening and closing independently can't
hand scrolling back to the page while one is still open.

**Accepted limitation, stated rather than hidden:** every other responsive
rule in this app (typography scale steps, card padding, the dozen smaller
breakpoints across the role stylesheets) still keys off the real browser
viewport, which stays desktop-wide in compare mode even though a column is
phone-narrow. Retrofitting all of them to respond to a column's own width
would be a second project the size of this one; the one collapse that
would otherwise be functionally broken rather than merely denser — the
Operator's two-pane request queue, which would leave a real detail pane
under 200px wide — reuses its own existing narrow-screen rules by class.
Everything else is accepted as a deliberately denser view, the same way a
compare column scrolls horizontally into view rather than trying to
compress three independent apps into a phone screen.

Files: `src/main.tsx` only (`App` renamed to `Workspace` and parameterized;
a new, small `App` composes one or three instances) and `src/style.css`
(the `.compare-row`/`.compare-column` rules). `ContractorWork.tsx`,
`CustomerIntake.tsx`, `NotificationUI.tsx` and the model/dispatch/work
layers are unchanged.

Validation: 218 tests, `npm run design:check` and the production build
pass unmodified. Browser-verified: single-role mode is unaffected at
390/768/1280px in both themes (ids unprefixed, identical markup); compare
mode renders three correctly-labelled columns that navigate, scroll and
scroll-lock independently; an operator action (asking a clarifying
question) appears in the customer column immediately, with no reload;
each column's toast and drawer stay visually confined to that column;
a too-narrow window scrolls the row horizontally instead of squashing the
columns.

## PMW — proactive property maintenance

Until now work could only enter Fieldwork one way: a customer reports a
problem. **PMW (Property Maintenance Walkthrough)** adds the other
direction. An operator walks a property, records what they observe, and
the customer decides item by item what to approve. Both paths converge on
the same fulfillment system — one property, one maintenance record, two
ways work enters Fieldwork.

**Try it.** Operator → **Walkthroughs** → New walkthrough → add findings →
Send to customer → **Copy link** or **Open as the customer**. The link is
the customer's whole experience: no account, no sign-in.

### What a finding is

One observed issue, kept separate from every other issue found the same
day. It carries an area, the observed condition, the proposed work,
photos, and either a price or the classification **further assessment
required** — for the case where something is visibly wrong but the cause,
access, trade or extent cannot responsibly be priced from a walkthrough.

That distinction is held in the data, not the interface. A finding has
two fields: `pricing`, which is the operator's classification, and
`decision`, which is the customer's. Approval is refused for anything
that is not priced, so no surface — the guest link, the operator screen,
or anything added later — can record an approval for work nobody scoped.
The customer sees a status and a way to ask for an assessment, never an
approve button beside a price that does not exist.

### Approved work is ordinary work

Approving converts findings into ordinary Fieldwork tasks on one ordinary
request with one approved quote. Nothing downstream knows PMW exists: the
operator queue, dispatch, the contractor's Your Work and the payment gate
all behave exactly as they do for a reported problem. Converted tasks
still run through the same classifier and the same provider eligibility,
so a walkthrough cannot route restricted work to an unqualified
contractor.

Scheduling is blocked until payment is settled, and that needed no new
code — an approved, unpaid quote is already the state the reconciler
reads as Awaiting Payment.

### The record outlasts the job

Deferred findings stay attached to the property and resurface in its
maintenance record rather than disappearing with the assessment.
Completed work keeps its date, the contractor's note and the after
photos. The record is assembled on read from walkthroughs, findings,
tasks and visits, so it cannot disagree with the work it describes. It is
shown to the operator, to the customer below their bookings, and on the
guest link.

### The printed assessment

**Print / Save PDF** on the assessment produces the document the PMW
template specifies — header, numbered findings, work summary, approval
block, payment note. It renders from the same records and the same
derived values as the screen, so the two cannot drift; a test asserts the
printed document carries the same assessment id, finding numbers, scopes,
prices and statuses.

### Known limits

The assessment link is a URL parameter, not a secured private link, and
the page says so. The guest view lives outside the workspace, so it does
not appear in side-by-side mode — demoing the handoff takes a second tab.
Account creation after completion is invited but does nothing: that is
the brief's Phase 4, deliberately out of scope, as is everything in its
§15.

Files: `src/pmw.ts` (records, decisions, conversion, derived state),
`src/Walkthroughs.tsx` (operator capture), `src/Assessment.tsx` and
`src/AssessmentPrint.tsx` (the customer's link and its printed form),
`src/PropertyRecord.tsx`, `src/store.ts` (one load/save/commit pipeline
shared by both entry points), plus `Property`/`Walkthrough`/`Finding` in
`src/model.ts`. `reconcile()`, `src/dispatch.ts`, `src/work.ts`,
`ContractorWork.tsx` and `CustomerIntake.tsx` are unchanged.

Validation: the existing 218 tests pass unmodified — the check that the
pipeline really was reused rather than forked — alongside 29 new tests
covering identifier stability, totals and tax, the refusal to approve an
unpriced finding, conversion shape, the payment gate, carry-forward, and
screen/print parity. `npm run design:check` and the production build
pass. Browser-verified end to end at 390/768/1280px in both themes:
capture, the guest link, per-finding decisions, conversion into the
existing queue, the property record, and the printed document.

## Matching the reference artboard

The prototype's look was compared against an earlier design export the product
owner preferred. Reading that export settled something that had only been
assumed: **it is the same design system.** `--surface-0 #12151a`,
`--surface-1 #1b1f26`, `--accent #e3a95e` and the 6/10/16 radius scale are the
values already in `src/tokens.css` under different names, and the export's own
header comment describes replacing "the competing blue-theme.css accent
system" — the blue-to-amber decision recorded here as ADR 001 → ADR 006.

So the palette was never the gap. Three things were.

**The app opened in light.** It now opens dark, which is the design's home
ground. The sun/moon toggle still remembers anyone who prefers light, and the
customer's assessment page stays forced light because it is a printable
document.

**Tone was colouring text.** A declined job set a warning colour on its whole
row, so the heading "Contractor declined" rendered as a warning label rather
than a heading. Tone now belongs to the icon tile alone — a red tile beside an
ordinary title — which is what the reference does.

**"Today at a glance" was four boxes.** The card was a surface and each
statistic inside it had its own filled, bordered tile. The card is now the only
surface and the numbers sit directly on it. They are still buttons, because all
three navigate, so the affordance the tile carried moved to hover and the focus
ring. The rule this expresses, applied across the screen: inside a card,
content does not get its own surface — the tinted icon tile being the
deliberate exception.

Every measurement the reference specifies already had a token: its 14px title
is `--text-label`, its 12px meta is `--text-caption`, its 26px greeting is
within a pixel of `--text-h3`, its tile and card radii are `--radius-md` and
`--radius-lg`. The one addition is `--link`, for pressable card titles and
genuine anchors, opt-in through a `.link` class rather than a bare `a` rule
because several anchors here wrap images rather than words.

"Compare" is renamed **Side by side**, after the reference's own label.

Scope: the operator's Home only, with the role header left as it was. The other
screens pick up the new default theme and were re-audited for contrast, but
were not redesigned.

Validation: 247 tests, `npm run design:check` and the production build pass
unmodified. 56 automated browser checks pass — contrast and horizontal overflow
across operator Home, the customer portal, the contractor view and walkthroughs
at 390/768/1280px in **both** themes, plus first-visit theme, the light
preference surviving a reload, side-by-side mode, and the assessment page still
rendering and printing as a light document. Zero console errors.
