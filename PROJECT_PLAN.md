# ClaudeKarma - Browser Extension

## 🎯 Project Overview

A cross-browser extension that displays Claude AI usage statistics directly in the browser toolbar. Users can see their current session usage at a glance (circular progress icon) and view detailed weekly limits in a popup. Part of the Karma extension family.

### Target Browsers
- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Brave
- Opera
- Perplexity Browser (Chromium-based)
- Arc Browser

---

## 📋 Features

### Core Features
1. **Toolbar Icon with Progress Ring**
   - Circular progress indicator showing current 5-hour session usage
   - Color changes based on usage level (green → yellow → orange → red)
   - Updates automatically every 5 minutes

2. **Popup Dashboard**
   - Current session usage with reset countdown
   - Weekly "All models" usage with reset time
   - Weekly "Sonnet only" usage with reset time
   - Visual progress bars for each limit
   - "Refresh" button for manual update

3. **Notifications (Optional)**
   - Alert when approaching limit (80%, 90%, 95%)
   - Alert when limit resets

### Nice-to-Have Features
- Dark/Light theme matching system preference
- Usage history graph (last 7 days)
- Export usage data
- Multiple account support

---

## 🏗️ Technical Architecture

### Browser Extension Standard
Using **WebExtension API** (Manifest V3) which is supported by all target browsers.

```
claudekarma/
├── manifest.json           # Extension manifest (V3)
├── background/
│   └── service-worker.js   # Background service worker
├── popup/
│   ├── popup.html          # Popup UI
│   ├── popup.css           # Popup styles
│   └── popup.js            # Popup logic
├── content/
│   └── content.js          # Content script for Claude.ai
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-128.png
│   └── icon-template.svg   # For dynamic icon generation
├── lib/
│   ├── api.js              # API communication
│   ├── storage.js          # Storage utilities
│   └── utils.js            # Helper functions
├── _locales/
│   ├── en/messages.json
│   └── fr/messages.json
└── browser-polyfill.min.js # Mozilla's WebExtension polyfill
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLAUDE USAGE TRACKER                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SERVICE WORKER (background/service-worker.js)                  │
│  ─────────────────────────────────────────────────────────────  │
│  • Fetches usage data from Claude.ai API                        │
│  • Manages polling interval (every 5 min)                       │
│  • Updates extension icon with progress ring                    │
│  • Stores data in chrome.storage.local                          │
│  • Handles notifications                                        │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         │ fetch                        │ storage.set
         ▼                              ▼
┌─────────────────┐         ┌─────────────────────────────────────┐
│  CLAUDE.AI API  │         │  BROWSER STORAGE                    │
│  ─────────────  │         │  ─────────────────────────────────  │
│  /api/usage     │         │  • lastUsageData                    │
│  (with cookies) │         │  • lastFetchTime                    │
└─────────────────┘         │  • settings                         │
                            └─────────────────────────────────────┘
                                        │
                                        │ storage.get
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│  POPUP (popup/popup.html + popup.js)                            │
│  ─────────────────────────────────────────────────────────────  │
│  • Displays current session usage                               │
│  • Shows weekly limits                                          │
│  • Progress bars & countdown timers                             │
│  • Manual refresh button                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔑 API Discovery

### Method 1: Intercept Network Requests
The extension can observe XHR/fetch requests when user visits claude.ai/settings/usage to discover the API endpoint.

### Method 2: Direct API Call
Based on typical Anthropic patterns, the endpoint is likely:
```
GET https://claude.ai/api/organizations/{org_id}/usage
```
or
```
GET https://claude.ai/api/account/usage
```

### Method 3: Parse the Page HTML
As fallback, inject a content script that reads the usage data directly from the rendered page DOM.

### Recommended Approach
1. **Primary**: Try known API endpoints with session cookies
2. **Fallback**: Content script to scrape the settings page
3. **Cache**: Store results to minimize requests

---

## 📝 Implementation Steps for Claude Code

### Phase 1: Project Setup
```
Step 1.1: Create directory structure
Step 1.2: Initialize manifest.json for Manifest V3
Step 1.3: Add browser-polyfill for cross-browser support
Step 1.4: Create basic icon set (placeholder)
```

### Phase 2: Core Functionality
```
Step 2.1: Implement service worker with API fetching
Step 2.2: Create storage utilities for caching usage data
Step 2.3: Implement icon badge update logic
Step 2.4: Create dynamic circular progress icon using OffscreenCanvas
```

### Phase 3: Popup Interface
```
Step 3.1: Design popup HTML structure
Step 3.2: Style with CSS (dark mode default, matching Claude aesthetic)
Step 3.3: Implement popup.js to display cached data
Step 3.4: Add refresh button and countdown timers
```

### Phase 4: Content Script (Fallback)
```
Step 4.1: Create content script for claude.ai
Step 4.2: Implement DOM scraping for usage data
Step 4.3: Send data to service worker via messaging
```

### Phase 5: Cross-Browser Testing
```
Step 5.1: Test in Chrome
Step 5.2: Test in Firefox (may need manifest modifications)
Step 5.3: Test in Edge, Brave, Opera
Step 5.4: Create browser-specific build scripts if needed
```

### Phase 6: Polish & Distribution
```
Step 6.1: Create production icons
Step 6.2: Add internationalization (EN/FR)
Step 6.3: Write privacy policy
Step 6.4: Prepare store listings
```

---

## 🎨 UI Design Specifications

### Extension Icon
- **Size**: 16x16, 32x32, 48x48, 128x128 pixels
- **Design**: Circular progress ring
- **Colors**:
  - Background: Transparent
  - Ring track: `#3a3a3a` (dark gray)
  - Progress 0-50%: `#22c55e` (green)
  - Progress 50-75%: `#eab308` (yellow)
  - Progress 75-90%: `#f97316` (orange)
  - Progress 90-100%: `#ef4444` (red)

