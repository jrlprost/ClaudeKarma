/**
 * ClaudeKarma - Constants and Configuration
 *
 * Central configuration for colors, thresholds, and timing.
 */

// Storage keys
export const STORAGE_KEYS = {
  USAGE_DATA: 'usageData',
  SETTINGS: 'settings',
  LAST_FETCH: 'lastFetchedAt',
  FETCH_SOURCE: 'fetchSource'
};

// Alarm names
export const ALARMS = {
  FETCH_USAGE: 'fetchUsageData'
};

// Default settings
export const DEFAULT_SETTINGS = {
  refreshInterval: 5, // minutes
  notifications: {
    enabled: true,
    thresholds: [75, 90, 100]
  },
  theme: 'dark',
  language: 'en'
};

// Refresh intervals
export const TIMING = {
  REFRESH_INTERVAL_MINUTES: 5,
  MUTATION_OBSERVER_TIMEOUT_MS: 15000,
  MIN_FETCH_INTERVAL_MS: 30000 // 30 seconds minimum between fetches
};

// Icon sizes to generate (Chrome uses 16, 19, 32, 38, 48 for different displays/contexts)
export const ICON_SIZES = [16, 19, 32, 38, 48];

// UI colors (dark theme)
export const COLORS = {
  // Theme colors
  background: '#0d0d0f',
  card: '#1f1f23',
  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  accent: '#a855f7',      // Neon purple - vibrant and visible on dark backgrounds
  accentLight: '#c084fc', // Lighter neon purple

  // Progress ring background
  ringBackground: '#27272a',

  // Progress colors by threshold (will be implemented by user)
  // Default values - user can customize in getProgressColor()
  progress: {
    low: '#22c55e',      // green: 0-50%
    medium: '#eab308',   // yellow: 50-75%
    high: '#f97316',     // orange: 75-90%
    critical: '#ef4444'  // red: 90-100%
  }
};

// Message types for communication between components
export const MESSAGE_TYPES = {
  USAGE_DATA_SCRAPED: 'usageDataScraped',
  REQUEST_REFRESH: 'requestRefresh',
  GET_USAGE_DATA: 'getUsageData',
  USAGE_DATA_UPDATED: 'usageDataUpdated'
};

// Default usage data structure
export const DEFAULT_USAGE_DATA = {
  currentSession: {
    percentage: 0,
    resetTimestamp: null
  },
  weeklyLimits: {
    allModels: {
      percentage: 0,
      resetTimestamp: null,
      resetDay: null,
      resetTime: null
    },
    sonnetOnly: {
      percentage: 0,
      resetTimestamp: null,
      resetDay: null,
      resetTime: null
    }
  },
  lastFetchedAt: null,
  fetchSource: null
};
