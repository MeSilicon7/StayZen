/**
 * StayZen Background Script
 * Manages: Pomodoro timer, notifications, site tracking, and message handling
 */

// State management
let pomodoroState = {
  isRunning: false,
  isBreak: false,
  remainingTime: 25 * 60, // 25 minutes in seconds
  focusTime: 25 * 60,
  breakTime: 5 * 60
};

let timerInterval = null;
let siteTimers = {}; // Track time spent on each site
let warningThreshold = 5 * 60; // 5 minutes in seconds
let warningsEnabled = true;
let currentActiveTab = null; // Track currently active tab
let siteTrackingInterval = null; // Interval for continuous tracking
let customQuote = ""; // User's custom quote
let pomodoroBreakQuote = ""; // Custom quote for break time
let pomodoroFocusQuote = ""; // Custom quote for focus time
let blockerQuote = ""; // Custom quote for blocked sites
let autoBlockImages = false; // Auto-block images setting
let autoBlockTimer = null; // Timer for auto-blocking images
let imageBlockingEnabled = false; // Track image blocking state

// Default inspirational quotes
const defaultQuote = "Take a deep breath. Focus on what truly matters.";
const defaultBreakQuote = "🌸 Take a moment to breathe. You've earned this rest.";
const defaultFocusQuote = "🚀 Ready to conquer your goals? Let's focus and make it happen!";
const defaultBlockerQuote = "Take a deep breath. This is your time to focus on what truly matters.";

/**
 * Load settings from storage
 */
async function loadSettings() {
  const { settings, imageBlockingEnabled: imgBlockEnabled } = await browser.storage.local.get(['settings', 'imageBlockingEnabled']);
  
  if (settings) {
    pomodoroState.focusTime = (settings.focusTime || 25) * 60;
    pomodoroState.breakTime = (settings.breakTime || 5) * 60;
    warningThreshold = (settings.warningTime || 5) * 60;
    warningsEnabled = settings.enableWarnings !== undefined ? settings.enableWarnings : true;
    autoBlockImages = settings.autoBlockImages !== undefined ? settings.autoBlockImages : false;
    customQuote = settings.customQuote || defaultQuote;
    pomodoroBreakQuote = settings.pomodoroBreakQuote || defaultBreakQuote;
    pomodoroFocusQuote = settings.pomodoroFocusQuote || defaultFocusQuote;
    blockerQuote = settings.blockerQuote || defaultBlockerQuote;
    
    // Update remaining time if not running
    if (!pomodoroState.isRunning) {
      pomodoroState.remainingTime = pomodoroState.focusTime;
    }
    
    imageBlockingEnabled = imgBlockEnabled || false;
    updateImageBlocking();
    
    console.log(`StayZen: Settings loaded - Auto-block images: ${autoBlockImages}, Image blocking: ${imageBlockingEnabled}`);
  }
}

/**
 * WebRequest listener for blocking images
 */
function onBeforeRequestListener(details) {
  // Only block image requests when image blocking is enabled
  if (imageBlockingEnabled && details.type === 'image') {
    console.log(`StayZen: Blocked image request: ${details.url}`);
    return { cancel: true };
  }
  return { cancel: false };
}

/**
 * Update image blocking via webRequest API
 */
function updateImageBlocking() {
  // Remove existing listener
  if (browser.webRequest.onBeforeRequest.hasListener(onBeforeRequestListener)) {
    browser.webRequest.onBeforeRequest.removeListener(onBeforeRequestListener);
  }
  
  // Add listener if blocking is enabled
  if (imageBlockingEnabled) {
    browser.webRequest.onBeforeRequest.addListener(
      onBeforeRequestListener,
      { urls: ["<all_urls>"], types: ["image"] },
      ["blocking"]
    );
    console.log('StayZen: Image blocking enabled at network level');
  } else {
    console.log('StayZen: Image blocking disabled at network level');
  }
}

/**
 * Initialize extension on install
 */
