/**
 * StayZen Content Script - Site Usage Tracker
 * Tracks time spent on each website
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
      // Page hidden, stop tracking
      console.log(`StayZen: Paused tracking for ${domain}`);
    } else {
      // Page visible again, resume tracking
      startTime = Date.now();
      console.log(`StayZen: Resumed tracking for ${domain}`);
    }
  });

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
