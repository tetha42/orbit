# Orbit Community OS — Dual Design Language & UI Architecture

**Orbit Community OS** by **tetha42** implements a purposeful **Dual Design Language** that separates the interactive multi-window desktop environment from standalone public and onboarding utilities:

1. **Workspace Desktop Shell & Mini-Apps:** Adaptive light/dark glass and flat studio surfaces engineered for long-session productivity, multi-window spatial management, and 60/120fps responsiveness.
2. **Standalone & Static Surfaces:** Clean, non-macOS, non-neon, high-contrast monochrome flat surfaces engineered for zero-distraction utility routes (`/setup`, `/verify`, `/checkin`, `/oauth/authorize`, offline states, and error boundaries).

---

## Table of Contents

1. [Surface 1: Workspace Desktop Shell & Mini-Apps](#1-surface-1-workspace-desktop-shell--mini-apps)
2. [Surface 2: Standalone & Static Utility Surfaces](#2-surface-2-standalone--static-utility-surfaces)
3. [Semantic CSS Tokens & Theme Engine (`src/core/theme/`)](#3-semantic-css-tokens--theme-engine-srccoretheme)
4. [Zero-Flash Theme Boot Script (`themeBootScript`)](#4-zero-flash-theme-boot-script-themebootscript)
5. [60/120fps Compositing & Frosted Glass Architecture](#5-60120fps-compositing--frosted-glass-architecture)
6. [Touchscreen, Mobile Launcher & Responsive Ergonomics](#6-touchscreen-mobile-launcher--responsive-ergonomics)
7. [Component Primitives & Interaction Patterns](#7-component-primitives--interaction-patterns)

---

## 1. Surface 1: Workspace Desktop Shell & Mini-Apps

The authenticated workspace (`/`) presents a spatial desktop environment composed of:

### Shell Chrome Components
- **TopBar (`src/components/shell/TopBar/`):** System menu bar displaying the Orbit brand menu, active mini-app menu categories (dynamically loaded from `manifest.ts`), live SoC posture indicators, Control Center toggles, Spotlight trigger, and the 4-tier Notification Center bell.
- **Window Manager (`src/components/shell/WindowManager/`):** Floating, draggable, 8-directionally resizable application frames (`WindowFrame`) with keyboard focus cycling, minimize-to-Dock, and full-viewport maximize.
- **Application Dock (`src/components/shell/Dock/`):** Magnification-ready application bar with unread badge counters (`useDockBadge`), automatic hiding when any non-minimized window is maximized (`anyMaximized`), a 14px bottom-edge hover reveal hotspot, and `onMouseEnter` chunk prefetching (`prefetchApp`).
- **Spotlight Search (`src/components/Common/`):** Instant keyboard-driven launcher and cross-domain search palette (`⌘K` / `Ctrl+K`).

### Mini-App Studio Layout Pattern
Inside the 15 mini-apps (`src/apps/<id>/`), interfaces follow a clean **Pro Studio Split-View** paradigm:
- **Left Navigation / Filter Sidebar:** Compact category switcher, room list, or vault selector (`var(--window-titlebar)` / `var(--fill-soft)`).
- **Flat Studio Toolbar:** Contextual actions, search inputs, and view switchers aligned along a top header bar.
- **Primary Content Canvas:** High-density data grids, Kanban columns, or telemetry charts constructed using semantic studio tokens (`var(--window-bg)`, `var(--card-bg)`, `var(--border-subtle)`).

---

## 2. Surface 2: Standalone & Static Utility Surfaces

Standalone routes operate outside the Web-Desktop window manager and intentionally avoid desktop chrome (no Dock, no TopBar, no floating macOS window traffic lights, and no decorative neon gradients). Instead, they use **clean, high-contrast monochrome flat surfaces** optimized for clarity, accessibility, and fast mobile/desktop completion:

| Route | Component Path | Design & UX Purpose |
| :--- | :--- | :--- |
| **`/setup` (`/kurulum`)** | `src/app/kurulum/page.tsx` & `FirstRunSetupWizard.tsx` | **Zero-Config First-Run Onboarding:** Focused 5-step card workflow for binding PostgreSQL, setting Studio (`tetha42`) & Community identity, and creating the first administrator |
| **`/verify` (`/dogrula`)** | `src/app/dogrula/page.tsx` & `[kod]/BelgeDogrulama.tsx` | **Cryptographic Document & Certificate Verification:** High-contrast institutional verification sheet displaying authenticity status, issuer signatures, and timestamps |
| **`/checkin` (`/yoklama`)** | `src/app/yoklama/page.tsx` | **Event QR & Short-Code Check-In:** High-contrast mobile-first scanner and 6-digit code input designed for fast venue entry under any lighting condition |
| **`/oauth/authorize`** | `src/app/oauth/authorize/page.tsx` | **OAuth 2.0 / OIDC Consent Screen:** Clear, unambiguous scope permission prompt showing requesting client identity, redirect domain, and requested claims |
| **Offline & Error Boundaries** | `PWADownloadLanding.tsx` & error boundaries | High-legibility diagnostic and recovery states |

---

## 3. Semantic CSS Tokens & Theme Engine (`src/core/theme/`)

All visual styling in Orbit Community OS is driven by semantic CSS variables declared in `src/app/globals.css` and controlled by four user preferences stored in `localStorage` (`kulup_theme`, managed by `src/core/theme/pure.ts`):

1. **Theme Mode (`data-theme`):** `light` | `dark` | `system` (tracks OS `prefers-color-scheme` in real time via `ThemeSync`).
2. **Accent Palette (`data-accent`):** `blue` (`#0a84ff`) | `purple` (`#bf5af2`) | `pink` (`#ff375f`) | `orange` (`#ff9f0a`) | `green` (`#30d158`) | `graphite` (`#8e8e93`).
3. **Transparency (`data-transparency`):** `on` | `off` (defaults to `off` for locked 60/120fps performance on all hardware).
4. **Motion (`data-motion`):** `full` | `reduced` (respects `prefers-reduced-motion`).

### Core Semantic Token Reference (`src/app/globals.css`)

| Token Category | CSS Custom Properties | Usage Rule |
| :--- | :--- | :--- |
| **Surfaces & Chrome** | `--window-bg`, `--window-titlebar`, `--topbar-bg`, `--dock-bg`, `--menu-bg`, `--card-bg`, `--input-bg` | Always use surface tokens instead of hardcoded `#fff` or `#1e1e1e` so Light and Dark modes adapt automatically |
| **Typography** | `--text-primary`, `--text-secondary`, `--text-muted` | High-contrast legibility across both opaque and translucent surfaces |
| **Borders & Fills** | `--window-border`, `--border-subtle`, `--fill-soft`, `--fill-softer`, `--fill-strong` | Hairline studio dividers (`1px solid var(--border-subtle)`) and subtle hover states |
| **Accents & Status** | `--accent`, `--success`, `--warning`, `--danger`, `--info` | Interactive controls, badges, and SoC severity indicators |
| **Frosted Glass** | `--glass-blur`, `--glass-blur-strong`, `--glass-blur-scrim` | Evaluates to `blur(...) saturate(...)` when transparency is enabled, or `none` when disabled |

> **Compile-Time Token Gate:** `scripts/check-tokens.mjs` (part of `npm run verify`) scans stylesheets to ensure components adhere to semantic token rules.

---

## 4. Zero-Flash Theme Boot Script (`themeBootScript`)

To prevent a jarring white flash (FOUC) when loading the workspace in Dark Mode, `src/app/layout.tsx` injects a synchronous inline `<script>` generated by `themeBootScript()` (`src/core/theme/pure.ts`) inside `<head>` before first paint:

- Reads `kulup_theme` from `localStorage` (falling back safely if storage is blocked in private browsing).
- Resolves `system` mode against `window.matchMedia('(prefers-color-scheme: dark)')`.
- Sets `data-theme`, `data-accent`, `data-transparency`, `data-motion`, and the `.dark` class on `<html>` before a single pixel is painted.
- **Automated Parity Verification:** `scripts/check-pure.mjs` executes both `themeBootScript()` and `parseThemePrefs() + htmlAttributes()` across all combinations to guarantee 100% behavioral parity.

---

## 5. 60/120fps Compositing & Frosted Glass Architecture

### Single-Source `backdrop-filter` Rule
Frosted glass effects are defined exclusively through `--glass-blur`, `--glass-blur-strong`, and `--glass-blur-scrim` (`.glass`, `.glass-strong`, `.glass-scrim` in `src/app/globals.css`):
- **Standard Unprefixed `backdrop-filter` Only:** Never write `-webkit-backdrop-filter` alongside `backdrop-filter` in CSS modules, as CSS minifiers may strip the standard property in favor of the vendor prefix.
- **Zero-Cost Opaque Mode:** When `[data-transparency="off"]` is active, `--glass-blur` is `none`, eliminating expensive GPU backdrop sampling during multi-window dragging.

### Window Compositor Optimizations
- Minimized windows receive `content-visibility: hidden`, completely bypassing browser layout and paint passes while keeping React state alive.
- Active window dragging/resizing applies `will-change: top, left, width, height` and `contain: strict` to isolate repaints to a single GPU layer.

---

## 6. Touchscreen, Mobile Launcher & Responsive Ergonomics

Orbit Community OS adapts seamlessly across desktop monitors, touch-enabled laptops, tablets, and mobile phones:

1. **W3C Pointer Events Window Manipulation:**
   - Desktop and tablet touchscreens can drag windows and resize edges/corners smoothly via enlarged invisible hit targets (`12px` edge handles and `18px` corner handles).
2. **Mobile Launcher & Home Screen (`src/components/shell/MobileLauncher/`):**
   - On compact viewports, Orbit transitions from floating windows to a responsive mobile OS shell with a touch app grid, status bar, bottom navigation bar, and native-feeling slide-up **Action Sheets** (`@/core/ui/Sheet`).
3. **iOS & Notch Safe-Area Compliance:**
   - All top bars, bottom docks, and sheets respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` for iPhone Dynamic Island and home indicator ergonomics.
   - Form inputs maintain a minimum `16px` font size on mobile viewports to prevent unwanted iOS Safari auto-zooming on focus.
4. **Tactile Spring Feedback & Long-Press Context Menus:**
   - Interactive controls provide `<16ms` active touch feedback (`transform: scale(0.98)`), and holding any item for `500ms` triggers `useContextMenu` with a `10px` scroll-cancellation guard and subtle haptic vibration.

---

## 7. Component Primitives & Interaction Patterns

When building or extending UI inside Orbit Community OS, use the shared primitives in `src/core/ui/` and `src/components/Common/`:

- **Dialogs & Confirmations:** Use `useDialog()` (`@/components/Common/DialogProvider`) for modal confirmations and prompts. Never call native `window.alert()` or `window.confirm()`.
- **Slide-Over Panels:** Use `<Sheet>` (`@/core/ui/Sheet`) for detail drawers, Kanban card inspectors, and mobile action sheets.
- **Toast Notifications:** Use `useToast()` (`@/core/ui/Toast`) for non-blocking feedback after mutations.
- **Context Menus:** Spread `{...useContextMenu({ items })}` (`@/core/shell`) onto rows, cards, or canvases to support both desktop right-click and mobile long-press menus.
- **Role Badges:** Render member roles consistently with `<RoleBadge>` and `roleGradient()` (`@/core/ui/RoleBadge`).