browser.runtime.onInstalled.addListener(async () => {
  const defaults = {
    blockedSites: [],
    imageBlockingEnabled: false,
    dailyStats: {
      focusTime: 0,
      sitesBlocked: 0,
      lastReset: new Date().toDateString()
    },
    settings: {
      focusTime: 25,
      breakTime: 5,
      warningTime: 5,
      enableWarnings: true,
      autoBlockImages: false,
      customQuote: defaultQuote,
      pomodoroBreakQuote: defaultBreakQuote,
      pomodoroFocusQuote: defaultFocusQuote,
      blockerQuote: defaultBlockerQuote
    }
  };
  
  await browser.storage.local.set(defaults);
  await loadSettings();
  console.log('StayZen initialized');
});

/**
 * Initialize tracking on startup
 */
async function initializeTracking() {
  await loadSettings();
  
  // Get the currently active tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs.length > 0 && tabs[0].url) {
    currentActiveTab = { id: tabs[0].id, url: tabs[0].url };
    startSiteTracking(tabs[0].url);
    console.log('StayZen: Initial tracking started');
  }
}

// Initialize on startup
initializeTracking();

/**
 * Pomodoro Timer Logic
 */
function startPomodoro() {
  pomodoroState.isRunning = true;
  
  timerInterval = setInterval(async () => {
    pomodoroState.remainingTime--;
    
    // Update badge with remaining minutes
    const minutes = Math.ceil(pomodoroState.remainingTime / 60);
    browser.action.setBadgeText({ text: `${minutes}` });
    browser.action.setBadgeBackgroundColor({ color: pomodoroState.isBreak ? '#42B883' : '#1877F2' });
    
    if (pomodoroState.remainingTime <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      pomodoroState.isRunning = false;
      
      if (pomodoroState.isBreak) {
        // Break is over, time to focus
        await showPomodoroModal({
          type: 'focus',
          title: 'Break Over! 🧘',
          message: pomodoroFocusQuote || defaultFocusQuote,
          duration: pomodoroState.breakTime / 60
        });
        
        pomodoroState.isBreak = false;
        pomodoroState.remainingTime = pomodoroState.focusTime;
      } else {
        // Focus session complete, time for break
        await showPomodoroModal({
          type: 'break',
          title: 'Focus Session Complete! 🎉',
          message: pomodoroBreakQuote || defaultBreakQuote,
          duration: pomodoroState.focusTime / 60
        });
        
        pomodoroState.isBreak = true;
        pomodoroState.remainingTime = pomodoroState.breakTime;
        
        // Update daily stats
        const { dailyStats } = await browser.storage.local.get('dailyStats');
        dailyStats.focusTime += pomodoroState.focusTime;
        await browser.storage.local.set({ dailyStats });
      }
      
      browser.action.setBadgeText({ text: '' });
    }
  }, 1000);
}

function stopPomodoro() {
  // Clear the interval first
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  
  // Reset state
  pomodoroState.isRunning = false;
  pomodoroState.isBreak = false;
  pomodoroState.remainingTime = pomodoroState.focusTime;
  
  // Clear badge
  browser.action.setBadgeText({ text: '' });
  
  console.log('StayZen: Pomodoro stopped and reset');
}

/**
 * Show Pomodoro completion modal
 */
async function showPomodoroModal(data) {
  const { type, title, message, duration } = data;
  
  // Send to active tab to show modal
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0 && tabs[0].id) {
      await browser.tabs.sendMessage(tabs[0].id, {
        action: 'showPomodoroModal',
        type: type,
        title: title,
        message: message,
        duration: Math.floor(duration)
      });
      console.log(`StayZen: Pomodoro modal shown (${type})`);
    }
  } catch (error) {
    console.error('StayZen: Error showing Pomodoro modal', error);
    // Fallback to browser notification
    browser.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: title,
      message: message
    });
  }
}

/**
 * Site Usage Tracking
 */
