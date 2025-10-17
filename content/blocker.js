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
        <div class="blocked-container">
          <h1>Focus Mode Active</h1>
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
   * Uses proper blocking that prevents image loading, not just hiding
   */
  let imagesBlocked = false;
  let blockingStyle = null;

  async function checkImageBlocking() {
    const { imageBlockingEnabled } = await browser.storage.local.get('imageBlockingEnabled');
    if (imageBlockingEnabled) {
      blockImages();
    }
  }

  function blockImages() {
    if (imagesBlocked) return;
    imagesBlocked = true;

    // Method 1: Inject CSS at document_start to prevent rendering
    if (!blockingStyle) {
      blockingStyle = document.createElement('style');
      blockingStyle.id = 'stayzen-image-blocker';
      blockingStyle.textContent = `
        /* Block image elements from displaying */
        img {
          display: none !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* Block background images */
        *:not(body):not(html) {
          background-image: none !important;
        }
        
        /* Block picture elements */
        picture {
          display: none !important;
        }
        
        /* Block image inputs */
        input[type="image"] {
          display: none !important;
        }
        
        /* Block SVG images */
        svg image {
          display: none !important;
        }
        
        /* Don't block video elements - only images */
        video {
          display: block !important;
        }
      `;
      
      // Insert before any other styles
      if (document.head) {
        document.head.insertBefore(blockingStyle, document.head.firstChild);
      } else {
        // If head doesn't exist yet, wait for it
        const observer = new MutationObserver(() => {
          if (document.head) {
            document.head.insertBefore(blockingStyle, document.head.firstChild);
            observer.disconnect();
          }
        });
        observer.observe(document.documentElement, { childList: true });
      }
    }

    // Method 2: Set src to empty for existing images
    blockExistingImages();
    
    // Method 3: Observe for new images and block them
    startImageObserver();
    
    console.log('StayZen: Images blocked (loading prevented)');
  }

  function blockExistingImages() {
    // Block all existing img elements
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.hasAttribute('data-stayzen-blocked')) {
        img.setAttribute('data-stayzen-blocked', 'true');
        // Prevent loading by removing src
        img.removeAttribute('src');
        img.removeAttribute('srcset');
      }
    });
    
    // Block picture sources
    const pictures = document.querySelectorAll('picture source');
    pictures.forEach(source => {
      if (!source.hasAttribute('data-stayzen-blocked')) {
        source.setAttribute('data-stayzen-blocked', 'true');
        source.removeAttribute('srcset');
      }
    });
  }

  let imageObserver = null;

  function startImageObserver() {
    if (imageObserver) return;
    
    imageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) { // Element node
            // Check if it's an image
            if (node.tagName === 'IMG' && !node.hasAttribute('data-stayzen-blocked')) {
              node.setAttribute('data-stayzen-blocked', 'true');
              node.removeAttribute('src');
              node.removeAttribute('srcset');
            }
            
            // Check for images in added subtree
            const imgs = node.querySelectorAll?.('img');
            imgs?.forEach(img => {
              if (!img.hasAttribute('data-stayzen-blocked')) {
                img.setAttribute('data-stayzen-blocked', 'true');
                img.removeAttribute('src');
                img.removeAttribute('srcset');
              }
            });
            
            // Check for picture sources
            const sources = node.querySelectorAll?.('picture source');
            sources?.forEach(source => {
              if (!source.hasAttribute('data-stayzen-blocked')) {
                source.setAttribute('data-stayzen-blocked', 'true');
                source.removeAttribute('srcset');
              }
            });
          }
        }
      }
    });
    
    imageObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function stopImageObserver() {
    if (imageObserver) {
      imageObserver.disconnect();
      imageObserver = null;
    }
  }

  function unblockImages() {
    if (!imagesBlocked) return;
    imagesBlocked = false;
    
    // Remove blocking style
    if (blockingStyle && blockingStyle.parentNode) {
      blockingStyle.parentNode.removeChild(blockingStyle);
      blockingStyle = null;
    }
    
    // Stop observing
    stopImageObserver();
    
    // Remove blocked attributes (images will load naturally on page reload)
    const blockedElements = document.querySelectorAll('[data-stayzen-blocked]');
    blockedElements.forEach(el => el.removeAttribute('data-stayzen-blocked'));
    
    console.log('StayZen: Images unblocked');
  }

  /**
   * Listen for messages from popup and background
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
