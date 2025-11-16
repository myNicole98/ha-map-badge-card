/**
 * Handles communication with the map iframe via postMessage
 */
export class IframeMessenger {
  constructor(debugMode = false) {
    this._iframe = null;
    this._iframeReady = false;
    this._debug = debugMode;
    this._retryCount = 0;
    this._messageListener = null;
    this._readyCallback = null;
    this._dataRequestCallback = null;
  }

  /**
   * Logs debug messages
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  _log(message, ...args) {
    if (this._debug) {
      console.log(`[IframeMessenger ${new Date().toISOString()}] ${message}`, ...args);
    }
  }

  /**
   * Sets the iframe element
   * @param {HTMLIFrameElement} iframe - Iframe element
   */
  setIframe(iframe) {
    this._iframe = iframe;
    this._iframeReady = false;
  }

  /**
   * Gets the iframe ready state
   * @returns {boolean} True if iframe is ready
   */
  isReady() {
    return this._iframeReady;
  }

  /**
   * Marks the iframe as ready
   */
  markReady() {
    this._iframeReady = true;
  }

  /**
   * Sets debug mode
   * @param {boolean} debug - Debug mode flag
   */
  setDebugMode(debug) {
    this._debug = debug;
  }

  /**
   * Sets the callback for when iframe is ready
   * @param {Function} callback - Callback function
   */
  onReady(callback) {
    this._readyCallback = callback;
  }

  /**
   * Sets the callback for when iframe requests data
   * @param {Function} callback - Callback function
   */
  onDataRequest(callback) {
    this._dataRequestCallback = callback;
  }

  /**
   * Starts listening for messages from iframe
   */
  startListening() {
    if (this._messageListener) {
      window.removeEventListener('message', this._messageListener);
    }

    this._messageListener = (event) => {
      if (!event.data) return;

      switch (event.data.type) {
        case 'iframe-ready':
          this._log('Iframe reports ready');
          this._iframeReady = true;
          if (this._readyCallback) {
            this._readyCallback();
          }
          break;

        case 'request-data':
          this._log('Iframe requesting data');
          if (this._dataRequestCallback) {
            this._dataRequestCallback();
          }
          break;

        case 'data-received':
          this._log('Iframe confirmed data received');
          this._retryCount = 0;
          break;
      }
    };

    window.addEventListener('message', this._messageListener);
  }

  /**
   * Stops listening for messages
   */
  stopListening() {
    if (this._messageListener) {
      window.removeEventListener('message', this._messageListener);
      this._messageListener = null;
    }
  }

  /**
   * Sends entity data to the iframe
   * @param {Object} data - Entity data to send
   * @returns {boolean} True if sent successfully
   */
  sendData(data) {
    if (!this._iframe || !this._iframe.contentWindow) {
      this._log('Cannot send data: iframe not available');
      return false;
    }

    if (!data || Object.keys(data).length === 0) {
      this._log('No data to send to iframe');
      return false;
    }

    try {
      const message = {
        type: 'entity-update',
        data: data,
        timestamp: Date.now(),
        debug: this._debug
      };

      this._log('Sending data to iframe:', message);
      this._iframe.contentWindow.postMessage(message, '*');
      this._retryCount = 0;
      return true;
    } catch (error) {
      console.error('[IframeMessenger] Error sending data to iframe:', error);
      return false;
    }
  }

  /**
   * Sends configuration update to the iframe
   * @param {Object} zones - Zone configurations
   * @param {Object} activities - Activity configurations
   * @param {string} markerBorderRadius - Marker border radius
   * @param {string} badgeBorderRadius - Badge border radius
   * @returns {boolean} True if sent successfully
   */
  sendConfigUpdate(zones, activities, markerBorderRadius, badgeBorderRadius) {
    if (!this._iframe || !this._iframe.contentWindow) {
      this._log('Cannot send config update: iframe not available');
      return false;
    }

    try {
      const message = {
        type: 'config-update',
        zones: zones,
        activities: activities,
        marker_border_radius: markerBorderRadius,
        badge_border_radius: badgeBorderRadius,
        timestamp: Date.now()
      };

      this._log('Sending config update to iframe:', message);
      this._iframe.contentWindow.postMessage(message, '*');
      return true;
    } catch (error) {
      console.error('[IframeMessenger] Error sending config update to iframe:', error);
      return false;
    }
  }

  /**
   * Gets the retry count
   * @returns {number} Current retry count
   */
  getRetryCount() {
    return this._retryCount;
  }

  /**
   * Increments the retry count
   */
  incrementRetryCount() {
    this._retryCount++;
  }

  /**
   * Resets the retry count
   */
  resetRetryCount() {
    this._retryCount = 0;
  }
}
