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
    }
  };
  
  await browser.storage.local.set(defaults);
  console.log('StayZen initialized');
});

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
  const tab = await browser.tabs.get(activeInfo.tabId);
  trackSiteUsage(tab.url);
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    trackSiteUsage(tab.url);
  }
});

function trackSiteUsage(url) {
  if (!url || url.startsWith('about:') || url.startsWith('moz-extension:')) return;
  
  const domain = new URL(url).hostname;
  
  if (!siteTimers[domain]) {
    siteTimers[domain] = { startTime: Date.now(), totalTime: 0 };
  } else {
    const elapsed = (Date.now() - siteTimers[domain].startTime) / 1000;
    siteTimers[domain].totalTime += elapsed;
    siteTimers[domain].startTime = Date.now();
    
    // Warn if more than 5 minutes
    if (siteTimers[domain].totalTime > 300 && siteTimers[domain].totalTime < 310) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-128.png',
        title: 'Time Warning ⏰',
        message: `You've spent over 5 minutes on ${domain}. Stay focused!`
      });
    }
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
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

async function checkIfBlocked(url) {
  const { blockedSites } = await browser.storage.local.get('blockedSites');
  const domain = new URL(url).hostname;
  return { isBlocked: blockedSites.some(site => domain.includes(site)) };
}
