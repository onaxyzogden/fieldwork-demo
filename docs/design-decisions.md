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
Accepted. Supersedes ADR 001. The redesign handoff specifies a refined amber, and it is adopted as the brand in dark *and* light mode rather than dark-only as the handoff had it — the light theme is a shipped, tested feature and is not worth dropping for palette fidelity. The handoff supplies no light values, so they are derived by holding the dark ramp's hue and inverting lightness direction.

Two consequences follow and are deliberate. A separate amber `warning` would be indistinguishable from an amber brand, so attention states resolve to the urgent ramp and are told apart by the word and icon beside them. `--info` follows the accent instead of keeping a competing blue.

Tokens now carry an explicit **role**. `--accent`, `--success-fill`, `--danger-fill` are fills — light in both themes, pairing with the dark `--on-accent`. `--accent-text`, `--success`, `--danger` are text — they flip per theme. Using a text token as a solid fill was widespread before this change and produced light-on-light in dark mode and dark-on-dark in light; it is now a documented "do not".

## ADR 007: Keep the rem type scale, decline the handoff's px scale
Accepted. The handoff specifies a px scale at a 15px base. Keeping ADR 003's rem-based 1.25 scale from 16px, because px sizes stop responding to the reader's browser font-size setting — an accessibility regression, and an odd pairing with ADR 008, which is itself an accessibility change. Every other token family in the handoff is adopted as specified. Radius moves to 6/10/16, amending ADR 004's 4/8/16.

## ADR 008: No submit-type button is ever disabled
Accepted. A disabled button drops out of tab order, is silent to screen readers, and fires no pointer events — so a tooltip explaining why it is blocked cannot reach the person who needed it — and the greyed label routinely fails contrast. Every submit-type action stays enabled and validates on click: mark the specific blocking field, write the reason beside it, move focus there. Per-field, never one global invalid flag, never a tooltip.

The boundary is submit-type *actions*. A control that is read-only because the record belongs to someone else is not a blocked action; those render as text or `readOnly`, not `disabled`.

## ADR 009: The operator note stays one slot
Accepted. Operator asks one question; the customer gives one reply; asking again replaces the pair. This deliberately does not grow into a message list. Real back-and-forth would be a decision to adopt chat, and the per-visit message thread already exists for that; faking history by appending to this field would give neither.

## Boundaries
Scheduling, payments, dispatch, authorization and the clarification catalogue are unchanged. The handoff's stub slot generator and five-category matcher were **not** adopted: the existing `slots()`/`available()` scheduler and the 81-issue catalogue already do more, and replacing them would be a regression.
