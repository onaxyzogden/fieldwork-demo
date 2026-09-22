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
