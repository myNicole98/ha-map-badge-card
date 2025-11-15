class MapBadgeCard extends HTMLElement {
  constructor() {
    super();
    this._entityCache = {};
    this._updateInterval = null;
    this._iframeReady = false;
    this._pendingData = null;
    this._retryCount = 0;
  }

  setConfig(config) {
    console.log('[Card] setConfig called with:', JSON.stringify(config, null, 2));

    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error('You need to define entities');
    }

    const oldConfig = this._config;
    // Hardcoded activity icons based on Google/iOS activity detection
    // Map similar activities to single entities with friendly names
    const defaultActivities = {
      unknown: { icon: 'mdi-human-male', color: '#000000', name: 'Unknown' },
      still: { icon: 'mdi-human-male', color: '#000000', name: 'Still' },
      on_foot: { icon: 'mdi-walk', color: '#000000', name: 'On Foot' },
      walking: { icon: 'mdi-walk', color: '#000000', name: 'Walking' },
      running: { icon: 'mdi-run', color: '#000000', name: 'Running' },
      on_bicycle: { icon: 'mdi-bike', color: '#000000', name: 'Cycling' },
      in_vehicle: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_road_vehicle: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_four_wheeler_vehicle: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_car: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      Automotive: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_rail_vehicle: { icon: 'mdi-train', color: '#000000', name: 'On Train' },
      in_bus: { icon: 'mdi-bus', color: '#000000', name: 'On Bus' },
      tilting: { icon: 'mdi-phone-rotate-landscape', color: '#000000', name: 'Tilting' }
    };

    // Merge user colors with default icons and names
    const activities = {};
    Object.keys(defaultActivities).forEach(key => {
      activities[key] = {
        icon: defaultActivities[key].icon,
        name: defaultActivities[key].name,
        color: (config.activities && config.activities[key] && config.activities[key].color) ? config.activities[key].color : defaultActivities[key].color
      };
    });

    this._config = {
      entities: config.entities,
      map_provider: config.map_provider || 'osm', // 'osm' or 'google'
      google_api_key: config.google_api_key || '',
      map_type: config.map_type || 'hybrid',
      default_zoom: config.default_zoom || 13,
      update_interval: config.update_interval || 10, // Now in seconds
      marker_border_radius: config.marker_border_radius || '50%',
      badge_border_radius: config.badge_border_radius || '50%',
      zones: config.zones || {
        home: { color: '#cef595' },
        not_home: { color: '#757575' }
      },
      activities: activities,
      debug: config.debug || false // Add debug mode option
    };

    // Check if zones or activities changed (during config editing)
    const zonesChanged = oldConfig && JSON.stringify(oldConfig.zones) !== JSON.stringify(this._config.zones);
    const activitiesChanged = oldConfig && JSON.stringify(oldConfig.activities) !== JSON.stringify(this._config.activities);
    const borderRadiusChanged = oldConfig && (
      oldConfig.marker_border_radius !== this._config.marker_border_radius ||
      oldConfig.badge_border_radius !== this._config.badge_border_radius
    );

    // If only zones/activities/border radius changed, send update to iframe instead of full re-render
    if ((zonesChanged || activitiesChanged || borderRadiusChanged) && this._iframe && this._iframeReady) {
      this._sendConfigUpdateToIframe();
    } else {
      this._render();
    }
  }

  set hass(hass) {
    this._hass = hass;
    
    // Start fetching entity data when hass is available
    if (hass && !this._updateInterval) {
      this._startEntityUpdates();
    }
    
    // If we have pending data and iframe is ready, send it
    if (hass && this._iframeReady && this._pendingData) {
      this._sendDataToIframe(this._pendingData);
      this._pendingData = null;
    }
  }

  _log(message, ...args) {
    if (this._config && this._config.debug) {
      console.log(`[MapBadgeCard ${new Date().toISOString()}] ${message}`, ...args);
    }
  }

  _startEntityUpdates() {
    this._log('Starting entity updates');
    
    // Fetch entities immediately
    this._fetchEntities();
    
    // Set up interval for updates
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }
    
    this._updateInterval = setInterval(() => {
      this._fetchEntities();
    }, this._config.update_interval * 1000); // Convert seconds to milliseconds
  }

  async _fetchEntities() {
    if (!this._hass || !this._config.entities) {
      this._log('Cannot fetch entities: hass or entities not available');
      return;
    }
    
    this._log('Fetching entities from hass...');
    
    let hasValidData = false;
    
    for (const entityConfig of this._config.entities) {
      try {
        // Fetch person entity directly from hass states
        const personState = this._hass.states[entityConfig.person];
        if (!personState) {
          console.error(`[MapBadgeCard] Entity not found: ${entityConfig.person}`);
          continue;
        }
        
        // Check if we have valid GPS data
        if (!personState.attributes.latitude || !personState.attributes.longitude) {
          this._log(`No GPS data for ${entityConfig.person}`);
          continue;
        }
        
        // Fetch activity entity if specified
        let activityState = null;
        if (entityConfig.activity) {
          activityState = this._hass.states[entityConfig.activity];
        }
        
        // Store in cache
        this._entityCache[entityConfig.person] = {
          person: personState,
          activity: activityState,
          timestamp: Date.now()
        };
        
        hasValidData = true;
        
        this._log(`Cached entity ${entityConfig.person}:`, personState.state, 
                   'Location:', personState.attributes.latitude, personState.attributes.longitude);
      } catch (error) {
        console.error(`[MapBadgeCard] Error fetching ${entityConfig.person}:`, error);
      }
    }
    
    // Only send update if we have valid data
    if (hasValidData) {
      const data = this._prepareEntityData();
      if (this._iframeReady) {
        this._sendDataToIframe(data);
      } else {
        this._log('Iframe not ready, storing data as pending');
        this._pendingData = data;
      }
    } else {
      this._log('No valid entity data to send');
    }
  }

  _prepareEntityData() {
    const entityData = {};
    
    for (const [entityId, data] of Object.entries(this._entityCache)) {
      // Build picture URL
      let pictureUrl = data.person.attributes.entity_picture || '';
      if (pictureUrl && pictureUrl.startsWith('/')) {
        pictureUrl = window.location.origin + pictureUrl;
      }
      
      entityData[entityId] = {
        state: data.person.state,
        attributes: {
          latitude: data.person.attributes.latitude,
          longitude: data.person.attributes.longitude,
          friendly_name: data.person.attributes.friendly_name,
          entity_picture: pictureUrl
        },
        activity: data.activity ? data.activity.state : 'unknown'
      };
    }
    
    return entityData;
  }

  _sendDataToIframe(data = null) {
    if (!this._iframe || !this._iframe.contentWindow) {
      this._log('Cannot send data: iframe not available');
      return;
    }

    if (!data) {
      data = this._prepareEntityData();
    }

    if (Object.keys(data).length === 0) {
      this._log('No data to send to iframe');
      return;
    }

    try {
      const message = {
        type: 'entity-update',
        data: data,
        timestamp: Date.now(),
        debug: this._config.debug
      };

      this._log('Sending data to iframe:', message);
      this._iframe.contentWindow.postMessage(message, '*');
      this._retryCount = 0; // Reset retry count on successful send
    } catch (error) {
      console.error('[MapBadgeCard] Error sending data to iframe:', error);
    }
  }

  _sendConfigUpdateToIframe() {
    if (!this._iframe || !this._iframe.contentWindow) {
      this._log('Cannot send config update: iframe not available');
      return;
    }

    try {
      const message = {
        type: 'config-update',
        zones: this._config.zones,
        activities: this._config.activities,
        marker_border_radius: this._config.marker_border_radius,
        badge_border_radius: this._config.badge_border_radius,
        timestamp: Date.now()
      };

      this._log('Sending config update to iframe:', message);
      this._iframe.contentWindow.postMessage(message, '*');
    } catch (error) {
      console.error('[MapBadgeCard] Error sending config update to iframe:', error);
    }
  }

  _render() {
    if (!this._config) return;

    // Create a simpler iframe URL without auth complexity
    const params = new URLSearchParams({
      provider: this._config.map_provider,
      apikey: this._config.google_api_key || '',
      maptype: this._config.map_type,
      zoom: this._config.default_zoom,
      mode: 'proxy', // Tell iframe to expect data via postMessage
      debug: this._config.debug ? '1' : '0'
    });

    // Add entities for initial configuration
    const entitiesParam = this._config.entities
      .map(e => `${e.person}${e.activity ? ':' + e.activity : ''}`)
      .join(',');
    params.append('entities', entitiesParam);

    // Add zones (zones only have colors now, no icons)
    const zonesParam = Object.entries(this._config.zones)
      .map(([state, config]) => `${state}:${encodeURIComponent(config.color)}`)
      .join(',');
    params.append('zones', zonesParam);

    // Add activities
    const activitiesParam = Object.entries(this._config.activities)
      .map(([state, config]) => `${state}:${config.icon}:${encodeURIComponent(config.color)}`)
      .join(',');
    params.append('activities', activitiesParam);

    // Add border radius configuration
    params.append('marker_radius', encodeURIComponent(this._config.marker_border_radius));
    params.append('badge_radius', encodeURIComponent(this._config.badge_border_radius));

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
          ${this._config.debug ? `
          <div style="position: absolute; top: 5px; right: 5px; background: rgba(255,255,255,0.9); padding: 5px; font-size: 10px; z-index: 1000;">
            <div>Debug Mode ON</div>
            <div>Entities: ${this._config.entities.length}</div>
            <div>Cache: ${Object.keys(this._entityCache).length}</div>
            <div>Ready: ${this._iframeReady}</div>
          </div>
          ` : ''}
        </div>
      </ha-card>
    `;

    // Reset iframe ready state
    this._iframeReady = false;

    // Get iframe reference
    this._iframe = this.querySelector('#map-badge-iframe');
    
    // Set up multiple attempts to establish communication
    if (this._iframe) {
      // Method 1: Wait for iframe load event
      this._iframe.onload = () => {
        this._log('Iframe loaded (onload event)');
        
        // Try sending data after a short delay
        setTimeout(() => {
          this._iframeReady = true;
          if (this._pendingData) {
            this._log('Sending pending data after iframe load');
            this._sendDataToIframe(this._pendingData);
            this._pendingData = null;
          } else if (Object.keys(this._entityCache).length > 0) {
            this._log('Sending cached data after iframe load');
            this._sendDataToIframe();
          } else {
            this._log('No data to send after iframe load, fetching...');
            this._fetchEntities();
          }
        }, 500);
        
        // Also try again after a longer delay as backup
        setTimeout(() => {
          if (Object.keys(this._entityCache).length > 0) {
            this._log('Backup data send after iframe load');
            this._sendDataToIframe();
          }
        }, 2000);
      };
    }
    
    // Listen for messages from iframe
    if (!this._messageListener) {
      this._messageListener = (event) => {
        if (event.data) {
          if (event.data.type === 'iframe-ready') {
            this._log('Iframe reports ready');
            this._iframeReady = true;
            
            // Send data immediately
            if (this._pendingData) {
              this._log('Sending pending data on iframe-ready');
              this._sendDataToIframe(this._pendingData);
              this._pendingData = null;
            } else if (Object.keys(this._entityCache).length > 0) {
              this._log('Sending cached data on iframe-ready');
              this._sendDataToIframe();
            } else {
              this._log('No data available on iframe-ready, fetching...');
              this._fetchEntities();
            }
          } else if (event.data.type === 'request-data') {
            this._log('Iframe requesting data');
            this._fetchEntities();
          } else if (event.data.type === 'data-received') {
            this._log('Iframe confirmed data received');
            this._retryCount = 0;
          }
        }
      };
      window.addEventListener('message', this._messageListener);
    }
    
    // Set up periodic retry mechanism
    if (!this._retryInterval) {
      this._retryInterval = setInterval(() => {
        if (this._iframeReady && this._retryCount < 3 && Object.keys(this._entityCache).length > 0) {
          const now = Date.now();
          const lastUpdate = Math.max(...Object.values(this._entityCache).map(e => e.timestamp || 0));
          
          // If we haven't sent data successfully in the last 5 seconds, retry
          if (now - lastUpdate < 30000) { // Data is less than 30 seconds old
            this._log('Retrying data send, attempt:', this._retryCount + 1);
            this._sendDataToIframe();
            this._retryCount++;
          }
        }
      }, 5000);
    }
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
    
    if (this._messageListener) {
      window.removeEventListener('message', this._messageListener);
      this._messageListener = null;
    }
  }

  getCardSize() {
    return 5;
  }

  static getConfigElement() {
    return document.createElement('map-badge-card-editor');
  }

  static getStubConfig() {
    return {
      entities: [],
      map_provider: 'osm',
      google_api_key: '',
      map_type: 'hybrid',
      default_zoom: 13,
      update_interval: 10,
      marker_border_radius: '50%',
      badge_border_radius: '50%',
      debug: false,
      zones: {
        home: { color: '#cef595' },
        not_home: { color: '#757575' }
      },
      activities: {}
    };
  }
}

// Keep the same configuration editor
class MapBadgeCardEditor extends HTMLElement {
  constructor() {
    super();
    this._debounceTimeout = null;
    this._hass = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._setEntityPickerHass();
  }

  setConfig(config) {
    this._config = JSON.parse(JSON.stringify(config));

    if (!this._config.entities) {
      this._config.entities = [];
    }

    if (!this._config.zones) {
      this._config.zones = {
        home: { color: '#cef595' },
        not_home: { color: '#757575' }
      };
    }

    // Hardcoded activity icons based on Google/iOS activity detection
    // Map similar activities to single entities with friendly names
    const defaultActivities = {
      unknown: { icon: 'mdi-human-male', color: '#000000', name: 'Unknown' },
      still: { icon: 'mdi-human-male', color: '#000000', name: 'Still' },
      on_foot: { icon: 'mdi-walk', color: '#000000', name: 'On Foot' },
      walking: { icon: 'mdi-walk', color: '#000000', name: 'Walking' },
      running: { icon: 'mdi-run', color: '#000000', name: 'Running' },
      on_bicycle: { icon: 'mdi-bike', color: '#000000', name: 'Cycling' },
      in_vehicle: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_road_vehicle: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_four_wheeler_vehicle: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_car: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      Automotive: { icon: 'mdi-car', color: '#000000', name: 'In Vehicle' },
      in_rail_vehicle: { icon: 'mdi-train', color: '#000000', name: 'On Train' },
      in_bus: { icon: 'mdi-bus', color: '#000000', name: 'On Bus' },
      tilting: { icon: 'mdi-phone-rotate-landscape', color: '#000000', name: 'Tilting' }
    };

    // Merge user colors with default icons and names
    const activities = {};
    Object.keys(defaultActivities).forEach(key => {
      activities[key] = {
        icon: defaultActivities[key].icon,
        name: defaultActivities[key].name,
        color: (this._config.activities && this._config.activities[key] && this._config.activities[key].color) ? this._config.activities[key].color : defaultActivities[key].color
      };
    });

    this._config.activities = activities;

    console.log('[Editor] setConfig - activities after merge:', JSON.stringify(this._config.activities, null, 2));

    if (!this._config.map_provider) {
      this._config.map_provider = 'osm';
    }

    if (!this._config.marker_border_radius) {
      this._config.marker_border_radius = '50%';
    }

    if (!this._config.badge_border_radius) {
      this._config.badge_border_radius = '50%';
    }

    this._render();
  }

  _render() {
    if (!this._config) return;

    const zonesHtml = Object.entries(this._config.zones)
      .map(([state, config], idx) => `
        <div class="config-item">
          <div class="input-wrapper" style="flex: 1;">
            <label>State Name</label>
            <input
              type="text"
              id="zone-state-${idx}"
              class="entity-input"
              value="${state}"
              data-zone-idx="${idx}"
              data-zone-field="state"
              placeholder="home">
          </div>
          <div class="input-wrapper" style="width: 80px;">
            <label>Color</label>
            <input type="color" value="${config.color}" data-zone-idx="${idx}" data-zone-field="color" style="width: 100%; height: 40px; border-radius: 4px; border: 1px solid var(--divider-color); cursor: pointer;">
          </div>
          <ha-icon-button
            data-zone-delete="${idx}">
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        </div>
      `).join('');

    console.log('[Editor] _render - activities object:', this._config.activities);
    console.log('[Editor] _render - activities entries:', Object.entries(this._config.activities));

    // Group activities by unique name to avoid duplicates in UI
    // Filter out "Unknown" - it uses default black and shouldn't be configurable
    const uniqueActivities = new Map();
    const activityGroups = {}; // Map from display name to array of state keys
    const hiddenActivities = ['Unknown']; // Activities to hide from UI

    Object.entries(this._config.activities).forEach(([state, config]) => {
      const displayName = config.name || state.replace(/_/g, ' ');

      // Skip hidden activities
      if (hiddenActivities.includes(displayName)) {
        return;
      }

      if (!uniqueActivities.has(displayName)) {
        uniqueActivities.set(displayName, { ...config, states: [state] });
        activityGroups[displayName] = [state];
      } else {
        // Add this state to the existing group
        activityGroups[displayName].push(state);
      }
    });

    console.log('[Editor] Activity groups:', activityGroups);
    console.log('[Editor] Unique activities count:', uniqueActivities.size);

    const activitiesHtml = Array.from(uniqueActivities.entries())
      .map(([displayName, config]) => {
        // Convert mdi-icon-name to mdi:icon-name for ha-icon
        const haIconFormat = config.icon.replace('mdi-', 'mdi:');
        const states = activityGroups[displayName].join(',');
        return `
        <div class="config-item" style="align-items: center; gap: 16px;">
          <ha-icon icon="${haIconFormat}" style="--mdc-icon-size: 24px; color: var(--primary-text-color); flex-shrink: 0;"></ha-icon>
          <div class="input-wrapper" style="flex: 1;">
            <label>${displayName}</label>
          </div>
          <div class="input-wrapper" style="width: 100px;">
            <label>Color</label>
            <input type="color" value="${config.color || '#000000'}" data-activity-states="${states}" style="width: 100%; height: 40px; border-radius: 4px; border: 1px solid var(--divider-color); cursor: pointer;">
          </div>
        </div>
      `;
      }).join('');

    console.log('[Editor] _render - activitiesHtml length:', activitiesHtml.length);

    // Get entity lists for autocomplete
    let personEntities = [];
    let sensorEntities = [];
    let personDatalist = '<datalist id="person-entities-list"></datalist>';
    let sensorDatalist = '<datalist id="sensor-entities-list"></datalist>';

    if (this._hass && this._hass.states) {
      personEntities = Object.keys(this._hass.states)
        .filter(e => e.startsWith('person.'))
        .sort();
      sensorEntities = Object.keys(this._hass.states)
        .filter(e => e.startsWith('sensor.'))
        .sort();

      // Create datalist elements for autocomplete
      personDatalist = `
        <datalist id="person-entities-list">
          ${personEntities.map(e => {
            const friendlyName = this._hass.states[e]?.attributes?.friendly_name || e;
            return `<option value="${e}">${friendlyName}</option>`;
          }).join('')}
        </datalist>
      `;

      sensorDatalist = `
        <datalist id="sensor-entities-list">
          ${sensorEntities.map(e => {
            const friendlyName = this._hass.states[e]?.attributes?.friendly_name || e;
            return `<option value="${e}">${friendlyName}</option>`;
          }).join('')}
        </datalist>
      `;
    }

    const entitiesHtml = this._config.entities
      .map((entity, idx) => `
        <div class="config-item">
          <div class="input-wrapper" style="flex: 1;">
            <label>Person Entity</label>
            <input
              type="text"
              id="entity-person-${idx}"
              class="entity-input"
              value="${entity.person || ''}"
              data-entity-idx="${idx}"
              data-entity-field="person"
              placeholder="person.example"
              list="person-entities-list">
          </div>
          <div class="input-wrapper" style="flex: 1;">
            <label>Activity Sensor</label>
            <input
              type="text"
              id="entity-activity-${idx}"
              class="entity-input"
              value="${entity.activity || ''}"
              data-entity-idx="${idx}"
              data-entity-field="activity"
              placeholder="sensor.phone_activity"
              list="sensor-entities-list">
          </div>
          <ha-icon-button
            data-entity-delete="${idx}">
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        </div>
      `).join('');

    this.innerHTML = `
      <style>
        .config-container {
          padding: 20px;
          max-width: 800px;
        }
        .config-header {
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 24px;
          color: var(--primary-text-color);
          padding-bottom: 12px;
          border-bottom: 2px solid var(--divider-color);
        }
        .config-row {
          margin: 20px 0;
        }
        .config-row ha-textfield,
        .config-row ha-select {
          width: 100%;
        }
        .config-note {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-top: 6px;
          font-style: italic;
        }
        .config-section {
          margin: 32px 0;
          padding: 20px;
          background: var(--card-background-color);
          border-radius: 12px;
          border: 1px solid var(--divider-color);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .config-section-header {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 20px;
          color: var(--primary-text-color);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .config-section-header ha-icon {
          flex-shrink: 0;
        }
        .config-item {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: flex-end;
        }
        .add-button {
          margin-top: 12px;
        }
        ha-icon-button[data-entity-delete],
        ha-icon-button[data-zone-delete],
        ha-icon-button[data-activity-delete] {
          --mdc-icon-button-size: 40px;
          color: var(--error-color);
          flex-shrink: 0;
        }
        .input-wrapper {
          display: flex;
          flex-direction: column;
        }
        .input-wrapper label {
          font-size: 12px;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
          font-weight: 500;
        }
        .entity-input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-family: inherit;
          font-size: 14px;
          transition: border-color 0.2s;
        }
        .entity-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }
        .entity-input::placeholder {
          color: var(--secondary-text-color);
          opacity: 0.5;
        }
        .radius-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 6px;
          border-radius: 3px;
          background: var(--divider-color);
          outline: none;
          transition: background 0.2s;
        }
        .radius-slider:hover {
          background: var(--secondary-text-color);
        }
        .radius-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          transition: transform 0.2s;
        }
        .radius-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .radius-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          border: none;
          transition: transform 0.2s;
        }
        .radius-slider::-moz-range-thumb:hover {
          transform: scale(1.2);
        }
      </style>
      <div class="config-container">
        <div class="config-header">Map Badge Card Configuration</div>

        <div class="config-row">
          <ha-select
            id="map_provider"
            label="Map Provider"
            value="${this._config.map_provider || 'osm'}">
            <mwc-list-item value="osm">OpenStreetMap (No API Key Required)</mwc-list-item>
            <mwc-list-item value="google">Google Maps</mwc-list-item>
          </ha-select>
          <div class="config-note">OpenStreetMap is free and requires no authentication</div>
        </div>

        <div class="config-row" id="google-api-key-row" style="display: ${this._config.map_provider === 'google' ? 'block' : 'none'}">
          <ha-textfield
            id="google_api_key"
            label="Google API Key"
            value="${this._config.google_api_key || ''}"
            placeholder="AIzaSy...">
          </ha-textfield>
          <div class="config-note">Required only for Google Maps - Get your API key from Google Cloud Console</div>
        </div>

        <div class="config-row" id="map-type-row" style="display: ${this._config.map_provider === 'google' ? 'block' : 'none'}">
          <ha-select
            id="map_type"
            label="Map Type"
            value="${this._config.map_type || 'hybrid'}">
            <mwc-list-item value="hybrid">Hybrid</mwc-list-item>
            <mwc-list-item value="satellite">Satellite</mwc-list-item>
            <mwc-list-item value="roadmap">Roadmap</mwc-list-item>
            <mwc-list-item value="terrain">Terrain</mwc-list-item>
          </ha-select>
          <div class="config-note">Map type (Google Maps only)</div>
        </div>

        <div class="config-row">
          <ha-textfield
            id="default_zoom"
            label="Default Zoom"
            value="${this._config.default_zoom || 13}"
            type="number"
            min="1"
            max="21">
          </ha-textfield>
          <div class="config-note">1 = World view, 21 = Maximum zoom</div>
        </div>

        <div class="config-row">
          <ha-textfield
            id="update_interval"
            label="Update Interval (seconds)"
            value="${this._config.update_interval || 10}"
            type="number"
            min="1">
          </ha-textfield>
          <div class="config-note">How often to refresh location data</div>
        </div>

        <div class="config-row">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--primary-text-color);">
            Marker Border Radius
          </label>
          <div style="display: flex; align-items: center; gap: 12px;">
            <input
              type="range"
              id="marker_border_radius"
              min="0"
              max="50"
              value="${parseInt(this._config.marker_border_radius) || 50}"
              class="radius-slider"
              style="flex: 1;">
            <span id="marker-radius-value" style="min-width: 40px; text-align: right; font-weight: 600;">${this._config.marker_border_radius || '50%'}</span>
          </div>
          <div class="config-note">0% for square, 50% for circle</div>
        </div>

        <div class="config-row">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--primary-text-color);">
            Badge Border Radius
          </label>
          <div style="display: flex; align-items: center; gap: 12px;">
            <input
              type="range"
              id="badge_border_radius"
              min="0"
              max="50"
              value="${parseInt(this._config.badge_border_radius) || 50}"
              class="radius-slider"
              style="flex: 1;">
            <span id="badge-radius-value" style="min-width: 40px; text-align: right; font-weight: 600;">${this._config.badge_border_radius || '50%'}</span>
          </div>
          <div class="config-note">0% for square, 50% for circle</div>
        </div>

        <div class="config-section">
          <div class="config-section-header">
            <ha-icon icon="mdi:account-multiple"></ha-icon>
            Entities
          </div>
          <div id="entities-container">${entitiesHtml}</div>
          ${personDatalist}
          ${sensorDatalist}
          <ha-button class="add-button" id="add-entity">
            <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
            Add Entity
          </ha-button>
        </div>

        <div class="config-section">
          <div class="config-section-header">
            <ha-icon icon="mdi:map-marker"></ha-icon>
            Zone Configuration
          </div>
          <div id="zones-container">${zonesHtml}</div>
          <ha-button class="add-button" id="add-zone">
            <ha-icon icon="mdi:plus" slot="icon"></ha-icon>
            Add Zone
          </ha-button>
        </div>

        <div class="config-section">
          <div class="config-section-header">
            <ha-icon icon="mdi:walk"></ha-icon>
            Activity Configuration
          </div>
          <div id="activities-container">${activitiesHtml}</div>
        </div>
      </div>
    `;

    // Use requestAnimationFrame to ensure DOM is ready before attaching listeners
    requestAnimationFrame(() => {
      this._attachListeners();
      this._setEntityPickerHass();
    });
  }

  _setEntityPickerHass() {
    // Not needed anymore since we removed icon pickers
  }

  _attachListeners() {
    // Map provider selector
    this.querySelector('#map_provider')?.addEventListener('selected', (e) => {
      this._config.map_provider = e.target.value;
      // Show/hide Google Maps fields based on selection
      const googleApiKeyRow = this.querySelector('#google-api-key-row');
      const mapTypeRow = this.querySelector('#map-type-row');
      if (googleApiKeyRow) {
        googleApiKeyRow.style.display = e.target.value === 'google' ? 'block' : 'none';
      }
      if (mapTypeRow) {
        mapTypeRow.style.display = e.target.value === 'google' ? 'block' : 'none';
      }
      this._fireChanged();
    });

    // Basic config - using 'change' event for ha-textfield components
    this.querySelector('#google_api_key')?.addEventListener('change', (e) => {
      this._config.google_api_key = e.target.value;
      this._fireChanged();
    });
    this.querySelector('#map_type')?.addEventListener('selected', (e) => {
      this._config.map_type = e.target.value;
      this._fireChanged();
    });
    this.querySelector('#default_zoom')?.addEventListener('change', (e) => {
      this._config.default_zoom = parseInt(e.target.value);
      this._fireChanged();
    });
    this.querySelector('#update_interval')?.addEventListener('change', (e) => {
      this._config.update_interval = parseInt(e.target.value);
      this._fireChanged();
    });

    // Marker border radius slider
    const markerSlider = this.querySelector('#marker_border_radius');
    const markerValueDisplay = this.querySelector('#marker-radius-value');
    markerSlider?.addEventListener('input', (e) => {
      const value = e.target.value + '%';
      markerValueDisplay.textContent = value;
      this._config.marker_border_radius = value;
      this._fireChanged();
    });

    // Badge border radius slider
    const badgeSlider = this.querySelector('#badge_border_radius');
    const badgeValueDisplay = this.querySelector('#badge-radius-value');
    badgeSlider?.addEventListener('input', (e) => {
      const value = e.target.value + '%';
      badgeValueDisplay.textContent = value;
      this._config.badge_border_radius = value;
      this._fireChanged();
    });

    // Entities - using 'change' event for input elements
    this.querySelectorAll('input.entity-input[data-entity-idx]').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.entityIdx);
        const field = e.target.dataset.entityField;
        if (idx < this._config.entities.length) {
          this._config.entities[idx][field] = e.target.value || '';
          this._fireChanged();
        }
      });
    });
    this.querySelectorAll('[data-entity-delete]').forEach(el => {
      el.addEventListener('click', (e) => {
        const button = e.target.closest('ha-icon-button');
        if (button) {
          const idx = parseInt(button.dataset.entityDelete);
          this._config.entities.splice(idx, 1);
          this._render();
          this._fireChanged();
        }
      });
    });
    this.querySelector('#add-entity')?.addEventListener('click', () => {
      this._config.entities.push({ person: '', activity: '' });
      this._render();
      this._fireChanged();
    });

    // Zones - using 'change' event for input elements
    this.querySelectorAll('input[data-zone-idx][data-zone-field="state"]').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.zoneIdx);
        const zones = Object.entries(this._config.zones);
        if (idx >= zones.length) return;

        const [oldState, oldConfig] = zones[idx];
        const newValue = e.target.value;

        if (newValue && oldState !== newValue) {
          delete this._config.zones[oldState];
          this._config.zones[newValue] = oldConfig;
        }
        this._fireChanged();
      });
    });
    this.querySelectorAll('input[data-zone-idx][data-zone-field="color"]').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.zoneIdx);
        const zones = Object.entries(this._config.zones);
        if (idx >= zones.length) return;

        const [state, config] = zones[idx];
        config.color = e.target.value;
        this._fireChanged();
      });
    });
    this.querySelectorAll('[data-zone-delete]').forEach(el => {
      el.addEventListener('click', (e) => {
        const button = e.target.closest('ha-icon-button');
        if (button) {
          const idx = parseInt(button.dataset.zoneDelete);
          const zones = Object.entries(this._config.zones);
          const [state] = zones[idx];
          delete this._config.zones[state];
          this._render();
          this._fireChanged();
        }
      });
    });
    this.querySelector('#add-zone')?.addEventListener('click', () => {
      this._config.zones[''] = { color: '#757575' };
      this._render();
      this._fireChanged();
    });

    // Activities - only handle color changes (icons are hardcoded)
    // Note: data-activity-states contains comma-separated list of states
    this.querySelectorAll('input[data-activity-states]').forEach(el => {
      el.addEventListener('change', (e) => {
        const states = e.target.dataset.activityStates.split(',');
        const newColor = e.target.value;

        // Update color for all states in this group
        states.forEach(state => {
          if (this._config.activities[state]) {
            this._config.activities[state].color = newColor;
          }
        });

        this._fireChanged();
      });
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

customElements.define('map-badge-card', MapBadgeCard);
customElements.define('map-badge-card-editor', MapBadgeCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'map-badge-card',
  name: 'Map Badge Card',
  description: 'Map with person markers, zone borders, and activity badges',
  preview: false
});

