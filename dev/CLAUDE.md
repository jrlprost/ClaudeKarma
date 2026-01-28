# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClaudeKarma is a cross-browser extension (Manifest V3) that displays Claude AI usage statistics in the browser toolbar. It shows current session usage via a circular progress icon and detailed weekly limits in a popup. Targets Chrome, Firefox, Edge, Brave, Opera, and other Chromium-based browsers.

**Current Status**: Planning phase - manifest.json and documentation exist, but implementation files need to be created.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE WORKER (background/service-worker.js)                  │
│  • Fetches usage data from Claude.ai API (with cookies)         │
│  • Manages polling interval (every 5 min via chrome.alarms)     │
│  • Updates extension icon with dynamic progress ring            │
│  • Stores data in chrome.storage.local                          │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐         ┌─────────────────────────────────────┐
│  CLAUDE.AI API  │         │  BROWSER STORAGE                    │
│  /api/usage     │         │  (chrome.storage.local/sync)        │
└─────────────────┘         └─────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  POPUP (popup/*.html/css/js) - Reads cached data, displays UI  │
└─────────────────────────────────────────────────────────────────┘

FALLBACK: Content script (content/content.js) scrapes usage page DOM
```

### Data Fetching Strategy
1. **Primary**: Direct API call to claude.ai usage endpoints with session cookies
2. **Fallback**: Content script on `claude.ai/settings/usage*` scrapes DOM
3. **Cache**: Results stored in `chrome.storage.local` to minimize requests

## Directory Structure (Planned)

```
claudekarma/
├── manifest.json              # Extension manifest (V3) ✓ EXISTS
├── background/service-worker.js
├── popup/{popup.html, popup.css, popup.js}
├── content/content.js         # Fallback scraper
├── lib/{api.js, storage.js, utils.js}
├── icons/{16,32,48,128}.png + icon-template.svg
├── _locales/{en,fr}/messages.json
└── browser-polyfill.min.js    # Mozilla's cross-browser polyfill
```

## Build Commands

Build system not yet implemented. When ready:
```bash
npm install
npm run build:chrome    # → dist/chrome/
npm run build:firefox   # → dist/firefox/
npm run build:all
```

## Manual Testing

1. Load extension in developer mode (`chrome://extensions/` with Developer mode enabled)
2. Log into claude.ai
3. Navigate to Settings > Usage
4. Click extension icon to verify data

## Cross-Browser Notes

- **Chrome**: Uses `service_worker` + `offscreen` API for canvas operations
- **Firefox**: May need different manifest handling; uses gecko-specific settings (ID: `claudekarma@jrtech.dev`, min version 109.0)
- **Edge/Brave/Opera**: Chromium-based, should work with Chrome version

## Key Technical Constraints

- **Manifest V3**: Must use service workers (not persistent background pages)
- **OffscreenCanvas**: Required for dynamic icon generation in Chrome
- **Host permissions**: Only `https://claude.ai/*` - uses existing session cookies
- **Permissions**: `storage`, `alarms`, `offscreen` (minimal set)

## UI Specifications

### Icon Progress Ring Colors
- 0-50%: `#22c55e` (green)
- 50-75%: `#eab308` (yellow)
- 75-90%: `#f97316` (orange)
- 90-100%: `#ef4444` (red)

### Popup Theme (Dark Mode)
- Background: `#1a1a1a`, Card: `#2a2a2a`
- Text: `#ffffff` / `#888888`
- Accent: `#6366f1` (indigo, Claude brand)
- Width: 320px, height: auto

## Data Structures

```typescript
// chrome.storage.local
interface UsageData {
  currentSession: { percentage: number; resetTimestamp: number };
  weeklyLimits: {
    allModels: { percentage: number; resetTimestamp: number; resetDay: string; resetTime: string };
    sonnetOnly: { percentage: number; resetTimestamp: number; resetDay: string; resetTime: string };
  };
  lastFetchedAt: number;
  fetchSource: 'api' | 'scrape';
}

// chrome.storage.sync
interface Settings {
  refreshInterval: number;  // minutes, default 5
  notifications: { enabled: boolean; thresholds: number[] };
  theme: 'dark' | 'light' | 'system';
  language: 'en' | 'fr';
}
```

## Implementation Phases

1. **Project Setup**: Directory structure, manifest, browser-polyfill, placeholder icons
2. **Core Functionality**: Service worker with API fetching, storage utilities, dynamic icon with OffscreenCanvas
3. **Popup Interface**: HTML/CSS (dark mode), popup.js, refresh button, countdown timers
4. **Content Script Fallback**: DOM scraping on usage page, messaging to service worker
5. **Cross-Browser Testing**: Chrome, Firefox, Edge, Brave, Opera
6. **Polish**: Production icons, i18n (EN/FR), store listings

## Reference

- See `PROJECT_PLAN.md` for detailed implementation steps and API discovery strategies
- See `README.md` for user-facing documentation
