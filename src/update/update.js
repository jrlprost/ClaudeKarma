/**
 * ClaudeKarma - Update Page Script
 * Handles version display and previous versions toggle
 */

// Display current version from manifest
async function displayVersion() {
  try {
    const manifest = chrome.runtime.getManifest();
    const versionElement = document.getElementById('version-number');
    if (versionElement) {
      versionElement.textContent = manifest.version;
    }
  } catch (error) {
    console.error('[ClaudeKarma Update] Error getting version:', error);
  }
}

// Initialize previous versions toggle
function initPreviousToggle() {
  const toggle = document.getElementById('previous-toggle');
  const content = document.getElementById('previous-content');

  if (toggle && content) {
    toggle.addEventListener('click', () => {
      const isOpen = content.classList.contains('open');

      if (isOpen) {
        content.classList.remove('open');
        toggle.classList.remove('open');
      } else {
        content.classList.add('open');
        toggle.classList.add('open');
      }
    });
  }
}

// Initialize close button
function initCloseButton() {
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      window.close();
    });
  }
}

// Mark update page as viewed
async function markUpdateAsViewed() {
  try {
    const manifest = chrome.runtime.getManifest();
    await chrome.storage.local.set({
      lastSeenVersion: manifest.version,
      updatePageViewed: true
    });
  } catch (error) {
    console.error('[ClaudeKarma Update] Error marking as viewed:', error);
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  displayVersion();
  initPreviousToggle();
  initCloseButton();
  markUpdateAsViewed();
});
