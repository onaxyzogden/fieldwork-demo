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

# Design decisions — compare mode

## ADR 016: Three independent columns come from three instances of one component, not three new ones

Accepted. The brief called for Customer, Operator and Contractor to run side by side, each fully and independently navigable. The obvious-looking path — extract `OperatorPanel` and `CustomerPanel` as new components, wire each one's dozen-odd pieces of state through props — means hand-splitting roughly 1,900 lines that already work, with every split a chance to drop a variable or change behavior by accident.

The app's whole body was already one component (`App`, now `Workspace`) reading one set of state. Renamed and parameterized to take its shared document store and theme as props, it composes as one instance for the existing single-role mode or three for Compare, one per role. Each instance gets its own `page`/`active`/`modal`/`toast` for free, from React's own per-instance hooks — no manual state-splitting, no risk of an Operator and Customer flow silently sharing a variable the way ADR 010's `reschedule` field once did by coincidence. `s`/`setS` stay lifted and shared across all three, which is the one deliberate exception: data is shared so an action in one column is visible in the others; navigation is not.

## ADR 017: Reuse the mobile drawer's own CSS instead of inventing a compare-mode nav

Accepted. `.sidebar` is `position: fixed` to the browser viewport, correct for one Workspace and wrong for three side by side — opening any column's drawer would pin it to the whole page's left edge, not that column. Rather than building new compact per-column navigation, each compare column gets `transform: translateZ(0)`, which by the CSS spec becomes the containing block for its own `position: fixed` descendants. `.sidebar`, `.modal-backdrop`, `.drawer-backdrop` and `.toast` all become column-relative with no change to any of those rules, and each column reuses the exact drawer treatment already built and tested for phones.

The same reasoning applies to responsive collapse generally: rather than retrofitting every breakpoint in the app to respond to a column's own width (a project the size of this one), only the one collapse that would otherwise be functionally broken — the Operator's two-pane request queue, whose detail pane would drop under 200px — is forced narrow by class. Everything else is an accepted, stated density tradeoff of a comparison view, not a full re-certification of the app's responsive design at column width.

## Boundaries

`src/ContractorWork.tsx`, `src/CustomerIntake.tsx`, `src/NotificationUI.tsx` and every model/dispatch/work module are unchanged — Compare mode is composition and CSS containment over an app that already worked, not new business logic. All 218 tests pass unmodified.

# Design decisions — PMW (Property Maintenance Walkthrough)

## ADR 018: The property is the record, and a foreign key is the only thing that says so

Accepted. Work could only enter Fieldwork reactively, and every address was a flat string on a `Request`. Two jobs at the same house were unrelated rows, so there was nothing a maintenance history could belong to — the brief's "one property, one maintenance record" had no record to attach to.

`Property` is now a real entity and `Request.propertyId` links to it. The migration that backfills it for saved states matches on normalized address, city and owner **once**, and only for a request that has no property yet. It never re-derives the link afterwards, because addresses are editable free text: a customer correcting a typo in their address must not silently move that job to a different property. This is the same principle model.ts already states for customers — identity is a foreign key, not a string comparison.

## ADR 019: What the operator can price and what the customer decides are two different fields

Accepted. The brief asks that "further assessment required" not appear as a third checkbox beside Approve and Not Now, because it is not a customer preference — it is the operator admitting the walkthrough did not reveal enough to price the repair responsibly.

A `Finding` therefore carries `pricing` (the operator's classification: `Quoted` or `Further Assessment Required`) and `decision` (the customer's: `Pending`, `Approved`, `Not Now`) as separate fields, and `decide()` returns false when asked to approve anything that is not quotable. One enum would have made "you cannot approve this" a rule the UI enforces by hiding a button; two fields make it a rule the data enforces, so no surface — guest link, operator screen, or anything added later — can record an approval for work nobody has scoped.

Everything else about a finding is derived: deferred, scheduled, in progress and completed all read the task it became, where `reconcile()` already maintains the truth. Completion is deliberately not a `decision` value, because completion is a fact about the task, and storing it on the finding would give one truth two writers — the failure ADR 011 names.

## ADR 020: The proactive path converts into the existing pipeline rather than forking it

Accepted. Approved findings become ordinary tasks on one ordinary request with one approved quote. Nothing in the operator queue, the dispatch layer, the contractor's Your Work or the payment gate knows PMW exists.

Three consequences are deliberate. **One request per approval event**, not per walkthrough, so approving a finding that was deferred months ago opens new work instead of reopening a completed job. **Converted tasks are marked reviewed**, because an operator scoped them in person and `reconcile()` parks any request holding an unreviewed task in `Needs Review` — intake triage this work has already had; they still run through the same classifier and the same provider eligibility, so a walkthrough cannot route restricted work to an unqualified contractor. And **the payment gate needed no new code at all**: an approved, unpaid quote is already the state `reconcile()` reads as `Awaiting Payment`, which is exactly the brief's "no scheduling until the payment requirement is satisfied".

The brief asks for an authorization rather than a charge. `"Paid"` is read in six places across `model.ts` and `main.tsx`, all of them on the reactive path, so widening that vocabulary would have put shipped behaviour at risk to change a word. The payment row stays `"Paid"` and the customer-facing wording is derived from whether the quote's request came from a walkthrough.

## ADR 021: The printed assessment has no data path of its own

Accepted. §11 requires the PDF and the digital record to be two representations of one thing. The reliable way to guarantee that is not discipline but structure: `AssessmentPrint` renders from the same records and the same derived helpers as the screen, is always in the DOM, and is revealed by `@media print`. There is no export step that could fall behind, and a test asserts the printed document carries the same assessment id, finding numbers, scopes, prices and statuses as the screen.

Found in the same pass: `blueprint.css` declared a global, unscoped `@page { size: A4 landscape }`, and it ships in the same bundle as the rest of the app. Any printable document added anywhere would have come out landscape. It is now a named page scoped to the blueprint.

## Boundaries

`reconcile()`, `src/dispatch.ts`, `src/work.ts`, `src/ContractorWork.tsx` and `src/CustomerIntake.tsx` are unchanged: PMW is new records and new surfaces over an execution pipeline that already worked. The existing tests pass unmodified, which is the check that this stayed true. The guest assessment link is a URL parameter, not a secured link, and the page says so; account creation after completion is invited but does nothing, since the brief's Phase 4 is out of scope.

# Design decisions — matching the reference artboard

## ADR 022: The reference confirmed the palette rather than replacing it

Accepted. The product owner preferred an earlier Claude-chat design and supplied its export. Comparing it to `tokens.css` settled a question that had been open by assumption: the two are the same system. `--surface-0 #12151a`, `--surface-1 #1b1f26`, `--surface-2 #242a33`, `--accent #e3a95e`, `--accent-soft-ink #f0cd96` and the 6/10/16 radius scale are identical values under different names, and the reference's own header comment describes replacing "the competing blue-theme.css accent system" — ADR 001 → ADR 006, recorded in the file that became ours.

Two things follow. **ADR 006 stands**: amber is confirmed as the brand by the very design that was held up against it, not overturned. And the visible gap was never the palette — **it was that the app booted into light**, which is now changed. Dark is what a first visit gets; the toggle still remembers anyone who prefers light, and the assessment page stays forced light because it is a printable document.

A caution worth recording, since it nearly sent this round the wrong way: the brief began from a screenshot, and reading colour off a PNG produced a confident, wrong claim that the reference used blue titles. It uses `--ink-primary #eef1f6`, a near-white that reads cool against a dark card. Sample the source, not the picture.

## ADR 023: Tone belongs to the icon, and a card is one surface

Accepted. Two habits had accumulated on the operator's Home that the reference does not share.

**Tone was colouring text.** A declined job set `color: var(--warning)` on the whole row, so its heading rendered as a warning label rather than a heading. In the reference a declined row has a red icon tile and an ordinary title. Tone now applies to the tile alone — background and glyph — and `--tone` survives only because the decision card on the request detail still draws a stripe from it.

**"Today at a glance" was four boxes.** The card was a surface, and each statistic inside it had its own filled, bordered tile. The reference gives the card the only surface and lets the numbers sit on it. They remain buttons, because all three navigate; the affordance the tile used to carry moved to hover and the focus ring, which is the honest trade — a control that looks inert but isn't would be worse than a heavy one.

The general rule: **inside a card, content does not get its own surface**, the row's tinted icon tile being the deliberate exception.

Alongside this, `--link` joins the palette in both themes for pressable card titles and genuine anchors. It is opt-in through a `.link` class rather than a bare `a` rule, because several anchors in this app wrap images rather than words.

## Boundaries

The role header is untouched, as asked: the sidebar, demo bar and topbar keep their structure and pick up the default theme like everything else. Only the operator's Home was restyled — the customer, contractor, walkthrough and assessment screens were re-audited for contrast in both themes but not redesigned. "Compare" is renamed "Side by side" after the reference's own label; the `.compare-*` class names keep their spelling.

# Design decisions — layout that measures the content area

## ADR 024: The window was never the right measurement

Accepted. Every responsive rule in the app keyed off the browser window. That reading was only ever right by coincidence — a Workspace happened to own the whole page — and side by side broke the coincidence: three 420px columns inside a 1440px window are each told they have 1440px. A two-column grid stayed two columns inside a 420px box and handed a card 61px for its text, in a card 249px tall. The gaps measured correctly the whole time; what read as missing spacing was padding sitting around crushed content.

`.shell` is now a size container, and rules for content inside `main` ask it rather than the window. `.shell` and not `main`, for two reasons: an element cannot query its own container, and the toast and modal backdrop are siblings of `.shell`, so the containment `container-type: inline-size` implies does not capture their `position: fixed` — the same trap the `transform` on `.compare-column` already had to navigate.

**Frame and content are now separate concerns.** The sidebar, topbar, demo bar, role switch, drawer and the fixed overlays stay `@media`: they answer to the window, and in side by side each column supplies its own frame. Content inside `main` answers to `@container workspace (…)`.

**Thresholds were re-derived, not copied**, which is the part that would have quietly regressed the desktop. Above 900px the sidebar occupies a flat 272px, so a rule written as `@media (max-width: 1150px)` was really a statement about 878px of content, and `@media (min-width: 1500px)` about 1228px. At and below 900px the sidebar is a drawer and the two measurements agree, so those thresholds carry over unchanged. The check was a before/after matrix at 390/600/800/1024/1280/1500 across four screens, not an after-only look.

**Touch targets stay behind `@media`.** A 420px column on a desktop is not a phone and does not want 44px hit areas; that rule is about the device, not the column.

One deliberate change in normal mode follows from measuring the right thing. Between 901 and 1172px the content area is under 900px while the window is not, so the operator's compact request browser now replaces the stacked queue there. The tall queue above the detail at those widths was the symptom, not the baseline.

The `.compare-column` overrides that forced narrow styling class by class are deleted — the limitation recorded when side by side was built, removed rather than worked around again. What remains under that selector is only what is genuinely about a column being its own window.

## ADR 025: `overflow-wrap: anywhere` tells a grid a word is one character wide

Accepted. `anywhere` counts mid-word break points when computing min-content width, so an element claims it can be one character wide and a grid believes it. That is why 61px looked acceptable to the layout and why titles broke as "Contract/or" and "Lakesh/ore". `break-word` breaks a word only when it genuinely cannot fit and leaves min-content intact, so the floor survives. Every occurrence outside `blueprint.css` is now `break-word`.

The customer accordion header needed the matching fix on the flex side: it wraps, and its text block asks for 200px before anything else gets a share, so a long status badge drops to its own line instead of starving the address. At 390px that header went from 183px tall to 118px.

## Boundaries

No `.tsx` changed. `blueprint.css` keeps its own `@media` rules and its two `anywhere` declarations: the blueprint renders as a top-level view outside `.shell`, so it has no container to ask. The sidebar-width ladder in `style.css` (205px at 1150, 185px at 800) is dead code — `typography.css` sets a flat 17rem later in the cascade — and is left alone here rather than folded into a layout change.

# Design decisions — hardening before live testing

## ADR 026: A write that does not land has to say so

Accepted. Everything the demo knows lives in one `localStorage` key, and `save()` wrapped the write in an empty `catch`. That made a full origin invisible from the inside: `setItem` throws, the change stays in memory, the screen still shows it, and the next reload is the first anyone hears about it.

It was reachable, not theoretical. Photos were stored as base64 data URLs — a 1.4 MB file becoming ~1.9 MB of string — so the third photo overflowed a 5 MB budget. Measured before the change: photo 1 stored, photo 2 stored, photo 3 silently dropped, photo 4 silently dropped, and the finding created alongside it dropped too, while a toast said "Finding added". Once the ceiling is hit **every** later write is discarded, so an operator can complete and send a whole walkthrough that half-exists on reload.

Two changes, because the cause and the symptom are different problems. **Photos are downscaled on the way in** (`photos.ts`: 1600px longest edge, JPEG at 0.82), which moves the ceiling far enough away that ordinary use does not reach it — six 1.4 MB photos now occupy 2.6 MB where two occupied 3.8 MB, and a real photograph compresses far better than the incompressible test image those numbers come from. And **`save()` reports**, so a write that still fails raises a banner that stays until one succeeds.

The banner takes its own room at the top of the page rather than covering it. An alert that hides the role switcher and the demo bar would be covering the controls it is telling you to go and use.

The generous file cap that replaced the old 1.5 MB one is worth stating plainly: 1.5 MB rejected ordinary phone photos for being ordinary phone photos. The cap now exists only to refuse a file too large to decode comfortably; fitting the result into storage is the downscaler's job, not the user's.

## ADR 027: A state that cannot be rendered gets a screen, not a blank page

Accepted. Every screen resolves the active request, its tasks and its visit up front and uses them without guards — 48 `find(...)!` assertions across the source. A saved state whose records do not line up throws during render, React unmounts the tree, and because the state is in `localStorage` every reload does it again. Four reproductions, all ending in a blank page with no message: `tasks` missing, an assignment pointing at a visit that is gone, a visit pointing at a missing request, a task pointing at a missing request.

`load()`'s existing `try`/`catch` was not the guard it looked like. It only covered what the migrations happen to touch: `migratePmw` backfills `properties`/`walkthroughs`/`findings` and `migrateDispatch` iterates `requests` and `assignments`, so a state missing `requests` threw inside the migration and was caught, while a state missing `tasks` passed straight through to render. That is why the failure mode depended on which collection was absent.

So: a shape check on the way in for the collections nothing else verifies, and a React error boundary for the disagreements a shape check cannot see. Both land on the same recovery screen.

**The broken state is left on disk.** Reseeding silently would be the smaller change, and it would throw away whatever the person had done without telling them. Resetting is destructive, so it is a button they press, and until they press it the state is still there to be looked at.

Two throws happen outside render and would escape the boundary: the cross-tab `storage` listener in `main.tsx` and in `Assessment.tsx` both call `load()` from an event. Each now logs and ignores an unreadable update rather than taking down a tab that is working fine.

## ADR 028: Sending is a rule about the data, not a check in a button

Accepted. ADR 019 already argued this for approval — "one enum would make 'you cannot approve this' a rule the UI enforces by hiding a button; two fields make it a rule the data enforces". The send gate had drifted the other way: `sendWalkthrough()` checked only that findings existed, and the price rule lived in the `onClick` of one button.

What that allowed, reproduced end to end: a finding with a price and no title sent successfully, and the customer's assessment showed `01 · Untitled finding`, the labels "Observed." and "Proposed work." with nothing after them, `$450 + applicable tax`, and an Approve button. The `"Untitled finding"` fallback appears in six places, so the blank state was known and papered over at render time instead of prevented at write time.

`sendBlockers()` now answers why an assessment cannot go out, finding by finding, and `sendWalkthrough()` refuses when it returns anything — so no surface can send what a customer could not identify. A finding needs a title and either a price or the "further assessment required" classification. Observed and proposed stay optional, because an operator standing in a hallway should be able to name and price a job without writing two paragraphs first.

The screen follows the customer intake's idiom rather than its own: the reasons appear on the fields that are wrong, on the first attempt to send, and clear as they are fixed. The disappearing toast it replaces was both easy to miss and, since it only knew about price, wrong about what was missing.

## Boundaries

Four defects, no restructuring. The 3,155-line `Workspace`, the ~600 lines of CSS that match no markup, and `typography.css` silently overriding `style.css` were all found in the same audit and are all still there — they are friction, not breakage, and folding them into this change would have buried it. `carryForward()` remains unreachable from the UI and the seed still contains no walkthroughs.

# Design decisions — the stylesheets

## ADR 029: Six hundred lines that could never match anything

Accepted. Thirty-four class names existed only in CSS: `.stats`, `.stat`, `.request-row`, `.request-list`, `.insight`, `.pulse`, `.route-stop`, `.route-toolbar`, `.offer-pay`, `.dispatch-inbox`, `.portal-tabs`, `.work-mobile-nav` and the rest. They are leftovers from markup that three rounds of restyling replaced, and they were not harmless: the container-query conversion in ADR 024 spent effort re-deriving breakpoint thresholds for rules that no element could ever match.

Confirmed two ways before deleting anything — no occurrence in any `.ts`, `.tsx` or `.html`, and zero elements carrying them in the live DOM across every screen, every role, side by side and the blueprint. A further 22 declarations were deleted because a later stylesheet overrode them unconditionally, including the entire `.sidebar { width }` and `.shell { margin-left }` responsive ladders: four breakpoints each, none of which had applied since `typography.css` started setting a flat `17rem`. That flat sidebar is the real design — ADR 024's threshold arithmetic is derived from it — so the dead ladder was removed rather than revived.

760 lines, and not one computed style changed.

## ADR 030: This stylesheet decides about a hundred declarations by source position

Accepted, and it is the reason the reorganization is a cut rather than a sort.

The intent was to make every file name true: type in `typography.css`, theme in `primitives.css`, structure in a layout file. Sorting the rules that way changed **1,662 computed values across 98 screens** — the topbar repainted, eight pixels came off a dozen layouts, a line-height dropped from 1.6 to 1.5 and took every inheriting element with it.

The cause is not a bug in the sort. Two rules that set the same property on the same element, where neither selector is more specific, are separated only by which one comes later in the concatenated stylesheet. This codebase has roughly a hundred such pairs, spread across files that load in a fixed order. Grouping rules by concern moves them past one another, and each crossing silently picks a new winner. A second attempt that pinned same-selector conflicts in place still changed 1,662 values, because most of the pairs are not same-selector — they are different selectors matching the same element at equal specificity, which no static rule about selectors can detect.

So `style.css` is split where it can be split safely: **at source-order boundaries, with nothing moved past anything else.** `base.css` takes the reset and bare-element defaults, `layout.css` the structure and components, `responsive.css` the breakpoint blocks. The cascade is byte-for-byte what it was, proven against a 17,897-element snapshot at six widths in both themes.

What is left undone is stated rather than hidden: `typography.css` still holds layout and `primitives.css` still holds structure. Making those files honest means resolving ~100 latent ambiguities one at a time, deciding for each which rule was _meant_ to win — real work, and not work to do blind inside a file move.

The lesson worth keeping: a stylesheet whose rendering depends on source order cannot be reorganized by concern until that dependency is paid off. The measurement is what turned that from an opinion into a number.

## Boundaries

No `.tsx` changed except the import list and three comments naming the old file. `work.css`, `cards.css`, the three `-concept` files, `assessment.css` and `blueprint.css` are untouched apart from dead-rule removal.

## ADR 031: The chrome comes out cleanly; the modals do not

Accepted. `Workspace` held the frame and three roles' worth of screens in one 3,149-line function. The navigation drawer, the prototype banner and the topbar are the honest first thing to lift out: they are identical for every role, they are what side by side renders three of, and they depend on about ten named values rather than on Workspace's internal state. They move to `Shell.tsx` along with `identity()`, which replaces the role-to-initials ternary that appeared three times.

The Demo settings dialog follows, for a different reason. It read fourteen pieces of internal state inline — `setS`, `save`, `seed`, `migrateDispatch`, `setActive`, `setCustomer`, `setStep`, `setPage` and the rest — which is what "reset the demo" genuinely needs, but not what a dialog should know. Workspace keeps the resetting and hands the component four callbacks.

**The other ten modals stay.** Between them they read about twenty-five pieces of Workspace's internal state: `choose`, `reoffer`, `replacementOptions`, `notify`, `update`, and a dozen setters for the selection, the wizard step, the payment result and the contractor's current visit. Extracting them would replace inline code with a props bag of the same size — the coupling made explicit but not reduced. What would make them separable is consolidating that state behind a reducer or a context first, which is the full decomposition this round deliberately did not take on.

**On performance: this changed nothing, and it was not supposed to.** Side-by-side typing cost 25.2 ms median per keystroke before and 29.1 ms after — noise. The 27 ms lives in the role bodies re-rendering three times over shared state, not in the chrome. Moving the chrome out does not touch it, and saying otherwise would be inventing a result. Workspace went from 3,149 lines to 2,911.

Nothing rendered changed: the same 98-screen, 17,897-element computed-style snapshot, identical. The Demo settings dialog's four callbacks are exercised end to end — the toggle writes to state, the clock advances exactly three hours, a scenario selects and closes, and Reset restores the seed and says so.

## ADR 032: Validation that names a field says so on the field

Accepted. The customer intake already did this — "Enter a Canadian postal code, for example L6J 4S7." sits under the postal code box, appears on the attempt, and clears as it is fixed. Everywhere else the same job was done by a toast: a sentence that slides in over the corner of the screen, names a field the user then has to go and find, and leaves after three and a half seconds whether or not it was read. Seventeen of them had accumulated, mostly on the operator's scheduling path — the densest form in the app.

