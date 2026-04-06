/**
 * Offline Status Monitor
 * Detects internet connectivity and provides UI feedback
 */

let listeners = [];
let isOnline = navigator.onLine;

// Check if we're truly offline (no external pings needed)
// The app works offline by design, this is just for user awareness
function updateStatus() {
  const wasOnline = isOnline;
  isOnline = navigator.onLine;
  
  if (wasOnline !== isOnline) {
    listeners.forEach(listener => listener(isOnline));
  }
}

// Listen to browser online/offline events
window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);

// Initial check
updateStatus();

/**
 * Subscribe to offline status changes
 * @param {Function} callback - Called with boolean (true = online, false = offline)
 * @returns {Function} Unsubscribe function
 */
export function subscribeToOfflineStatus(callback) {
  listeners.push(callback);
  callback(isOnline); // Call immediately with current status
  
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

/**
 * Get current offline status
 * @returns {boolean} True if online, false if offline
 */
export function isOnline() {
  return navigator.onLine;
}