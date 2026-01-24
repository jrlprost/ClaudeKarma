/**
 * ClaudeKarma - Icon Renderer
 *
 * Generates dynamic toolbar icons using OffscreenCanvas.
 * Creates circular progress rings that update based on usage percentage.
 */

import { ICON_SIZES, COLORS } from './constants.js';

/**
 * Get progress ring color based on percentage
 *
 * TODO: This is a user contribution opportunity!
 * Customize the color thresholds to match your preferences.
 *
 * @param {number} percentage - Usage percentage (0-1)
 * @returns {string} Hex color code
 */
export function getProgressColor(percentage) {
  // Convert to 0-100 scale for easier reading
  const percent = percentage * 100;

  // Default thresholds from CLAUDE.md spec:
  // 0-50%: green, 50-75%: yellow, 75-90%: orange, 90-100%: red
  if (percent < 50) {
    return COLORS.progress.low;      // #22c55e (green)
  } else if (percent < 75) {
    return COLORS.progress.medium;   // #eab308 (yellow)
  } else if (percent < 90) {
    return COLORS.progress.high;     // #f97316 (orange)
  } else {
    return COLORS.progress.critical; // #ef4444 (red)
  }
}

/**
 * Draw a circular progress ring on OffscreenCanvas
 *
 * @param {number} size - Canvas size in pixels
 * @param {number} progress - Progress value (0-1)
 * @returns {ImageData} Pixel data for chrome.action.setIcon()
 */
export function drawProgressRing(size, progress) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Canvas dimensions
  const centerX = size / 2;
  const centerY = size / 2;
  const lineWidth = Math.max(2, Math.floor(size / 8));
  const radius = (size / 2) - lineWidth;

  // Clear canvas with transparent background
  ctx.clearRect(0, 0, size, size);

  // Draw background ring (gray track)
  ctx.strokeStyle = COLORS.ringBackground;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
  ctx.stroke();

  // Draw progress arc (colored)
  if (progress > 0) {
    const color = getProgressColor(progress);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    // Start at top (12 o'clock position)
    const startAngle = -Math.PI / 2;
    // Progress determines how far to draw
    const endAngle = startAngle + (Math.min(progress, 1) * 2 * Math.PI);

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.stroke();
  }

  // Return ImageData for setIcon
  return ctx.getImageData(0, 0, size, size);
}

/**
 * Generate icon data for all required sizes
 *
 * @param {number} progress - Progress value (0-1)
 * @returns {Object} Dictionary of size -> ImageData
 */
export function generateIconData(progress) {
  const result = {};

  for (const size of ICON_SIZES) {
    result[size] = drawProgressRing(size, progress);
  }

  return result;
}

/**
 * Update the browser toolbar icon
 *
 * @param {number} progress - Progress value (0-1)
 * @returns {Promise<void>}
 */
export async function updateIcon(progress) {
  return new Promise((resolve, reject) => {
    try {
      const imageData = generateIconData(progress);

      chrome.action.setIcon({ imageData }, () => {
        if (chrome.runtime.lastError) {
          console.error('[ClaudeKarma] Icon update failed:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    } catch (error) {
      console.error('[ClaudeKarma] Icon generation failed:', error);
      reject(error);
    }
  });
}

/**
 * Set badge text on the icon (fallback for browsers without OffscreenCanvas)
 *
 * @param {string} text - Badge text (e.g., "45%")
 * @param {string} color - Badge background color
 */
export async function setBadge(text, color = COLORS.accent) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

/**
 * Clear badge text
 */
export async function clearBadge() {
  await chrome.action.setBadgeText({ text: '' });
}