browser.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await browser.tabs.get(activeInfo.tabId);
    currentActiveTab = { id: tab.id, url: tab.url };
    startSiteTracking(tab.url);
  } catch (error) {
    console.error('StayZen: Error in onActivated', error);
  }
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    currentActiveTab = { id: tab.id, url: tab.url };
    startSiteTracking(tab.url);
  }
});

// Track when window focus changes
browser.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === browser.windows.WINDOW_ID_NONE) {
    // Browser lost focus, stop tracking
    stopSiteTracking();
  } else {
    // Browser gained focus, resume tracking
    try {
      const tabs = await browser.tabs.query({ active: true, windowId: windowId });
      if (tabs.length > 0 && tabs[0].url) {
        currentActiveTab = { id: tabs[0].id, url: tabs[0].url };
        startSiteTracking(tabs[0].url);
      }
    } catch (error) {
      console.error('StayZen: Error in onFocusChanged', error);
    }
  }
});

/**
 * Start continuous site tracking
 */
function startSiteTracking(url) {
  // Stop any existing tracking
  stopSiteTracking();
  
  if (!url || url.startsWith('about:') || url.startsWith('moz-extension:')) {
    console.log('StayZen: Skipping special URL');
    return;
  }
  
  try {
    const domain = new URL(url).hostname;
    
    // Initialize or reset site timer
    if (!siteTimers[domain]) {
      siteTimers[domain] = { 
        startTime: Date.now(), 
        totalTime: 0, 
        lastWarningTime: 0, // Track when last warning was shown
        lastCheck: Date.now()
      };
      console.log(`StayZen: Initialized tracking for ${domain}`);
    } else {
      // Reset start time for resumed tracking
      siteTimers[domain].startTime = Date.now();
      siteTimers[domain].lastCheck = Date.now();
      console.log(`StayZen: Resumed tracking for ${domain} (total: ${Math.floor(siteTimers[domain].totalTime)}s)`);
    }
    
    // Start continuous tracking (check every second)
    siteTrackingInterval = setInterval(() => {
      trackSiteUsage(url);
    }, 1000);
    
    console.log(`StayZen: Active tracking started for ${domain} (threshold: ${warningThreshold}s)`);
  } catch (error) {
    console.error('StayZen: Error starting site tracking', error);
  }
}

/**
 * Stop continuous site tracking
 */
function stopSiteTracking() {
  if (siteTrackingInterval) {
    clearInterval(siteTrackingInterval);
    siteTrackingInterval = null;
    
    // Save the accumulated time before stopping
    if (currentActiveTab && currentActiveTab.url) {
      try {
        const url = currentActiveTab.url;
        if (!url.startsWith('about:') && !url.startsWith('moz-extension:')) {
          const domain = new URL(url).hostname;
          if (siteTimers[domain]) {
            const elapsed = (Date.now() - siteTimers[domain].lastCheck) / 1000;
            siteTimers[domain].totalTime += elapsed;
            console.log(`StayZen: Stopped tracking ${domain} (total: ${Math.floor(siteTimers[domain].totalTime)}s)`);
          }
        }
      } catch (error) {
        // Ignore invalid URLs
      }
    }
  }
}

function trackSiteUsage(url) {
  if (!url || url.startsWith('about:') || url.startsWith('moz-extension:')) return;
  
  try {
    const domain = new URL(url).hostname;
    const now = Date.now();
    
    if (!siteTimers[domain]) {
      siteTimers[domain] = { 
        startTime: now, 
        totalTime: 0, 
        lastWarningTime: 0,
        lastCheck: now
      };
      return;
    }
    
    // Calculate elapsed time since last check
    const elapsed = (now - siteTimers[domain].lastCheck) / 1000;
    siteTimers[domain].totalTime += elapsed;
    siteTimers[domain].lastCheck = now;
    
    // Check if we should show a warning
    const timeSinceLastWarning = siteTimers[domain].totalTime - siteTimers[domain].lastWarningTime;
    
    if (warningsEnabled && timeSinceLastWarning >= warningThreshold) {
      siteTimers[domain].lastWarningTime = siteTimers[domain].totalTime;
      
      const totalMinutes = Math.floor(siteTimers[domain].totalTime / 60);
      
      // Use custom quote from settings
      const quote = customQuote || defaultQuote;
      
      // Send message to content script to show modal
      if (currentActiveTab && currentActiveTab.id) {
        browser.tabs.sendMessage(currentActiveTab.id, {
          action: 'showTimeWarning',
          domain: domain,
          totalMinutes: totalMinutes,
          quote: quote
        }).catch((error) => {
          console.error('StayZen: Error sending warning to content script', error);
        });
      }
      
      console.log(`StayZen: ⚠️ WARNING SHOWN for ${domain} (${Math.floor(siteTimers[domain].totalTime)}s)`);
    }
  } catch (error) {
    console.error('StayZen: Error tracking site usage', error);
  }
}