### Popup Window
- **Size**: 320px width × auto height
- **Theme**: Dark mode (matches Claude.ai)
- **Colors**:
  - Background: `#1a1a1a`
  - Card background: `#2a2a2a`
  - Text primary: `#ffffff`
  - Text secondary: `#888888`
  - Accent: `#6366f1` (indigo, Claude brand)
  - Progress bar track: `#3a3a3a`
  - Progress bar fill: `#6366f1`

### Popup Layout
```
┌────────────────────────────────────────┐
│  Claude Usage Tracker            [⟳]  │
├────────────────────────────────────────┤
│                                        │
│  Current Session                       │
│  ━━━━━━━━━━━━━━━━━░░░░░░░  12%        │
│  Resets in 4h 39min                    │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  Weekly Limits                         │
│                                        │
│  All Models                            │
│  ━━━━━━━━━━━░░░░░░░░░░░░░  20%        │
│  Resets Fri 10:00                      │
│                                        │
│  Sonnet Only                           │
│  ░░░░░░░░░░░░░░░░░░░░░░░░   0%        │
│  Resets Wed 12:00                      │
│                                        │
├────────────────────────────────────────┤
│  Last updated: 1 minute ago            │
└────────────────────────────────────────┘
```

---

## 🔒 Permissions Required

```json
{
  "permissions": [
    "storage",           // Store usage data locally
    "alarms",            // Schedule periodic fetches
    "offscreen"          // Generate dynamic icon (Chrome)
  ],
  "host_permissions": [
    "https://claude.ai/*"  // Access Claude API with cookies
  ]
}
```

---

## 📦 Cross-Browser Considerations

### Chrome (Manifest V3)
- Uses `service_worker` for background script
- Requires `offscreen` API for canvas operations
- Full support for all features

### Firefox (Manifest V3)
- Uses `background.scripts` array (not service_worker)
- OffscreenCanvas works differently
- May need `browser_specific_settings` in manifest

### Edge, Brave, Opera, Perplexity
- Chromium-based, should work with Chrome version
- Minor testing needed for edge cases

### Build Script
Create a build script that generates browser-specific packages:
```bash
npm run build:chrome   # → dist/chrome/
npm run build:firefox  # → dist/firefox/
npm run build:all      # → dist/chrome/ + dist/firefox/
```

---

## 🚀 Claude Code Instructions

### Starting the Project

