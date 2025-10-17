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

// Default inspirational quote
const defaultQuote = "🧘 Take a deep breath. Focus on what truly matters.";

/**
 * Load settings from storage
 */
async function loadSettings() {
  const { settings } = await browser.storage.local.get('settings');
  
  if (settings) {
    pomodoroState.focusTime = (settings.focusTime || 25) * 60;
    pomodoroState.breakTime = (settings.breakTime || 5) * 60;
    warningThreshold = (settings.warningTime || 5) * 60;
    warningsEnabled = settings.enableWarnings !== undefined ? settings.enableWarnings : true;
    customQuote = settings.customQuote || defaultQuote;
    
    // Update remaining time if not running
    if (!pomodoroState.isRunning) {
      pomodoroState.remainingTime = pomodoroState.focusTime;
    }
    
    console.log(`StayZen: Settings loaded - Warning: ${warningThreshold}s, Quote: "${customQuote}"`);
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
      customQuote: defaultQuote
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
    browser.action.setBadgeBackgroundColor({ color: pomodoroState.isBreak ? '#4CAF50' : '#FF6B6B' });
    
    if (pomodoroState.remainingTime <= 0) {
      clearInterval(timerInterval);
      pomodoroState.isRunning = false;
      
      // Show notification
      if (pomodoroState.isBreak) {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: 'Break Over! 🧘',
          message: 'Time to focus again. Let\'s go!'
        });
        pomodoroState.isBreak = false;
        pomodoroState.remainingTime = pomodoroState.focusTime;
      } else {
        browser.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: 'Focus Session Complete! 🎉',
          message: 'Take a 5-minute break. You earned it!'
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
  pomodoroState.isRunning = false;
  clearInterval(timerInterval);
  browser.action.setBadgeText({ text: '' });
  pomodoroState.remainingTime = pomodoroState.focusTime;
  pomodoroState.isBreak = false;
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
 