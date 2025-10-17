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
   * Send heartbeat every minute
   */
  setInterval(() => {
    if (!document.hidden) {
      const timeSpent = (Date.now() - startTime) / 1000;
      console.log(`StayZen: Active on ${domain} for ${Math.floor(timeSpent)}s`);
    }
  }, 60000);

})();
