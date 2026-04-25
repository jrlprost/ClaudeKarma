# CLAUDE.md

Guidance for Claude Code when working in the ClaudeKarma repo.

## Project context

ClaudeKarma is a Chrome / Firefox / Edge / Brave extension (Manifest V3) tracking Claude.ai usage limits. Live on Chrome Web Store with 1000+ users. Part of the **tokenkarma.app** umbrella project (companion site at https://tokenkarma.app/tips).

Author: Jean-Rémi Larcelet-Prost (`@jrlprost`).

**Stack:** vanilla JS, no build step, ES modules. The `src/` folder is what gets zipped and shipped to the Chrome Web Store.

## Strategic direction

ClaudeKarma is the flagship product of an umbrella brand `tokenkarma.app`. Future products will track other AI services (ChatGPT, Cursor, Perplexity, Midjourney, etc.). Long-term plan: a paid Mac menu-bar app that aggregates all AIs with cloud sync, with the free extensions as acquisition channels.

Positioning: **save tokens, work smarter**. Win-win with Anthropic (less server load, happier users). Never anti-Anthropic.

The companion site `tokenkarma.app/tips` hosts educational content. The extension's primary CTA points there.

## Critical pitfalls (must read before changing manifest)

### Adding a permission disables the extension for ALL existing users

When you add a new permission (or `host_permissions`) to `manifest.json`, Chrome disables the extension on update for every user until they manually re-enable it via `chrome://extensions`. This caused user churn in v1.1.0 (when `notifications` was added).

**Before adding ANY permission, flag this loudly to the user and discuss alternatives:**
- `chrome.permissions.request()` for runtime opt-in (no force-disable)
- Re-using existing `host_permissions` when possible

### Never use `chrome.tabs.update()` to navigate the user's tab

The v1.1.0 content-script fallback navigated the user's active Claude.ai tab to `/settings/usage` every 5 minutes during alarm cycles. Hotfixed in v1.1.1.

**Rule:** never call `chrome.tabs.update({ url: ... })` on tabs the user is actively browsing. Use `chrome.tabs.create()` for new tabs only.

## Design preferences (apply consistently to extension UI, welcome page, tips site)

- **No em-dashes** (`—`). Use `:`, `,`, or restructure with "to" / "and" instead.
- **No emojis in production UI.** Use Tabler-style inline SVG icons (1.75 stroke-width, currentColor).
- **No dead links.** A `href="#"` that scrolls to top is worse than a `<div>` with no link. If a destination doesn't exist yet, show "Coming soon" in muted italic.
- **Compactness over breathing room.** The popup must fit without vertical scroll. The user prefers always-visible sections over collapsible ones.
- **Color-coded status:** green `<50%`, yellow `50-70%`, orange `70-90%`, red `>=90%`. Never animate at 70% (rotation was perceived as confusing); blink at `>=90%` only.

## Claude API quirks (as of April 2026)

### `/api/organizations/{orgId}/usage`

Per-model entries (`seven_day_*`) can be `null` when the user hasn't used that model. Always filter `data[k] != null` before reading `.utilization`.

Internal codenames returned by the API:
- `omelette` → display as **Claude Design**
- `cowork` → display as **Cowork**
- `iguana_necktie`, `omelette_promotional` → **hide** (internal/experimental)

Map via `MODEL_DISPLAY_NAMES` in `src/background/service-worker.js`. Unknown codenames fall through to title-cased raw text.

### `/v1/code/routines/run-budget` (Claude Code routines)

Different namespace from the org API. Headers required:
- `anthropic-version: 2023-06-01`
- `anthropic-beta: ccr-triggers-2026-01-30`
- `anthropic-client-platform: web_claude_ai`
- `x-organization-uuid: <orgId>` (in headers, NOT in URL)

Returns `{used, limit}` as **strings**, parse to int. Returns 403/404 for plans that don't have routines (Free, Pro). Always handle gracefully.

### Peak hours (post-March 2026)

Verified from Anthropic support docs (https://support.claude.com/en/articles/14063676):
- Peak: weekdays 13:00-19:00 UTC (5 to 11 AM PT)
- Affects 5-hour session limits only (~3 to 5x faster drain). Weekly limits unaffected.
- Schedule hardcoded in `src/lib/peak-schedule.js`. Will move to `api.tokenkarma.app/peak-schedule.json` in v1.2.1.

## Architecture

```
src/
├── manifest.json              # MV3 manifest, version, permissions
├── background/
│   └── service-worker.js      # API fetching, codename mapping, alarms
├── content/
│   └── content.js             # Fallback DOM scraping (avoid using)
├── popup/
│   ├── popup.html             # 2-column: gauge (left) + bars (right)
│   ├── popup.css              # Dark theme, 440px wide
│   └── popup.js               # ES module, imports peak-schedule
├── lib/
│   ├── constants.js           # COLORS, ICON_SIZES, MESSAGE_TYPES, defaults
│   ├── storage.js             # chrome.storage abstraction
│   ├── icon-renderer.js       # OffscreenCanvas dual rings, blink animation
│   └── peak-schedule.js       # Hardcoded peak windows + getCurrentPeakState()
├── tips/, update/, welcome/   # Standalone HTML pages
├── icons/                     # 16/32/48/128 PNG
├── _locales/                  # 9 languages (en, fr, de, es, it, ja, ko, nl, pt_BR)
└── browser-polyfill.min.js    # Mozilla cross-browser polyfill
```

The popup imports `peak-schedule.js` via `<script type="module">`. Don't break the module structure with global vars.

## Versioning and ship process

1. Feature branches: `feat/vX.Y-description` → merge with `--no-ff` to `main`
2. Bump `manifest.json` version
3. Build ZIP from `src/` directly (`cd src && zip -r ../claudekarma-v{version}.zip .`)
4. Pre-ship review (use the `pr-review-toolkit:code-reviewer` agent before submitting)
5. Upload to Chrome Web Store dashboard
6. Hotfixes go directly on `main`, no separate branch

The `dev/` directory is gitignored (mockups, store assets, internal docs). Don't try to commit files there.

## Companion site: tokenkarma.app

Repo: `jrlprost/tokenkarma-app` (separate repo).
Stack: Astro 5 statique on Cloudflare Pages, auto-deployed from main.

Key URLs:
- `tokenkarma.app/` → currently redirects to `/tips` (real landing planned for v1.2.x)
- `tokenkarma.app/tips` → educational hub, target of the popup CTA
- `api.tokenkarma.app/peak-schedule.json` → planned for v1.2.1 (peak hours feed)

The site uses **Cloudflare Web Analytics** (cookieless, GDPR-friendly, no consent banner needed). No PostHog, no third-party trackers.

## Privacy posture

- Extension: ALL data stored locally in `chrome.storage.local`. No third-party fetches except claude.ai. No analytics inside the extension.
- Companion site: only Cloudflare Web Analytics (cookieless). Documented in README and store description.

## What NOT to do

- Don't add tracking cookies, third-party SDKs, or fingerprinting to the extension.
- Don't change the brand color (`#22c55e`) without explicit approval.
- Don't add a build step (webpack/vite) without explicit approval. Vanilla JS is intentional for review simplicity.
- Don't auto-submit to the store. The user always uploads ZIPs manually.
