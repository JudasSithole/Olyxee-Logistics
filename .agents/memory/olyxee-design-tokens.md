---
name: Olyxee design tokens
description: Where the design system lives and the hard rule that the orange brand tokens must never be restyled.
---

# Olyxee design tokens (olyxee-admin frontend)

All design tokens live in `artifacts/olyxee-admin/src/index.css` (Tailwind v4 `@theme inline` + `:root`/`.dark` CSS vars). shadcn/ui components consume `--color-*` which map to these vars.

## Hard rule: never restyle the orange brand
The orange brand/primary is driven by `--brand-h/--brand-s/--brand-l` (set at runtime in `src/contexts/theme-context.tsx` from tenant branding). `--primary`, `--sidebar-primary`, `--ring`, and `--chart-1` all derive from those brand vars. When applying design-system / restyle work, change the NEUTRALS, typography, radius, shadow, and motion tokens only — do NOT touch `--brand-*`, `--primary*`, or `--ring`.

**Why:** the user's explicit standing instruction is "follow the style guide but do not change the orange — it's our primary color."

**How to apply:** for any future restyle, edit neutral/surface/type/motion tokens and leave the brand chain alone. Note the default `DEFAULTS.primaryColor` in theme-context is `#2b2b2b` (dark), not orange — orange comes from tenant branding/logo, so a plain UI screenshot may show dark primary buttons; that is expected, not a bug.

## Design system alignment (Olyxee visual system)
- Web font is **Inter** (leads `--font-sans`); Apple SF fonts are intentionally NOT used as web fonts (licensing). `--font-mono` = JetBrains Mono, reserved for technical values (tracking IDs / references — already applied via `font-mono` across order pages).
- Neutral palette is the guide's cool-neutral hue ~210 (neutral-0..900), not the older blue-purple hue 240.
- Radius scale: xs 4 / sm 6 / md 10 / lg 14 / xl 20 px; base `--radius` = 10px.
- Motion tokens (`--duration-*`, `--ease-*`) exist AND are wired into `.animate-page` / `.tap`. If you add motion, use these tokens, not hardcoded ms values.
