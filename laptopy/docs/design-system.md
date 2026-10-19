# Laptopy design system

The look comes from the store logo: **deep navy + white**, with one bright blue for actions.
Everything below is implemented as CSS variables in `public/css/base.css`.

## Colour

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#08101f` | page background |
| `--surface` | `#0f1d3a` | panels, inputs, table label column |
| `--glass` / `--line` | `#ffffff0d` / `#ffffff1f` | frosted cards and 1px borders |
| `--tx` / `--mu` | `#eaf0ff` / `#9fb0d6` | text / secondary text |
| `--ac` / `--ac-d` / `--ac-2` | `#4f8cff` / `#3b6fe8` / `#8fb4ff` | accent, buttons, highlights |
| `--ok` / `--danger` / `--wa` | `#10b981` / `#ef4444` / `#25d366` | best value / errors / WhatsApp |

Text on the dark surfaces keeps a contrast ratio of at least 4.5:1.

## Typography

- **Sora** for Latin text and the wordmark (wide, geometric, modern).
- **Cairo** is the fallback for Arabic glyphs, so Arabic and English mix cleanly.
- Headings use `letter-spacing: -0.02em`; the wordmark uses `-0.05em`.

## Layout

- Max content width 1160px (`--maxw`), fluid gutters.
- Catalogue = sticky filter sidebar + card grid (stacks on phones).
- Header is sticky on desktop and static on phones (saves screen space).

## Motion

| Where | What | Notes |
|-------|------|-------|
| Hero laptop (`assets-src/laptop-scene`) | closed laptop with the logo on its lid -> lid opens slowly on its hinge (3.8s, ease-in-out, tiny natural settle) -> screen lights up and spills light on the keys -> logo, then store name appear -> slow camera drift | WebGL (three.js); draws only while visible; reduced motion shows the finished laptop; still-picture fallback when WebGL is missing |
| Page / grid entrance | cards rise in with a 70ms stagger | only when the person navigates or changes filters, never on every keystroke |
| Buttons | hover lift, press scale (0.94), ripple from the pointer | |
| Compare table | rows rise in, bars grow, score rings pop | |
| Chat | window springs open, messages pop in, typing dots | |

`prefers-reduced-motion: reduce` switches every animation off and shows the finished state
(the laptop is simply open).

## Accessibility rules applied (from the ui-ux-pro-max skill)

- Visible focus ring on every control (`:focus-visible`), including the slider thumbs and the chat window.
- Icon-only buttons have `aria-label`s; icons are SVG, not emoji.
- Form errors appear **under the field**, linked with `aria-describedby`, plus a focusable summary at the top
  of the form after a failed submit.
- Touch targets are at least 44px on touch devices (`@media (pointer: coarse)`).
- The chat is a `role="dialog"`, closes with Esc and returns focus to its button.
- Result counts and Robin's replies are in `aria-live` regions.
- Browser Back works: tabs are `#shop`, `#compare`, `#admin` in the URL.
- Sign-in uses OAuth (Google), not passwords or one-time codes.
- The animated hero is decorative (`aria-hidden`), pauses off-screen, and has a static final state (reduced motion / no WebGL).

## Credits

- The idea of an opening 3D laptop is inspired by the "Animated 3D MacBook Air" component by **@jahed** on 21st.dev.
  The model, materials and animation here are written from scratch for Laptopy (three.js, no React/Tailwind).
