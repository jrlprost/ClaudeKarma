# ClaudeKarma · Claude Usage Tracker

Track your Claude AI usage limits directly from the browser toolbar. Monitor 5-hour session and 7-day quotas with real-time bars and a circular gauge. Know when peak hours drain your limits faster. Never hit the limit unexpectedly again.

Companion site: [tokenkarma.app/tips](https://tokenkarma.app/tips) — a free playbook to save tokens and stretch your limits.

## Features

- **Live Session Gauge**: 5-hour limit shown as a circular gauge, color-coded by usage
- **Per-Model Breakdown**: stacked bars for All models, Sonnet, Opus, Haiku, and Claude Design
- **Daily Routines Tracker**: monitor scheduled Claude Code routines on Max plans (X / 15 daily)
- **Peak Hour Alerts**: a banner shows when Claude session limits drain 3 to 5x faster (weekdays 5 to 11 AM PT)
- **Plan Badge**: see your tier at a glance (Pro, Max 5x, Max 20x)
- **Activity Heatmap**: hourly grid showing when you use Claude most (week or month view)
- **Smart Notifications**: browser alerts at configurable thresholds (default 90% and 100%)
- **Settings Panel**: refresh interval, notification thresholds, data management
- **Color-Coded Status**: green, yellow, orange, red indicators
- **Dynamic Toolbar Icon**: dual concentric rings, blinks at 90% and above
- **Premium Dark Theme**: native-feeling interface
- **Privacy First**: all extension data stays on your device, no third-party tracking inside the extension

## Installation

### Chrome Web Store

[Add to Chrome](https://chrome.google.com/webstore/detail/claudekarma) (search for "ClaudeKarma")

### Manual Install (Chrome / Edge / Brave / Opera)

1. Download or clone this repository
2. Go to `chrome://extensions/` (or equivalent)
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `src` folder

### Firefox

1. Download or clone this repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `src/manifest.json`

## Usage

1. **Log in to Claude.ai**: the extension uses your active session
2. **Click the extension icon**: see your detailed usage stats
3. **Pin it to your toolbar**: the icon color shows your usage level at a glance

## Toolbar Icon

The toolbar icon shows two concentric rings:

| Ring | Tracks |
|------|--------|
| **Outer ring** | 5-hour session limit |
| **Inner ring** | 7-day weekly limit (all models) |

| Usage Level | Color | Meaning |
|-------------|-------|---------|
| 0 to 50% | Green | Plenty of usage remaining |
| 50 to 70% | Yellow | Moderate usage |
| 70 to 90% | Orange | Getting close to limit |
| 90 to 100% | Red | Near or at limit |

At 90% and above, the icon blinks to grab your attention.

## Peak Hours

Claude session limits drain noticeably faster during peak business hours. Source: [Anthropic support](https://support.claude.com/en/articles/14063676).

| Time (UTC) | Days | State |
|------------|------|-------|
| 13:00 to 19:00 UTC (5 to 11 AM PT) | Monday to Friday | Peak (drain 3 to 5x faster) |
| All other times | Weekdays + weekends | Off-peak (standard rate) |

The popup banner shows a live indicator and a countdown to the next state change. Weekly limits are not affected, only the 5-hour session.

## Project Structure

```
src/
├── manifest.json              # Extension manifest (MV3)
├── background/
│   └── service-worker.js      # API fetching, codename mapping, alarms
├── content/
│   └── content.js             # Fallback DOM scraping (rare)
├── popup/
│   ├── popup.html             # 2-column layout: gauge + bars
│   ├── popup.css              # Dark theme styles
│   └── popup.js               # Render logic, peak banner, plan badge
├── tips/
│   ├── tips.html              # Internal tips page (legacy, redirects to tokenkarma.app)
│   ├── tips.css
│   └── tips.js
├── update/
│   ├── update.html            # "What's New" changelog page
│   ├── update.css
│   └── update.js
├── welcome/
│   ├── welcome.html           # First-run welcome with pin instructions
│   ├── welcome.css
│   └── welcome.js
├── lib/
│   ├── constants.js           # Colors, thresholds, config
│   ├── storage.js             # Storage abstraction (cross-browser)
│   ├── icon-renderer.js       # Dynamic icon with OffscreenCanvas
│   └── peak-schedule.js       # Hardcoded peak/off-peak windows (v1.2.1 will fetch)
├── icons/
│   └── icon-{16,32,48,128}.png
├── _locales/
│   └── {en,fr,de,es,it,ja,ko,nl,pt_BR}/messages.json
└── browser-polyfill.min.js    # Cross-browser support
```

## Architecture

```
                ┌─────────────────────────────┐
                │  SERVICE WORKER             │
                │  fetchUsageData() / alarms  │
                └──────────┬──────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  /api/.../usage   /v1/code/routines   /api/.../rate_limits
  (5h, 7-day,      (Max plans only)    (plan tier)
  per-model)
                           │
                           ▼
                ┌─────────────────────────────┐
                │  chrome.storage.local       │
                │  usageData snapshot         │
                └──────────┬──────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
        Toolbar icon   Popup UI    Update / welcome
        (refreshIcon)  (popup.js)  pages
```

## Privacy

- All extension data stored locally in your browser
- No data sent to third-party servers from the extension
- Uses your existing Claude.ai session (no passwords stored, ever)
- Minimal permissions requested (see below)
- Open source: full code transparency

The companion website at [tokenkarma.app](https://tokenkarma.app) uses Cloudflare Web Analytics, which is cookieless, GDPR-friendly, and does not track individual visitors.

Full privacy policy: [PRIVACY.md](https://github.com/jrlprost/ClaudeKarma/blob/main/PRIVACY.md)

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Store cached usage data locally |
| `alarms` | Schedule periodic data refresh (default 5 minutes) |
| `notifications` | Optional alerts at configured thresholds (90%, 100%) |
| `offscreen` | Generate dynamic toolbar icons (Chrome) |
| `host_permissions: claude.ai` | Fetch usage data from Claude's API |

## Roadmap

### v1.0 (shipped)

- Dual progress rings (5-hour session + 7-day weekly)
- Dynamic toolbar icon with color-coded status
- Auto-detect organization ID
- Premium dark theme UI
- Welcome page with pin instructions

### v1.1 (shipped)

- Activity heatmap (GitHub-style hourly grid)
- Per-model usage tabs (Opus, Sonnet, Haiku)
- Browser notifications at usage thresholds
- Settings panel with refresh interval and threshold customization
- i18n in 9 languages
- Plan-aware data logging

### v1.2 (current)

- Redesigned popup with stacked bars for every weekly limit
- Claude Design tracking (Anthropic codename: omelette)
- Daily Routines tracker for Max plans
- Peak / off-peak hour banner with verified Anthropic schedule
- Plan tier badge in popup header
- Big "Save tokens" CTA leading to [tokenkarma.app/tips](https://tokenkarma.app/tips)
- Welcome page refreshed with peak-hour explanation
- Hotfixes: tab navigation bug, null model crash, first-run UX

### v1.2.1 (next)

- Peak schedule fetched from `api.tokenkarma.app/peak-schedule.json` instead of hardcoded
- 40 individual tip pages on tokenkarma.app
- Possible Claude Code billing / extra usage tracking (when API exposes it)

### v1.3 (planned)

- Light theme option
- Keyboard shortcut to open popup
- Usage budget alerts ("you'll hit your limit by 4 PM at this rate")
- ChatGPT extension companion (`GPTKarma`) under the same tokenkarma umbrella

### Future ideas

- Mac menu-bar app (paid Pro tier) tracking all your AI tools in one place
- Multiple Claude account support
- Slack / Discord bot for usage alerts
- Team / organization view

## Companion Site: tokenkarma.app

[tokenkarma.app](https://tokenkarma.app) is the umbrella project that ClaudeKarma is part of. The site hosts a free educational hub at [tokenkarma.app/tips](https://tokenkarma.app/tips) with verified, actionable tips to use Claude more efficiently. Future products under the same umbrella will track other AI services (ChatGPT, Cursor, Perplexity, etc.).

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

Have a feature idea? [Open an issue](https://github.com/jrlprost/ClaudeKarma/issues) with the `enhancement` label.

## Troubleshooting

### "Please log in" message
- Make sure you are logged into Claude.ai in the same browser
- Try clicking the refresh button in the popup

### Data not updating
- Open `chrome://extensions/`, find ClaudeKarma, click the reload icon
- Check that you are logged into claude.ai
- On a fresh install, the first fetch can take up to 5 minutes

### Extension was disabled after update
- Chrome disables extensions when new permissions are added (this happened in v1.1.0 with the notifications permission)
- Re-enable it manually in `chrome://extensions/`

### Extension not loading
- Make sure all files are present in the `src/` folder
- Check the browser's extension error log
- Open the service worker console to see runtime errors

## License

MIT License: see [LICENSE](LICENSE) file

---

**Note:** ClaudeKarma is an independent project and is not affiliated with Anthropic.

Made with care by [Jean-Rémi Larcelet-Prost](https://jrlarcelet.com).
