/**
 * ClaudeKarma - Icon Renderer
 *
 * Generates dynamic toolbar icons using OffscreenCanvas.
 * Features dual concentric progress rings:
 * - Outer ring: 5-hour session limit
 * - Inner ring: 7-day weekly limit
 */

import { ICON_SIZES, COLORS } from './constants.js';

// Animation state
let animationInterval = null;
let currentProgress = { session: 0, weekly: 0 };
let animationPhase = 0;
let animationType = null;

// Animation settings
const ANIMATION_FPS = 30;
const ANIMATION_INTERVAL = 1000 / ANIMATION_FPS;
const PULSE_SPEED = 0.05;  // Rotation speed for warning animation
const SPIN_SPEED = 0.15;

/**
 * Get progress ring color based on percentage
 */
export function getProgressColor(percentage) {
  const percent = percentage * 100;

  if (percent < 50) {
    return COLORS.progress.low;
  } else if (percent < 70) {
    return COLORS.progress.medium;
  } else if (percent < 90) {
    return COLORS.progress.high;
  } else {
    return COLORS.progress.critical;
  }
}

/**
 * Parse hex color to RGB components
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * Draw dual concentric progress rings
 *
 * @param {number} size - Canvas size in pixels
 * @param {number} sessionProgress - 5-hour limit progress (0-1)
 * @param {number} weeklyProgress - 7-day limit progress (0-1)
 * @param {object} options - Animation options
 */
export function drawDualProgressRing(size, sessionProgress, weeklyProgress, options) {
  options = options || {};
  const glowIntensity = options.glowIntensity || 0;
  const spinOffset = options.spinOffset || 0;
  const showSpinner = options.showSpinner || false;
  const rotationOffset = options.rotationOffset || 0;

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const centerX = size / 2;
  const centerY = size / 2;

  // Calculate ring dimensions based on size
  // Outer ring for session (5-hour)
  const outerLineWidth = Math.max(2, Math.floor(size / 8));
  const outerRadius = (size / 2) - outerLineWidth / 2 - 1;

  // Inner ring for weekly (7-day) - smaller and thinner
  const innerLineWidth = Math.max(1.5, Math.floor(size / 10));
  const innerRadius = outerRadius - outerLineWidth - Math.max(1, size / 16);

  ctx.clearRect(0, 0, size, size);

  if (showSpinner) {
    // Spinning loading indicator (uses outer ring position)
    const spinnerColor = COLORS.accent || '#6366f1';
    const spinnerLength = Math.PI * 0.6;

    // Outer spinner
    ctx.strokeStyle = COLORS.ringBackground;
    ctx.lineWidth = outerLineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = spinnerColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, spinOffset, spinOffset + spinnerLength);
    ctx.stroke();

    // Inner track (just background)
    ctx.strokeStyle = COLORS.ringBackground;
    ctx.lineWidth = innerLineWidth;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.stroke();

  } else {
    // === OUTER RING (Session / 5-hour) ===

    // Background track
    ctx.strokeStyle = COLORS.ringBackground;
    ctx.lineWidth = outerLineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Progress arc
    if (sessionProgress > 0) {
      const color = getProgressColor(sessionProgress);
      const rgb = hexToRgb(color);

      // Glow layer (pulsing effect)
      if (glowIntensity > 0) {
        const glowRadius = outerLineWidth * (1 + glowIntensity * 0.8);
        const glowAlpha = 0.5 * glowIntensity;

        ctx.strokeStyle = 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + glowAlpha + ')';
        ctx.lineWidth = glowRadius;
        ctx.lineCap = 'round';

        const startAngle = -Math.PI / 2 + rotationOffset;
        const endAngle = startAngle + (Math.min(sessionProgress, 1) * 2 * Math.PI);

        ctx.beginPath();
        ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
        ctx.stroke();
      }

      // Main arc
      ctx.strokeStyle = color;
      ctx.lineWidth = outerLineWidth;
      ctx.lineCap = 'round';

      const startAngle = -Math.PI / 2 + rotationOffset;
      const endAngle = startAngle + (Math.min(sessionProgress, 1) * 2 * Math.PI);

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.stroke();
    }

    // === INNER RING (Weekly / 7-day) ===

    // Background track
    ctx.strokeStyle = COLORS.ringBackground;
    ctx.lineWidth = innerLineWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Progress arc
    if (weeklyProgress > 0) {
      const color = getProgressColor(weeklyProgress);

      ctx.strokeStyle = color;
      ctx.lineWidth = innerLineWidth;
      ctx.lineCap = 'round';

      // Inner ring rotates opposite direction for cool effect
      const startAngle = -Math.PI / 2 - rotationOffset;
      const endAngle = startAngle + (Math.min(weeklyProgress, 1) * 2 * Math.PI);

      ctx.beginPath();
      ctx.arc(centerX, centerY, innerRadius, startAngle, endAngle);
      ctx.stroke();
    }
  }

  return ctx.getImageData(0, 0, size, size);
}

