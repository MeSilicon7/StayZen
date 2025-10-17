/**
 * StayZen Options/Settings Script
 * Handles user preferences for Pomodoro and site tracking
 */

// DOM Elements
const focusTimeInput = document.getElementById('focusTime');
const breakTimeInput = document.getElementById('breakTime');
const warningTimeInput = document.getElementById('warningTime');
const enableWarningsCheckbox = document.getElementById('enableWarnings');
const customQuoteTextarea = document.getElementById('customQuote');
const quoteCharCount = document.getElementById('quoteCharCount');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const saveStatus = document.getElementById('saveStatus');

// Default settings
const DEFAULT_SETTINGS = {
  focusTime: 25,
  breakTime: 5,
  warningTime: 5,
  enableWarnings: true,
  customQuote: "🧘 Take a deep breath. Focus on what truly matters."
};

/**
 * Initialize options page
 */
async function init() {
  await loadSettings();
  setupEventListeners();
}

/**
 * Load settings from storage
 */
async function loadSettings() {
  try {
    const { settings } = await browser.storage.local.get('settings');
    
    if (settings) {
      focusTimeInput.value = settings.focusTime || DEFAULT_SETTINGS.focusTime;
      breakTimeInput.value = settings.breakTime || DEFAULT_SETTINGS.breakTime;
      warningTimeInput.value = settings.warningTime || DEFAULT_SETTINGS.warningTime;
      enableWarningsCheckbox.checked = settings.enableWarnings !== undefined 
        ? settings.enableWarnings 
        : DEFAULT_SETTINGS.enableWarnings;
      customQuoteTextarea.value = settings.customQuote || DEFAULT_SETTINGS.customQuote;
      updateCharCount();
    } else {
      await saveSettings(DEFAULT_SETTINGS);
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Error loading settings', 'error');
  }
}

/**
 * Save settings to storage
 */
async function saveSettings(customSettings = null) {
  try {
    const settings = customSettings || {
      focusTime: parseInt(focusTimeInput.value),
      breakTime: parseInt(breakTimeInput.value),
      warningTime: parseInt(warningTimeInput.value),
      enableWarnings: enableWarningsCheckbox.checked,
      customQuote: customQuoteTextarea.value.trim() || DEFAULT_SETTINGS.customQuote
    };

    // Validate inputs
    if (settings.focusTime < 1 || settings.focusTime > 120) {
      showStatus('Focus time must be between 1-120 minutes', 'error');
      return;
    }
    if (settings.breakTime < 1 || settings.breakTime > 60) {
      showStatus('Break time must be between 1-60 minutes', 'error');
      return;
    }
    if (settings.warningTime < 1 || settings.warningTime > 240) {
      showStatus('Warning time must be between 1-240 minutes', 'error');
      return;
    }
    if (settings.customQuote.length > 200) {
      showStatus('Quote must be 200 characters or less', 'error');
      return;
    }

    await browser.storage.local.set({ settings });
    
    // Notify background script to reload settings
    await browser.runtime.sendMessage({ action: 'reloadSettings' });
    
    showStatus('Settings saved successfully! ✓', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', 'error');
  }
}

/**
 * Reset to default settings
 */
async function resetSettings() {
  if (confirm('Reset all settings to defaults?')) {
    focusTimeInput.value = DEFAULT_SETTINGS.focusTime;
    breakTimeInput.value = DEFAULT_SETTINGS.breakTime;
    warningTimeInput.value = DEFAULT_SETTINGS.warningTime;
    enableWarningsCheckbox.checked = DEFAULT_SETTINGS.enableWarnings;
    customQuoteTextarea.value = DEFAULT_SETTINGS.customQuote;
    updateCharCount();
    
    await saveSettings(DEFAULT_SETTINGS);
    showStatus('Settings reset to defaults! ✓', 'success');
  }
}

/**
 * Update character count
 */
function updateCharCount() {
  const count = customQuoteTextarea.value.length;
  quoteCharCount.textContent = count;
  quoteCharCount.style.color = count > 200 ? '#E4294B' : '#65676B';
}

/**
 * Show status message
 */
function showStatus(message, type) {
  saveStatus.textContent = message;
  saveStatus.className = `save-status show ${type}`;
  
  setTimeout(() => {
    saveStatus.classList.remove('show');
  }, 3000);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  saveBtn.addEventListener('click', () => saveSettings());
  resetBtn.addEventListener('click', resetSettings);
  customQuoteTextarea.addEventListener('input', updateCharCount);
  
  // Save on Enter key (except textarea)
  [focusTimeInput, breakTimeInput, warningTimeInput].forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveSettings();
    });
  });
}

// Initialize on load
init();