The reason the toast kept winning is worth naming, because it is not laziness: `notify("…")` is one line and the inline version was six, repeated per field. `fields.tsx` is those six lines, once — `useFieldErrors()` returns `fail`, `clear`, `fieldClass`, `invalid` and a `Message` component, so a guard reads `return fail("provider", "…")` and the field gets three short additions.

Sixteen of the seventeen moved. The messages were also rewritten where the toast had been vague about which control it meant: "Choose a provider with the required skills" became "This provider lacks the required skills or restricted-work eligibility for the selected tasks", because by then the message is sitting under the provider you picked.

**One stays a toast, on purpose.** `beginReassign` refuses to open the reassignment panel at all when Yousef cannot cover the visit — there is no field on screen for the message to sit beside, because the screen it would sit on is the one being refused. A toast is the right shape for that, and forcing it inline would have meant inventing a field to hang it on.

Buttons stay enabled and validate on click, which is the existing house rule: a control that looks inert but is not would be worse than one that explains itself when pressed.

## ADR 033: The demo opens with a walkthrough already in it

Accepted. `seed()` contained no walkthroughs and no findings, so the feature the last round built opened on "No walkthroughs yet" — the correct message and the wrong first impression. A reviewer clicking Walkthroughs had to do a property's worth of data entry before seeing anything it does.

Two are seeded. One **sent** assessment with three findings — two priced, one needing a closer look — so the guest link, the totals, the tax line and all three finding states are real on arrival. One **draft** with a single finding, so the capture surface is real without pre-deciding what the reviewer records next.

They are built by calling `createWalkthrough`, `addFinding` and `sendWalkthrough` rather than by writing record literals, so seeded content cannot drift into a shape the app would never produce. A test asserts the sent one has no `sendBlockers` — the same gate a human has to pass.

`seedWalkthroughs` lives in `pmw.ts` and is called from `store.ts`, not from `seed()`, because `pmw.ts` imports `model.ts` and the reverse would be a cycle. That turns out to be the better seam: `seed()` stays the plain record set the logic tests build on, and the demo content is added at `freshDemo()` — the one place the demo actually starts, which both a first visit and "Reset all demo data" now go through.

## ADR 034: carryForward gets the entry point it never had

Accepted. `carryForward()` was implemented, tested, and called from nothing. Its `"Superseded"` state in `findingState()` was therefore unreachable in the running app, and `carriedFrom`/`resolvedBy` were written by no one — a documented behaviour that could not be demonstrated.

A draft walkthrough now shows **Still open from earlier visits**: the findings this property's earlier visits left deferred or unpriced, each with one button. `carryCandidates()` computes the list from `propertyRecord()`, drops anything already carried into this walkthrough, and returns nothing at all for a walkthrough that has been sent — carrying into a sent assessment would change what the customer is already looking at.

This is the pairing the feature was designed around: a deferred item and an item nobody could price are precisely the reasons to walk a property twice. Carrying one restates it with its own price and its own decision, and supersedes the original, so the maintenance record shows one live item rather than two copies of the same problem.

## ADR 035: Account carries a type; individuals get a contact too

Accepted. `customers` was a flat `{ id, name }` list, which both pre-implementation audits named as the largest modelling gap: a property management company with several properties and several people, and the question of who may approve, had nowhere to live.

Three shapes were considered. An `Organization` record with an invisible one manufactured for every homeowner stores a fiction. Giving individuals no `Contact` row at all is fewer rows, but makes "who raised this" and "who approved this" a Contact sometimes and an Account other times, so every reader branches on account type — a branch that would appear in dozens of places and be wrong in one.

`Account` carries `type: "individual" | "organization"`, and **every** account has at least one `Contact`; an individual has exactly one, which is that person. One extra row per homeowner buys a uniform answer to the only question that matters downstream: which human. `inactiveAt` retires a contact without deleting them, because approvals keep pointing at people after they leave.

`migrateAccounts()` renames `customerId` to `accountId` on saved states and deletes the old key rather than leaving an alias on the type, so there is exactly one name for the field in the source. It runs before `migratePmw()`, which builds properties out of requests and so needs their accounts already rewritten.

The seed carries one organization with two contacts in different roles. Without it, `Account.type` would have a branch nothing ever takes — the same defect ADR 034 was written about.

## ADR 036: Approval is a snapshot, written by the function that sets the status

Accepted. A quote had no record of what was approved. `audit-reconciliation.md` claimed otherwise — that a quote carried `taskIds` — and that was wrong: `taskIds` is a field on `Visit`. The audit that said approval has no version was right, and the reconciliation had filed it under "what the audits got wrong".

A quote is priced against its **request**, and that request's tasks can change afterwards, so "what did they agree to" is unambiguous only at the instant of approval. `Quote.approval` freezes the contact, their role, the timestamp, the amount, the high figure and the task ids as they stood.

It is written inside `approveQuote()` rather than by each screen. The same reasoning moved `sendBlockers()` into the data layer in ADR 028: if the status can be set from one place and the snapshot from another, `Approved` and `what was approved` become two facts that can disagree. A second approval is refused rather than re-stamping the first, so a double-submit cannot move the agreed date.

The amounts are copied rather than read back off the quote. Today they would agree, because a quote is superseded rather than edited — but the record must not depend on that staying true.

## ADR 037: Materials responsibility is a field, not a policy

Accepted. `"Materials required"` has been one of the five task outcomes since the beginning, and it was a stall: it recorded that work stopped without recording whose materials were missing.

The tempting fix was a company policy — "the operator supplies everything" — which is clean in a schema and wrong in the world, because it makes the operator the delivery driver for every box of screws for every contractor in the region.

`Task.materials` instead holds one of four values: `Customer supplied`, `Provider standard supplies`, `Operator supplied`, `To be confirmed`. Per task rather than per job, because a customer-supplied TV and a provider-supplied box of anchors routinely sit in the same visit. The default is the explicit "nobody has said yet" rather than a guess.

This interacts with fixed contractor pay, and the interaction is stated rather than left implicit: `Provider standard supplies` means ordinary consumables, and because pay is fixed on acceptance, that pay includes them. Otherwise the fixed-pay promise erodes on exactly the jobs needing the most patch material.

## ADR 038: Rework is new work on a new request

Accepted. `Completed` was terminal with no path back, which is correct — but it left rework with nowhere to go.

Reopening the original task would rewrite history: on the day it finished, the work *was* done, and destroying that date to represent a later complaint makes the maintenance record lie. So rework is a new task carrying `originTaskId` and `reworkReason`.

It goes on a **new request**, not the original one. This is the part that is easy to get wrong: request status is derived by `reconcile()` from its tasks, not stored, so adding an unfinished task to a finished request would derive that request back out of `Completed` — the same destruction by a different route. A test asserts the original request still holds exactly one task after rework is raised.

`warranty` is `{ billable, decidedBy, decidedAt }` and starts **absent**. Whether rework is chargeable is a judgement someone makes, sometimes days later and sometimes after visiting the property; a boolean defaulted at creation is wrong for half the cases and silently so. "Raised, nobody has decided who pays" is a true state and is better visible than guessed.

## ADR 039: The write boundary reads before it writes

Accepted. Two open tabs could lose each other's work. `save()` did a blind `localStorage.setItem`, and `commit(previous, fn)` cloned `previous` — the state the calling tab had **rendered from** — rather than what was on disk. The second tab's clone never contained the first tab's change, so saving it erased that change.

The symptom is worse than the double-booking it was filed under. Two visits at one time is a clash an operator would see. What actually happened is that one customer's confirmed appointment vanished, with nothing anywhere recording that it had existed.

`commit()` now reads the newest state off disk, applies the change to that, bumps a `rev`, and writes only if `rev` on disk is still the one it read. A losing write re-applies itself against the newer state, up to three times. Re-applying is safe because every mutation in this codebase addresses records by id rather than by array position, so the same function against a newer state means the same thing.

What re-applying does **not** mean is that the change is still valid. A booking whose slot was taken in between has to notice that itself, which is why `bookVisit()` checks availability *inside* the write. Validating before the commit checks a state that no longer exists by the time it matters — that was the original bug in a different costume.

`rev` is optional on the type and backfilled by `migrateDispatch()`. Requiring it in `checkShape()`, as first planned, would have sent every state saved before this existed to the recovery screen.

The atomicity claim is deliberately narrow. Read-check-write in one synchronous block cannot be interleaved *within* a tab, because JavaScript is not preempted mid-block and localStorage is synchronous. Two tabs are genuinely concurrent, which is what the version check is for. Neither is a substitute for a server-side transaction, and the comment in `store.ts` says so.

`update()` stopped calling `commit()` inside a React state updater at the same time. StrictMode double-invokes updaters in development, so every write ran twice — two saves, two rounds of notifications. Production builds do not double-invoke, so the shipped app was unaffected, but a state updater must be pure.

## ADR 040: A held slot is a record, not a UI state

Accepted. Rechecking availability at checkout narrows the race window; it does not close it, and it produces the worst version of the experience: the customer picks a time, fills in their details, and is refused at the end.

`Hold` is a record with an expiry. `available()` refuses a slot covered by another request's live hold — the same overlap arithmetic it already ran against booked visits, so it is written once and asked twice. A request never blocks itself, or a customer could not book the slot they are holding.

Holds expire rather than being released by whoever abandoned the checkout, because the usual way to abandon a checkout is to close the tab. `reconcile()` drops the expired ones beside where it already expires contractor offers — the same kind of fact, a promise with a clock on it that nobody is coming back to clear by hand.

Idempotency rides on the same write. Each booking press carries an `opKey`, stored on the visit it creates; a repeat with that key returns the existing visit. A double tap, a retried press and a re-applied `commit()` therefore all produce one appointment, which matters more now that a losing write re-applies itself automatically.

## ADR 041: Duplicates are found with a different key than the one that prevents them

Accepted. Two records for one building can arise two ways: `migratePmw()` builds a property per distinct request address, and an operator can type an address in Walkthroughs that already exists.

The obvious move was to reuse `propertyKey()`. It is wrong for this, and the reason is worth keeping. `propertyKey()` is `norm(address) | norm(city) | accountId` — it includes the account **on purpose**, and a test asserts it "never merges across customers", because re-homing one account's request under another on matching text would be the serious bug ADR 018 exists to prevent. A detector that reused it could never surface the duplicate that matters most: one address reached by two accounts.

So detection has its own key, `addressKey()`, over address and city alone. `propertyKey()` is untouched. The two keys disagree deliberately: one is strict because it acts automatically, the other is loose because a person reads its output.

Nothing is merged automatically, and a cross-account match is **flagged rather than offered**. Address text cannot tell "two records for one house" from "two different units", and merging across accounts would move one account's maintenance history under another with no rule able to say which is right. The panel shows how many requests and walkthroughs each side carries, so the decision is made on evidence.

A merge **repoints and removes** rather than leaving a tombstone. `Task.mergedInto` set the other precedent, and it is filtered with `!t.mergedInto` at eleven separate read sites; properties are read in about seven files, so copying the pattern means a filter in each, every one of which can be forgotten, and a forgotten one renders a merged-away record as live. Repointing leaves nothing to filter, so no read site changed at all.

What replaces the tombstone is `mergedFrom`, old id → surviving id, consulted **only where an id arrives from outside**: today that is one place, a property id held in `useState` across a merge in another tab. Everything the merge itself repointed is already correct, which is the payoff.

Merging refuses rather than resolving where it would lose something: across accounts, and where both records carry different notes. Detail the survivor lacks is carried over; detail it already has wins.

## ADR 042: No account merge, because no account can duplicate

Accepted, and recorded so it is not mistaken for an omission. The review that prompted this work was right that duplicate accounts matter — a property management company entered twice is a real problem once the product is real.

It cannot happen here. `accounts` is a module-level `const` with no creation path; nothing in the app pushes to it. A `mergeAccounts()` would therefore be a function nothing could reach, which is precisely the defect ADR 034 was written about, and writing one to satisfy a plan would be worse than leaving the gap visible.

The gap is recorded in `decisions.md` with the trap that is waiting in it: account ids are stored **inside strings**. `notification.recipient` is `"Customer:<accountId>"` and `visit.messages[].sender` uses the same shape. A merge that rewrote only the typed `accountId` fields would not error — it would silently orphan the merged account's whole notification and message history. Property ids are not embedded in strings anywhere, which was checked rather than assumed.

## ADR 043: The event log gains detail without losing its narrative

Accepted. `events` was `{ id, text, at }`. It could say "Quote sent to Daniel Brooks · $420" and could not answer "who changed this price, and from what" — the question `docs/permissions.md` recorded as missing and both audits asked for.

Entries now carry optional `actor`, `requestId`, `entity`, `entityId`, `field`, `from` and `to`. Every one of them is optional on purpose. `log(s, text)` keeps its one-argument form, so the twenty-odd existing narrative entries are untouched and no call site had to change to keep working. A log where some entries carry detail is more useful than one that was never finished because every site had to be converted at once.

`from` and `to` hold **rendered** values — "$420", "Sent", "Customer supplied" — not raw ones. The log is read by a person, and a price stored as `420` would have to be re-formatted by whatever renders it, which is where the currency and the rounding rules would drift apart from the rest of the app.

The first quote on a request records no `from` at all, rather than "none" or "$0". There was no previous price, which is a different fact from a previous price of nothing.

Recording happens at the change, not at the screen. `approveQuote()` and `respondToOffer()` log from inside the data layer, which is the same reasoning as ADR 036: a status that can be set from one place and recorded from another gives you two facts that can disagree. A refused approval logs nothing, which a test asserts, because a rejected write is not a change.

A request shows its own trail through `auditFor()`, rendered on the request detail where the operator is already looking. A log nothing renders is the `carryForward` defect ADR 034 was written about, and this is the third time that pattern has come up in this codebase.

Coverage is deliberately partial and should be described that way: price, booking mode, materials, review, assignment, approval and property merges. Those are the changes the audits asked about. Every other write still logs its narrative line and nothing more, and extending it is adding an argument at the call site rather than changing the shape.

## ADR 044: The payment lifecycle is modelled, and says so

Accepted. Decision 3 settled the sequence — approve, store a method, confirm, authorize near service, capture at completion — and left it unbuilt. This builds every state and transition without contacting a provider, so a backend inherits a shape rather than a blank, and so the states a real integration produces have somewhere to live.

**Confirmation waits on a method, not on money.** `secured()` replaced two separate inline checks for `status === "Paid"` that could have drifted apart. A visit is confirmable once a `PaymentMethod` is on file, because the whole reason for authorizing near service is that a job three weeks out cannot hold an authorization that long — and the customer should still get a confirmed appointment. `Paid` and `Authorized` also satisfy it, because the simulated checkout writes `Paid` directly and the five demo scenarios depend on that shortcut.

**A failed capture is `Outstanding`, not `Failed`.** They are different situations. `Failed` is a charge that never started; `Outstanding` is work that was done and not paid for, which is the one an operator has to chase. Collapsing them was the original defect the audit named.

**A partial refund is its own status.** Not `Paid` with an amount beside it, because "we refunded one task of four" is a state someone filters on and a full refund is not the same thing.

**The authorization window is config, not a constant.** `AUTHORIZE_WITHIN_DAYS` decides whether the hold goes on at confirmation or is scheduled for that many days before service. Real expiry varies by network and merchant category and has to be checked against the provider's own rules at integration; asserting a number here from memory is exactly what decision 3 was rewritten to avoid.

**The token is shaped to look like a token.** `sim_tok_…`, not digits. In a real integration the provider issues it and it is all this application would ever hold; a simulated value that looked like a card would invite someone to treat it as one.

Labelling is per surface rather than per state, which is a deliberate middle setting. An `Authorized` badge reads like a hold on a real card, so each payment surface carries one notice saying nothing is stored, held or moved. A marker beside every state would be noise; the blueprint entry alone would not reach anyone using the demo.

What this does **not** model: a provider is asynchronous and can fail after returning, retries are not idempotent for free, and a scheduled authorization needs something to run it. Those are named in `blueprint-data.ts` as the production gap.

## ADR 045: Notification channels are chosen by urgency, and the classification is exhaustive

Accepted. Decision 11 settled that channel follows urgency rather than role, and the earlier version of `docs/notifications.md` had it the other way round for a reason worth remembering: the taxonomy was read off `emit()`'s recipient strings, which are roles, so the answer came out role-shaped. A cancellation two hours before an appointment is urgent whoever receives it.

`urgency` is a `Record<NotificationKind, Urgency>` over a union of every kind the app emits. Adding a kind without classifying it is a **build error**, not a silent default. That is the whole reason for the union: a notification taxonomy with a fallback branch is one that quietly stops being true.

**In-app is `delivered`; an external channel stops at `sent`.** In-app genuinely is delivered — it is sitting in the inbox. SMS and email never move past `sent` because without a provider nothing reports back, and freezing them there is the honest shape of the gap rather than a placeholder. A real integration turns that into delivered, bounced or a hard failure, and until one exists nobody can say which.

**A bounce is reachable, not theoretical.** A channel with no address on file bounces immediately with the reason. One seeded contact deliberately has an email and no mobile, so the state can be seen in the running app — the same rule as the seeded organization in ADR 035: a branch nothing reaches is a branch nobody maintains.

`unseen()` answers the question the audits actually asked — "has the contractor seen the offer?" — which the operator could not ask before, because an offer expiring unseen looked identical to one being ignored. It filters on time-sensitive kinds only: a document nobody opened is not something to chase.

## ADR 046: Notifications are part of the state, so they are computed before the write

Accepted, as a regression fix. ADR 039 reordered `commit()` to read-apply-write, and in doing so moved `deliverUpdates()` to *after* `writeIfCurrent()`. The reasoning at the time — "a stale write that ran out of retries is not persisted and not announced" — was wrong on its own terms: `deliverUpdates()` does not announce anything, it writes rows into the state.

The effect was that every notification raised between that change and this one existed only in the writing tab's memory. It rendered, and it was gone on the next reload.

The browser hid it. The tab that raises a notification is the tab that displays it, so the defect is invisible unless you reload, or read the stored state directly — which is what caught it: a delivery panel rendering with rows while `localStorage` held none.

Notifications are state. They are computed before serialization, full stop, and a regression test in `store.test.ts` asserts a raised notification is on disk. A second test asserts a re-applied write does not double them, and it also records that one-per-recipient is correct: a clarification goes to the operator *and* the customer, so the property worth asserting is that no recipient gets two, not that only one row exists.

## ADR 047: The guest link gets a token, and the page keeps saying it is not a secret

Accepted. Decision 5 settled the policy — high-entropy token, expiry, revocation, access log, fresh-link path — and this builds all of it.

**It is not security, and the honest statement has to come first.** Every token lives in the same `localStorage` as the rest of the state, so anyone who can open the app can read all of them. Nothing client-side could be otherwise. Two things the model does buy, and they are the entire justification:

- `PMW-0001` is no longer what the URL carries, so an assessment cannot be found by counting upwards from one. Small, but real.
- A backend inherits the fields rather than having them invented later from screens.

The page's existing notice got sharper rather than being removed, and the operator's panel says the same thing beside the link it is offering to copy.

`accessToken()` uses `crypto.getRandomValues` where it exists and falls back to a value prefixed `insecure-`. The fallback exists so tests and non-browser contexts do not throw, and it announces itself, because `Math.random()` behind the word "token" is the shape somebody copies into a backend without re-reading it.

**A refusal says why.** Expired, revoked and unknown are three different things to the person holding the link — "ask for a fresh one", "this was withdrawn", "check the link" — and a blank page is none of them.

**Re-issuing rotates the token**, which is what makes revoking mean anything: an old link stops resolving. Opens survive a re-issue, because how often an assessment was looked at is a fact about the assessment rather than about the current link.

**The access log is the part with immediate value.** *Did they ever open it?* is a question the operator could not ask at all before, and it is one sentence on the panel now.

One existing test had to change rather than the behaviour. It asserted the assessment page "never writes to the customer's browser just by being opened", which stopped being true the moment opening recorded the open — and it kept passing only because `renderToString` does not run effects, so it was asserting nothing. It is now two tests: rendering writes nothing, and opening writes exactly the one row and leaves the rest of the state byte-identical.

## ADR 048: Approval authority is a rule the operator can set, not a flag that ships

Accepted. Decision 2 deferred enforcement until Account existed. It does, so this enforces it.

`mayApprove()` gates **both** approval paths — `decide()` for a finding and `approveQuote()` for a quote — inside the data layer rather than in the screens, for the reason in ADR 036: an approval that can be recorded from one place and authorised from another gives two facts that can disagree.

An individual account's sole contact may approve without being granted anything. There is nobody else it could be, and making a homeowner grant themselves authority would be theatre. An organization's contacts may only where an operator has said so, which is the "Sarah raises, Ahmed approves" case the review raised.

**Deferring is not gated.** Saying "not now" commits the account to nothing, and requiring proof of authority to shrug would turn a non-decision into a permissions problem.

The grant lives in `State.approvers`, keyed by contact, **not** on the contact record. `contacts` is a static roster with no creation path, so the flag it ships with cannot be changed at runtime — building only the seeded flag would have left the decision half-built: the rule enforced, and nobody able to set it. That was caught by asking where the operator's grant button would write to. When contacts become records the overlay folds into them.

The assessment asks an organization *which contact* is approving, because a rule can be checked against a contact and cannot be checked against a typed name. An individual keeps the typed name.

This enforces a **rule, not an identity**. Nothing authenticates the person choosing from the list, `docs/permissions.md` says so, and no client-side app could do better.

