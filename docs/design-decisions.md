# Design decisions — 2026-09-13

## ADR 001: Blue remains the brand

**Superseded by ADR 006 (2026-09-21).** Accepted at the time. The audit assumed gold was canonical; the user had explicitly approved navy/blue. Consolidate the active blue palette and remove the old amber alias. This is system cleanup, not a rebrand.

## ADR 002: Semantic tokens own themes

Accepted. `tokens.css` owns light/dark/print values. Components may alias scope-specific tokens but must not redefine global palette values. Shared component styling from the former light/blue files lives in `primitives.css`; role layouts stay in their role stylesheets. CSS import order no longer chooses between two palettes. Use a small sRGB palette; OKLCH complexity is not needed here.

## ADR 003: Modular type

Accepted by user. Ratio 1.25 from 16px yields intro 20, H3 25, H2 31.25 and H1 39.0625. Retain 12/14 utility sizes; all are rem-based. Increased wrapping is intentional and must be accommodated with layout, not smaller text.

## ADR 004: One card base

Accepted. `cards.css` contains the canonical card and legacy forwarding selectors. Modifiers own internal layout and local tint aliases. Contractor photo cards use a grid so text and images can shrink independently; no floated thumbnail. Map labels have theme-aware tokens. Standard radii are 4/8/16px plus pill; tight nested controls choose a smaller step and structural cutouts may use zero.

## ADR 005: Icons and motion

Accepted. Lucide outline icons use 16/20/24/32/48px. Existing inline actions map to 16/20, navigation to 24, features to 32, hero marks to 48. Minimum targets are 44px. Shared 160/320ms timing preserves restrained motion and reduced-motion users receive no decorative animation.

## Boundaries

No changes to autosave timing, validation semantics, authorization, navigation persistence, scheduling, payments or dispatch. No backend loading implementation. Reference documents remain unchanged.

# Design decisions — 2026-09-21

## ADR 006: Amber is the brand, in both themes

Accepted. Supersedes ADR 001. The redesign handoff specifies a refined amber, and it is adopted as the brand in dark _and_ light mode rather than dark-only as the handoff had it — the light theme is a shipped, tested feature and is not worth dropping for palette fidelity. The handoff supplies no light values, so they are derived by holding the dark ramp's hue and inverting lightness direction.

Two consequences follow and are deliberate. A separate amber `warning` would be indistinguishable from an amber brand, so attention states resolve to the urgent ramp and are told apart by the word and icon beside them. `--info` follows the accent instead of keeping a competing blue.

Tokens now carry an explicit **role**. `--accent`, `--success-fill`, `--danger-fill` are fills — light in both themes, pairing with the dark `--on-accent`. `--accent-text`, `--success`, `--danger` are text — they flip per theme. Using a text token as a solid fill was widespread before this change and produced light-on-light in dark mode and dark-on-dark in light; it is now a documented "do not".

## ADR 007: Keep the rem type scale, decline the handoff's px scale

Accepted. The handoff specifies a px scale at a 15px base. Keeping ADR 003's rem-based 1.25 scale from 16px, because px sizes stop responding to the reader's browser font-size setting — an accessibility regression, and an odd pairing with ADR 008, which is itself an accessibility change. Every other token family in the handoff is adopted as specified. Radius moves to 6/10/16, amending ADR 004's 4/8/16.

## ADR 008: No submit-type button is ever disabled

Accepted. A disabled button drops out of tab order, is silent to screen readers, and fires no pointer events — so a tooltip explaining why it is blocked cannot reach the person who needed it — and the greyed label routinely fails contrast. Every submit-type action stays enabled and validates on click: mark the specific blocking field, write the reason beside it, move focus there. Per-field, never one global invalid flag, never a tooltip.

The boundary is submit-type _actions_. A control that is read-only because the record belongs to someone else is not a blocked action; those render as text or `readOnly`, not `disabled`.

## ADR 009: The operator note stays one slot

Accepted. Operator asks one question; the customer gives one reply; asking again replaces the pair. This deliberately does not grow into a message list. Real back-and-forth would be a decision to adopt chat, and the per-visit message thread already exists for that; faking history by appending to this field would give neither.

## ADR 010: The operator's remit is five responsibilities, and the screen shows one decision

Accepted. The operator triages scope, authors it when it is wrong, decides who does the job, decides the price, and unblocks declines. Naming these is the change: the density on the request detail existed because nothing said which controls earned their place.

The request detail renders **exactly one** dispatch decision card, chosen from derived state rather than shown unconditionally. Before this, a declined job offered the same reassignment choice through five control clusters and announced it with six badges; two of those paths guarded differently and gave different reasons for the same refusal, and one silently changed behaviour with task-checkbox state. Duplicating a decision is not redundancy for safety — it is five places to keep in sync and five chances to disagree.

