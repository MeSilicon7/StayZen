/**
 * StayZen Content Script - Site Usage Tracker
 * Tracks time spent on each website and shows custom modal
 */

(function() {
  'use strict';

  let startTime = Date.now();
  let domain = window.location.hostname;

  /**
   * Track time when page becomes visible/hidden
   */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log(`StayZen: Paused tracking for ${domain}`);
    } else {
      startTime = Date.now();
      console.log(`StayZen: Resumed tracking for ${domain}`);
    }
  });

  /**
   * Listen for time warning messages from background script
   */
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'showTimeWarning') {
      showTimeWarningModal(message);
    } else if (message.action === 'showPomodoroModal') {
      showPomodoroModal(message);
    }
  });

  /**
   * Show time warning modal with inspirational quote
   */
  function showTimeWarningModal(data) {
    const { domain, totalMinutes, quote } = data;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('stayzen-modal');
    if (existingModal) existingModal.remove();
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'stayzen-modal';
    modalOverlay.innerHTML = `
      <style>
        #stayzen-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          animation: stayzen-fadeIn 0.2s ease-out;
        }
        
        @keyframes stayzen-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes stayzen-slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .stayzen-modal-content {
          background: #ffffff;
          border-radius: 12px;
          max-width: 440px;
          width: 90%;
          padding: 32px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3);
          text-align: center;
          animation: stayzen-slideUp 0.3s ease-out;
        }
        
        .stayzen-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #1877F2 0%, #0C63D4 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 32px;
        }
        
        .stayzen-title {
          font-size: 24px;
          font-weight: 600;
          color: #1C1E21;
          margin: 0 0 12px;
        }
        
        .stayzen-domain {
          font-size: 14px;
          color: #65676B;
          margin: 0 0 8px;
        }
        
        .stayzen-time {
          font-size: 28px;
          font-weight: 700;
          color: #1877F2;
          margin: 0 0 24px;
        }
        
        .stayzen-quote {
          background: #F0F2F5;
          border-left: 4px solid #1877F2;
          padding: 16px 20px;
          border-radius: 8px;
          font-size: 15px;
          line-height: 1.6;
          color: #1C1E21;
          margin: 0 0 28px;
          text-align: left;
        }
        
        .stayzen-button {
          background: #1877F2;
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }
        
        .stayzen-button:hover {
          background: #166FE5;
          transform: scale(1.02);
        }
        
        .stayzen-button:active {
          transform: scale(0.98);
        }
      </style>
      
      <div class="stayzen-modal-content">
        <div class="stayzen-icon">⏰</div>
        <h2 class="stayzen-title">Time to Refocus</h2>
        <p class="stayzen-domain">You've been on <strong>${domain}</strong></p>
        <div class="stayzen-time">${totalMinutes} min</div>
        <div class="stayzen-quote">${quote}</div>
        <button class="stayzen-button" id="stayzen-dismiss">Got it, let's focus!</button>
      </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Add event listeners
    const dismissBtn = document.getElementById('stayzen-dismiss');
    const closeModal = () => modalOverlay.remove();
    
    dismissBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    
    // Auto-close after 10 seconds
    setTimeout(closeModal, 10000);
    
    console.log(`StayZen: Modal shown for ${domain}`);
  }

  /**
   * Show Pomodoro completion modal (SweetAlert2 style)
   */
  function showPomodoroModal(data) {
    const { type, title, message, duration } = data;
    
    // Remove existing modal if any
    const existingModal = document.getElementById('stayzen-pomodoro-modal');
    if (existingModal) existingModal.remove();
    
    // Determine colors based on type
    const isBreak = type === 'break';
    const iconColor = isBreak ? '#42B883' : '#1877F2';
    const icon = isBreak ? '🎉' : '🧘';
    const buttonColor = isBreak ? '#42B883' : '#1877F2';
    const buttonHoverColor = isBreak ? '#36A372' : '#166FE5';
    
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'stayzen-pomodoro-modal';
    modalOverlay.innerHTML = `
      <style>
        #stayzen-pomodoro-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          animation: stayzen-pomodoro-fadeIn 0.3s ease-out;
        }
        
        @keyframes stayzen-pomodoro-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes stayzen-pomodoro-popIn {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes stayzen-pomodoro-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .stayzen-pomodoro-content {
          background: #ffffff;
          border-radius: 16px;
          max-width: 480px;
          width: 90%;
          padding: 40px 32px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
          text-align: center;
          animation: stayzen-pomodoro-popIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        
        .stayzen-pomodoro-icon-wrapper {
          width: 80px;
          height: 80px;
          background: ${iconColor};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
          animation: stayzen-pomodoro-pulse 1.5s ease-in-out infinite;
        }
        
        .stayzen-pomodoro-icon {
          font-size: 40px;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
        }
        
        .stayzen-pomodoro-title {
          font-size: 28px;
          font-weight: 700;
          color: #1C1E21;
          margin: 0 0 16px;
          line-height: 1.2;
        }
        
        .stayzen-pomodoro-duration {
          font-size: 16px;
          color: #65676B;
          margin: 0 0 20px;
          font-weight: 500;
        }
        
        .stayzen-pomodoro-message {
          background: linear-gradient(135deg, #F0F2F5 0%, #E4E6EB 100%);
          border-left: 4px solid ${iconColor};
          padding: 20px 24px;
          border-radius: 12px;
          font-size: 16px;
          line-height: 1.7;
          color: #1C1E21;
          margin: 0 0 32px;
          text-align: left;
          font-weight: 500;
        }
        
        .stayzen-pomodoro-buttons {
          display: flex;
          gap: 12px;
        }
        
        .stayzen-pomodoro-button {
          background: ${buttonColor};
          color: white;
          border: none;
          padding: 14px 32px;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          flex: 1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .stayzen-pomodoro-button:hover {
          background: ${buttonHoverColor};
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }
        
        .stayzen-pomodoro-button:active {
          transform: translateY(0);
        }
        
        .stayzen-pomodoro-secondary {
          background: #E4E6EB;
          color: #1C1E21;
          box-shadow: none;
        }
        
        .stayzen-pomodoro-secondary:hover {
          background: #D8DADF;
        }
      </style>
      
      <div class="stayzen-pomodoro-content">
        <div class="stayzen-pomodoro-icon-wrapper">
          <div class="stayzen-pomodoro-icon">${icon}</div>
        </div>
        <h2 class="stayzen-pomodoro-title">${title}</h2>
        <p class="stayzen-pomodoro-duration">Session completed: ${duration} minutes</p>
        <div class="stayzen-pomodoro-message">${message}</div>
        <div class="stayzen-pomodoro-buttons">
          <button class="stayzen-pomodoro-button stayzen-pomodoro-secondary" id="stayzen-pomodoro-dismiss">
            Close
          </button>
          <button class="stayzen-pomodoro-button" id="stayzen-pomodoro-continue">
            ${isBreak ? "Let's Focus!" : "Take a Break"}
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modalOverlay);
    
    // Add event listeners
    const dismissBtn = document.getElementById('stayzen-pomodoro-dismiss');
    const continueBtn = document.getElementById('stayzen-pomodoro-continue');
    const closeModal = () => modalOverlay.remove();
    
    dismissBtn.addEventListener('click', closeModal);
    continueBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
    
    // Auto-close after 15 seconds
    setTimeout(closeModal, 15000);
    
    console.log(`StayZen: Pomodoro modal shown (${type})`);
  }

  /**
   * Send heartbeat every minute
   */
  setInterval(() => {
    if (!document.hidden) {
      const timeSpent = (Date.now() - startTime) / 1000;
      console.log(`StayZen: Active on ${domain} for ${Math.floor(timeSpent)}s`);
    }
  }, 60000);

})();