## ADR 049: Spacing between boxes is owned by the stack, and "reads well" is now measured

Accepted. Three layout defects were reported from a narrow viewport on the live
site. Two of them had passed every responsive sweep run since Round 4, and the
reason they passed is the first thing worth recording.

**Every sweep measured overflow. None measured reading.** Nothing spilled,
nothing clipped, no scrollbar appeared — and a heading was still wrapping one
word per line inside a column 40% of the width it had. "No overflow" is not
"reads well," and only the first was ever checked.

The measurement that finds it is the **share of available width a block uses
while wrapping**. Characters per line is the obvious metric and it is the wrong
one: a 32px `h1` legitimately gets about eleven characters at 360px, so a
chars-per-line threshold flags every heading in the app and hides the real
finding in noise. Asking instead whether a block that wraps is using the room
its container gave it isolates the defect exactly — it found the decision card
at 360 and 480 in both themes, and nothing else anywhere.

**The decision card's cause was a shared rule with two call shapes.**
`.op-decision-head` is a row: a status icon beside a `<div>` wrapping the
heading and paragraph. Three walkthrough cards have no icon and no wrapper, so
their `<h3>` and `<p>` were direct flex children and became two columns. Fixed
in CSS rather than by adding wrappers at the three call sites: a rule that only
works when callers match one shape is a rule that will break again.

**The badge defect was an unscoped override, not a missing alignment.** Below
800px the *request* queue becomes a wrapping strip of shrink-to-fit chips, and
the rules that do that were written as bare `.queue-item`. The walkthrough list
uses the same class in a plain block parent, where `width: auto` made every row
only as wide as its text — so two rows sat side by side, the chip landed after
the text, and `.queue-item small { display: none }` silently removed the
address and finding count from each row. Scoping three rules to `.queue` fixed
the reported symptom and restored a line of information nobody had noticed was
missing.

**Vertical rhythm now has one owner.** `main` was a plain block; the gap between
boxes came from whatever margins the components happened to carry, collapsing
against each other — 20, 12, 28 and 0 pixels between consecutive boxes on one
screen. `main`, `.op-home`, `.customer-wrap`, `.contractor-wrap` and `.detail`
are flex columns with a single `--space-5` gap, and the margins that stood in
for it were removed **from the components** rather than overridden on them. The
first attempt did override them, with `main > * { margin-block: 0 }`, which
loses to every class selector — and even had it won it would have left two
owners arguing, which is the condition that produced the drift.

Two margins were doing a second job and kept it, scoped to it: `.op-view-switch`
spaces itself inside the Today card, `.task-review` inside a request panel.

**Not everything that measures uneven is a defect.** Spacing *inside* a card is
that card's own business and still varies; the report was about the boxes. The
identity switcher keeps its left-flowing pills, because those are choices to
read across rather than a status ending a row.

## ADR 050: One selected state, one greeting size, one glance — and measuring the controls rather than looking at them

Accepted. Four pieces of feedback from the live site, three of which turned out
to be the same shape of problem: a rule that applied to one screen and was left
to chance everywhere else.

**A panel does not introduce itself twice.** The notifications panel rendered
its own `<h3>Notifications & messages</h3>` inside a dialog the shell already
titles "Notifications". "Mark all read" rendered unconditionally, so it sat
above "No updates yet." offering to mark nothing. It is gated on something
being unread rather than on the list being non-empty — a list where everything
has already been read has nothing to mark either, and the button would be just
as out of place there. Verified in all three states: nothing unread (no
button), something unread (button), and after marking (button gone, rows stay).

**Measuring the controls found a defect that looking at them did not.** The
reported symptom was an extra bottom edge on the operator's selected view-switch
button — `--shadow-selected` on a button that already carries an accent border.
Dumping the computed selected and unselected treatment of every such control,
in both themes, is what turned up the real one:

```
identity pill rest      bg rgb(58,47,28)  border rgb(46,53,64)  text rgb(240,205,150)
identity pill SELECTED  bg rgb(58,47,28)  border rgb(46,53,64)  text rgb(240,205,150)
```

Byte-identical. `:root[data-theme] .badge` outranks `.badge-accent` and
`.badge-neutral`, so nothing on screen said which account or contractor you were
viewing as — `aria-pressed` was the only signal, and only a screen reader could
read it. Four controls now share one pair of rules, each keeping its own layout;
the pair reads `aria-pressed` directly, so the two pill classes are gone and the
state lives in one place rather than in a class and an attribute that could
disagree. The contractor's tab strip had the opposite gap — a `.chosen` class
and no `aria-pressed` at all — and now carries both.

`--shadow-selected` stays for `.bp-stage-nav`, where an underline is what a tab
wants and there is no border for it to double up on.

**A size that was a property of which screen you were on.** `.op-greeting h1`
carried a deliberate choice — `--text-h3` with tight tracking, a heading that
frames rather than dominates — and applied to the operator alone. The other two
roles fell through to `.heading h1` and came out a step larger. The class is
`.role-greeting` and all three home headers wear it.

**The glance is one component, not three copies.** Extracting the operator's
markup is what makes "the same card" true rather than aspirational; three
hand-built copies would drift by the next round. The other two lead with the
next thing in the diary above their counts, which is what someone with two jobs
and one appointment is actually asking.

The contractor's counts are not a second opinion about its own screen.
`tabWork()` **is** the filter the Offers / Today / Upcoming tabs run — the tabs
were rewritten to call it — so a count and the list it promises cannot disagree.
A test asserts that equality rather than trusting it.

The customer's numbers are deliberately not buttons, and its date chip is a
plain span. Everything they could navigate to is already on that screen, and a
control with no effect is the ADR 034 defect.

**The break test found a rule nothing tested.** Removing each guard in
`glance.ts` in turn, dropping `&& !running` from the Upcoming filter changed no
test — because a merely overrunning job is already in the past, so the
exclusion never fires for it. The case it exists for is a job *started ahead of
its scheduled date*, which belongs to Today and must not also appear under
Upcoming. That test exists now, and the break is caught. A guard that has never
been seen to fail is not known to work, and this is the second round running
where the exercise found the gap rather than confirming there wasn't one.

## ADR 051: A count that cannot be clicked, and a count that counts twice

Accepted. Two pieces of feedback on the glance card shipped in ADR 050, one of
which was a real bug in the counting.

**"Open requests" was a total wearing a bucket's label.** It counted every live
request, which meant it contained both other numbers. A customer with one
booked job read "1 Upcoming visits" and "1 open request" — the same job, twice
— and anything waiting on them was counted under "Waiting on you" and again
under "open". Reproduced against the seed before touching it: account `c5`, one
request, `Awaiting Provider Acceptance`, read 0 / 1 / 1.

The third number is **In progress**: live requests that are neither waiting on
the customer nor already carrying a date. The three no longer overlap.

One overlap is kept on purpose and is worth naming: a payment due on a job that
already has a date counts under both "Waiting on you" and "Upcoming visits".
Those are different nouns — a request and a visit — and collapsing them would
mean dropping the visit count, which is the more useful of the two. Making
every live request land in exactly one bucket was the alternative considered;
it costs the ability to say "you have two visits this month" when both are on
one request.

**Counts carry their ids.** Each bucket returns the request ids behind it, not
just a length. That buys two things:

- A click opens something the number actually counted. The alternative — the
  component re-deriving "the first waiting request" — is two filters that can
  disagree, which is the same defect in a different place.
- "These numbers do not double count" becomes an invariant a test can check.
  The test walks every status `reconcile()` can produce, against a request that
  does and does not carry a visit, and asserts the id sets do not intersect and
  that each count is exactly the length of its own list. That is a property of
  the pair of sets, which is stronger than one lucky example.

**Every section is clickable**, which reverses the call made in ADR 050 that
the customer's numbers should be plain text. That reasoning — everything they
could reach is already on this screen — was true and still missed the point:
the accordion row is on the screen but collapsed and possibly below the fold,
so "open that one and bring it into view" is a real action. A bucket with
nothing in it still gets no handler, so the card never offers a button that
would do nothing.

**The break test found a bug rather than a gap this time.** Removing each rule
in turn, two changed nothing: nothing asserted that a `Completed` or
`Cancelled` request stays out of the counts, and following that up showed a
closed request's leftover visit *was* being counted as upcoming, because the
visit filter keyed on non-Draft rather than live requests. The test was missing
and so was the behaviour.

One remaining break changes nothing and is marked as such in the source rather
than papered over: no status is in both `WAITING_ON_CUSTOMER` and `CLOSED`
today, so filtering live there is belt and braces. Claiming a test covers it
would be worse than saying it does not.

## ADR 052: A defect in an engine this environment does not have

Accepted, with a verification gap stated rather than papered over.

The date picker on the operator's Today screen runs past its card on an iPhone.
Reading the CSS suggested several causes and **measuring ruled out every one of
them**:

- Not `box-sizing` — `base.css:9` sets `* { box-sizing: border-box }`.
- Not a missing width — `.field input` is `width: 100%`.
- Not the container query failing — the toolbar does collapse to
  `minmax(0, 1fr)` below 600px.
- Not the input's intrinsic minimum — its min-content width measures 170px
  against a 294px column.

In Chromium at 320, 360 and 390px the input's right edge and the card's content
edge are **the same pixel**, and page overflow is 0. It fits exactly.

The screenshot is not Chromium. It renders `Sep 30, 2026` centred with no
calendar affordance; Chromium renders `09/27/2026` left-aligned with one. That
is iOS Safari, where `input[type="date"]` carries a native intrinsic width that
`width: 100%` does not shrink. Dropping the native appearance is what lets the
declared width win, and the rule is inert in Chromium — measured identical
before and after, calendar indicator intact, because that indicator is a shadow
pseudo-element rather than part of the appearance.

**This fix is not verified against the engine that has the bug.** Playwright's
WebKit cannot be downloaded in this environment, so there is no way to reproduce
it here. The reasoning is sound and the change is safe, but "safe and reasoned"
is not "seen to work", and the difference is worth writing down rather than
letting a confident commit message imply otherwise.

**The harness gained the probe that this round proved it was missing**, even
though that probe would not have caught this defect either. Four rounds of
responsive checks never asked whether an element is wider than the box
containing it: the page-level overflow check exists but lives in the scenario
walk, which only ever visits one screen. The sweep now compares every visible
element's border box against its parent's content box, excluding parents that
scroll or clip on purpose. It reports zero across six widths and every screen —
which is the correct answer for Chromium, and says nothing about Safari.

The honest summary of what the checks cover: **one engine.** Every measurement
in every verification note in this repository is Chromium. That was never
written down before, and it is the thing that let an iOS-only defect through
four rounds that all reported clean.

## ADR 053: The walkthrough pipeline gets the same card, bucketed by whose move it is

Accepted. The operator's Walkthroughs page gains the glance card the three role
homes carry, on the same rules: every walkthrough counts in at most one bucket,
every number opens what it counted, and a bucket with nothing in it offers no
button.

**Lead: the oldest assessment still undecided, and whether it was opened.** The
open log from the guest-link work (ADR 047) was recorded and surfaced almost
nowhere; "sent five days ago · not opened yet" is the sentence it exists for.

