# Fieldwork design system

Fieldwork helps customers explain work, operators dispatch suitable providers, and contractors complete the right tasks. The highest-risk design mistake is making a preferred time or accepted offer look like a confirmed booking.

**Principles:** Intent first; deliberate hierarchy; one consistent system; complete states. Preserve the request → tasks → visit → assignment distinction and confirmation gates.

## Tokens

`src/tokens.css` is the only palette/theme owner. A refined amber is the approved brand; dark mode sits on a neutral near-black elevation ladder, light mode on warm off-white. Component CSS must not introduce color literals.

Two consequences of an amber brand are deliberate. A separate amber `warning` would be indistinguishable from the accent, so attention states resolve to the urgent ramp and are told apart by the word and icon beside them, never by hue alone. `--info` follows the accent rather than keeping a competing blue.

Tokens carry a **role**, and the role decides the pairing. `--accent`, `--success-fill` and `--danger-fill` are *fill* tokens: light in both themes, so they pair with `--on-accent` (dark ink). `--accent-text`, `--success` and `--danger` are *text* tokens: they flip lightness per theme and must never be used as a solid fill behind `--on-accent` or `--text`.

| Family | Meaning |
|---|---|
| `bg`, `panel`, `surface-raised`, `line` | Page, cards, elevated controls, borders |
| `text`, `muted`, `on-accent` | Primary, secondary, and text on solid actions |
| `accent`, `accent-text`, `accent-soft`, `focus` | Solid blue action, readable blue text, selection tint, focus ring |
| `success*`, `warning*`, `danger*`, `info` | Semantic feedback; always pair with words/icons |
| `map-*`, `gradient-*`, `print-*` | Illustrative maps and print, never actual geocoding |
| `space-N` | N × 4px; larger steps cover structural offsets |
| `radius-sm/md/lg/pill` | 6/10/16px and circles/pills; nested controls use smaller steps |
| `z-*` | Base, dropdown, sticky, overlay, drawer, modal, toast, tooltip; native dialogs use the browser top layer |
| `shadow-*` | Small/medium elevation, drawer/modal, focus, selected and inset states |
| `motion-fast/base/panel`, `ease-*` | 160/220/320ms; enter ease-out, exit ease-in, moves ease-in-out; `ease-out` is the shared decelerating curve |

Typography is DM Sans/Manrope with a 1.25 ratio: body 16, intro 20, H3 25, H2 31.25, H1 39.0625px, stored in rem. Labels 14px and captions 12px are intentional utility exceptions. Body line-height is 1.6, headings 1.5. Never shrink text to fit a screen.

## Five primitives

1. **Card:** `.card` owns border, radius, surface and padding. Existing `.panel` and portal card classes forward to the same base for compatibility. Modifiers own layout. Surface resolution is `--card-surface → --panel`; border is `--card-border → --line`. Use grouping deliberately; don't wrap every inline label. Contractor cards use a two-column thumbnail grid, not a float.
2. **Buttons:** one primary action, secondary alternatives, tertiary links. Lucide outline icons use 16/20/24/32/48px for inline/default/navigation/feature/hero contexts. Interactive targets remain at least 44px. Actions never rely on hover alone.
3. **Status/stepper:** existing stored and derived statuses retain their meaning. Color supplements labels and icons. A checkmark on entered task details is not scope approval.
4. **Fields:** readable values, visible labels and focus; keep existing validation and draft persistence. Geometry does not move on hover/focus.
5. **Notifications/overlays:** account-specific messages, readable inline updates and native dialog sheets. Keep keyboard dismissal/focus return and viewport scrolling. No real external notification delivery is implied.

Flat utilities express reusable concerns (`.secondary`, `.field`); role-prefixed classes express component layouts. Compatibility class names remain supported. Pattern vocabulary referenced by the supplied house methodology: Design Tokens, Perfect Card, Focus States, Accordion Disclosure, Notification System, Modal Hierarchy and Dark Mode; implementation follows the existing Fieldwork behaviors, not an imported template.

**Do not:** add hex/RGB colors outside tokens; add a second card base; invent icon sizes; encode status only by color; introduce competing theme definitions; add artificial loading delays. Structural zero, dimensions, percentages, SVG/map geometry, border widths, and layout calculations are explicit literal exceptions.

Before shipping run `npm run design:check`, tests and build; inspect both themes, five viewports, zoom, contrast, keyboard focus and reduced motion. See `docs/design-decisions.md` and `docs/loading-states.md`.
