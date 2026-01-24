# ClaudeKarma

A cross-browser extension that displays your Claude AI usage statistics directly in the browser toolbar. Part of the Karma extension family.

## Features

- 🔵 **Dynamic Progress Icon** - Circular progress ring shows usage at a glance
- 📊 **Detailed Popup** - View session and weekly limits with progress bars
- ⏰ **Reset Countdowns** - Know exactly when your limits reset
- 🎨 **Color-coded Status** - Green → Yellow → Orange → Red as usage increases
- 🌙 **Dark Theme** - Matches Claude.ai's aesthetic
- 🌐 **Multi-Browser** - Works in Chrome, Firefox, Edge, Brave, and Opera

## Screenshot

```
┌────────────────────────────────────────┐
│  ClaudeKarma                      [⟳]  │
├────────────────────────────────────────┤
│  Current Session                       │
│  ━━━━━━━━━━━━━━━━━░░░░░░░  12%        │
│  Resets in 4h 39min                    │
├────────────────────────────────────────┤
│  Weekly Limits                         │
│  All Models   ━━━━━░░░░░░░  20%       │
│  Sonnet Only  ░░░░░░░░░░░░   0%       │
├────────────────────────────────────────┤
│  Last updated: 1 minute ago            │
└────────────────────────────────────────┘
```

## Installation

### Chrome / Edge / Brave / Opera

1. Download or clone this repository
2. Go to `chrome://extensions/` (or equivalent)
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `claudeKarma` folder

### Firefox

1. Download or clone this repository
2. Go to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select the `manifest.json` file

## Usage

1. **Log in to Claude.ai** - The extension needs your active session
2. **Visit the Usage page** - Go to [Settings > Usage](https://claude.ai/settings/usage) at least once
3. **Click the extension icon** - View your detailed usage stats
4. **Check the toolbar icon** - Color indicates usage level (green = low, red = high)

## Icon Colors

| Usage Level | Color | Meaning |
|-------------|-------|---------|
| 0-50% | 🟢 Green | Plenty of usage remaining |
| 50-75% | 🟡 Yellow | Moderate usage |
| 75-90% | 🟠 Orange | Getting close to limit |
| 90-100% | 🔴 Red | Near or at limit |

## How It Works

The extension scrapes your usage data from Claude.ai's usage page using your existing browser session. No passwords are stored, and all data stays local in your browser.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE WORKER (background/service-worker.js)                  │
│  • Manages periodic refresh via chrome.alarms                   │
│  • Updates extension icon with OffscreenCanvas                  │
│  • Stores data in chrome.storage.local                          │
└─────────────────────────────────────────────────────────────────┘
         ▲                              │
         │                              ▼
┌─────────────────┐         ┌─────────────────────────────────────┐
│  CONTENT SCRIPT │         │  POPUP UI                           │
│  Scrapes usage  │         │  Displays detailed stats            │
│  from DOM       │         │  with countdown timers              │
└─────────────────┘         └─────────────────────────────────────┘
```

### Data Flow

1. **Content Script** - Extracts usage data from `claude.ai/settings/usage`
2. **Service Worker** - Stores data, updates icon, schedules refreshes
3. **Popup** - Reads stored data and displays with live countdowns

## Project Structure

```
claudeKarma/
├── manifest.json              # Extension manifest (MV3)
├── background/
│   └── service-worker.js      # Central orchestrator
├── content/
│   └── content.js             # DOM scraping
├── popup/
│   ├── popup.html             # Popup structure
│   ├── popup.css              # Dark theme styles
│   └── popup.js               # Popup logic
├── lib/
│   ├── constants.js           # Configuration
│   ├── storage.js             # Storage abstraction
│   └── icon-renderer.js       # OffscreenCanvas renderer
├── icons/
│   └── icon-{16,32,48,128}.png
├── _locales/
│   └── en/messages.json       # English strings
└── browser-polyfill.min.js    # Cross-browser support
```

## Privacy

- ✅ All data stored locally in your browser
- ✅ No data sent to third-party servers
- ✅ Uses your existing Claude.ai session (no passwords stored)
- ✅ Minimal permissions requested
- ✅ Open source - full code transparency

## Permissions Explained

| Permission | Reason |
|------------|--------|
| `storage` | Store cached usage data locally |
| `alarms` | Schedule periodic data refresh (every 5 minutes) |
| `offscreen` | Generate dynamic toolbar icons |
| `host_permissions: claude.ai` | Access Claude.ai to scrape usage data |

## Troubleshooting

### "Please log in" message
- Make sure you're logged into Claude.ai in the same browser
- Visit the [usage page](https://claude.ai/settings/usage) to trigger data collection

### Data not updating
- Click the refresh button (⟳) in the popup
- Visit the usage page manually to trigger a scrape
- Check browser console for error messages

### Extension not loading
- Make sure all files are present
- Check the browser's extension error log
- For Firefox, ensure `browser_specific_settings` is configured

## Development

### Building

No build step required - load the extension directly in developer mode.

### Testing

1. Load the extension in developer mode
2. Open DevTools and check for console logs prefixed with `[ClaudeKarma]`
3. Navigate to `claude.ai/settings/usage` to trigger scraping
4. Click the extension icon to verify the popup

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file

## Acknowledgments

- Anthropic for creating Claude AI
- Mozilla for the [webextension-polyfill](https://github.com/nicolo-ribaudo/webextension-polyfill-ts)
- The WebExtension community for cross-browser compatibility tools

---

Made with ❤️ by JR
