/**
 * StayZen Content Script - Site and Image Blocker
 * Blocks websites and images based on user settings
 */

(async function() {
  'use strict';

  /**
   * Check if current site is blocked
   */
  async function checkIfBlocked() {
    try {
      const url = window.location.href;
      const response = await browser.runtime.sendMessage({
        action: 'checkBlocked',
        url: url
      });
      
      if (response.isBlocked) {
        await showBlockedPage();
        
        // Update stats
        const { dailyStats } = await browser.storage.local.get('dailyStats');
        dailyStats.sitesBlocked++;
        await browser.storage.local.set({ dailyStats });
      }
    } catch (error) {
      console.error('StayZen: Error checking blocked status', error);
    }
  }

  /**
   * Show blocked page overlay
   */
  async function showBlockedPage() {
    // Get custom blocker quote from background script
    let customQuote = "Take a deep breath. This is your time to focus on what truly matters.";
    try {
      const response = await browser.runtime.sendMessage({ action: 'getBlockerQuote' });
      if (response && response.quote) {
        customQuote = response.quote;
      }
    } catch (error) {
      console.error('StayZen: Error fetching blocker quote', error);
    }

    document.documentElement.innerHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            color: white;
          }
          .blocked-container {
            text-align: center;
            padding: 40px;
          }
          h1 {
            font-size: 36px;
            margin-bottom: 10px;
          }
          p {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 30px;
          }
          .message {
            background: rgba(255, 255, 255, 0.2);
            padding: 20px;
            border-radius: 12px;
            max-width: 500px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="blocked-container">          <h1>Focus Mode Active</h1>
          <p>This site is blocked to help you stay focused.</p>
          <div class="message">
            <p>${customQuote}</p>
            <p style="font-size: 14px; opacity: 0.8;">
              You can manage blocked sites from the StayZen extension popup.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Image blocking functionality
   */
  let imagesBlocked = false;

  async function checkImageBlocking() {
    const { imageBlockingEnabled } = await browser.storage.local.get('imageBlockingEnabled');
    if (imageBlockingEnabled) {
      blockImages();
    }
  }

  function blockImages() {
    if (imagesBlocked) return;
    imagesBlocked = true;

    // Add CSS to hide images
    const style = document.createElement('style');
    style.id = 'stayzen-image-blocker';
    style.textContent = `
      img {
        visibility: hidden !important;
      }
      *[style*="background-image"] {
        background-image: none !important;
      }
      video {
        visibility: hidden !important;
      }
    `;
    document.head.appendChild(style);
  }

  function unblockImages() {
    imagesBlocked = false;
    const style = document.getElementById('stayzen-image-blocker');
    if (style) {
      style.remove();
    }
  }

  /**
   * Listen for messages from popup
   */
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'toggleImages') {
      if (message.enabled) {
        blockImages();
      } else {
        unblockImages();
      }
    }
  });

  // Initialize
  await checkIfBlocked();
  await checkImageBlocking();

})();
