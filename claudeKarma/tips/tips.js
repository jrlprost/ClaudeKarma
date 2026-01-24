/**
 * ClaudeKarma - Tips Page Script
 * Handles accordion interactions and marks page as viewed
 */

// Mark tips page as viewed in storage
async function markTipsAsViewed() {
  try {
    await chrome.storage.local.set({ tipsPageViewed: true });
  } catch (error) {
    console.error('[ClaudeKarma Tips] Error marking tips as viewed:', error);
  }
}

// Initialize accordion functionality
function initAccordion() {
  const accordionItems = document.querySelectorAll('.accordion-item');

  accordionItems.forEach(item => {
    const header = item.querySelector('.accordion-header');

    header.addEventListener('click', () => {
      // Toggle current item
      const isOpen = item.classList.contains('open');

      // Close all other items (single-expand behavior)
      accordionItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('open');
        }
      });

      // Toggle clicked item
      if (isOpen) {
        item.classList.remove('open');
      } else {
        item.classList.add('open');
      }
    });
  });
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  markTipsAsViewed();
  initAccordion();
  initCloseButton();
});