Scope authoring stays in the remit but not in the triage path: classification internals sit behind _Why this classification?_ and the authoring controls behind _Adjust scope_. Reachable, not in the way.

## ADR 011: A status the router recognizes must be a status something writes

Accepted. `bucket()` routed `"Information requested"` to Waiting, `notifications.ts` keyed off a third spelling of it, and nothing ever wrote either — so "Need More Info" left the request in Needs Action with no waiting state at all. `reconcile()` now sets it while an operator question is outstanding and clears it on the customer's reply.

The general rule: a derived router that recognizes a value nothing produces is worse than not recognizing it, because the dead branch reads as coverage. Either write the value or delete the branch.

## Boundaries

Scheduling, payments, dispatch, authorization and the clarification catalogue are unchanged. The handoff's stub slot generator and five-category matcher were **not** adopted: the existing `slots()`/`available()` scheduler and the 81-issue catalogue already do more, and replacing them would be a regression. Home, Today, Contractors and Activity navigation is untouched: the density complaint lives on the request detail.

# Design decisions — contractor round

## ADR 012: The screen opens to the derived state, not a remembered tab

Accepted. The contractor's opening tab was already computed from a "what needs attention right now" priority — a running job, a pending offer, something scheduled today, else Upcoming — but that computation only ever chose a _tab_, then discarded itself. A single unambiguous offer or running job still required an extra "View job" click on a one-item list.

The same computation now also drives the initial selection: a running job or exactly one pending offer opens directly, everything else still shows as a list. Multiple simultaneous offers stay a list, since there is no single unambiguous "the" decision left to jump to. Tabs remain a full manual override once the contractor has looked — this is a one-time initial derivation, not a live re-render that would fight the contractor's own navigation.

The same round removed the post-accept interstitial (a receipt screen behind its own "View job" click) in favor of dropping straight into the job with a toast, and made "On my way" / "Start job" one primary action per stage instead of two permanent peers, once its own duplicate status badge was found — the same duplicate-announcement pattern as ADR 011's derived-value check, this time in a badge rather than a status field.

## Boundaries

`src/work.ts` and `src/dispatch.ts` are unchanged — every fix in this round was a UI consolidation over model-layer behavior that was already correct. All 218 application tests pass unmodified, which was the check that this stayed true.

# Design decisions — customer round

## ADR 013: A status badge borrows its words from the explanation next to it, never from the state machine

Accepted. The customer's accordion header rendered `x.status` verbatim — "Awaiting Provider Acceptance," "Awaiting Quote Approval" — the dispatch layer's own vocabulary, shown to the one person with no reason to know it, directly above a hand-written note already explaining the same fact in plain language. Two vocabularies for one fact is the same failure ADR 010 and ADR 011 found on the operator's screen, just customer-facing this time.

The fix keeps `badge()`'s existing colour logic (now extracted into `badgeTone()`, keyed off the real status so nothing about correctness changes) and adds a customer-only word list that borrows its phrasing from the note beside it: "Matching you with a provider," not "Awaiting Provider Acceptance." Anywhere a badge and a prose explanation of the same state sit next to each other, they should read like they were written by the same person.

## ADR 014: A progress tracker that only moves forward must not render for something that stopped

Accepted. The Received → Quote → Confirmed tracker has no vocabulary for "this ended" — every step is a step toward completion. Rendering it for a Cancelled or Declined request made a terminated request look like a paused pipeline. It's now replaced by a single terminal line for those two statuses, and `badgeTone()`'s red rule was extended to include Cancelled (Declined already matched), so both terminal states read consistently.

Found in the same pass: the plain-language note's own suppression list excluded Confirmed, Cancelled and Draft, but not Declined — a declined request was still told "we're matching you with a provider," which is not merely uninformative but actively wrong. Declined joins the suppression list.

## ADR 015: Two controls with one label must have one behavior

Accepted. The customer's two "New request" entry points — the nav button and the trailing button at the bottom of Home — carried the same label and apparent intent but different guards: one resumed an active draft, the other always created a fresh one regardless of what the customer already had open. Same shape as ADR 010's `Do It Myself` finding on the operator screen: a decision reachable through more than one control only stays safe if every path agrees.

Both now call a single `startOrResumeRequest()` that checks for _any_ existing incomplete draft — not just whichever request happens to be currently active — before ever creating a second one.

## Boundaries

`src/CustomerIntake.tsx`, `src/work.ts` and `src/dispatch.ts` are unchanged. `completeEntry()`'s unused `uncertain` parameter was removed (its capability was already fully covered by the per-question "Not sure" button the UI actually uses); `src/intake.test.ts` was updated to exercise the same real path rather than the removed flag, preserving every invariant it checked.
