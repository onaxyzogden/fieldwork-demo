# Fieldwork design system

Fieldwork helps customers explain work, operators dispatch suitable providers, and contractors complete the right tasks. The highest-risk design mistake is making a preferred time or accepted offer look like a confirmed booking.

**Principles:** Intent first; deliberate hierarchy; one consistent system; complete states. Preserve the request → tasks → visit → assignment distinction and confirmation gates.

## Tokens

`src/tokens.css` is the only palette/theme owner. Navy and blue are the approved brand; light mode uses cool white/slate. Component CSS must not introduce color literals.

| Family | Meaning |
|---|---|
| `bg`, `panel`, `surface-raised`, `line` | Page, cards, elevated controls, borders |
| `text`, `muted`, `on-accent` | Primary, secondary, and text on solid actions |
| `accent`, `accent-text`, `accent-soft`, `focus` | Solid blue action, readable blue text, selection tint, focus ring |
| `success*`, `warning*`, `danger*`, `info` | Semantic feedback; always pair with words/icons |
| `map-*`, `gradient-*`, `print-*` | Illustrative maps and print, never actual geocoding |
| `space-N` | N × 4px; larger steps cover structural offsets |
| `radius-sm/md/lg/pill` | 4/8/16px and circles/pills; nested controls use smaller steps |
| `z-*` | Base, dropdown, sticky, overlay, drawer, modal, toast, tooltip; native dialogs use the browser top layer |
| `shadow-*` | Small/medium elevation, drawer/modal, focus, selected and inset states |
| `motion-fast/panel`, `ease-*` | 160/320ms; enter ease-out, exit ease-in, moves ease-in-out |

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
