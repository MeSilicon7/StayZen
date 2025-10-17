/**
 * StayZen Popup Script
 * Handles UI interactions and communicates with background script
 */

// DOM Elements
const timerDisplay = document.getElementById('timerDisplay');
const timerLabel = document.getElementById('timerLabel');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const imageToggle = document.getElementById('imageToggle');
const siteInput = document.getElementById('siteInput');
const addSiteBtn = document.getElementById('addSiteBtn');
const siteList = document.getElementById('siteList');
const focusTimeEl = document.getElementById('focusTime');
const sitesBlockedEl = document.getElementById('sitesBlocked');
const settingsBtn = document.getElementById('settingsBtn');

/**
 * Initialize popup
 */
async function init() {
  await loadSettings();
  await loadPomodoroState();
  await loadStats();
  setupEventListeners();
  startTimerUpdate();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  const { blockedSites, imageBlockingEnabled } = await browser.storage.local.get([
    'blockedSites',
    'imageBlockingEnabled'
  ]);
  
  // Update image toggle
  imageToggle.checked = imageBlockingEnabled || false;
  
  // Update blocked sites list
  renderBlockedSites(blockedSites || []);
}

/**
 * Load Pomodoro state
 */
async function loadPomodoroState() {
  const response = await browser.runtime.sendMessage({ action: 'getPomodoroState' });
  updateTimerUI(response.state);
}

/**
 * Load daily stats
 */
async function loadStats() {
  const { dailyStats } = await browser.storage.local.get('dailyStats');
  
  if (dailyStats) {
    // Check if we need to reset daily stats
    const today = new Date().toDateString();
    if (dailyStats.lastReset !== today) {
      dailyStats.focusTime = 0;
      dailyStats.sitesBlocked = 0;
      dailyStats.lastReset = today;
      await browser.storage.local.set({ dailyStats });
    }
    
    focusTimeEl.textContent = `${Math.floor(dailyStats.focusTime / 60)} min`;
    sitesBlockedEl.textContent = dailyStats.sitesBlocked;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  startBtn.addEventListener('click', startPomodoro);
  stopBtn.addEventListener('click', stopPomodoro);
  imageToggle.addEventListener('change', toggleImageBlocking);
  addSiteBtn.addEventListener('click', addBlockedSite);
  settingsBtn.addEventListener('click', openSettings);
  siteInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addBlockedSite();
  });
}

/**
 * Pomodoro Timer Functions
 */
async function startPomodoro() {
  const response = await browser.runtime.sendMessage({ action: 'startPomodoro' });
  updateTimerUI(response.state);
}

async function stopPomodoro() {
  const response = await browser.runtime.sendMessage({ action: 'stopPomodoro' });
  updateTimerUI(response.state);
}

function updateTimerUI(state) {
  const minutes = Math.floor(state.remainingTime / 60);
  const seconds = state.remainingTime % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  timerLabel.textContent = state.isBreak ? 'Break Time' : 'Focus Time';
  
  startBtn.disabled = state.isRunning;
  stopBtn.disabled = !state.isRunning;
}

/**
 * Update timer display every second
 */
function startTimerUpdate() {
  setInterval(async () => {
    await loadPomodoroState();
  }, 1000);
}

/**
 * Image Blocking Functions
 */
async function toggleImageBlocking() {
  const enabled = imageToggle.checked;
  await browser.storage.local.set({ imageBlockingEnabled: enabled });
  
  // Notify all tabs to update
  const tabs = await browser.tabs.query({});
  tabs.forEach(tab => {
    browser.tabs.sendMessage(tab.id, {
      action: 'toggleImages',
      enabled: enabled
    }).catch(() => {}); // Ignore errors for special pages
  });
}

/**
 * Blocked Sites Management
 */
async function addBlockedSite() {
  const site = siteInput.value.trim();
  if (!site) return;
  
  // Clean up the URL (remove protocol, www, paths)
  const cleanSite = site.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  
  const { blockedSites } = await browser.storage.local.get('blockedSites');
  if (!blockedSites.includes(cleanSite)) {
    blockedSites.push(cleanSite);
    await browser.storage.local.set({ blockedSites });
    renderBlockedSites(blockedSites);
    siteInput.value = '';
    
    // Reload all tabs to apply blocking
    const tabs = await browser.tabs.query({});
    tabs.forEach(tab => {
      if (tab.url && tab.url.includes(cleanSite)) {
        browser.tabs.reload(tab.id);
      }
    });
  }
}

async function removeBlockedSite(site) {
  const { blockedSites } = await browser.storage.local.get('blockedSites');
  const index = blockedSites.indexOf(site);
  if (index > -1) {
    blockedSites.splice(index, 1);
    await browser.storage.local.set({ blockedSites });
    renderBlockedSites(blockedSites);
  }
}

function renderBlockedSites(sites) {
  siteList.innerHTML = '';
  sites.forEach(site => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${site}</span>
      <button class="remove-btn" data-site="${site}">Remove</button>
    `;
    li.querySelector('.remove-btn').addEventListener('click', (e) => {
      removeBlockedSite(e.target.dataset.site);
    });
    siteList.appendChild(li);
  });
}

/**
 * Open settings page
 */
function openSettings() {
  browser.runtime.openOptionsPage();
}

// Initialize on load
init();