```
Create a new browser extension called "ClaudeKarma" that displays 
Claude AI usage statistics in the browser toolbar.

Follow the PROJECT_PLAN.md for architecture and implementation details.

Start with Phase 1: Create the project structure and manifest.json.
Then proceed through each phase sequentially.

Key requirements:
1. Use Manifest V3 (WebExtension standard)
2. Include Mozilla's browser-polyfill for cross-browser support
3. Make the circular progress icon dynamic (updates based on usage %)
4. Dark mode UI matching Claude.ai aesthetic
5. Support both API fetching and DOM scraping as fallback

The extension should work when the user is logged into claude.ai - 
it uses their existing session cookies to fetch usage data.
```

### API Discovery Task

```
Before implementing the full extension, we need to discover the correct 
API endpoint for usage data. Create a minimal test:

1. A content script that runs on claude.ai/settings/usage
2. Intercept and log all fetch/XHR requests
3. Look for endpoints returning usage percentage data

Once we identify the endpoint, update the service worker accordingly.
```

---

## 📊 Data Structures

### Usage Data (stored in chrome.storage.local)
```typescript
interface UsageData {
  currentSession: {
    percentage: number;       // 0-100
    resetTimestamp: number;   // Unix timestamp
  };
  weeklyLimits: {
    allModels: {
      percentage: number;
      resetTimestamp: number;
      resetDay: string;       // "Fri", "Mon", etc.
      resetTime: string;      // "10:00"
    };
    sonnetOnly: {
      percentage: number;
      resetTimestamp: number;
      resetDay: string;
      resetTime: string;
    };
  };
  lastFetchedAt: number;      // Unix timestamp
  fetchSource: 'api' | 'scrape';
}
```

### Settings (stored in chrome.storage.sync)
```typescript
interface Settings {
  refreshInterval: number;    // minutes, default 5
  notifications: {
    enabled: boolean;
    thresholds: number[];     // [80, 90, 95]
  };
  theme: 'dark' | 'light' | 'system';
  language: 'en' | 'fr';
}
```

---

## 🧪 Testing Checklist

- [ ] Extension loads without errors in Chrome
- [ ] Extension loads without errors in Firefox
- [ ] Icon displays correctly at all sizes
- [ ] Progress ring updates based on usage percentage
- [ ] Popup displays all usage categories
- [ ] Countdown timers update in real-time
- [ ] Refresh button fetches new data
- [ ] Data persists across browser restarts
- [ ] Works when claude.ai session is active
- [ ] Graceful error handling when not logged in
- [ ] No excessive API calls (respects rate limits)

---

## 📄 Privacy Policy Points

1. **Data Collection**: The extension only accesses your Claude.ai usage data
2. **Data Storage**: All data is stored locally in your browser
3. **No Transmission**: No data is sent to any third-party servers
4. **Authentication**: Uses your existing Claude.ai session (no passwords stored)
5. **Permissions**: Minimal permissions required for functionality

---

## 🏪 Store Listing Information

### Extension Name
**ClaudeKarma**

### Short Description (132 chars)
Monitor your Claude AI usage directly from the toolbar. See session limits, weekly quotas, and reset times at a glance.

### Description
Keep track of your Claude AI usage without leaving your current tab!

Features:
• Real-time session usage in toolbar icon
• Weekly limit tracking for all models
• Countdown to limit reset
• Dark mode interface
• Works in Chrome, Firefox, Edge, and more

Simply install the extension and log into Claude.ai. Your usage stats will appear in the toolbar icon, and clicking it shows detailed information.

Privacy-focused: All data stays in your browser. No external servers.

### Categories
- Productivity
- Developer Tools

### Tags
claude, anthropic, ai, usage, tracker, quota, limits

---

## 📅 Estimated Timeline

| Phase | Description | Time Estimate |
|-------|-------------|---------------|
| 1 | Project Setup | 30 min |
| 2 | Core Functionality | 2-3 hours |
| 3 | Popup Interface | 1-2 hours |
| 4 | Content Script Fallback | 1 hour |
| 5 | Cross-Browser Testing | 1-2 hours |
| 6 | Polish & Distribution | 1-2 hours |

**Total: ~7-10 hours**

---

## 🔗 Resources

- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Firefox WebExtension APIs](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)
- [Mozilla Browser Polyfill](https://github.com/nickclaw/webextension-polyfill)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