/**
 * Start auto-block timer (1 minute)
 */
function startAutoBlockTimer() {
  // Clear any existing timer
  if (autoBlockTimer) {
    clearTimeout(autoBlockTimer);
  }
  
  if (!autoBlockImages) {
    return; // Auto-block is disabled
  }
  
  console.log('StayZen: Auto-block timer started (1 minute)');
  
  autoBlockTimer = setTimeout(async () => {
    // Re-enable image blocking
    imageBlockingEnabled = true;
    await browser.storage.local.set({ imageBlockingEnabled: true });
    updateImageBlocking();
    
    // Notify all tabs to block images
    const tabs = await browser.tabs.query({});
    tabs.forEach(tab => {
      browser.tabs.sendMessage(tab.id, {
        action: 'toggleImages',
        enabled: true
      }).catch(() => {});
    });
    
    console.log('StayZen: Auto-blocked images after 1 minute');
    autoBlockTimer = null;
  }, 60000); // 1 minute = 60000ms
}

/**
 * Cancel auto-block timer
 */
function cancelAutoBlockTimer() {
  if (autoBlockTimer) {
    clearTimeout(autoBlockTimer);
    autoBlockTimer = null;
    console.log('StayZen: Auto-block timer cancelled');
  }
}

/**
 * Message Handling from popup and content scripts
 */
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startPomodoro':
      startPomodoro();
      sendResponse({ success: true, state: pomodoroState });
      break;
      
    case 'stopPomodoro':
      stopPomodoro();
      sendResponse({ success: true, state: pomodoroState });
      break;
      
    case 'getPomodoroState':
      sendResponse({ state: pomodoroState });
      break;
      
    case 'getSiteTimers':
      sendResponse({ timers: siteTimers });
      break;
      
    case 'checkBlocked':
      checkIfBlocked(message.url).then(result => sendResponse(result));
      return true; // Keep channel open for async response
    
    case 'getBlockerQuote':
      sendResponse({ quote: blockerQuote || defaultBlockerQuote });
      break;
      
    case 'imageBlockingChanged':
      imageBlockingEnabled = message.enabled;
      updateImageBlocking();
      
      if (message.enabled) {
        // Images are being blocked, cancel timer
        cancelAutoBlockTimer();
      } else {
        // Images are being unblocked, start 1-minute timer
        startAutoBlockTimer();
      }
      sendResponse({ success: true });
      break;
    
    case 'reloadSettings':
      loadSettings().then(() => {
        // Reset last warning time when settings change (but keep totalTime)
        Object.keys(siteTimers).forEach(domain => {
          siteTimers[domain].lastWarningTime = 0;
          console.log(`StayZen: Reset warning timer for ${domain}`);
        });
        
        // Restart tracking with new settings
        if (currentActiveTab && currentActiveTab.url) {
          stopSiteTracking();
          startSiteTracking(currentActiveTab.url);
        }
        
        sendResponse({ success: true });
      });
      return true;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

async function checkIfBlocked(url) {
  const { blockedSites } = await browser.storage.local.get('blockedSites');
  const domain = new URL(url).hostname;
  return { isBlocked: blockedSites.some(site => domain.includes(site)) };
}
