# Better Audio Player

![Better Audio Player screenshot](docs/img/player.png)

A small, mobile-first audio player built with Svelte focusing on a compact, at-a-glance UI and smooth touch interactions.

**Highlights:**

- **Mobile-first scrubbing:** pointer-based drag support on the progress `seek` control for precise touch scrubbing.
- **Animated visuals:** a blurred, animated blob gradient on the seek bar for a modern look (CSS-only).
- **Focused UI:** page scrolling and overscroll are disabled so the player is always visible without scrolling.
- **Interaction polish:** double-tap zoom is prevented on the seek control; global text selection is disabled to avoid accidental highlights while interacting.

**Developer quick-start:**

1. Install deps and start dev server:

```bash
bun i
bun dev
```

2. Open http://localhost:{port}/ in your device/emulator.

**Key files:**

- `src/lib/Player.svelte` — core player UI and logic, including scrubbing and loop controls.
- `src/app.css` — styling, animated seek gradient, and global interaction rules (scroll/selection).
- `src/main.ts` — app bootstrap and small global handlers (scroll blocking, double-tap prevention scoped fallback).
