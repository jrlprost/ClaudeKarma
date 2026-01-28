# ClaudeKarma — Claude Usage Tracker

Track your Claude AI usage limits directly from the browser toolbar. Monitor 5-hour session and 7-day quotas with real-time progress rings. Never hit the limit unexpectedly again.

## Features

- **Dual Progress Rings** — See both session (5-hour) and weekly (7-day) limits at a glance
- **Color-Coded Status** — Green, yellow, orange, and red indicators show usage levels
- **Real-Time Updates** — Automatically refreshes every 5 minutes
- **Visual Warnings** — Animated rotating icon when approaching limits (70%+)
- **Tips & Tricks** — 40+ built-in prompting tips to use Claude more effectively
- **Auto-Detect** — Automatically finds your Claude organization, no setup needed
- **Premium Dark Theme** — Beautiful, native-feeling interface
- **Privacy First** — All data stays on your device. No tracking, no analytics.

## Installation

### Chrome Web Store

Coming soon.

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

1. **Log in to Claude.ai** — The extension needs your active session
2. **Click the extension icon** — View your detailed usage stats
3. **Pin it to your toolbar** — The icon color shows your usage level at a glance

## Toolbar Icon

The toolbar icon shows two concentric rings:

| Ring | Tracks |
|------|--------|
| **Outer ring** | 7-day weekly limit (all models) |
| **Inner ring** | 5-hour session limit |

| Usage Level | Color | Meaning |
|-------------|-------|---------|
| 0–50% | Green | Plenty of usage remaining |
| 50–70% | Yellow | Moderate usage |
| 70–90% | Orange | Getting close to limit |
| 90–100% | Red | Near or at limit |

At 70%+, the icon animates (rotating rings) to grab your attention.

## Project Structure

```
src/
├── manifest.json              # Extension manifest (MV3)
├── background/
│   └── service-worker.js      # Central orchestrator
├── content/
│   └── content.js             # Fallback DOM scraping
├── popup/
│   ├── popup.html             # Popup structure
│   ├── popup.css              # Dark theme styles
│   └── popup.js               # Popup logic & tips
├── tips/
│   ├── tips.html              # Tips & Tricks page
│   ├── tips.css
│   └── tips.js
├── welcome/
│   ├── welcome.html           # Welcome & pin instructions
│   ├── welcome.css
│   └── welcome.js
├── lib/
│   ├── constants.js           # Colors, thresholds, config
│   ├── storage.js             # Storage abstraction
│   └── icon-renderer.js       # Dynamic icon with OffscreenCanvas
├── icons/
│   └── icon-{16,32,48,128}.png
├── _locales/
│   └── en/messages.json
└── browser-polyfill.min.js    # Cross-browser support
```

## Privacy

- All data stored locally in your browser
- No data sent to third-party servers
- Uses your existing Claude.ai session (no passwords stored)
- Minimal permissions requested
- Open source — full code transparency

Full privacy policy: [PRIVACY.md](https://github.com/jrlprost/ClaudeKarma/blob/main/PRIVACY.md)

## Permissions

| Permission | Reason |
|------------|--------|
| `storage` | Store cached usage data locally |
| `alarms` | Schedule periodic data refresh (every 5 minutes) |
| `offscreen` | Generate dynamic toolbar icons |
| `host_permissions: claude.ai` | Fetch usage data from Claude's API |

## Roadmap

### v1.0 — Initial Release (Current)

- [x] Dual progress rings (5-hour session + 7-day weekly)
- [x] Dynamic toolbar icon with color-coded status
- [x] Rotating animation warning at 70%+ usage
- [x] Auto-detect organization ID
- [x] Tips & Tricks page with prompting best practices
- [x] Random tip display in popup
- [x] Premium dark theme UI
- [x] Welcome page with pin instructions

### v1.1 — Notifications & Badges

- [ ] Desktop notifications at configurable thresholds (70%, 90%, 100%)
- [ ] Badge text on toolbar icon showing percentage
- [ ] Sound alerts (optional, with mute)
- [ ] "Do not disturb" quiet hours setting

### v1.2 — Usage Insights

- [ ] Usage history graph (daily/weekly trends)
- [ ] Calendar heatmap (GitHub-style activity view)
- [ ] Usage predictions ("At this rate, limit in ~2h")
- [ ] Peak usage hours analysis
- [ ] Export data (CSV/JSON)

### v1.3 — Customization

- [ ] Light theme option
- [ ] Custom accent colors
- [ ] Configurable refresh intervals
- [ ] Keyboard shortcut to open popup

### v1.4 — Multi-Account & Sync

- [ ] Multiple Claude account support
- [ ] Sync settings across devices (Chrome sync)

### v1.5 — Cross-Browser

- [ ] Firefox Add-ons store release
- [ ] Microsoft Edge Add-ons store release
- [ ] Localization (FR, DE, ES, PT, JP)

### Future Ideas

- Teams/Organization view
- Desktop widgets (macOS/Windows)
- Slack/Discord bot for usage alerts
- Usage budgets and smart suggestions

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

Have a feature idea? [Open an issue](https://github.com/jrlprost/claudekarma_browser/issues) with the `enhancement` label.

## Troubleshooting

### "Please log in" message
- Make sure you're logged into Claude.ai in the same browser

### Data not updating
- Click the refresh button in the popup
- Check that you're logged into claude.ai

### Extension not loading
- Make sure all files are present in the `src/` folder
- Check the browser's extension error log

## License

MIT License — see [LICENSE](LICENSE) file

---

**Note:** ClaudeKarma is an independent project and is not affiliated with Anthropic.

Made with care by Jean-Rémi Larcelet-Prost
