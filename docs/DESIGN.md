# Dovo Planning Poker Design System

## Design direction

Dovo is a focused team tool with a calm, precise interface. It borrows the clarity, generous spacing, rounded controls, and restrained translucency associated with native iOS interfaces without copying platform chrome or hiding important actions behind gestures.

The existing muted green and warm amber palette remains the visual signature. Light and dark themes use the same semantic tokens. Glass is a subtle surface treatment, not a full-screen effect: keep content readable, avoid stacked translucent panels, and do not place cards inside cards.

## Color tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--page` | `#eef1ed` | `#141b18` | Page background |
| `--surface` | `#f8faf7` | `#1c2520` | Solid fallback surface |
| `--surface-raised` | `#ffffff` | `#222e27` | Raised controls and overlays |
| `--ink` | `#1b2721` | `#eef4ef` | Primary text |
| `--muted` | `#6a766e` | `#a5b2a9` | Supporting text and metadata |
| `--line` | `#d7dfd8` | `#36453b` | Dividers |
| `--line-strong` | `#bcc9bf` | `#506357` | Input and control borders |
| `--accent` | `#28664f` | `#83c8a5` | Primary actions and selected states |
| `--signal` | `#d8aa4f` | `#e2bd6c` | Round and host indicators |
| `--danger` | `#a84a3f` | `#ed9689` | Errors and destructive actions |

Use semantic tokens rather than hard-coded colors in components. Do not add a third theme or derive a theme automatically from the operating system.

## Subtle glass

| Token | Light | Dark |
| --- | --- | --- |
| `--glass-surface` | `rgb(255 255 255 / 68%)` | `rgb(255 255 255 / 4%)` |
| `--glass-strong` | `rgb(255 255 255 / 82%)` | `rgb(255 255 255 / 7%)` |
| `--glass-border` | `rgb(255 255 255 / 88%)` | `rgb(255 255 255 / 9%)` |

- Use a 10–14px backdrop blur on selected surfaces: the sticky header, entry panels, room heading, round status, voting cards, and transient toast.
- Keep the blur and border low-contrast. The page background remains opaque and carries a very faint structural grid.
- Inputs and cards must retain a solid-color fallback when backdrop filters are unavailable or reduced transparency is requested.
- Avoid large blurred blobs, strong gradients, bright glow, and excessive shadows.

## Shape and depth

| Element | Radius |
| --- | ---: |
| Compact controls, inputs, icon buttons | 12px |
| Voting and result cards | 14px |
| Entry and room panels | 18px |
| Avatars and status dots | 50% |

Prefer thin borders and small, soft shadows over heavy elevation. Use rounded corners consistently; avoid capsule-shaped controls unless they represent a compact status or count.

## Typography

- Use Geist Sans for interface copy and Geist Mono for room codes, round numbers, and numeric estimates.
- Keep headings purposeful and compact: a clear home headline, moderate room titles, and small section labels.
- Use sentence case for controls. Metadata can use uppercase mono labels sparingly.
- Keep letter spacing at zero and allow long translated labels to wrap instead of clipping.

## Product surfaces

- **Home:** keep Create room and Join room as the two obvious paths. On wider screens, show the two lightly glazed panels side by side; stack them on narrow screens.
- **Room:** keep the room/topic heading, invite actions, round status, vote deck, and member list easy to scan. The host's next action is visually prominent without overpowering the selected card.
- **Voting cards:** use stable dimensions and a clear selected state. Hidden votes show only whether a participant has voted; never expose values before reveal.
- **Advertising:** reserve a quiet, labeled placement outside the primary control path. Ads must not cover or shift voting controls.

## Responsive and RTL behavior

- Use CSS logical properties (`margin-inline`, `padding-inline`, `border-inline-start`, and `inset-inline-*`) for layout.
- In Arabic, set `lang="ar"` and `dir="rtl"`; mirror directional icons where appropriate.
- Keep room codes and card values LTR and legible within RTL layouts.
- Preserve usable touch targets, stable card sizes, and clear spacing on mobile. Check for horizontal overflow at 320px and above.

## Interaction and accessibility

- Use 150–200ms transitions for color, border, and small elevation changes. Avoid scaling buttons or moving layout on hover.
- Respect `prefers-reduced-motion` and `prefers-reduced-transparency`.
- Keep visible focus indicators, accessible control names, and keyboard-operable dialogs and actions.
- Maintain readable contrast in both themes. Do not communicate vote, connection, host, or error state through color alone.
- Use Lucide icons for icon-only actions and provide a tooltip or accessible label.