**Three buckets, by next action:** Drafts (the operator's move), With customer
(sent, something undecided, nothing approved waiting — theirs), Ready to
convert (sent, approved findings not yet turned into work — the operator's
again, and the one that holds money).

**One precedence rule.** A sent assessment with some findings approved and some
undecided counts as Ready to convert, not With customer. Conversion works per
approval, so the approved half is actionable now without waiting for the rest.

**Converted walkthroughs are history and count nowhere** — including one whose
second finding is still pending, because the page the number would open offers
"Open the request", not anything about that finding. This exposes a
pre-existing gap rather than creating one. _Corrected in ADR 054:_ this
paragraph first said a customer could still approve such a leftover. They
cannot — the customer page locks every finding once the request exists — and
that lock is the gap: the finding was stranded, reachable from no count, no
page and no carry-forward list.

"Ready" uses the same finding filter as `convertApproved()`, so it means exactly
"the Convert button would do something". Its `!f.taskId` clause is unreachable
while conversion always flips the walkthrough to Converted, and the source says
so instead of claiming a test covers it.

## ADR 054: Leftover findings are closed out or carried, never stranded

Accepted. Once an assessment's approved work goes ahead, any finding the
customer never decided on used to vanish. The customer page locks every finding
once a request exists; the glance card counts converted walkthroughs nowhere
(ADR 053); and the carry-forward list offered only deferred findings and ones
needing a closer look. A finding in "Pending decision" on a converted
walkthrough matched none of the three.

There are two ways work goes ahead, and they get different treatment on
purpose.

**The customer submits.** Submitting ends their decision round. Anything left
undecided is recorded as "Not now" through the ordinary `decide()` path, and a
note above the submit button says so first, with the count. It is then an
ordinary deferral: on the property record, and carryable onto the next
walkthrough, which is the path deferrals already had. `closeOutUndecided()` in
`pmw.ts`.

**The operator converts early.** Conversion works per approval (ADR 053), so
the operator may convert the approved half before the customer finishes. That
path does **not** close anything out: an operator must never record a decision
the customer did not make. The leftover stays "Pending decision", and instead
`carryCandidates()` now also offers pending findings from converted
walkthroughs. The Sent card warns before converting, and the Converted card
says how many were left and where they will be offered.

The carry-forward list is the one place both paths end up. That is the reason
for the list, not a new mechanism: restating a finding on the next walkthrough
gives it its own price and its own decision, and marks the original superseded
so it is offered once.

Rejected:

- **Unlocking the customer page after conversion** so leftovers stay
  decidable. That means a second approval against an assessment whose
  authorization snapshot (ADR 036) already describes a different set. Each
  later approval would need its own payment step and request, which amounts to
  rebuilding conversion.
- **Deferring leftovers on the operator's convert too.** It is simpler, but it
  writes "Not now" into the record as the customer's answer when they never
  gave one.
- **Counting converted walkthroughs with leftovers on the glance card.** The
  page that number opens has nothing to act on (ADR 053's rule). The next
  walkthrough for the property is where the action is.

## ADR 055: Centred columns fill their space before they cap

Accepted. Reported as the contractor's Your Work page changing width between
Offers, Today and Upcoming. This was a regression introduced by ADR 049's
change, not an old defect.

**Cause.** ADR 049 made `main` a flex column so the stack would own the space
between boxes. The page columns inside it are centred with auto side margins,
and in a flex container auto margins on the cross axis switch off stretching.
Each column therefore shrank to its widest content, capped at its max-width.
In a block `main`, which is what these rules were written for, the same margins
fill the space and then centre. On the contractor page the widest content is
each tab's empty-state heading, so the column followed it: at 430px it was
360 / 364 / 398px across the three tabs, where 398px was available.

It was not only the contractor page. Measured against the commit before ADR 049:

| column                            | before ADR 049 | since                             | now |
| --------------------------------- | -------------- | --------------------------------- | --- |
| operator Home, 1280px             | 944            | 624, and 654 on All Requests      | 944 |
| contractor, 1280px                | 760            | 360–474 by tab                    | 760 |
| customer New request form, 1280px | 760            | 444                               | 760 |
| customer home, 1280px             | 760            | 760, by luck: its content is wide | 760 |

**Fix.** `.op-home`, `.customer-wrap`, `.contractor-wrap` and
`.customer-intake` get `width: 100%` alongside their existing max-width and
auto margins: fill, then cap, then centre. `align-self: stretch` would not have
worked, because auto margins take precedence over it. The duplicate
`.contractor-wrap { max-width; margin }` in `contractor-concept.css` is deleted.
It restated the shared rule with `margin: auto` in place of `0 auto`.

**Why the probes missed it.** All four existing probes measure one state of
each screen, and each state looked internally fine. Two probes are added:

- **Width across states:** click through every tab or segmented switch on a
  screen and flag any column or glance card whose width changes.
- **Shrink-wrapped by auto margins:** any flex-column item centred by auto
  margins that is narrower than both its space and its max-width.

Both are silent on the commit before ADR 049, and both fired on the four columns
above before the fix. The second one also found the New request form, which
the first cannot see because that screen has no tabs.

## ADR 056: The walkthrough is captured on site and priced afterwards

Accepted. The aim is time spent on the work rather than on the screen, and one
action at a time. A draft finding used to show ten fields at once: area,
title, observed, proposed, photo, pricing, price, two notes, and remove. Its
photo button opened a file picker rather than the camera, and nothing
separated standing in a room from writing a quote.

**Two modes, each the whole screen.**

- **Capture** asks only for what a person on site can give without stopping:
  a photo, a few words (the keyboard's own microphone is the voice input), and
  the room.
  - "Save & next item" keeps the room, since the next item is usually in the
    same one.
  - "Finish" saves an item that is half done and moves on to pricing.
- **Pricing** comes afterwards, one item per screen. The title is suggested
  from the note's first clause, and the price box has focus when the screen
  opens. It ends on "Send to customer".

Both are a fixed layer above the app chrome, so nothing else competes for
attention.

**A capture is an ordinary `Finding`, with no title and no price.** The send
rule from ADR 028 therefore already holds it back until it is priced. Neither
screen adds a gate of its own:

- `needsPricing()` is `sendBlockers()` asked which findings still need work;
- the pricing step checks one item with the same `named()` and `quotable()`.

**The room is a tap, not typing.**

- `Property` gains an optional `type`, with four values: House, Townhouse,
  Condo, Commercial. It is asked once, at the first on-site walkthrough, and
  stored on the property. It is optional so saved data keeps loading. The
  seed sets organisation properties to Commercial and the rest to House.
- `roomsFor()` returns the type's rooms, then any area this property already
  has, compared without regard to case. "Other" opens a text box, and a room
  typed there becomes its own button from the next item on. One spelling per
  room keeps the property record grouped by place.

**Choices made on purpose:**

- **A photo is optional.** A photo or a note is enough, which covers a noise
  or a smell. An item can have several photos.
- **The capture input carries `capture="environment"`,** which opens the rear
  camera directly on a phone.
- **Items still open from earlier visits** appear as one collapsed line, "N to
  re-check", rather than a panel. The operator needs to know they are there,
  not to read them at every item.
- **Nothing is priced on site.** Pricing is the slow, desk-shaped step, and it
  is the one that blocks sending.

**The draft card leads with one action,** chosen by state: "Start on site"
when the draft is empty, "Price N items" while anything is unpriced, otherwise
"Send to customer". "Continue on site" sits second.

**A path deliberately removed.** Pressing Send on an incomplete draft used to
reveal field errors on the finding cards. That attempt can no longer happen,
because Send is offered only once nothing blocks it. The pricing step names
the missing title or price on its own field, so the reveal code was deleted
rather than left unreachable (ADR 029).

**Not verifiable here.** Whether `capture` opens the camera, and whether
focusing the price box raises the number pad on iOS, both need a real phone.
In desktop Chromium the first falls back to a file picker. The full editing
page is unchanged, and is still where internal notes, customer notes and
corrections are made.

## ADR 057: Today's job runs one step at a time

Accepted. The second round of "one action at a time" (ADR 056 was the first).
After "Start job", a contractor's job page showed every task as a collapsed
panel. Each panel held:

- a required five-option outcome dropdown;
- a note;
- separate before and after photo pickers that opened the file picker, not the camera.

Below the tasks sat an always-open message thread, then "Complete job" and a
confirmation pop-up. The glance card and tabs stayed above the whole job.

**Job mode** is the same full-screen layer as the walkthrough capture
(`onsite.css`). It opens when today's accepted job, or any job already running,
is opened.

1. **Arrival.** The address and the task list, with one main button: "On my
   way", then "Start job". Navigate sits beside it, and "Already here? Start"
   skips the on-the-way step.
2. **One task per screen**, "Task 2 of 4":
   - Before and After buttons that open the camera directly;
   - the customer's answers and photos behind "Details";
   - one tap for **Done as described**;
   - **Something's different** opens the other four outcomes and a note box;
   - **Skip for now** leaves the task open, and Back revisits the one before.
3. **Finish.** "3 of 4 done", listing each task's outcome, and any task can be
   reopened from the list. While anything is open the button is "Do the next
   open task". Once nothing is, it is "Finish job". That screen replaces the
   pop-up.
4. **Finished.** "Next job" or "Done for today".

Messages moved to a header button showing how many messages came from other
people. There is no read state for messages, so it is a count, not "unread".
"Close" is always there: a running job reopens on its own the next time the
contractor opens Your Work, so leaving loses nothing.

**An exception needs a note, and that is a data rule.** An outcome other than
Completed hands the task back to the operator. "Materials required" does not
name the material, so `needsNote()` in `work.ts` requires a few words, and
`execute(…, "finish")` refuses while any exception lacks one. Job mode asks
for the note before moving on. The old job page asks on "Complete job", on the
note field itself.

**Photos stay optional**, as before. Each is one tap. **Tasks come in order**,
with skipping. `openTasks()` decides where job mode resumes and what the finish
screen still owes.

**What keeps the old page:**

- an accepted job on another day, which can only be read until its day;
- the operator's "View progress" and "Do it myself" job page, which is for
  watching or self-fulfilment at a desk.

**Not verifiable here:** whether `capture` opens the camera needs a real phone.

## ADR 058: The customer approves one decision at a time

Accepted. This is the third round of "one action at a time", after ADR 056
and ADR 057. The customer's assessment was one long page, about 3,960px at
phone width: every finding card, a summary table, then an approval form.
The form had a typed name (and, for an organisation, a contact list and a
typed role), an "I am authorized" checkbox, and a payment toggle, followed by
the Approve button.

**The flow now:**

- **Who is approving.** Organisations only. The customer taps their own name.
  Someone without authority is told so on the spot, and the authority rule
  stays in `mayApprove()` (ADR 048). An individual is one person, so they skip
  this screen.
- **One finding per screen**, "Item 1 of 3": the photos, what we saw, what we
  would do, and the price, with **Approve · $180** or **Not now**. Each answer
  moves to the next item. A finding that needs a closer look offers
  **Request an assessment** or **Skip**, never a price or an approve control
  (ADR 019).
- **Review.** Each decision is listed, and tapping one reopens it. Then the
  totals, "Approving as Sarah Lin" with Change, the saved card with Change,
  and one button: **Approve 2 items · $452.00**.
- **After approval**, the record page is unchanged: progress, findings,
  summary, property record and print.

The page reopens wherever the customer is next: the first priced finding
still undecided, or the review.

**What the customer no longer does:**

- **Type their name.** It comes from the contact, as an individual's own
  name or the organisation contact they tapped, along with that contact's
  role. "Change" lets an individual correct it.
- **Tick a checkbox.** The line under the button says what approving
  confirms. The approval snapshot still records who and when (ADR 036).
- **Add a card every time.** "Add payment method" saves a simulated card to
  the account with `storePaymentMethod()`. The next assessment, and the
  customer portal, find it there. The payment recorded at approval now names
  that card (`methodId`).

**Submitting is now a function, not a click handler.** `approveAssessment()`
in `pmw.ts` refuses, in order:

1. an assessment that is already closed;
2. nothing approved;
3. an approver without authority;
4. no name;
5. no saved card.

It then writes what the handler used to write: the snapshot, the ADR 054
close-out, the conversion, and the payment. The screen asks a copy first, so
it can show the reason without writing anything. These checks used to be
screen logic that no test could reach.

**Unchanged:**

- the print document;
- the record page;
- the further-assessment rules;
- the simulated payment sequence. Approval still records the payment as it
  did before; that is out of scope here.

## ADR 059: The operator works through decisions one request at a time

Accepted. This is the last round of "one action at a time", after ADR 056 to
ADR 058. The request page already showed one decision per request (ADR 010),
but the operator reached it through a page of about 25 controls and then went
back to Home by hand. Nothing carried them to the next request. Contractor
pay was a flat $180, never checked against the contractor's rate.

**The flow now:**

- **Entry.** Home has a **Work through N decisions** button above the
  Needs-attention list. The list stays for browsing.
- **One request per screen**, "Decision 2 of 5". Each screen shows the
  customer, the address and the tasks with their estimates; notes, answers
  and photos sit behind Details. One button carries the app's own suggestion:

  | Decision            | Button                                         | Also                  |
  | ------------------- | ---------------------------------------------- | --------------------- |
  | Check the scope     | Scope looks right (all unsure tasks, one tap)  | Adjust                |
  | Book the work       | Offer to Nina Patel · Wed, Oct 7, 11:00 · $240 | Do it myself, Change  |
  | Send the quote      | Send quote · $525                              | Adjust (inline price) |
  | Quote declined      | Send revised quote · $X (price box open)       |                       |
  | Contractor declined | Re-offer to Nina Patel · Wed, Oct 7 · $120     | Do it myself, Change  |
  | Follow up the job   | Open request                                   |                       |

  When no contractor can take the work, the button is **Do it myself** if the
  operator is free, and **Open request** if not. Every screen has **Skip**;
  Adjust, Change and Open request leave for the request page, where the full
  controls are.

- **Order:** urgent first (a declined or expired offer, a late or unresolved
  job), then oldest, by each request's earliest logged event. The order is
  fixed when the queue opens. A request acted on goes to the back: if it now
  needs something else (a quote once the work is accepted) it comes round
  again; if it is waiting on someone else it is passed over.
- **The end:** "All caught up · N decisions handled", then Home.

**Pay is the contractor's rate × the job's length.** `suggestPay()` is the
same floor reassignment has always enforced (`minimumPay` in
`replacementOptions()`), which no ADR recorded until now. It is the
queue's suggestion and the assign panel's default in place of $180. The panel
still lets the operator raise it, and refuses less on the field.
`offerVisit()` refuses it too, so the rule is data, not screen logic. A
re-offer pays no less than the declined offer did.

**The decisions are data, and the writes are shared.** `decisions.ts` holds
`nextDecision()`, the decision card's branch order as a value, plus
`decisionQueue()`. The request page's own writes were extracted into it
rather than copied: `approveScope()`, `offerVisit()` (`bookVisit` and the
offer) and `issueQuote()`. The page now calls them too, so the two screens
cannot drift apart. Reassignment uses the existing `reoffer()`.

**A declined quote is the operator's move.** A customer's decline left the
request "Awaiting Quote Approval", and `bucket()` filed every Awaiting status
under Waiting, so Home listed it under "Waiting for a response" while the
request page asked the operator to revise it. `bucket()` now puts a request
with a declined quote in Needs Action, and its Home card reads "Quote
declined". Without this the queue could never reach a revision.

**Unchanged:**

- the request page and its decision card;
- the reassign modal;
- the Needs-attention list and its own order;
- what each write records. The same log lines and fields come from the
  extracted functions.

## ADR 060: The request page says whether an offer was opened, not how every notice travelled

Accepted. The request page carried a collapsible **Delivery (N)** log: every
notification raised for the request, one row each, such as `offer →
Contractor:nina · In-app · delivered`. It was added for ADR 045's question,
"has the contractor seen the offer?", but it did not answer it for the
operator:

- the rows used internal kinds and raw IDs, gave no times, and almost all
  read "delivered";
- half of them were the operator's own copies or the customer's;
- the decline notice showed no recipient at all;
- the note under it explained the simulation, not what to do.

The question only matters while an offer is waiting. On a declined or
accepted offer it is already answered.

**The log is gone. Two facts replace it, each where it changes the next
step:**

- **A waiting offer says whether it was opened.** Under "Waiting on Nina
  Patel to accept", the "Offer sent" card reads "Sent Tue, Oct 6, 11:39 a.m. ·
  not opened yet" or "Opened Tue, Oct 6, 11:52 a.m.". The operator waits on
  one and chases the other. It is read from the contractor's own copy of the
  offer, never the operator's (`offerSeen()`).
- **Someone who could not be reached gets one warning.** Under the decision
  card: "Couldn't text James Carter: no mobile number on file. Call or email
  them about this request." There is one line per person and channel, by
  name, however many notices bounced (`unreachable()`). The operator's own
  copies are left out, since there is nobody for the operator to chase.

**Opening an offer on Your Work now counts as seeing it.** Until now only
opening the notice from the bell marked it read. A contractor who opened the
offer from their work list, or landed on it because it was their only one,
would have shown as "not opened yet" while looking at it. An offer open on
that screen is now marked seen (`markOfferSeen()`). The write happens once,
only while it is unopened, and never during render. Seeing the list without
opening the offer does not count.

**Unchanged:**

- the notices themselves, their channels and delivery rows (ADR 045);
- the bell inbox, which still shows each notice's delivery;
- History on the request.

## ADR 061: The customer view reads as production; the demo says so once

Accepted. This narrows ADR 044/055 ("say once per surface that payment is
simulated") and ADR 047 (the guest assessment link keeps saying it is not a
secret), for the customer view only.

The customer screens explained the simulation inside the product: "Demo
payment due after approval · No real charge. Nothing is stored, held or
moved…", "Test card", "Send simulated message", "Illustrative location ·
simulated, not geocoded". They also showed the records' own vocabulary:
"YOUR MANUAL QUOTE" with a "Sent" badge, visits "Proposed", notices reading
"Your request: Awaiting Provider Acceptance".

**The demo now says it is a demo in one place.** The top "Interactive
prototype" banner stays, and so does the "Viewing as" switcher, because it is
how the demo is driven. Everything inside the product reads as it would in
production:

- **Words for the customer.** The customer gets what they are waiting for or
  have to do, not the record's state:
  - a quote is "Awaiting your approval", not "Sent";
  - a visit is "Awaiting confirmation", "On the way" or "Follow-up needed";
  - an assessment is "Being prepared", "Awaiting your approval" or
    "Approved".

  `customerText.ts` holds these maps, next to the existing request map. The
  badges and the customer's notifications both use them, so the two cannot
  disagree. `status:check` reads the maps from there, and every label has a
  row in the status dictionary.

- **No disclaimers.**
  - The quote's payment line, checkout, the assessment's card line, the
    intake address preview and the guest assessment footer lose their notes
    about the simulation.
  - Checkout shows the card on file and one "Pay $165" button.
  - Receipts drop the "demo_" prefix.
- **No back office.**
  - "Operator has a question" becomes "We have a question".
  - The business's messages are signed "fieldwork".
  - The 24-hour change and cancellation toasts say "We'll be in touch."
  - The customer's inbox has no delivery rows and no note about
    integrations.
- **The test control moved out.** "Simulate a failed payment" was a checkbox
  in the customer's checkout. It is now "Customer payments fail" in Demo
  settings, and a failure tells the customer "Your payment didn't go through.
  Try again, or use another card."
- **The footer's "Local prototype · CAD · America/Toronto" is gone.**

**Unchanged:** the operator and contractor views keep their wording, where it
is useful to them. That covers the inbox's delivery rows and note, "In-app
simulation" on threads, "Quote sent", "Simulated payment paid" and the event
log's "Demo payment received". The records keep their states too: only the
customer's words change.

## ADR 062: The customer and the contractor get their own one-at-a-time queue

Accepted. The operator's **Work through N decisions** (ADR 059) now has a
counterpart for the other two roles. All three use the same rules: one item
per screen, the suggested action on one button, Skip, an order fixed when the
queue opens, items re-read live, and "All caught up" at the end. The two new
queues share `QueueLayer.tsx`.

**Customer: "Review N things waiting on you".** N is the glance's own
"Waiting on you" count, because the queue is built from it
(`customerQueue()` in `roleQueues.ts`). Four kinds of screen:

- **Quote:** "Approve · $165". Decline reveals optional reasons (_Too
  expensive · Changed my mind · Found someone else · No reason_), and one tap
  declines. The reason is stored on the quote (`declineReason`). The operator
  sees it on the request page's "Quote declined" card and on the operator
  queue's revise screen.
- **Payment:** the card on file and "Pay $165". A failure (Demo settings'
  "Customer payments fail") stays on the screen and says so.
- **Our question:** the question, a reply box and Send. An empty reply is
  refused on the field.
- **Assessment:** "Your assessment is ready · N items to decide" and
  **Review assessment**, which opens the assessment's own one-item-per-screen
  flow (ADR 058). Until now the portal counted these under "Waiting on you"
  but had no way into them.

Assessments come last, because reviewing one leaves the queue. Something the
customer acts on and that comes round again (an approved quote, now to pay)
goes back in ahead of them.

**Contractor: "Review N offers".** N is the Offers tab's count, built from
the same list (`contractorQueue()` uses `tabWork()`). Each screen shows the
job, customer, time, length and pay, with task details behind Details. Accept
job; Decline reveals reasons (_Not available · Too far · Pay doesn't work ·
Outside my skill set · No reason_), and one tap declines; or Skip. An offer
shown counts as seen (ADR 060). Today's jobs stay in job mode (ADR 057),
which already runs one step at a time.

**One write per action, shared with the portal.** The queues call the same
functions as the portal's own buttons, so the two cannot drift apart:

- `approveQuote()`;
- `declineQuote()`, new, which the quote card's Decline now uses too;
- `payQuote()`, extracted from the checkout dialog;
- `answerQuestion()`, which the portal's reply box now uses too;
- `respondToOffer()`.

**Two counting corrections found on the way:**

- **A declined quote** left the request "Awaiting Quote Approval", so the
  customer's glance still counted it as waiting on them. The operator's
  bucket had the same problem, fixed in ADR 059. `customerGlance()` now
  leaves it out.
- **An unanswered question** on a request still waiting for a contractor was
  never counted. `reconcile()` lets "Awaiting Provider Acceptance" outrank
  the question, so the status never said "Information requested". The glance
  now counts any unanswered question, and the queue asks it first, since it
  is quick and the request comes round again for whatever follows.

## ADR 063: Four quick wins: assessment links, countdowns, real task titles, paying after the work

Accepted. The first of four batches from the UI/UX review, each planned and
confirmed before it is built.

**The customer can get to their assessment, and back.** The maintenance
record in My bookings listed a sent assessment as "Awaiting your approval"
with no way to open it; only the operator's copy had links. The customer's
copy now shows the status and an **Open assessment** link, in the same tab.
On the assessment page itself the current assessment has no link to itself.
The assessment page gains **← My bookings**, to `?role=Customer&account=…`.
The app reads those two parameters and opens the portal as that customer,
ignoring an account it does not know. The link is relative, so the page
still renders without a window.

**Time is said as time left.** `countdown()` gives "2 days", "1 h 40 m" or
"25 min" against the demo clock, and null once the moment has passed, so
"Advance clock" moves every countdown. `When` renders it as "Expires in
1 h 40 m · Wed, Oct 7, 12:03 a.m.", with the date muted and the countdown in
the warning colour under an hour. It appears on:

- the contractor's offer and its queue screen;
- each job card and the next job ("Starts in 1 day · …");
- job mode's arrival screen;
- the operator's "Offer sent" card ("… · expires in 25 min").

**A reviewed task never keeps a fallback title.** The classifier's two
fallbacks, "Tell us a little more" and "Electrical / restricted work
review", are named constants with a `genericTitle()` predicate. They are
fine as reasons to review, but they headed contractors' offers.
`reviewTask()` is now the one write for reviewing a task, used by the
request page's "Mark reviewed" and the queue's "Scope looks right" (through
`approveScope`). A generic title becomes the operator's, or else
`suggestTitle()` of the customer's description, and the change is logged.
Both screens show a **Title** field prefilled with the suggestion.

`suggestTitle()`, shared with walkthrough findings, now ends a long title at
the last joining word that leaves at least 15 characters ("Replace
electrical wiring and check a breaker", not "…a breaker that keeps"). Only
when there is none does it fall back to the last whole word.

**Pay on completion means after the work.** "Pay now" showed straight after
approval on a pay-on-completion quote. `readyToPay()` now requires an
approved, unpaid quote and, on completion, every live visit finished; the
quote card shows the button only then.

**A test that failed every Wednesday and Thursday.** `concurrency.test.ts`
booked "three days out" at 15:00 UTC, which lands on a weekend from a
Wednesday or Thursday, so four tests failed on those days on `main` as
well. The helper now moves to the Monday when that happens.

## ADR 064: Changes inside 24 hours, saved addresses, readable inboxes, contrast

Accepted. The second of four batches from the UI/UX review, planned and
confirmed before it was built. "Book the same as last time" was dropped:
the same job is almost never requested twice by one customer.

**A late cancellation cancels, holds the money and asks the operator.**
Inside 24 hours of a visit, "Cancel" used to log a line and show "We'll be
in touch", leaving the visit booked and nobody asked to act. Now:

- `cancelBooking()` is the only cancellation write, taken out of the Cancel
  booking modal. It always cancels the request, its visits and the offers
  still open on them. Declined and expired offers keep their status, where
  the old modal rewrote them.
- With every visit more than a day out, the money is refunded, as before.
  Inside a day it is held: the request records `lateCancel`, and the
  customer reads "Your visit is cancelled. Because it was less than 24 hours
  away, a late-cancellation fee may apply. We'll confirm." The modal says so
  before they confirm.
- `nextDecision()` gives the cancelled request one more decision,
  `late-cancel`, with a fee suggested at 25% of the quote. `bucket()` keeps
  it in Needs Action until then. The queue, the request page and the Home
  row all show it.
- `settleLateCancel()` keeps the fee and refunds the rest
  (`Partially Refunded`), or refunds in full when waived. A fee larger than
  what was paid charges the difference to the card on file as its own
  payment (`fee: true`). With no card on file the difference is
  `Outstanding`, the operator's to chase, never dropped.

**A late change promises a call.** Inside 24 hours, "Reschedule" records
`callBack` with a time two hours out. The customer reads "Your visit is less
than 24 hours away, so we'll arrange the new time with you. Expect a call by
6:15 p.m." The visit stays booked. The operator gets a `call-back` decision
with the customer's number, and two ways to close it:

- **Reschedule visit** opens the reschedule panel on the request page.
  Moving the visit closes the call.
- **Called, no change** closes it as it is.

`rescheduleVisit()` is the one write for moving a visit to a new time with
the same contractor; the customer's own reschedule uses it too. The renewed
offer carries the pay the contractor accepted, rather than the first offer's.

**Repeat customers pick a saved address.** The address step lists the
addresses the account has booked before, most recent first, plus "A
different address". With exactly one, it is preselected. Picking one links
the request to that property, so the work lands on the same maintenance
record. Changing the street or municipality unlinks it, and submitting links
it again by address. A saved address with no postal code opens the fields
with that one thing marked. The seeded requests now carry postal codes.

This fixed a bug: `migratePmw()` runs on every commit, so a new draft, with
no address yet, was given a property with an empty address that typing never
updated. Drafts are now skipped and linked once submitted.

**The staff inbox says what happened and to whom.** "Nina Patel: offer
offered · …" and "Sarah Lin: request awaiting payment" read like status
codes. The operator now reads, for example:

- "Offer sent to Nina Patel · …" and "Nina Patel accepted · …";
- "New request from Sarah Lin" and "Sarah Lin approved the quote";
- "Visit proposed for Sarah Lin · …";
- "Nina Patel is on the way · arriving around …".

The contractor reads "New job offer", "Offer expired", "Offer withdrawn",
"Job cancelled" and "You're on the way". Nobody is told about what they just
did themselves, so a contractor's own answer and the operator's own
withdrawal raise no notice. An offer withdrawn and renewed at a new time in
the same change reads only as a new offer. The request texts are a function
of status and name (`operatorRequestText`), not labels, so they sit in
`notifications.ts` rather than `customerText.ts`.

**Contrast meets WCAG AA in both themes.** A sweep over every role's
screens, the queues, the intake and the new late-change screens found four
colour pairs under 4.5:1:

- `--ink-muted` in the light theme (3.5:1);
- the intake's upcoming step names, dimmed with 40% opacity, in both themes.

`--ink-muted` moves to `#656a77` (light) and `#88919f` (dark). Both are the
smallest change on the same hue that passes on every surface. The dark value
also passes on raised surfaces, where it measured 3.9:1. The upcoming step
is muted by that colour instead of opacity. That is the one component rule
changed; the plan expected tokens only.

## ADR 065: Follow-ups are solved, not just flagged

Accepted. The first half of the third UI/UX batch. Distance on offers,
visit-day banners and notification links follow as ADR 066.

**Before this, a follow-up could not be cleared.**

- A visit that finished with a task not `Completed` kept `workIssue()` true
  forever, so the request stayed in Needs attention with only "Open request".
- The request page had no action for it either.
- The unfinished task counted as "assigned to visit", because the finished
  visit still listed it, so it could not even be booked again.
- A late arrival cleared only when the job started.

**Each unfinished task now gets a decision.** Its outcome records a
`resolution`:

- **Return visit**, when it is booked or sent to the customer as a charge;
- **Closed**, with the refund given, possibly $0.

`unresolved()` lists the outcomes still undecided, and `workIssue()` counts
only those. `reconcile()` gives a closed task the new status `Not done`.
`assigned to visit` now means an unfinished visit. A request completes when
every task is `Completed` or `Not done`.

**One screen, in two places.** `FollowUp.tsx` is the same component in the
operator's queue and on the request page's decision card. For each task it
offers **Return visit** or **Close as not done**:

- "Customer declined" defaults to Close; every other outcome to Return.
- **Close** suggests the task's share of the quote by estimated minutes,
  capped at what is left to refund (`refundShare`, `refundLeft`). It is
  editable, $0 is allowed, and a refund over what is left is refused inline.
- **Return** suggests the contractor who went first if they are free, then the
  first other contractor who can do the tasks, and the operator themselves
  (`returnOptions`).
  - **Pay** is suggested by reason (`returnPay`): the contractor's rate for
    "Needs return visit" and "Materials required", $0 for "Unable to
    complete". It is always editable.
  - `offerVisit()` accepts pay below the contractor's rate, down to $0, only
    when `returning` is set; every other offer keeps the floor.
  - **"Scope changed: charge the customer"** asks for an amount and a reason.

**An additional charge is approved and paid first.**

- `requestExtraCharge()` creates a `Charge` (`Sent`) carrying the planned
  return visit. The tasks count as heading for a return visit, so the request
  waits on the customer (the Waiting bucket, "Waiting on approval" on Home).
- The customer sees an "Additional charge" panel on the booking and a screen
  in their one-at-a-time queue, which counts it as waiting on them.
- `approveCharge()` takes the payment (Demo settings' "Customer payments
  fail" applies) and books the planned visit. If that time has gone, the
  tasks return to the operator with the charge already paid.
- `declineCharge()` hands the tasks back to the operator, who can close them
  or come back at no charge.

A charge is its own record rather than a second live quote. "The live quote"
is looked up throughout the app as the one quote not superseded, and a second
one would have changed every one of those answers. Its payment is an ordinary
`Payment` on the quote with `chargeId`, as ADR 064's fee used `fee: true`.
`workPayment()` keeps both out of "has the quote been paid?". Without it, a
paid charge would have hidden "Pay now" for the work itself on a
pay-on-completion quote, and payQuote would have refused it.

**A late arrival is told, then cleared.** `tellCustomerLate()` posts "Running
a little late: Nina Patel is arriving around 11:20 a.m." in the visit's
conversation, as the operator, and records `lateToldAt`. The job is still
late, but nothing is left for the operator to do.

**Who is told what.**

- **The customer** is told:
  - when a charge is waiting for them;
  - when a task is closed, and what was refunded;
  - what a finished visit means: "A return visit is booked for the rest. One
    task won't be done, and $164 was refunded."
- **The operator** is told when a charge is approved or declined.
- **Home rows** read "Unfinished work · 2 tasks left undone · return or
  close", then "Waiting on approval · $45 additional charge · …".

**Smaller fixes.**

- `sentence()` ends a sentence once. A time already ends in "a.m.", so the
  late message, the follow-up summary and ADR 064's call-back message all
  ended in "a.m..".
- Unfinished work is chosen before a late arrival on the same request.

## ADR 066: Trips on offers, visit day at a glance, notices that open the thing

Accepted. The second half of the third UI/UX batch, after ADR 065.

**An offer says how far it is.** "About 24 min · 16 km from Burlington"
appears on:

- the contractor's offer screen;
- each job card;
- the offers queue.

The minutes are the visit's own `travel`, the figure the scheduler booked it
with, so the 8-or-24-minute rule is not written a third time. `trip()` adds
where the contractor starts and a distance from a small table:

- 5 km across one city;
- a symmetric figure for each pair of the four cities.

When a pair is not in the table, the label leaves the distance out rather
than guess (`tripLabel`).

**Visit day, live.** `todaysVisits()` lists a day's visits in the demo's
timezone, earliest first. It leaves out cancelled visits and visits on
cancelled or declined requests, and keeps finished ones for the day.
`visitDayState()` says where each one is: Scheduled, On the way, Running
late, In progress, Done or Unfinished.

- **The customer** sees a banner at the top of My bookings, one line per
  visit today. Tapping it opens that visit:
  - "Today: Yousef Haddad arrives at 11:00 a.m. · in 2 h";
  - "… is on the way · arriving around 10:55 a.m.";
  - "Running late · … arriving around 11:25 a.m.", in the warning colour;
  - "Work in progress · started 11:25 a.m.";
  - "Done · finished 12:30 p.m.".
- **The operator** sees a Today strip on Home: a row per visit with its
  time, customer, contractor and a state chip, and a link to all of today.
  The strip and the "Scheduled visits" count are one list, so they cannot
  disagree.

**A notice opens the exact thing.** `noticeTarget()` maps each notice to
where it is about, for the role reading it:

- **Operator:** the decision card, a visit, a conversation or the question.
- **Customer:** the quote, an additional charge, a visit, a conversation,
  the question or the booking. A charge notice carries `chargeId`, so it
  opens the charge rather than the quote its kind would mean. A payment
  opens the quote, unless it came of a visit (a task closed with a refund).
- **Contractor:** the job, or its conversation.

The inbox opens that target. The pop-up now opens its own item, read,
rather than the whole inbox. `reveal()` scrolls the target into view and
outlines it for two seconds, one mark at a time. Nothing moves, so reduced
motion needs no rule of its own. The quote, charge and question cards gained
anchors for this.

## ADR 067: Contractors set their hours and see what they have earned

Accepted. The first half of the fourth UI/UX batch.

**Hours are the contractor's, and one check applies them.** Every time the
app proposes or accepts goes through `available()`. That covers:

- the operator's suggestions;
- the customer's instant picker;
- the operator's manual time;
- moving an offer to someone else.

It used to close weekends and everything outside 9–5 for everyone. It now
asks `withinHours()`, which reads that contractor's own hours:

- **Blocks:** for each day of the week, any of Morning (9–12), Afternoon
  (1–5) and Evening (5–9). Weekends included.
- **Days off:** single Toronto dates.
- **Windows:** neighbouring blocks run together, so Morning and Afternoon
  make one 9–5 with the lunch hour in it, as before. Morning with Evening is
  two windows, and a visit must fit one of them with its drive before and
  its 15-minute wrap-up after.
- **Default:** a contractor who has never set hours gets Monday to Friday,
  Morning and Afternoon. That is the old 9–5 exactly, so the seed and every
  existing test behave as before. `hoursOf()` supplies it, so nothing is
  backfilled.

`slots()` also tries 5 and 6 p.m., and those times appear only where a
contractor works evenings.

**The customer is held to what they asked for.** With weekends and evenings
no longer closed for everyone, the customer's timing is checked on its own:

- "Weekdays · …" excludes Saturday and Sunday.
- "1–5 PM" and "9 AM–5 PM" must end by 5.
- A new "Weekdays · 5–9 PM" choice starts at 5 or later.
- "Flexible" and the instant picker include any evening or weekend a
  contractor works.

**Changing hours doesn't strand work.** `setAvailability()` saves the hours.
Then:

- **Open offers the new hours miss are withdrawn** through the ordinary
  decline, with the reason "Outside my availability". The operator hears
  about it as any decline, and the auto-reoffer setting applies, so there is
  no new status.
- **Accepted jobs not yet started stay booked.** The page lists them as
  "Outside your new hours", each opening the job, and says to talk to the
  operator about any they can't make (`outsideHours()`).

**The pages.** The contractor navigation gains Earnings and Availability.

- **Availability:** a week of block pills, days off with inline errors (a
  past date, a day already off), and Save. Save says what it did, or that
  nothing changed.
- **Decline nudge:** declining an offer as "Not available" now shows
  "Update your availability" on that offer.
- **Roster:** the operator's Contractors page shows each person's hours in a
  line, for example "Mon, Wed–Fri 9–5 · Tue 9–9 · Sat 9–12", and their next
  day off. It is read-only, and nobody, the operator included, can book
  outside someone's hours.

**Earnings are worked out, not stored.** `earnings()` reads accepted offers
and their visits, grouped by Toronto week, Monday to Sunday:

- **Earned:** a finished visit at the agreed pay, whatever its outcomes. The
  contractor went and did what could be done. It falls in the week it was
  finished.
- **Upcoming:** accepted, not finished, not cancelled.
- **This week:** always shown, with its totals at the top of its card.
- **Payouts:** each week is paid the Friday after it ends. Until then it
  reads "Payout pending · Fri, Oct 16"; after that, "Paid". The page says
  payouts are simulated and no money has been sent. They stay apart from the
  customer's payment, as decision 12 in `docs/decisions.md` requires.

## ADR 068: A quieter request page, and a desktop panel beside the queues

Accepted. The second half of the fourth UI/UX batch, and the last of its
sixteen suggestions.

**The request page shows the decision, then one thing at a time.**

- **Above the tabs:** the summary, the decision card, any delivery warning
  and the customer-question card. Each needs attention when it is there.
- **The tabs:** everything else, one at a time.
  - **Tasks:** task review and splitting into visits.
  - **Visits:** each visit's card, its conversation and its assignments.
  - **Notes:** the customer's notes and stated preference.
  - **History:** the request's trail.
- **Which tab opens:** Visits once the request has a live visit, Tasks
  until then (`hasLiveVisit()`). Picking a tab overrides that until another
  request is chosen.
- **Counts:** each tab shows its count (Notes has none). On a phone they wrap
  two by two rather than squeeze.
- **History moved:** it used to sit in the decision card's More actions and
  now has its own tab. Decline, booking mode and payments stay in More
  actions.
- **Asking the customer is part of scoping.** "Need More Info" is a main
  button while the request has no live visit. After that it is the first
  item in More actions, still one tap away.
- **Fulfilment still takes the whole page.** The "Assign contractor / Do it
  myself" screen sits outside the tabs, because its rule is to hide
  everything but itself.
- **Jumps land on the right tab.**
  - "Review tasks", in the decision card and on the fulfilment screen,
    switches to Tasks and scrolls there.
  - A visit or message notice switches to Visits before it scrolls and marks
    its target (ADR 066).
- **The operator can read a visit's conversation.** Message notices have
  always gone to the operator, but no operator screen showed the thread, so
  such a notice opened onto nothing. The visit card on the Visits tab now
  carries it, where the notice lands.

**A panel beside the queues on desktop.** From 1024px, each one-at-a-time
queue has a read-only panel beside the decision column:

- the operator's decisions;
- the customer's to-dos;
- the contractor's offers.

The column keeps its 560px. Below 1024px the panel is not shown, so phones
are unchanged. `asideFor()` decides what each role sees, and it is never
more than they see elsewhere:

- **Operator:** the customer, the address, the tasks with photos, the
  customer's notes, the visit time, and the last five history entries.
- **Customer:** "Your booking": the address, the tasks with photos and the
  visit time. The operator's history is never shown.
- **Contractor offer:**
  - **Shown:** the city, the offer's own tasks with their answers and
    photos, and the offer's own time.
  - **Not shown:** the address and the customer's notes, as on the offer
    screen.
  - **No repeat:** the offer's inline Details toggle is hidden on desktop,
    since the panel already lists the tasks.

A customer's assessment has no request behind it, so it gets no panel.
`AuditList` is the one way a trail is drawn, in the History tab and in the
panel.

## ADR 069: Customer flows that finish, and say why when they don't

Accepted. The four P0/P1 findings of the customer UX audit.

**A request never blocks itself.** Choosing a time takes a hold
(`holdSlot`), and `available()` already ignored a request's own hold when
told whose it was. `slots()` never told it, so the customer's own hold hid
the time they had just chosen:

- the time dropped out of the list, the selection became invalid and was
  cleared, and Book & pay did nothing;
- the payment screen re-checked the slot the same way, so even a valid
  selection was refused as "no longer available".

`slots()` now takes the asking request (`forRequest`), passed by
`intakeOptions` and by the Instant payment check. Booking releases the hold
once the visit exists. A test locks it in: a request's own hold keeps its
time on offer, and someone else's hold still removes it.

**A refusal shows where the button was pressed.** Book & pay with no time
chosen shows "Choose an appointment time before booking." above the button
and moves focus to the first time. The message used to live only in the
More-times dialog, which is closed when it is needed.

**The one-at-a-time queues are real modals** (ADR 062), for the customer
and the contractor alike, on the sidebar drawer's rules:

- Escape closes;
- Tab and Shift+Tab stay inside;
- focus goes back to the button that opened it.

The layer is rendered inside the shell, so the shell cannot be made inert
as the drawer does. Everything beside the layer is made inert instead,
level by level up to the shell, which leaves the other columns usable in
side-by-side mode.

**Continue says which details are missing.** Continue on the tasks step
with an unfinished task opens it, marks its unanswered questions inline
("Answer this, or tap Not sure.") and focuses the first, as Save answers
does. The toast stays, but focus is no longer left on nothing.

**Builds on every filesystem.** `Glance.tsx` and `Earnings.tsx` differed
from `glance.ts` and `earnings.ts` only by case, so the app would not build
or run on Windows or macOS. They are now `GlanceCard.tsx` and
`EarningsPanel.tsx`.

## ADR 070: One thing to press, and words that agree

Accepted. The five P2 findings of the customer UX audit.

**One "Continue" on the tasks step.** The task card's button that moves
from the description to its questions now reads "Next: details", so the
step's own Continue is the only one.

**One primary button on the customer home, and it says what it does.**

- With one thing waiting, the button names it: "Review your quote for
  90 Rebecca Street", "Pay for…", "Answer our question about…",
  "Review your assessment for…" (`customerTodoLabel`). With more than one,
  it still counts them.
- A draft's "Continue request" and the trailing "New request" give way to it
  and become secondary. A draft is the customer's own unfinished work, not
  something waiting on them, so it stays out of the count. "New request"
  is also secondary while a draft exists, because it only resumes that draft.

**The badge and the line under it agree.** The line is chosen by
`customerProgressText` in `customerText.ts`, next to the badge wording
(ADR 061).

- "A provider has been matched" used to show as soon as an offer went out,
  under a "Matching you with a provider" badge. It now waits for an
  Accepted assignment. Until then the line reads "We’ve asked a provider and
  are waiting for them to accept."
- A decline still falls back to the ordinary matching line, so the customer
  never sees it.

**"Upcoming visits" counts visits that are booked.** A Proposed visit is
shown as "Awaiting confirmation" on its card, so the glance no longer counts
it as upcoming or names it as the next visit. Its request stays in "In
progress". `confirmed()` still lets in a booking whose visit has not been
reconciled yet, such as Instant Book's.

**No "Tell us a little more" as a job's name.** A task with a generic title
(`genericTitle`) shows the customer's own description instead, on the home
page and in the queue. An unanswered question now leads the status line:
"We have a question for you. Answer it below so we can keep going."

**The days picker only where it does something.**

- Instant Book offers real appointment times, so "Days that suit you" is
  hidden there. The intro says to pick one of them.
- Request to Book's days now start two days out, where `slots()` starts,
  so the customer is not invited to wish for today or tomorrow.

## ADR 071: A request's own hold does not hide its own time from the operator

Accepted. ADR 069 fixed this for the customer's intake; the operator's side
had the same gap.

**What went wrong.** A customer who picks a time in Request to Book holds it
for ten minutes, and submitting does not give the hold back. Every search the
operator makes for a free time then asked without saying which request it was
for, so the customer's own hold blocked the customer's own time:

- the recommended appointments and each provider's "First fitting time";
- the "Override proposed time" box, which ignored the time without a word;
- the decision queue's suggested offer, which proposed a different time.

Creating the visit already passed the request, so the time the screen would
not offer was one the write would have accepted.

**The rule.** A request never blocks itself. `suitableProviders` takes the
request asking, as `slots()` and `available()` already do, and every
operator-side search passes it. Another customer's live hold still blocks the
time, and a test holds it to that.

The hold itself stays after submission: it keeps the time the customer chose
from going to someone else while the operator schedules. Offering that time
first, rather than only allowing it, is left for a later change.

## ADR 072: The customer's chosen time comes first

Accepted. ADR 071 let the operator book the time a customer chose; this
offers it.

**Why.** A Request to Book customer picks a time with a provider, and that
choice is kept on the request (`preferredSlot`) and held for them. The
operator was still shown times by best route alone, so the customer's choice
came first only by coincidence, and the operator could not tell which time it
was.

**The rule.** `chosenStart` gives the customer's time while it still fits:
the same amount of work, and the time free for that provider, the request's
own hold aside. If it does not fit, nothing changes and best route decides,
with no message, because a time the customer can no longer have is not one
to explain to the operator.

- The scheduler selects the provider the customer chose with, if that time
  still fits them, instead of the best-route provider. A provider the operator
  picks by hand is never replaced.
- The chosen time is first in "Recommended appointments", selected by default,
  and labelled "Customer’s choice" rather than "Best route fit". "Why this
  time?" says the customer chose it.
- The decision queue's suggested offer follows the same order: the customer's
  provider at their time, then anyone free at their time, then best route.
- Splitting the job changes the amount of work, so the chosen time stops
  applying to either part.

## ADR 073: Who you are, where you are, and room to tap

Accepted. These are the customer audit's three P3 findings. Each is small;
they are taken together because each one is about the shell telling the
truth.

**The avatar names the account.** Every customer was shown as "SM", with the
name "Customer portal", so Sarah Lin and Daniel Brooks saw the same identity.
`identity()` now takes the customer account being viewed. The initials are the
first letters of its first two words (SL, NP), and the profile line uses the
account's name.

**One home label per role.** The customer's home was reached as "Home" from
the account picker, a first load and a direct portal link, and as "My
bookings" from everywhere else. So the breadcrumb switched between the two,
and on "Home" no sidebar item was marked. `homeOf(role)` was in the demo bar
and now lives in the shell. Every way in uses it, so the customer is always on
"My bookings". The marked sidebar item also carries `aria-current="page"`, so
it is announced as well as coloured.

**44 px text buttons.** Skip, Close and Decline were 27–36 px across. Every
`.text-button` now has a minimum of 44 × 44 px and side padding of
`--space-3`. Left-aligned links sit 12 px further in as a result. The demo
bar's buttons are exempt: that bar is prototype chrome, at a fixed height.

## ADR 074: Load what most visits never open when it's opened

Accepted. The build shipped one 602 kB script (174 kB gzipped), over Vite's
500 kB warning. Every visit downloaded every screen, including the developer
blueprint and the customer's assessment page, which most visits never see.

**Four screens load on demand.** They are the blueprint (`?view=blueprint`),
the assessment link (`?view=assessment`), the operator's Walkthroughs and the
customer's New request. `lazyScreen()` in `Recovery.tsx` imports each one the
first time it is opened. These four are split, and the three role workspaces
are not, because each of these is already its own module that only
`main.tsx` imports. The workspaces live inside `App`, share its state, and
the operator's home imports the contractor's `JobWork`, so splitting them
means a refactor first. That refactor is not done here.

**React gets its own file.** `react`, `react-dom` and `scheduler` go into a
`vendor` chunk. It changes far less often than the app, so a returning
browser keeps it across deploys.

**A screen that fails to load says so, and offers a reload.** A deploy
replaces every hashed file. So a tab left open across one asks for a chunk
that is gone. The app's own boundary would read that as broken saved data and
offer a reset, which is the wrong fix and a destructive one. Load failures
are tagged at the import and caught around the screen with "This page didn't
load" and a Reload button. The sidebar stays usable, and other errors still
reach the outer boundary. While a screen loads, a quiet "Loading…" line
stands in.

| | Before | After |
|---|---|---|
| App script | 602 kB (174 kB gz) | 305 kB (84 kB gz) |
| React (vendor) | (included) | 194 kB (61 kB gz) |
| On demand | — | Blueprint 37, Walkthroughs 29, Assessment 22, New request 18 kB |

A first load is now 499 kB (145 kB gzipped), and the build gives no warning.
The limit was not raised. Most of the drop comes from the vendor split. The
four screens are about 105 kB together, and the workspaces are still the bulk
of the app script.

## ADR 075: The role workspaces stay inline, for now

Superseded by ADR 078, which split the roles once ADR 077 had broken `Workspace` up. ADR 074 left the three role workspaces inside `Workspace` in
`main.tsx`. This ADR measured what splitting them would save before doing it.

**What a split would save.** These figures are for each role's first load
(today 499 kB, 145 kB gzipped). They come from rollup's per-module sizes,
scaled to the minified chunk.

| First load | Saved | Gzipped |
|---|---|---|
| Operator (the default) | 57 kB | about 16 kB (11%) |
| Contractor | 65 kB | about 18 kB (12%) |
| Customer (portal link) | 92 kB | about 25 kB (17%) |

`decisions.ts` and `FollowUp` stay shared whatever happens, because the
customer's queue and the shared request panels use them. The cost is moving
about 1,900 lines of JSX out of a component whose roughly 40 pieces of state
and 50 helpers all three roles share. Most of that move would be checked by
hand, since the tests cover the model, not the screens. A prefetch on idle
would then download the rest anyway, so the gain is time to first paint,
not bytes. That isn't worth it yet, so the workspaces stay inline.

**One part of it is kept.** `JobWork`, the job checklist, photos, outcomes
and finish sheet, moves out of `ContractorWork.tsx` into `JobWork.tsx`, along
with the `Sheet` dialog it uses. The operator runs the job too when they do
the work themselves. Importing it from the contractor's workspace tied the
operator's home to that whole module for no reason, so the move is worth
making on its own.

**When to revisit.** Revisit if `Workspace` is broken up for its own sake,
for example to make the screens testable. The split then comes almost for
free. Also revisit if first-load time on a phone becomes a complaint. The
60 kB intake catalogue (`catalogue.generated.json`) is the next candidate to
look at.

## ADR 076: The catalogue and the stylesheet stay in the first load

Accepted. ADR 075 named the intake catalogue as the next size candidate, and
per-screen CSS was deferred from ADR 074. Both were measured against today's
first load (499 kB, 145 kB gzipped), and neither is worth the code.

| Candidate | Raw | Gzipped | Best case saved |
|---|---|---|---|
| Intake catalogue (`catalogue.generated.json`, 81 issues) | 76 kB | 9.5 kB | about 6% |
| App stylesheet (Blueprint's is already separate) | 105 kB | 27.5 kB | about 3 kB (2%) |

**The catalogue isn't intake data.** It is how every request is classified.
Several things run synchronously on every render and read the catalogue:
`getIssue()` gives a request its title, its review policy and whether it is
referral only; `needsClarificationReview()`; and `questionAnswers()` labels
the customer's answers. They are called in `model.ts`, in `main.tsx`, in
every queue, and in `JobWork` and `JobMode`. Loading the catalogue on demand
would mean making classification async across the app. The other way is to
store the matched issue and its question labels on each request when it is
created, and then load the catalogue only in New request. That is a change
to the saved state, made to save 9.5 kB.

**The stylesheet is shared.** `assessment.css` is used by the queues,
PropertyRecord and Walkthroughs. `onsite.css` is used by QueueLayer and
DecisionQueue. The only CSS tied to one role is the three
`*-concept.css` sheets, at 1.3 to 1.7 kB gzipped each. They could only load
separately if the roles had their own chunks, and ADR 075 kept the roles
inline.

**When to revisit.** For the catalogue: if it grows past about 30 kB
gzipped, or if requests start storing their classification anyway, for
example so that a catalogue edit doesn't reclassify old requests. For the
CSS: if the role workspaces get their own chunks, since each role's sheet
can then go with its chunk. Until then, work on bundle size is parked.

## ADR 077: Workspace is broken up one role at a time, behind tests

Accepted. ADR 075 and 076 parked the role split until `Workspace` was broken
up for its own sake. This is that work. The goal is screens that can be
tested and files a person can hold in their head. It should change no
behaviour at all.

**Move, then pin, then cut.** Each step is checked by the step before it.

1. `Workspace` and `App` moved out of `main.tsx` verbatim, into
   `Workspace.tsx`. `main.tsx` is now only the entry. It imports `Workspace`
   before the global sheets so the CSS keeps its cascade order.
2. `workspace.test.tsx` renders the real `Workspace` on the seeded demo in
   jsdom, and pins what each role sees and can do: 15 tests, by role and
   visible text, not markup. jsdom and Testing Library are dev dependencies
   only.
3. The customer and contractor blocks moved into `CustomerWorkspace.tsx`
   and `ContractorWorkspace.tsx`. The tests didn't change, and they pass.
4. The operator's six small pages (Home, More, Walkthroughs, Today,
   Contractors and Activity) moved into `OperatorWorkspace.tsx`, which
   switches on `page`. The tests for Contractors, Activity and Demo settings
   were written first, and they passed before the move.
5. Requests moved into `OperatorRequests.tsx`, and `OperatorWorkspace`
   renders it. Five tests were written first: search and filter, the
   small-screen request list, Offer to a contractor and back, Do it myself,
   and Decline's confirmation. `Workspace` no longer renders any role's
   page inline.
6. The state, effects and helpers moved, verbatim, into
   `useWorkspaceState()` (`useWorkspaceState.tsx`, about 1,830 lines). It
   returns the `api` and the 46 names `Workspace`'s own chrome, modals and
   toasts read. `Workspace` is now its shell, about 850 lines. The tests
   didn't change.
7. The helpers only one role reads moved, verbatim, out of the hook and
   into that role's file: 19 into `OperatorRequests.tsx` (about 750 lines:
   fulfillment, quotes, payments, the decision card and the trail), 11 into
   `CustomerWorkspace.tsx` (the at-a-glance values and the quote and charge
   panels) and `RouteMap` into `OperatorWorkspace.tsx`. The hook went from
   about 1,830 to 740 lines. State stays in the hook: a role component that
   owned it would reset it on unmount, and the Requests search, for one,
   survives a change of page. A helper also stays when other code in the
   hook reads it, as `openContractorJob`, `candidates` and `scopeTasks` do.
   `WorkspaceApi` lost 31 names and gained 22, so it lists what the role
   files read. The tests didn't change.

| Block | Lines | Names it reads from `Workspace` |
|---|---|---|
| Contractor | 44 | 8 |
| Customer | 410 | 37 |
| Operator's six small pages | 130 | 9 |
| Operator Requests page | 861 | 58 (43 new) |

**Context, not props.** The extracted components read from
`WorkspaceContext` through `useWorkspace()`. `WorkspaceApi` in
`workspaceContext.ts` lists only the names an extracted component reads,
with the types `Workspace` declares them with. Those types were generated
with the TypeScript compiler, not typed by hand. `useWorkspaceState()`
owns all the state, and `Workspace` provides what it builds. The type grows with each extraction, until it is the workspace's
real shared API. For now the provider wraps only the role components, so the
rest of the return keeps its indentation and the diff stays readable.
`OperatorWorkspace` sits inside the same provider, in the slot of
`<main>` where the operator pages used to be, so the DOM doesn't change.
Where the compiler's type was a long inline object (the candidate
providers, the scope match, the appointment options), `WorkspaceApi` names
it with `ReturnType` of the function that builds it. `RouteMap` is a component
declared inside `Workspace`, so it gets a new identity every render. It goes
through the context as it is, and fixing that is separate work.

**No import cycles.** `NoteReply`, `TaskAnswers` and `ClarificationFields`
moved to `RequestFields.tsx`, because both `Workspace` and the customer
workspace use them. The lazy `CustomerIntake` moved into the customer
workspace, its only user.

**CSS order is part of the behaviour.** Vite orders the stylesheet by the
first import of each module. Removing `ContractorWork` from `Workspace`'s
imports moved `work.css` ahead of `onsite.css`. The rules were the same, but
the cascade wasn't. `ContractorWorkspace` is now imported where
`ContractorWork` was, and the built stylesheet is byte-identical. Check it
on every extraction. `useWorkspaceState` is imported right after it,
because the hook took over most of `Workspace`'s imports in the same order.

**What remains.** Nothing. The last step, a chunk per role, is ADR 078.

## ADR 078: Each role loads as its own chunk

Accepted. ADR 075 measured this split and declined it, because the role
workspaces shared one component's state. ADR 077 has since moved that state
into `useWorkspaceState()` and each role into its own file, so the split is
now a change to `Workspace.tsx`'s imports.

**What a role's first load saves.** These figures are measured on the build,
following each chunk's static imports. They include JS and CSS, gzipped.

| First load | Before | After | Saved |
|---|---|---|---|
| Operator (the default) | 608 kB, 174.6 kB gz | 563 kB, 165.8 kB gz | 8.8 kB gz (5%) |
| Customer (portal link) | 608 kB, 174.6 kB gz | 517 kB, 152.3 kB gz | 22.3 kB gz (13%) |
| Contractor | 608 kB, 174.6 kB gz | 527 kB, 154.8 kB gz | 19.8 kB gz (11%) |

The script every role loads went from 309 kB (86 kB gz) to 183 kB (51 kB gz).
The operator saves least, because most of the role code is the operator's.
The go/no-go line was 5% for every role, and the operator only just clears
it. The customer, who arrives from a link on a phone, gains the most.

**Each role is a `lazyScreen`.** `OperatorWorkspace`, `CustomerWorkspace`
and `ContractorWorkspace` load through `lazyScreen()`, like Walkthroughs. So a
chunk missing after a deploy shows "This page didn't load" and a Reload, not
the reset screen. The sidebar and the demo bar stay usable. State stays in
`useWorkspaceState()`, which is in the first load.

**The other two roles load when the browser is idle.** Once the first role is
on screen, `Workspace` asks `lazyScreen` to preload the other two. Without
that, switching roles in the demo bar would wait for a download. As ADR 075
expected, this saves time to first paint, not bytes. React suspends a lazy
component on its first render even when its chunk is already loaded, so
`lazyScreen` remembers a loaded screen and renders it directly when it is
mounted later. Each mount picks one way and keeps it, so a mounted screen
never swaps its tree.

**The CSS stays in the first load.** `onsite.css` and `work.css` reached the
stylesheet through the role modules. Splitting the roles would have moved
`onsite.css` into a sheet loaded after the main one, and put both later in
the cascade. `Workspace` now imports both first, where `ContractorWorkspace`
was imported. The built stylesheet is byte-identical, and has the same hash.
The per-role CSS was about 3 kB gzipped (ADR 076), not worth a cascade risk.

**Five small shared chunks stay separate.** `JobWork`, `QueueAside`,
`QueueLayer`, `RequestFields` and `PropertyRecord` are each shared by two
roles, so Rollup puts each in a chunk of its own, 2 to 7 kB. Grouping them
with `manualChunks` made the first load import the group, and moved CSS into
it, so they stay as Rollup made them. They load in parallel with the role.

**The screen tests load the roles first.** `workspace.test.tsx` renders each
role once in a `beforeAll` and waits for it. Every test then renders its role
at once, and no test changed.

## ADR 079: Focus always lands somewhere, and nothing destructive takes one tap

Accepted. These are the eight P1 findings of the platform UX audit of
2026-10 (`wiki/sources/platform-ux-audit-2026-10.md`). Each is pinned by a
screen test in `workspace.test.tsx` ("Focus and friction (ADR 079)"), and
each test fails without its fix.

**The operator's queue is on the shared layer.** `DecisionQueue` had its own
copy of the one-at-a-time layer (ADR 059), with no Escape, no Tab loop and
nothing behind it made inert. It now uses `QueueLayer` and `useOneAtATime`,
like the customer's and contractor's queues (ADR 062). It keeps its own
wording: "Decision N of M", and an end screen that goes back to Home.

**Focus has somewhere to go.**
- When a queue closes and the button that opened it is gone (its last
  item was handled), focus goes to the page's `h1`.
- In both queues, Decline opens its reasons with focus on the first
  reason, and Back returns focus to Decline. This uses `useSwapFocus`
  (`src/useSwapFocus.ts`), shared by every swap below.
- Each intake step's `h1` takes focus when the step changes, but not when
  intake first opens. A task editor that opens still takes focus from it.

**Declines and withdrawals confirm; removals undo.**
- The customer's quote card asks why, as the customer's queue does
  (`QUOTE_REASONS`, plus "No reason"). Focus stays on the card's heading
  once the buttons are gone.
- The additional charge asks "Decline this $N charge?", with "Keep it"
  focused.
- Availability counts the offers a save would withdraw, with a dry run of
  `setAvailability` on a copy of the state. If there are any, it says how
  many before saving, with "Keep editing" focused.
- Reset all demo data asks first, with Cancel focused.
- Remove finding shows "Finding removed. Undo", as intake's tasks do. Undo
  puts the finding back where it was.

A confirmation fits where the effect reaches someone else: an operator
revising a quote, a contractor's offer returned for reoffer, or every
scenario. An undo fits where the effect stays local to a draft. There is no
general undo from a snapshot. A decline sends notifications and frees
holds, and restoring a snapshot would retract them, so the people already
told would see something different from what happened.

**The role switch says which role is showing.** Each role button has
`aria-pressed`, and the group is labelled "Viewing as".

**What it cost.** The confirmations reuse `job-outcomes`, `secondary` and
`text-button`, and the built stylesheet is byte-identical. `useSwapFocus` is
a module of its own: importing it from `QueueLayer` would have pulled the
whole layer into the first load (+1.1 kB gzipped) to serve Reset. The first
load grew by 0.3 kB gzipped. There are 588 tests, ten of them new.

Out of scope, and left for later: the audit's P2s and P3s. These include
the Declined quote still reading "Quote ready", toast timing, and an undo
for the operator's Offer.

## ADR 080: What the screen says matches what happened, and is said where it can be read

Accepted. These are fourteen of the fifteen P2 findings of the platform UX
audit of 2026-10 (`wiki/sources/platform-ux-audit-2026-10.md`). The
fifteenth, intake focus, was fixed in ADR 079. Each is pinned by a test,
fifteen of them screen tests in `workspace.test.tsx` ("State and wording
(ADR 080)") and one in `glance.test.ts`, and each fails without its fix.

**Toasts have a tone and one timer.**
- `update` and `notify` take an optional tone, `"error"`.
- Two regions stay mounted, so the first toast is heard too: a
  `role="status"` one for news, and a `role="alert"` one for failures,
  which carry an alert icon and a danger border.
- A new toast clears the old timer, so the one before can't cut it short.
  Errors stay up for 7 s and news for 3.5 s.
- Switching role, contractor or customer drops the toast, since it was
  about whoever was being viewed.
- The failures sent as errors are: a payment that didn't go through,
  intake’s missing details, photos and address, a time that no longer fits, a
  cover or override conflict, and a failed capture.

**Errors that belong to a field are said beside it.** Continuing intake with
no task opens the empty task and says "Add a task before continuing." under
its textarea, with focus there. It is not said in a toast.

**The state shown is the state that holds.**
- A declined quote leaves the request "Awaiting Quote Approval" for the
  operator. The customer's badge reads "Quote declined · we’re revising
  it", and the line under it says the same. There is no new status: the
  wording is derived from the live quote (`customerRequestText`).
- After Accept, a contractor's job reads "Accepted", and says work opens
  once the customer confirms. It no longer reads "Proposed", which is the
  visit's status.
- The contractor's glance names the next job not yet finished, so a job
  done earlier today is not "next".
- The Requests count in the sidebar is the Needs Action bucket, the same
  number Home shows. The list's own count is the number of rows it shows.

**Each person sees their own name.** The sidebar's workspace block shows the
contractor's or customer's initials and name. Only the operator's reads
"Yousef’s workspace".

**The operator's request detail.**
- "← All requests" goes back to the list, with focus in its search box.
  It used to go back to Home.
- Choosing a request moves focus to its heading. On a narrow screen, where
  the list sits above the detail, the detail also scrolls to the top. The
  scroll is instant: a smooth one did not move the page reliably.
- Contractors and Activity mark More as the current page.
- After an Offer, the decision queue says "Sent: Offer to …". Any other
  decision says "Done: …". The Offer has no Undo, which is left for later:
  an offer notifies the contractor and holds the time, as ADR 079 says.

**Nothing is lost silently.**
- A photo taken on site can be removed (an X on its thumbnail), with an
  inline "Before photo removed. Undo". Undo puts it back where it was.
- Unsaved Availability hours survive a trip to another page. They are kept
  for the browser tab, in `sessionStorage`, with the saved hours they were
  made from, so they are dropped once those change. While they differ, the
  page says "Unsaved changes. Offers follow your saved hours until you
  save."
- Instant Book's payment ends with a toast, "Booked and paid · $129 ·
  {time}", and focus on the new booking. A quote payment's "Payment
  received" toast was being cleared straight after it was set, and now
  stays.

**What it cost.** The stylesheet gained one rule, for the error toast. The
removable photo reuses `onsite-thumb`, and the queue's record reuses
`onsite-hint dq-done`. There are 604 tests, sixteen of them new.

Out of scope, and left for later: an undo for the operator's Offer, Instant
Book's fixed $129, and the audit's P3s.

## ADR 081: What the eye reads from colour, the keyboard and the ear can reach too

Accepted. These are the six major findings of the WCAG 2.1 AA audit of
2026-10 (`wiki/sources/accessibility-audit-2026-10.md`). Each is pinned: eleven
screen tests in `workspace.test.tsx` ("Accessibility (ADR 081)"), one in
`assessment.test.ts`, and the field-border rule in `scripts/design-check.mjs`.
Each fails without its fix.

**A field is found by its edge (1.4.11).**
- A new token, `--field-border`, is `#6b7482` in dark mode and `#878b94` in
  light mode. That's at least 3.4:1 on the panel and 3.1:1 on the page in
  both themes. Inputs, selects and textareas use it. They used `--line`,
  which is 1.3:1.
- The audit proposed `#8b8f98` for light mode. On the page (`#f7f6f4`) it
  comes to 3.0:1, right at the line, so it is one step darker.
- `design:check` computes the contrast from `tokens.css` on every build, and
  checks that the field rule uses the token. The check began as a vitest
  test, but vitest stubs CSS, and the tsconfig has no Node types to read
  the file.

**What is chosen does not rely on hue alone (1.4.1).** A selected time pill,
date chip, slot, queue item, provider card or "who" card gets a doubled edge
in `--accent-text` (`--shadow-chosen`, an inset 1px over the border). That
also sets it apart from hover, which looked the same on slots. The plan was
a check mark. It was dropped because the 36 px pills and the column-layout
cards have no room for one without moving their text. The date chip
already had one.

**State is exposed, not only styled (1.3.1, 4.1.2).**
- `aria-pressed` is on the slot, the provider card, OnSite's pricing,
  Approve and Not now, and the scenarios.
- `aria-current` is on the queue item and on the Blueprint path
  (`"step"`).
- The customer's and the assessment's status tracks mark the current step
  with `aria-current="step"` and weight 600. A done step says ", done" to
  a screen reader through a global `.sr-only`. That class used to be scoped
  to the on-site layer.
- Approve and Not now on the assessment are never reachable, because
  `FindingReview` always renders locked. Removing them is left for later.

**The job and on-site screens are real modals (2.1.1, 2.4.3).** The queue's
modal behaviour is now `useModal`, and `QueueLayer`, `JobMode` and `OnSite`
all use it:
- Escape does what Close does.
- Tab wraps inside.
- Everything beside the layer, up to the shell, is inert.
- The page behind doesn't scroll.
- Focus goes back to whatever opened the layer, or to the page's heading
  if that is gone.

**A toast waits to be read (2.2.1).**
- Its timer waits while it is pointed at or focused, and starts its 3.5 s
  over when it is left.
- Each toast has a Dismiss button, which moves focus to the page's
  heading.
- An error has no timer. It stays until it is dismissed or replaced, so the
  7 s of ADR 080 is gone.

**What it cost.** Two tokens and two rules in the stylesheet, plus the
`.sr-only` that moved. One new hook, `useModal`, which took the queue's
effect out of `QueueLayer`. There are 616 tests, twelve of them new.

Out of scope, and left for later: the audit's 17 minors, the unreachable
assessment decision buttons, an undo for the operator's Offer, Instant
Book's fixed $129, and the platform audit's P3s.

## ADR 082: What a page is made of can be heard, not only seen

Accepted. These are the 17 minor findings of the WCAG 2.1 AA audit of 2026-10
(`wiki/sources/accessibility-audit-2026-10.md`), after ADR 081 fixed its six
majors. Each is pinned: thirteen screen tests in `workspace.test.tsx`
("Accessibility (ADR 082)") and two new rules in `scripts/design-check.mjs`.
The screens look as they did. Where a tag changed, a class carries the old
style.

**The outline is the page's (1.3.1, 2.4.1).**
- A heading is never more than one level below the one before it. The
  intake's, the walkthroughs', the assessment's and the customer cards'
  headings move up. `.panel-title h2` is sized as `.panel-title h3` was.
- A price is not a heading. The quote's and the payment modal's figure is
  `<p className="price-figure">`, and it is still where focus lands when
  the quote opens.
- The sidebar is `<nav aria-label="Pages">`. The workspace's and the
  Blueprint's footers sit beside `<main>`, not in it.
- "Skip to content" is the first stop and moves focus to `<main>`. It
  shares `.skip-link` with the Blueprint's.
- The brand is a `<span>`. It went nowhere, so it was not a link.

**A field's name is only its label (1.3.1, 3.3.1, 4.1.2).**
- An error is no longer inside its `<label>`. It sits after it, with an id,
  and `invalid(field)` points the field's `aria-describedby` at it. A
  `.field-label` wrapper is `display: contents`, so the layout holds.
- An error with no field of its own describes what it is about: the
  provider and slot groups (`role="group"`), the charge, instant-slot and
  merge buttons, and the photo input. Both split inputs are marked invalid.
- `Message` is made once per form, so it no longer remounts and
  re-announces on every render.
- A request question's "Not sure" and hint are outside its name. The hint
  and the error describe it.
- The intake's photo-only Continue puts its error by the task's
  description and moves focus there, instead of a toast.
- Street, unit and municipality have `autocomplete`
  (`address-line1`, `address-line2`, `address-level2`).

**What colour says is said in words too (1.4.1, 1.4.11).**
- The intake's done check fills with `--success-fill`. Its mark is about
  8:1 in both themes, up from 2.6:1 in light. `design:check` computes it
  from the tokens on every build.
- "Soon" says ", soon", a done intake step says ", done", and the online
  dot is an image named "Online".

**Disclosures and updates are announced (4.1.2, 4.1.3).**
- "New walkthrough", Browse requests, Messages and OnSite's earlier
  visits name what they open with `aria-controls`. Where the panel is
  conditional, only while it is open.
- The incoming-update region stays mounted while it is empty, as the
  toasts' does, so its first update is heard. The Blueprint announces its
  path's description, not the whole path.
- "Close navigation" is named without its ×.

**Icons are hidden from a screen reader (1.1.1).** Every lucide icon sits
beside text or inside a labelled control, so all of them take
`aria-hidden`. lucide-react 0.468 does not add it. `design:check` fails a
lucide icon without it, including one held as `Icon`.

**Small targets reach 32 px on desktop (2.5.5, advisory).** `.map-expand`,
the photo remove button and `button.badge` grow to 32 px; the badge by
about 2 px. The time pills (36 px) and the role switch (44 px) were already
there. Phones keep 44 px.

**What it cost.** A `.field-label`, a `.skip-link`, a `.price-figure` and an
`.incoming-region`, and two build rules. `useFieldErrors` gains
`describedBy` and `errorId`. There are 629 tests, thirteen of them new.

Out of scope, and left for later: the unreachable assessment decision
buttons, an undo for the operator's Offer, Instant Book's fixed $129, and
the platform audit's P3s.

## ADR 083: An offer can be taken back, and the small words are right

Accepted. This closes what ADR 082 left out: the assessment's unreachable
decision buttons, an undo for the operator's Offer, and the 13 P3s of the
platform UX audit (`wiki/sources/platform-ux-audit-2026-10.md`). It adds 19
tests: five model tests in `withdraw.test.ts`, and fourteen screen tests in
`workspace.test.tsx` under "Friction and wording (ADR 083)".

**An offer can be withdrawn until it is answered.** A ten-second grace
window covers only the first ten seconds. A withdraw covers the offer's whole
life, and a real dispatch back end needs one anyway. It adds no
delayed-commit machinery to the store or the notification diff.
- `withdrawOffer(s, assignmentId)` in `decisions.ts` refuses unless the
  assignment is still `Offered` and its visit `Proposed`.
  - The assignment becomes `Withdrawn`, a new status, which
    `status-dictionary.md` lists.
  - A first offer's visit is cancelled.
  - A replacement offer's visit gets back the provider, start, travel and
    status it had. `reoffer` now keeps them on the new assignment as
    `previous`.
  - `reconcile` frees the time and returns the request to where it was.
- **What the contractor sees.**
  - If the "New job offer" notice is still unread, it is removed, along
    with the unread "Visit proposed" beside it. Nothing is sent. To the
    contractor, this is the same as a grace period.
  - If they have read it, they get "Offer withdrawn", dated as the offer
    was.
  - Either way, the visit's own change sends the contractor nothing. No
    "Visit cancelled" sits beside "Offer withdrawn", and an earlier
    contractor whose declined visit is put back hears nothing either.
  - The customer hears the visit's change, as for any visit.
- **Where it is offered.**
  - The queue's "Sent" line has Undo.
  - The request page's offered assignment has "Withdraw offer".
  - On success the line reads "Offer to X withdrawn", and focus stays on it.
  - Once the contractor has accepted, it reads "X already accepted · it
    can't be withdrawn".
- `dispatchStatus` now reads the latest Declined or Expired entry, not the
  first.
- `cancelVisit` is lifted out of `OperatorRequests` into `decisions.ts`.

**The assessment shows only what can be done.** `FindingReview` loses
`locked`, `onDecide` and the Approve / Not now buttons, which no assessment
could reach. A converted finding shows its price, and its state badge already
says the decision.

**The platform audit's P3s.**
- "Needs Attention" is "Needs Action", as everywhere else.
- A shared `plural(n, word)` (`src/plural.ts`) fixes "1 tasks", "1 photos",
  "1 days ago" and "submitted 1 separate tasks". It covers the operator's
  request list, the contractor's work, the visit and intake screens, and
  the customer's visit line. A photo count of 0 is not shown.
- `.job-details summary` is a 44 px target, like the other summaries.
- An Activity entry about a request is a button that opens it, as Home's
  cards do.
- Demo settings is in the sidebar only. It no longer also appears on More.
- The Requests nav count is `aria-hidden`, and an `.sr-only` ", 3 need
  action" says what it counts.
- The contractor's Work page declines with the queue's one-tap reasons, in
  a fieldset that takes focus, instead of a sheet with a select. `REASONS`
  is exported from `ContractorQueue`.
- Availability's and the intake's Remove buttons name what they remove:
  "Remove day off {day}" and "Remove task {n}". The intake's undo note
  quotes the task it removed.
- The customer's Home "Review" steps down to secondary while the open
  request shows its own primary for the same thing.
- Until the contractor accepts, the customer sees "Your provider", not a
  name. An offer may yet be declined.
- The demo bar uses `min-height` in place of its fixed heights.
  `typography.css` had already made it grow with its content, so those
  heights were dead.
- On a desktop, its chips have a 32 px floor in every role.
- Already done before this ADR:
  - The contractor's chips were 32 px since ADR 082.
  - The role-switch announcement was fixed by ADR 080's `switching()`.

**A correction to ADR 082.** It said the role switch was "already 44 px".
That held on phones and, through `.app[data-role="Operator"] button`, in the
Operator's view. In the Customer's and Contractor's views on a desktop it was
about 37 px. The demo bar's chips are now about 37–39 px on a desktop in
every role, and 44 px on a phone.

**What it cost.** A `Withdrawn` status, `previous` on an assignment, and a
`.event-link` style. 648 tests; the greeting test reads the wall clock and
fails in the evening, on main too.

Out of scope, and left for later:
- the greeting test's wall-clock dependency;
- Instant Book's fixed $129;
- a screen test for the intake's photo-only Continue.

## ADR 084: The greeting keeps its own time, and Instant Book has a price list

Accepted. This closes two items that ADR 083 left for later, and adds 7
tests: four in `greeting.test.ts`, two in `model.test.ts`, and one screen
test in `workspace.test.tsx`. ADR 092 retires the greeting: Home's heading is
"Home". The price list stands.

**The greeting test passes at any hour.**
- The operator's Home greeting comes from the demo's clock, and `seed()`
  starts that clock at `Date.now()`. A test expecting "Good morning!" failed
  every afternoon and evening.
- The greeting is now a pure `greetingFor(clock)` in `OperatorWork.tsx`. It
  uses Toronto's hour, with the same cut-offs at 12 and 18.
- Its unit tests use fixed instants: both sides of each cut-off, and a UTC
  time that is a different hour in Toronto.
- The screen test checks the heading against `greetingFor` of the clock it
  seeded, not against a time of day. Faking `Date.now` would have moved
  every seeded visit as well.

**Instant Book reads its price from one table.**
- `INSTANT_PRICES` in `model.ts` gives each catalogue job a label, an
  amount and the quote's notes. It is keyed by the category the classifier
  assigns, since a task carries no rule id.
- It starts with one entry: "Handyman / Doors / Adjustment", at $129.
- `instantPrice(tasks)` returns the entry when the tasks are eligible.
- `instantEligible` now requires a priced category in place of
  `category.includes("Doors")`. Eligibility is unchanged today, and a job
  with no price can never be offered Instant Book.
- The intake's label and button, the payment dialog's figure and Pay
  button, and the quote, payment and toast it records all read the entry.
  `$129` is no longer written anywhere but the table.
- The customer sees no change.

Out of scope, and left for later:
- `OperatorRequests` as its own chunk;
- a screen test for the intake's photo-only Continue.

## ADR 085: The Contractors page is a roster, not a pitch

Accepted. This is the first application of the house methodology's
**register** (Layer 1 of `hybrid-design-system.md`): every surface declares
itself *persuasive* or *operational*, and the register sets the dials. The
operator's Contractors page was written in the persuasive register for an
operational job, and it changes to match. It adds 1 screen test and changes 1.

**What the audit found.** It used the remit "the operator compares the people
they can send: who, where, what, at what rate, when, and whether they may do
restricted work". The verdicts per dial:
- *Copy voice: fix.* An amber eyebrow and the h1 "Good people. Great work."
  sold the network to the one person who runs it.
- *Type scale: fix.* Each rate was a heading, which ADR 082 had already ruled
  out for prices.
- *Density and grid: fix.* Four large cards in a two-column grid. A rate or
  an hour could not be compared without reading every card in turn, and
  fields did not line up between cards.
- *Accent: fix.* Amber on the eyebrow, and a green badge on every card,
  whether or not it meant anything.
- *Motion: keep.* There was none to remove.

**What changed.**
- The h1 is "Contractors". Under it is one factual line: the count, the
  area, invite-only, and that each contractor sets their own hours.
- One table: contractor and role, base, skills, rate, hours, next day off,
  and restricted work. The rate is plain text with tabular figures. Hours
  and day off are the contractor's own (ADR 067).
- Restricted work is a short label. "Marked eligible" has a shield icon, and
  everyone else reads "General scope" in muted text. The caveat that
  software does not verify credentials is said once, under the table, not
  on every card. Status is never colour alone.
- No accent is spent on the page. The only colour is the text and muted
  tokens.
- Three widths, set by the workspace container rather than the window
  (ADR 024's container queries):
  - 64rem and wider: short values keep to one line, and only skills and
    hours wrap. Hours wrap between groups of days, never inside one.
  - Below that: cells wrap at word boundaries, and the rows still line up.
  - Below 47rem: each contractor becomes a block of labelled lines, with the
    header kept for screen readers. 47rem is where the wrapped table's
    narrowest layout (about 652px) stops fitting.
- The table elements carry explicit roles (`table`, `rowgroup`, `row`,
  `columnheader`, `rowheader`, `cell`). The stacked layout changes their
  `display`, and some browsers drop table semantics when that happens.
- `.avatar.large` and the old `.roster` grid rules are removed. Nothing else
  used them.

**Checked live.** At 1440px the whole roster and its note end at 678px, so
all four contractors can be compared without scrolling. No horizontal
overflow at 320, 375, 768, 1024, 1280 or 1440px. Muted text is 7.7:1 in
dark and 6.1:1 in light. No console errors. The roster adds no controls and
no motion, so keyboard order and reduced motion are unchanged.

**What it cost.** About 50 lines of CSS in place of 10, and 657 tests. Four
in `concurrency.test.ts` fail on `main` as well: they depend on the machine's
timezone (see the wiki log, 2026-10-16, "`concurrency.test.ts` independent of
the timezone").

Out of scope, and left for later:
- `concurrency.test.ts`'s dependence on the timezone (since fixed: the tests
  take their slot from `slots()`);
- phone and email on the roster;
- a link from each contractor to their visits;
- Elias's role, "Specialist · operator marked eligible", repeats the
  restricted-work column;
- the rest of the app, which has not had a register audit.

## ADR 086: The demo's seeded offer keeps Toronto time, on a weekday

Accepted. This closes the item left by PR #63, and adds 1 test in
`model.test.ts`.

**What was wrong.**
- `seed()` put marcus's offer v5 three days after the demo clock with
  `setHours(10)`. That is 10:00 in the machine's own timezone. The scheduler
  works in Toronto time everywhere else (`torontoParts`, `localTime`).
- In UTC the offer showed at 06:00, and in Tokyo or Honolulu it moved by
  hours and sometimes by a day.
- Nothing skipped weekends. Seeded on a Wednesday or Thursday, the
  offer fell on a Saturday or Sunday. Marcus works Monday to Friday by
  default (ADR 067), so the demo opened with an offer outside his own hours.

**What changed.**
- v5 starts at `localTime(day, 10)`, the way `slots()` builds its times,
  so it is 10:00 in Toronto on any machine.
- `day` is the first Toronto weekday at least three days out. A weekend
  rolls forward to Monday.
- The test fakes `Date.now` at midday Toronto for each day of one week,
  under UTC, America/Toronto, Asia/Tokyo and Pacific/Honolulu. It checks the
  day and the hour, and that the offer fits marcus's hours by `available()`.

**What stays.** r3's stated preference is still the Toronto date three days
out, weekend or not. It is the customer's own choice, and intake offers
weekend days too (`upcomingDays`). It is shown but never booked, and it is a
different request and customer, so it does not need to sit beside v5.

Out of scope, and left for later:
- `model.ts` is not Prettier-clean on `main`. This change formats only its
  own lines.

## ADR 087: The intake speaks warmly, and does not sell

Accepted. This is the second application of the **register**, and the first
to a customer surface. The customer intake is the one place in the app where
a warm voice belongs, because the person filling it in is asking for help
with their home. A warm voice is not the persuasive register: the intake
explains and confirms, but it does not sell, and it does not show the
customer the operator's working state. The audit used the remit "the
customer says where, what and when, and leaves knowing what happens next".
It found 11 issues, and all 11 are fixed. No tests change.

**The order of a comparison.**
- On a phone, Instant Book put the timing constraints above the real
  appointments, so the times a customer can book were below the fold. Real
  times now come first. Request to Book keeps preferences first, because
  there are no times to show until someone has reviewed the job.
- The step h1 is `--text-h2` in the intake. The summary of the earlier steps
  already says where the customer is, so the heading does not need the
  page-title size.
- The times were shown in score order, which reads as no order at all. The
  best fit still leads, marked "Recommended". The rest run in time order, and
  "See more times" groups them by day under a small heading. This is display
  only: the scoring in `intakeOptions` is unchanged.

**No internal state on a customer surface.**
- The amber "Needs review" or "Reviewed" badge on each task is gone. Review
  is the operator's step, not something the customer can act on.
- The "Instant Book" or "Request to Book" badge is gone. The copy under the
  heading already says which one this is, in the customer's words.
- The note on the tasks step reads "Saving your answers doesn't book or
  approve the work yet." An earlier draft said someone would look at the
  details first, which is not true for a job that Instant Book reviews
  automatically.
- The fallback when no times can be offered reads "We need to check a few
  details before we can offer times. Tell us what generally works for you."
  It used to talk about scope needing review.

**Said once, and at the size of what it is.**
- "Recommended" appeared twice on the first card. It is now once, as a plain
  muted label, not a pill.
- "60 min visit · Available appointment" was repeated on every card. The
  length of a visit is said once, above the list and in the dialog's
  subtitle. A card repeats its day only where the day is not already the
  heading, and screen readers still hear the day on every card.
- The 150px gradient that stood in for a map is now a one-line
  confirmation: a pin and the address. `--gradient-location` and the
  `--map-land`, `--map-water` and `--map-road` tokens it used are removed.
- `.time-pill` is 44px tall with label-size text, so it is a target the
  thumb can hit.
- The photo button loses its accent-soft background. Accent is kept for the
  primary action and for state.
- The dialog's h2 takes `look-h3`, so it does not compete with the page h1.

**Checked live.** At 375 by 812, the first appointment starts about 370px
below the step indicator. In the demo, the prototype's role switcher pushes
it just under the fold. No horizontal overflow at 320, 375, 768, 1024, 1280
or 1440px in either theme, on the address, tasks or timing step. "Recommended"
is 6.1:1 in light and about 7.5:1 in dark. Time pills measure 44px. No
console errors. The global `:focus-visible` ring covers every new target.

**Corrected from the audit.** The report listed `.task-number` as an
intake element. It is only used in `OperatorRequests`, so it is left alone.

Out of scope, and left for later:
- a regression test for the time order;
- the copy for "Send for referral review";
- the customer workspace's "Home, handled." and its eyebrows, which have
  not had a register audit;
- offering the soonest times, not only the best-scored ones.

## ADR 088: The customer's home is a list of their bookings, in the order they act on it

Accepted. This is the third application of the **register**, and the second
to a customer surface. The customer workspace home is a workspace: the
customer comes back to it to see what needs them, what is coming and how each
request stands. It is warm, as the intake is, but it does not sell. The audit
used the remit "the customer sees what needs them, what's coming, and how
each request stands". It found 9 issues, and all 9 are fixed. Three test
assertions change, for the new heading and one label.

**The order the customer acts in.**
- Requests were listed in creation order, oldest first. They now run: what
  waits on the customer, then what has a date, then what is in hand, then
  their own drafts, then what is closed. The ranks come from the same
  `customerAtAGlance` ids that drive the counts above the list. This is
  display only: `ownRequests` keeps creation order, because
  `startOrResumeRequest` reads it.
- The "Waiting on you" count was red (`urgent`) and could not be pressed when
  the waiting item was an assessment rather than a request. A quote to
  approve is not an error, and the primary button below already carries it,
  so the count is no longer red. When there is no request row to open, the
  count opens the same review queue the button opens.

**A workspace heading says where you are.**
- The h1 "Home, handled." and its subline "Your requests and upcoming
  visits." are gone. The h1 is "My bookings", as the sidebar names the page.
- Labels were typed in capitals with wide tracking: "NEXT VISIT", "YOUR
  QUOTE" or "YOUR ESTIMATE", "ADDITIONAL CHARGE", "WE HAVE A QUESTION" or "WE
  ASKED". They are now sentence case, with no letter-spacing, in the glance
  lead and inside a request.

**Said once.**
- A draft's title read "Draft · Bedroom door is sticking…" over a badge that
  also said Draft. The title is now the customer's own words.
- A request with no address fell back to "Request · " and its id in
  capitals. It now reads "Your request".
- One state had three words: the badge said "Submitted", the tracker said
  "Received", and the note said "We're matching…". `customerStatusText` now
  maps `Submitted` to "Received", which the status dictionary records. The
  notifications use the same map, so they say "Received" too.

**Accent for the action and for state.**
- Every task's wrench icon was accent-coloured, four amber icons on one
  request and about 2:1 on white. It is `--muted`, 5.2:1 in light and 6.8:1
  in dark.
- Every `.note` takes the accent fill app-wide (`primitives.css`), so an open
  request stacked its progress line, preference and notes as amber blocks,
  the same fill as the badges. Inside a customer request, notes now sit on
  `--surface-raised`. The question card and the primary action keep accent.
  The global rule is unchanged, because operator screens have not been
  audited for it.

**The row holds its edge.** `.accordion-head` was a wrapping flex row, so the
badge and chevron dropped to wherever the title left room; on the draft row
at 375px the chevron sat alone on a third line at the left. It is now a grid:
title, badge, chevron. Under a 420px workspace container the badge moves under
the place line and the chevron stays top right.

**Checked live.** No horizontal overflow at 320, 375, 768, 1024, 1280 or
1440px in either theme. Badges and chevrons line up on every row when wide;
at 420px and under the chevron stays 16px from the right edge. Note text is
14.1:1 in light and 12.8:1 in dark. The sentence-case labels are 5.9:1 in
light and 10.9:1 in dark. Sarah Lin's "Waiting on you" is a button; it opens
the review queue and moves focus to the queue's heading. The count and the
row heads show the global 2px focus ring. No console errors. The quote,
charge and question panels are not in the seed, so their label changes were
checked in code only.

**Left alone.** `GlanceCard` is shared by every role, so it is unchanged; the
customer's colour change comes from dropping `urgent`, not from the card.

Out of scope, and left for later:
- the shared "Today at a glance" heading, when the customer's next visit may
  be days away;
- the global `.note` accent fill on operator screens;
- the status dictionary's Draft row, which says the customer is not shown a
  status, when the customer's badge does say "Draft";
- tests for the list order and for the count opening the queue.

## ADR 089: The contractor's workspace has one primary action, in one colour

Accepted. This is the fourth application of the **register**, and the first
to the contractor. The contractor workspace is operational: the contractor
opens it to see the next job, the offers waiting on them, and what each one
pays. The audit used the remit "the contractor sees the next job and what it
pays, and answers each offer in one step". It found 11 issues, 6 at P2 and 5
at P3, and all 11 are fixed. Three tests change, and two are new.

**One action, one colour.**
- Accept was green on the job detail, from two rules
  (`.contractor-accept` in `contractor-concept.css` and again in
  `cards.css`), while Accept job in the offer queue was amber. The same
  action now has the same colour everywhere: Accept is a plain `.primary`,
  and both green rules are gone.
- With an offer open on the detail, the screen had two primaries: Accept and
  "Review 1 offer" above it. They lead to the same offer. While an offer is
  open, the Review button steps aside, so Accept is the screen's one primary.
- Every offer card ended in a filled "View job" button, so the list had one
  primary per card. "View job" is `.secondary`; Review stays the list's
  primary.
- The "New offers" count was drawn in the danger colour (`urgent`). An offer
  is work on the way, not an error, so the count is neutral.
- The pay sat on an accent fill on every card and on the detail. Accent
  repeated on every item is decoration, so pay sits on `--surface-raised`,
  with tabular figures.

**A workspace heading says where you are.**
- The h1 "Your Work" and its slogan "What's next, all in one place." are
  gone. The h1 is "Your work", in sentence case. The page key stays "Your
  Work".
- Job titles on the cards and the detail were `--text-h2` (31.25px), larger
  than the 25px h1. They, the week headings and the Earnings totals are now
  `--text-intro` (20px), so every heading inside the page sits below the h1.
- "VIEWING AS" and "NEXT JOB" were typed in capitals with wide tracking. They
  are "Viewing as" and "Next job", untracked.

**Said once.**
- Pay had three wordings: "$110 CAD · your pay" in the queue, "Your pay:
  $110 CAD" on the detail, and "Your pay: $110" on the card. `payLabel` in
  `ContractorQueue.tsx` now words it once, "Your pay: $110 CAD", for all
  three.
- A one-task job repeated its title: the card listed the task under an h2
  that already named it, and the detail's disclosure and the queue's details
  repeated it again. One task now has no list, and its disclosure is "Task
  details". A job with several tasks still lists them.
- A task with no restriction rendered an empty paragraph. It renders nothing.

**An empty state says what is true.** Today with no jobs said "You're done for
today." when there had been nothing to do. It now says "No jobs today."; "done"
is kept for a day whose jobs are all finished.

**Past work.** "Past offers & completed work" was a disclosure even when it
was empty, and it listed jobs in the order the offers were made. It now
appears only when there is past work, newest first. A finished job reads
"Completed", not the system's "Accepted".

**Checked live.** No horizontal overflow at 320, 375, 768, 1024, 1280 or
1440px in either theme, on the list, the detail, Earnings and Availability.
Accept is amber in both themes. Pay text is 14.1:1 in light and 12.8:1 in
dark, View job is 16.5:1 and 14.6:1, and the "Viewing as" label is 5.5:1 and
12.1:1. The global 2px focus ring shows on every button. Operator screens are
unchanged; their pending counts are still red. No console errors.

**Left alone.** These are shared with other roles, so they are unchanged:
`GlanceCard`; the global `.eyebrow` and `.note`; the customer's "VIEWING
AS"; `JobWork` and its `.contractor-success` check; `.time-pill`. The
contractor's untracked labels come from rules scoped to `.contractor-switch`
and `.contractor-wrap`.

Out of scope, and left for later:
- the customer's "VIEWING AS" switcher, and the `GlanceLead` tracking on
  operator screens;
- the accent fills on `.message-bubble.sent` and `.notification-link.unread`;
- the "Messages" in-app simulation summary;
- the `GlanceCard` doc comment on `urgent`;
- the glance's "City · $110", which does not use `payLabel`;
- the pills in the light theme.

## ADR 090: The operator's request list in the register

Accepted. This is the fifth application of the **register**, and the first to
the operator's Requests page, the screen the operator works from all day. The
audit used the remit "the operator sees what is theirs to act on, finds any
request in one step, and opens it". It found 10 issues: 1 at P1, 7 at P2 and
2 at P3. All 10 are fixed. One test is rewritten, three change, and two
are new.

**The page names itself.** The eyebrow "INTAKE & FULFILLMENT", the h1
"Service requests" and the slogan under it are gone. The h1 is "Requests", as
in the sidebar. The line under it states one fact, how much of the list is
showing: "4 of 7 requests", or "7 requests" when all of them show. That line
replaces the count, which sat in an accent badge beside the heading.

**Accent follows whose move it is.**
- Every status chip in the list was amber, so amber said nothing. In the
  list, a row in Needs Action keeps the accent chip. Every other status sits
  on a neutral chip (`.badge.quiet`, scoped to `.queue-item` in
  `operator-concept.css`). Green and red keep their meaning.
- "Needs Review" was red, because `badgeTone` matched `Review`. A request in
  review is work for the operator, not an error, so `Review` is out of the red
  pattern. `badgeTone` is shared, so the customer's "In review" chip, which
  sits over the same status, is no longer red either. It was the same
  misreading.

**In the order the operator acts on it.** "All requests" listed requests in
the order they were made. It now sorts by bucket: Needs Action, Waiting,
Scheduled, Draft, History. The sort is stable, so a single bucket keeps
creation order. `BUCKET_ORDER` gives the order once, for both the sort and the
filter. `bucket()` is unchanged (ADR 011).

**An empty list says so, and offers the way back.** A search or filter that
matched nothing left a blank panel. It now says "No requests match." with a
"Show all requests" button. The button clears the search, sets the filter to
All requests, and hands focus to the search, since it disappears once it is
pressed.

**One way back.** The detail had its own "← All requests" button, under a
"Request Details" heading. Beside the list when the screen is wide, it
duplicated the list. When the screen is narrow, it duplicated "Browse
requests". In fulfilment mode it was hidden. The header and its rules are
gone.

**Names and case.**
- The search input had only a placeholder. It now has
  `aria-label="Search requests"`, the P1 finding.
- The filter's options were title case. They are sentence case ("Needs
  action"), with the bucket's own string kept as the value.

**Checked live.** No horizontal overflow at 320, 375, 768, 1024, 1280 or
1440px in either theme, with the list, with the detail, or with the empty
state. Accent chips are 5.2:1 in light and 8.7:1 in dark. Quiet chips are
5.7:1 and 8.6:1, and 5.4:1 and 6.1:1 on the selected row. The global 2px
focus ring shows on "Show all requests". No console errors. The contractor
screens are unchanged. The customer's screens change only in the "In review"
chip.

**Left alone.**
- The status words in `docs/status-dictionary.md` ("Needs Review", "Awaiting
  Provider Acceptance") are the system's names, so their title case stays.
- The badges on the request detail keep their colour; this audit covered the
  list.

Out of scope, and left for later:
- the draft reference "JALS3PZ3" shown as a request's name;
- a narrow screen opens on a request rather than on the list;
- red for Declined and Cancelled, which are outcomes, not errors;
- the "All Requests" button on operator Home, in title case.

## ADR 091: The operator's request detail in the register

Accepted. This is the sixth application of the **register**, and the second to
the operator's Requests page: the detail beside the list, its four tabs, and
the fulfilment screen it opens. The audit used the remit "the operator sees
what this request needs, decides in one step, and books it". It found 12
issues: 1 at P1, 5 at P2 and 6 at P3, and 7 more under "Also found". All 12
are fixed, with five of the seven; two are left for later. Two tests change
and two are new.

**A removal asks first.** "Remove visit / regroup tasks" removed a visit and
cancelled its offer or booking in one click, and the toast that reported it
had no undo. That was the P1 finding. It is now "Remove visit", and it opens a
dialog that says what happens: any offer is cancelled and the tasks return to
the request. "Withdraw offer" and "Cancel question" acted in one click too.
Both can be redone by sending again, but their toasts have no undo either, so
they ask in the same way. The three dialogs use the modal host in
`Workspace.tsx`, like "Decline request". Closing one leaves everything as it
was.

**Accent follows whose move it is.**
- The summary card had two amber chips, the status and the booking mode. The
  mode is a fact, so it is plain text in the meta line. The status chip
  follows the list's rule from ADR 090: accent while the request is in Needs
  Action, a neutral chip otherwise. Green and red keep their meaning.
- A visit's "Proposed" or "Offered" chip, and an offer's status, mean the
  operator is waiting on a contractor. They are neutral chips now. The scoped
  `.badge.quiet` rule in `operator-concept.css` covers them; `badgeTone` is
  unchanged.
- The fulfilment summary sat on the accent tint, and its "4 tasks · 240 min"
  was an amber badge. Both are facts: the card is on the raised surface and
  the line is muted text.
- Each open task carried an amber duration badge. It is gone; the row above it
  already gives the minutes.

**Say it once.**
- The Maps link repeated the address under the address heading. It reads
  "Open in Maps ↗", and its `aria-label` names the address and the new tab.
- The Tasks panel opened with an h3, "Tasks 4", under the tab of the same name.
  The heading is gone; the panel keeps its name, and the hint is its first line.
- A task's checkbox repeated the task's name. It reads "Select for a separate
  visit", and its `aria-label` names the task.
- Each contractor card listed the job's tasks again. The list is gone, and
  "Why this provider?" keeps the reasons for each task.
- Every slot repeated "15 min buffer" and the work and fit line. One line under
  "Recommended appointments" says it for all of them; each slot keeps its time
  and its driving.
- Minutes were "240 minutes estimated" in one place and "240 min" elsewhere.
  Both are "min".
- A tab showed "0" beside its name. A count shows only when it is above 0.

**An error stays at its field.** A rejected override time was reported in a
toast while the input kept the time, so the field looked accepted. The error
is now said under the field, with `aria-invalid` and `aria-describedby`, and
clears when a valid time is entered.

**Names and case.**
- The fulfilment heading was "Assign Contractor" or "Do It Myself", but the
  button that opens it says "Offer to a contractor". The heading uses the
  button's words: "Offer to a contractor" or "Do it myself". The reassign
  dialog's "Confirm Do It Myself" is "Do it myself".
- The eyebrows were capitals: "SERVICE REQUEST / R2", "WAITING ON CUSTOMER",
  "CUSTOMER'S CHOICE". They are "Request R2", "Waiting on customer", "Customer
  answered", "Customer's choice" and "Best route fit", untracked by a rule
  scoped to `.operator-concept`.
- "Need More Info" is "Ask the customer". "Review tasks / split visit" is
  "Review tasks".
- The chosen time carries a check mark, as a chosen contractor does, as well
  as its border and fill.

**Checked live.** No horizontal overflow and no target under 44px at 320, 375,
768, 1024, 1280 or 1440px in either theme, on the detail with the Tasks panel
open and on fulfilment. The accent status chip and the slot eyebrows are
5.2:1 in light and 8.7:1 in dark. The neutral chips and muted lines are 6.1:1
and 7.7:1, and the eyebrows 5.9:1 and 10.9:1. The dialogs open with their own
text, and closing one keeps the visit. The override error shows inline and
clears. The global 2px focus ring shows. No console errors. `.operator-concept`
is used only on the Requests screen, so no other screen changes.

**Left alone.**
- The status words ("Awaiting Provider Acceptance") are the system's names,
  as in ADR 090.
- The shared `.eyebrow`, `.note` and `badgeTone`. The rules here are scoped to
  the operator's Requests screen.
- The classification options ("Handyman / Doors / Adjustment") are the
  system's taxonomy.

Out of scope, and left for later:
- a draft request offers "Assign this job", which is a product question;
- the README still says "Do It Myself";
- focus returns to the detail heading, not to the button that opened a dialog.

## ADR 092: The operator's Home and Today in the register

Accepted. This is the seventh application of the **register**, and the first to
the operator's Home and Today pages, with the `RouteMap` and `GlanceCard` as
they use them. The audit used the remit "the operator sees what today holds
and what needs them first, and gets to it in one step". It found 12 issues:
2 at P1, 7 at P2 and 3 at P3, and 9 more under "Also found". All 12 are fixed,
with the eight "Also found" items in scope; the ninth is on Walkthroughs. One
test changes, one is new, and `greeting.test.ts` is removed with the greeting.

**The heading says which day it is.** Today's h1 said "Today" on any date, with
"2026-10-19" under it. That is the worst case the page guards against: the
operator misreads which day is on screen. The h1 is "Today" only on today, and
otherwise the day in words, "Monday, October 19". The ISO date is gone.

**Focus goes where the person looks next.** That was the other P1 finding.
"Next scheduled day" removes itself when pressed, and focus fell to `<body>`.
It now moves to the h1, which names the day it opened. "View progress" opened
a panel below the section, out of view, with focus left on the button. The
panel scrolls into view and takes focus, and "Close progress" hands focus back
to the button that opened it. "View progress" shows only once a visit is
confirmed; on a proposed visit its panel had nothing to show.

**The page names itself.** Home's h1 was "Good morning!" over the slogan
"Here's what needs your attention." It is "Home", the sidebar's name, as in
ADR 088 to 090. This retires the greeting of ADR 084 and its four tests. Today
loses "What's happening, in appointment order." Its line is a fact, "1 visit ·
1 provider · 15 min buffer between visits", where it said "All providers ·
combined totals, separate routes".

**One state, one word, one number.** Home showed its count of decisions three
times under three names: "Pending decisions" in red, "Work through 4
decisions", and "Needs Action 4" on a red fill. The metric is "Needs action",
the name of the list it scrolls to, and has no `urgent`; the tab count sits on
the raised surface. A count is not an alarm. The tabs are "Needs action" and
"All requests". A card whose title fell back to a status shows it in sentence
case, "Needs review"; the status itself is unchanged.

**One move, one control.** Four controls on Home went to Today: the date, the
"Scheduled visits" and "Active contractors" metrics, and "All of today". "All
of today" stays. The other three are plain text.

**Accent follows whose move it is.**
- Every Home card had an amber icon tile, including those waiting on a
  contractor, and late or declined cards had a red one. ADR 090's rule now
  holds on Home: accent for a card in Needs action, neutral otherwise. A late
  job keeps its alert icon on the accent tile, not red. Red is for errors.
- Every Today entry had an amber line, dot and "Proposed" badge. The line and
  dots are structure, so they are neutral. A badge is green when done, accent
  when running late or unfinished, and neutral otherwise. The Today strip on
  Home follows the same rule.
- The day totals sat on the accent tint. They are on the raised surface.

**Totals count what the list shows.** "Booked work time" left out proposed
visits, but "Simulated travel" counted them, so a day read "0 hrs" beside "12
min". Both count every visit listed, and the first is "Work time". The totals,
and the Timeline/Map switch, show only when the day has visits.

**A map says only what it knows.** `RouteMap` always drew three numbered
stops and a route. It now draws one pin per visit, and a route only when one
provider is chosen; with all providers, the heading is "Provider locations"
and no route is drawn. Its label names the count, "Illustrative map, 1 visit".
The "Illustrative map · simulated travel" overlay repeated the caption and is
gone, as is the button that opened Today from Today. "LAKE ONTARIO" was drawn
in the colour of the water and is now muted text. Each "Open in Maps" link's
`aria-label` names the address and the new tab.

**Small things.**
- The map's heading was an h3 under the h1. It is an h2 at h3 size.
- Home's two h2s were 14px and 25px. The Today strip's heading is 14px, like
  "Today at a glance".
- An empty day says "plan a visit from Requests", and "Requests" is now a link.
- Each entry said "15 min buffer"; it is said once, above them. The entry
  keeps its travel time, which is what differs.
- A dead "Open map ↗" link inside timeline entries is removed.

**Checked live.** No horizontal overflow and no target under 44px at 320, 375,
768, 1024, 1280 or 1440px in either theme, on Home, an empty Today, a Today
timeline and the map. The lowest text contrast is 5.2:1 in both themes: on
Home in dark, and on Home and the timeline in light. Today in dark is at least
6.8:1. "Next scheduled day" puts focus on
"Monday, October 19" at every width, with the global 2px focus ring. No
console errors. The rules are scoped to `.op-home` and `.op-today`; the
removed `.map-label` and `.map-expand` were used only by `RouteMap`, so the
Contractor and Customer screens do not change.

**Left alone.**
- The status words are the system's names, as in ADR 090 and 091.
- The shared `GlanceCard`, `.eyebrow`, `.note` and `badgeTone`. Home passes
  different props to `GlanceCard`; the component is unchanged.
- The `--map-label` token is now unused but kept, for a later token cleanup.

Out of scope, and left for later:
- Walkthroughs still pass `urgent` to `GlanceCard`, so its count stays red;
- `RouteMap` is declared inside `OperatorWorkspace`, so it remounts on each
  render;
- at 320px the Provider and Date fields sit close, and the h1 "Monday, October
  19" wraps to two lines.

## ADR 093: The operator's Walkthroughs and the decision queue in the register

Accepted. This is the eighth application of the **register**, and the first to
the operator's Walkthroughs (the pipeline, the detail, on-site capture and
pricing) and the decision queue ("Work through 4 decisions"). The audit used
the remit "the operator sees whose move each walkthrough waits on, and makes
each decision in one press or skips it". The worst case is the operator
believing they are finished when they are not, or breaking a customer's link
without meaning to. It found 12 issues: 2 at P1, 9 at P2 and 1 at P3, and 5
more under "Also found". All 12 are fixed, with the empty state from "Also
found"; the other four are left for later. Existing tests follow the new
names, and six are new.

**An end screen says what is still waiting.** Skipping every decision in the
queue ended on "All caught up" and "0 decisions handled", with four still
waiting. That is the worst case. The queue now counts the live decisions left.
When there are some, the h1 is "End of the queue" and the line says "4 still
need a decision, under Needs action on Home", after the number handled if any
were. "All caught up", with its tick, shows only when none are left. The change
is in `DecisionQueue`; the shared `AllCaughtUp` is untouched.

**Focus goes where the person looks next.** That was the other P1 finding.
Opening a walkthrough replaces the list, and "All walkthroughs" replaces the
detail, so the pressed control was gone each way and focus fell to the top of
the page. The detail's h1 takes focus when it opens (`tabIndex={-1}`), and the
list puts focus back on the row of the walkthrough it was left for.

**A link that stops working asks first.** "Withdraw this link" and "Issue a
fresh link" each broke the link the customer holds in one press, and neither
toast can undo it. Each now asks inline, as "Withdraw offer" does in ADR 091:
"Withdraw this link? The customer's link stops working." with "Withdraw link"
and "Keep it", and "Issue a fresh link? The customer's current link stops
working." with "Issue fresh link" and "Keep it". "Keep it" takes focus, and
closing hands focus back to the button that asked, or to "Issue a fresh link"
once the withdrawn link's button is gone. A link that no longer works is
replaced in one step, since nothing breaks.

**The page names itself.** The h1 was "Property walkthroughs" under the label
"PROACTIVE MAINTENANCE" and over the slogan "Walk a property, record what you
see, and let the customer choose what to approve." It is "Walkthroughs", the
sidebar's name, as in ADR 088 to 092.

**One state, one word.** Each state had three names: the groups said "In
progress", "With the customer" and "Became work", the chips Draft, Sent and
Converted, and the glance Drafts, With customer and Ready to convert. "With
the customer" also held walkthroughs ready to convert, so it was not the set
the glance counted. The groups are captioned with the status itself, "Draft",
"Sent" and "Converted", and rows no longer repeat it in a chip. A sent
walkthrough with approvals carries one chip, "Ready to convert", the glance's
word. The status words are unchanged.

**A count is not an alarm.** "Ready to convert" was a red number. It is the
operator's next move, so Walkthroughs no longer passes `urgent` to it. This
closes the item ADR 092 left for later; `GlanceCard` is unchanged.

**Accent follows whose move it is.** Every chip was accent: `statusTone` gave
drafts a `neutral` class that no rule styles. One rule now holds, as in ADR
090 and 092. A draft, and a sent walkthrough with approvals to convert, are
accent; Converted, and a Completed finding, are green; anything waiting on the
customer is neutral. A finding approved but not yet converted is accent. The
group counts sit on the raised surface. The rules are scoped to `.wt-head`,
`.wt-finding` and `.wt-group`; `badgeTone` is untouched.

**Empty states say what is true.** A finding in a draft said "Pending
decision" when nothing had been sent; a draft's findings carry no state. An
unpriced finding also showed an "Assessment required" chip under its state
chip, which already said so; only a quoted price is shown.

**Facts, not boxes.** The Sent card stacked three or four note boxes on the
accent tint, one of them developer copy ("It is not a secret: everything this
prototype knows..."). That paragraph is gone, and the rest are plain muted
text (`.wt-fact`), as is "No walkthroughs yet".

**One move, one name.** In the queue, "Change", "Adjust" and "Open request"
all left the queue for the request page, while "Adjust" on a quote changed the
price in place. Every button that leaves the queue is "Open request", the
in-place one is "Change price", and the error says "Open request shows every
option."

**Small things.**
- "Open assessment" in the property record was 26px tall; on the operator's
  screens it is 44px. It and "Open as the customer" say "(opens in a new tab)"
  to screen readers, and "Open assessment" gains `rel="noopener"`.
- "OLDEST UNDECIDED", "ASSESSMENT PMW-0001" and the option "Further
  Assessment Required" are in sentence case. The stored value is unchanged.
- The assessment label in the detail is untracked, as in ADR 091.

**Checked live.** No horizontal overflow and no target under 44px at 320, 375,
768, 1024, 1280 or 1440px in either theme, on the pipeline, a Sent detail, the
link confirmation, a draft detail, the property record, the queue's first
screen and its end screen. The lowest text contrast is 5.2:1 in dark (the
desktop queue's side panel) and 5.2:1 in light; everything else in dark is at
least 7.7:1. At every width, opening a walkthrough focuses its h1, "Keep it"
takes focus and hands it back, the list focuses the row it was left for, and
the end screen focuses "End of the queue". No console errors. `DecisionQueue`
is the operator's alone, and `PropertyRecord` changes only in its operator
branch, so the Customer and Contractor screens do not change.

**Left alone.**
- The status words are the system's names, as in ADR 090 to 092.
- ADR 053's buckets and their precedence, ADR 059's order and suggested
  action, and ADR 079's fallbacks.
- The shared `GlanceCard`, `QueueLayer`, `AllCaughtUp`, `.eyebrow`, `.note`
  and `badgeTone`.

Out of scope, and left for later:
- the customer and contractor queues end on the shared `AllCaughtUp`, which
  says "All caught up" after skips too (done in ADR 094);
- in `PropertyRecord`, the h3s "Awaiting assessment" and "Assessments" sit
  under the next step's h2;
- on desktop the queue says the name, address and tasks twice, and hides the
  customer's own words for tasks not under review;
- "Open as the customer" opens a dead page once the link is withdrawn or
  expired (done in ADR 095).

## ADR 094: The customer's and contractor's queues say what is still waiting

Accepted. ADR 093 found that a queue skipped through ended on "All caught up"
with work still waiting, and fixed it for the operator's decision queue alone.
The customer's queue ("Waiting on you") and the contractor's ("Offers") end
on the shared `AllCaughtUp`, which said "All caught up" and "0 done. Anything
new will show here." after every item was skipped. That is the same worst
case: the person believes they are finished when they are not. Three tests
are new.

**An end screen says what is still waiting.** `AllCaughtUp` now takes the
number still waiting (`left`), the sentence that says so (`waiting`) and where
anything new will show (`where`). The caller counts what is still waiting
(skipped items, and any that arrived while the queue was open), as
`DecisionQueue` does, because the queue's own position does not know about
skipped items. When some are left, the h1 is "End of the queue" and the
line is the number done, if any, then what is waiting:
- the customer: "1 done. 2 still waiting on you, on Home.";
- the contractor: "2 offers still waiting, under Offers." ("offer" for one).

"All caught up", with its tick, shows only when nothing is left, as "3 done.
Anything new will show on Home." or "…under Offers." The old "here" named no
place, since the queue closes on Back.

**Checked live.** At 320, 375, 768, 1024, 1280 and 1440px in both themes,
skipping through each queue ends on "End of the queue" with the count and no
tick. Focus is on the h1, nothing overflows, and no target is under 44px.
The lowest text contrast is 8.2:1 in dark and 5.7:1 in light. The operator's
queue is unchanged. No console errors.

**Left alone.**
- `QueueLayer`, `useOneAtATime`, `.eyebrow`, `.note` and `badgeTone`.
- ADR 062's contents and order of each queue, the requeue rule, and ADR
  079's focus fallbacks.
- `DecisionQueue` keeps its own end screen from ADR 093.

## ADR 095: A link that no longer works is not offered

Accepted. ADR 093 left one item for later: once the customer's link was
withdrawn or had expired, the Sent card still offered "Copy link" and "Open as
the customer". Both led to the refusal page from ADR 047, so the operator could
copy a dead link into a message, or preview a page the customer would never
see. The heading still said "Waiting on the customer", which was no longer
true: the customer could not act until the operator did. Five tests are new.

**A link that no longer works is not offered.** While the link is withdrawn or
expired, the Sent card hides "Copy link" and "Open as the customer".
- With nothing approved, the h2 is "Link withdrawn" or "Link expired" and the
  line under it is "The customer can't open the assessment until you issue a
  fresh link." The muted line that said the same thing is dropped.
- "Issue a fresh link" is then the card's one move, so it is the primary
  button. Issued from there it acts in one step (ADR 093: nothing breaks), and
  focus goes to "Copy link", the next move, as the controls come back.
- With findings approved, the h2 stays "N approved · ready to convert" and
  "Convert" stays the primary; the muted line still says the link is
  withdrawn or expired, and "Issue a fresh link" stays a text button.

In the operator's property record, an assessment whose link is not live shows
"Link withdrawn" or "Link expired" as plain text instead of an "Open
assessment" link.

**Checked live.** At 320, 375, 768, 1024, 1280 and 1440px in both themes, a
Sent walkthrough withdrawn shows the one primary button with focus on it, and
a fresh link brings back "Copy link" with focus on it. Nothing overflows and no
target is under 44px. The lowest text contrast is 7.7:1 in dark and 6.1:1 in
light. The customer's and contractor's screens are unchanged. No console
errors.

**Left alone.**
- The customer's refusal page (ADR 047) and `LinkControls`' asking (ADR 093).
- The customer's side: `customerQueue` and the customer's glance still count a
  Sent assessment whose link is dead, and its "Review assessment" and "Open
  assessment" links lead to the refusal page. Changing what the customer's
  queue holds changes ADR 062, so it waits for its own decision.