/**
 * Legacy single ring function (for backwards compatibility)
 */
export function drawProgressRing(size, progress, options) {
  return drawDualProgressRing(size, progress, 0, options);
}

/**
 * Generate icon data for all required sizes
 */
export function generateIconData(sessionProgress, weeklyProgress, options) {
  const result = {};

  for (const size of ICON_SIZES) {
    result[size] = drawDualProgressRing(size, sessionProgress, weeklyProgress || 0, options || {});
  }

  return result;
}

/**
 * Update the browser toolbar icon with dual progress rings
 */
export async function updateIcon(sessionProgress, weeklyProgress, options) {
  // Handle legacy single-value calls
  if (typeof weeklyProgress === 'object') {
    options = weeklyProgress;
    weeklyProgress = 0;
  }

  return new Promise((resolve, reject) => {
    try {
      const imageData = generateIconData(sessionProgress, weeklyProgress || 0, options);

      chrome.action.setIcon({ imageData: imageData }, function() {
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
 * Animation frame update
 */
function animationFrame() {
  animationPhase += (animationType === 'spin' ? SPIN_SPEED : PULSE_SPEED);

  if (animationType === 'pulse') {
    // Rotating animation for high usage warning
    updateIcon(currentProgress.session, currentProgress.weekly, { rotationOffset: animationPhase }).catch(function() {});

  } else if (animationType === 'spin') {
    updateIcon(0, 0, { showSpinner: true, spinOffset: animationPhase }).catch(function() {});
  }
}

/**
 * Start icon animation
 */
export function startAnimation(type, sessionProgress, weeklyProgress) {
  stopAnimation();

  animationType = type || 'pulse';
  currentProgress = {
    session: sessionProgress || 0,
    weekly: weeklyProgress || 0
  };
  animationPhase = 0;

  animationInterval = setInterval(animationFrame, ANIMATION_INTERVAL);
  console.log('[ClaudeKarma] Icon animation started:', animationType);
}

/**
 * Stop icon animation and show static icon
 */
export async function stopAnimation(sessionProgress, weeklyProgress) {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }

  animationType = null;

  if (sessionProgress !== undefined) {
    currentProgress.session = sessionProgress;
    currentProgress.weekly = weeklyProgress || 0;
    await updateIcon(sessionProgress, weeklyProgress || 0, { glowIntensity: 0 });
  }

  console.log('[ClaudeKarma] Icon animation stopped');
}

/**
 * Check if animation is running
 */
export function isAnimating() {
  return animationInterval !== null;
}

/**
 * Update progress while keeping animation running
 */
export function setAnimationProgress(sessionProgress, weeklyProgress) {
  currentProgress.session = sessionProgress;
  currentProgress.weekly = weeklyProgress || 0;
}

/**
 * Set badge text on the icon
 */
export async function setBadge(text, color) {
  await chrome.action.setBadgeText({ text: text });
  await chrome.action.setBadgeBackgroundColor({ color: color || COLORS.accent });
}

/**
 * Clear badge text
 */
export async function clearBadge() {
  await chrome.action.setBadgeText({ text: '' });
}
