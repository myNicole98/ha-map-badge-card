import { ConfigManager } from './config-manager.js';
import { EntityDataFetcher } from './entity-data-fetcher.js';
import { IframeMessenger } from './iframe-messenger.js';
import { EditorUI } from './editor-ui.js';
import { EditorHandlers } from './editor-handlers.js';

/**
 * Main card component that integrates with Home Assistant
 */
class MapBadgeCard extends HTMLElement {
  constructor() {
    super();
    this._configManager = new ConfigManager();
    this._dataFetcher = new EntityDataFetcher();
    this._messenger = new IframeMessenger();
    this._updateInterval = null;
    this._retryInterval = null;
    this._pendingData = null;
    this._iframe = null;
  }

  setConfig(config) {
    console.log('[Card] setConfig called with:', JSON.stringify(config, null, 2));

    const oldConfig = this._configManager.getConfig();
    const newConfig = this._configManager.setConfig(config);

    // Check if activity_source or speed_source changed
    const activitySourceChanged = this._configManager.hasChanged(oldConfig, ['activity_source']);
    const speedSourceChanged = this._configManager.hasChanged(oldConfig, ['speed_source']);

    // Configure modules
    this._dataFetcher.setDebugMode(newConfig.debug);
    this._dataFetcher.setEntities(newConfig.entities);
    this._messenger.setDebugMode(newConfig.debug);

    // Check if only visual config changed
    const visualPropsChanged = this._configManager.hasChanged(oldConfig, [
      'zones',
      'activities',
      'marker_border_radius',
      'badge_border_radius',
      'marker_size'
    ]);

    if (visualPropsChanged && this._iframe && this._messenger.isReady()) {
      this._sendConfigUpdate();
    } else {
      this._render();
    }

    // If activity_source or speed_source changed, trigger data fetch immediately
    if ((activitySourceChanged || speedSourceChanged) && this._updateInterval) {
      this._fetchEntities();
    }
  }

  set hass(hass) {
    this._dataFetcher.setHass(hass);

    // Start fetching entity data when hass is available
    if (hass && !this._updateInterval) {
      this._startEntityUpdates();
    }

    // If we have pending data and iframe is ready, send it
    if (hass && this._messenger.isReady() && this._pendingData) {
      this._messenger.sendData(this._pendingData);
      this._pendingData = null;
    }
  }

  _startEntityUpdates() {
    const config = this._configManager.getConfig();

    // Fetch entities immediately
    this._fetchEntities();

    // Set up interval for updates
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }

    this._updateInterval = setInterval(() => {
      this._fetchEntities();
    }, config.update_interval * 1000);
  }

  async _fetchEntities() {
    const config = this._configManager.getConfig();
    const data = await this._dataFetcher.fetchEntities(config);

    if (!data) return;

    if (this._messenger.isReady()) {
      this._messenger.sendData(data);
    } else {
      this._pendingData = data;
    }
  }

  _sendConfigUpdate() {
    const config = this._configManager.getConfig();
    this._messenger.sendConfigUpdate(
      config.zones,
      config.activities,
      config.marker_border_radius,
      config.badge_border_radius,
      config.marker_size
    );
  }

  _render() {
    const config = this._configManager.getConfig();
    if (!config) return;

    const params = this._configManager.buildIframeParams();
    const iframeUrl = `/local/map-badge-card/map-badge-v2.html?${params.toString()}`;

    this.innerHTML = `
      <ha-card style="height: 100%; display: flex; flex-direction: column;">
        <div style="padding: 0; margin: 0; overflow: hidden; position: relative; flex: 1;">
          <iframe
            id="map-badge-iframe"
            src="${iframeUrl}"
            style="width: 100%; height: 100%; border: none; display: block; margin: 0; padding: 0;"
            allowfullscreen
          ></iframe>
          ${this._renderDebugInfo(config)}
        </div>
      </ha-card>
    `;

    this._setupIframe();
  }

  _renderDebugInfo(config) {
    if (!config.debug) return '';

    return `
      <div style="position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.9); padding: 5px; font-size: 10px; z-index: 1000;">
        <div>Debug Mode ON</div>
        <div>Entities: ${config.entities.length}</div>
        <div>Cache: ${Object.keys(this._dataFetcher.getCache()).length}</div>
        <div>Ready: ${this._messenger.isReady()}</div>
      </div>
    `;
  }

  _setupIframe() {
    this._iframe = this.querySelector('#map-badge-iframe');
    this._messenger.setIframe(this._iframe);

    if (this._iframe) {
      // Handle iframe load event
      this._iframe.onload = () => {
        setTimeout(() => {
          this._messenger.markReady();
          this._sendPendingOrCachedData();
        }, 500);

        // Backup attempt after longer delay
        setTimeout(() => {
          if (this._dataFetcher.hasData()) {
      this._messenger.sendData(this._dataFetcher.prepareEntityData(this._configManager.getConfig()));
          }
        }, 2000);
      };
    }

    // Set up message listener
    this._messenger.onReady(() => {
      this._sendPendingOrCachedData();
    });

    this._messenger.onDataRequest(() => {
      this._fetchEntities();
    });

    this._messenger.startListening();

    // Set up periodic retry mechanism
    this._setupRetryInterval();
  }

  _sendPendingOrCachedData() {
    if (this._pendingData) {
      this._messenger.sendData(this._pendingData);
      this._pendingData = null;
    } else if (this._dataFetcher.hasData()) {
      this._messenger.sendData(this._dataFetcher.prepareEntityData(this._configManager.getConfig()));
    } else {
      this._fetchEntities();
    }
  }

  _setupRetryInterval() {
    if (this._retryInterval) {
      clearInterval(this._retryInterval);
    }

    this._retryInterval = setInterval(() => {
      if (this._messenger.isReady() &&
          this._messenger.getRetryCount() < 3 &&
          this._dataFetcher.hasData()) {

        const now = Date.now();
        const lastUpdate = this._dataFetcher.getLastUpdateTime();

        // If data is less than 30 seconds old, retry
        if (now - lastUpdate < 30000) {
          this._messenger.sendData(this._dataFetcher.prepareEntityData(this._configManager.getConfig()));
          this._messenger.incrementRetryCount();
        }
      }
    }, 5000);
  }

  disconnectedCallback() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }

    if (this._retryInterval) {
      clearInterval(this._retryInterval);
      this._retryInterval = null;
    }

    this._messenger.stopListening();
  }

  getCardSize() {
    return 5;
  }

  static getConfigElement() {
    return document.createElement('map-badge-card-editor');
  }

  static getStubConfig() {
    return ConfigManager.getStubConfig();
  }
}

/**
 * Configuration editor component
 */
class MapBadgeCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = null;
    this._hass = null;
    this._configManager = new ConfigManager();
  }

  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config));
    this._configManager.setConfig(this._config);
    this._render();
  }

  _render() {
    if (!this._config) return;

    const html = EditorUI.generateHTML(this._config, this._hass);
    this.innerHTML = html;

    // Attach listeners after DOM is ready
    requestAnimationFrame(() => {
      EditorHandlers.attachListeners(
        this,
        this._config,
        () => this._fireChanged(),
        () => this._render()
      );
    });
  }

  _fireChanged() {
    console.log('[Editor] Firing config-changed event with config:', JSON.stringify(this._config, null, 2));

    const event = new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(event);
  }
}

// Register custom elements
customElements.define('map-badge-card', MapBadgeCard);
customElements.define('map-badge-card-editor', MapBadgeCardEditor);

// Register with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'map-badge-card',
  name: 'Map Badge Card',
  description: 'Map with person markers, zone borders, and activity badges',
  preview: false
});
