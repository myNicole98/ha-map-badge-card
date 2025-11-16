import { HIDDEN_ACTIVITIES } from './constants.js';

/**
 * Generates HTML for the configuration editor
 */
export class EditorUI {
  /**
   * Generates the complete editor HTML
   * @param {Object} config - Current configuration
   * @param {Object} hass - Home Assistant instance
   * @returns {string} HTML string
   */
  static generateHTML(config, hass) {
    const entitiesHtml = this._generateEntitiesHTML(config, hass);
    const zonesHtml = this._generateZonesHTML(config);
    const activitiesHtml = this._generateActivitiesHTML(config);
    const datalists = this._generateDatalistsHTML(hass);

    return `
      ${this._generateStyles()}
      <div class="config-container">
        <div class="config-header">
          Map Badge Card Configuration
        </div>

        ${this._generateMapProviderSection(config)}
        ${this._generateAppearanceSection(config)}
        ${this._generateEntitiesSection(entitiesHtml, datalists)}
        ${this._generateZonesSection(zonesHtml)}
        ${this._generateActivitiesSection(activitiesHtml)}
      </div>
    `;
  }

  /**
   * Generates styles for the editor
   * @returns {string} Style HTML
   */
  static _generateStyles() {
    return `
      <style>
        .config-container {
          padding: 24px;
          max-width: 900px;
          margin: 0 auto;
        }
        .config-header {
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 32px;
          color: var(--primary-text-color);
          padding-bottom: 16px;
          border-bottom: 3px solid var(--primary-color);
        }
        .config-row {
          margin: 24px 0;
          transition: all 0.3s ease;
        }
        .config-row ha-textfield,
        .config-row ha-select {
          width: 100%;
          --mdc-theme-primary: var(--primary-color);
        }
        .config-note {
          font-size: 13px;
          color: var(--secondary-text-color);
          margin-top: 8px;
          padding: 8px 12px;
          background: var(--secondary-background-color);
          border-radius: 6px;
          border-left: 3px solid var(--primary-color);
        }
        .config-section {
          margin: 32px 0;
          padding: 24px;
          background: var(--card-background-color);
          border-radius: 16px;
          border: 2px solid var(--divider-color);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
        }
        .config-section:hover {
          box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        }
        .config-section-header {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 24px;
          color: var(--primary-text-color);
          padding-bottom: 12px;
          border-bottom: 2px solid var(--divider-color);
        }
        .config-item {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: flex-end;
          padding: 12px;
          background: var(--secondary-background-color);
          border-radius: 12px;
          transition: background 0.2s ease;
        }
        .config-item:hover {
          background: var(--divider-color);
        }
        .add-button {
          margin-top: 16px;
          width: 100%;
          --mdc-theme-primary: var(--primary-color);
          border-radius: 8px;
          font-weight: 600;
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
          flex: 1 1 0;
          min-width: 0;
          max-width: 100%;
        }
        .input-wrapper label {
          font-size: 13px;
          color: var(--secondary-text-color);
          margin-bottom: 6px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .entity-input {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          padding: 10px 14px;
          border: 2px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-family: inherit;
          font-size: 14px;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .entity-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(var(--rgb-primary-color), 0.1);
        }
        .entity-input:hover {
          border-color: var(--primary-color);
        }
        .entity-input::placeholder {
          color: var(--secondary-text-color);
          opacity: 0.6;
        }
        .radius-slider {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: var(--divider-color);
          outline: none;
          cursor: pointer;
          pointer-events: auto;
        }
        .radius-slider::-webkit-slider-runnable-track {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: var(--divider-color);
        }
        .radius-slider::-moz-range-track {
          width: 100%;
          height: 8px;
          border-radius: 4px;
          background: var(--divider-color);
        }
        .radius-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: grab;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          margin-top: -6px;
        }
        .radius-slider::-webkit-slider-thumb:active {
          cursor: grabbing;
        }
        .radius-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: grab;
          border: none;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .radius-slider::-moz-range-thumb:active {
          cursor: grabbing;
        }
        #toggle-api-key-visibility {
          transition: color 0.2s ease;
        }
        #toggle-api-key-visibility:hover {
          color: var(--primary-color);
        }
        @media (min-width: 600px) {
          .config-row {
            display: grid;
            gap: 16px;
          }
        }
      </style>
    `;
  }

  /**
   * Generates map provider section HTML
   * @param {Object} config - Configuration object
   * @returns {string} HTML string
   */
  static _generateMapProviderSection(config) {
    const googleFieldsDisplay = config.map_provider === 'google' ? 'block' : 'none';

    return `
      <div class="config-section">
        <div class="config-section-header">
          Map Provider Settings
        </div>
        <div class="config-row">
          <ha-select
            id="map_provider"
            label="Map Provider"
            value="${config.map_provider || 'osm'}">
            <mwc-list-item value="osm">OpenStreetMap (No API Key Required)</mwc-list-item>
            <mwc-list-item value="google">Google Maps</mwc-list-item>
          </ha-select>
          <div class="config-note">OpenStreetMap is free and requires no authentication</div>
        </div>

        <div class="config-row" id="google-api-key-row" style="display: ${googleFieldsDisplay}">
          <div style="position: relative;">
            <ha-textfield
              id="google_api_key"
              label="Google API Key"
              value="${config.google_api_key || ''}"
              placeholder="AIzaSy..."
              type="password">
            </ha-textfield>
            <ha-icon-button
              id="toggle-api-key-visibility"
              style="position: absolute; right: 0; top: 8px;">
              <ha-icon icon="mdi:eye"></ha-icon>
            </ha-icon-button>
          </div>
          <div class="config-note">Required only for Google Maps - Get your API key from Google Cloud Console</div>
        </div>

        <div class="config-row" id="map-type-row" style="display: ${googleFieldsDisplay}">
          <ha-select
            id="map_type"
            label="Map Type"
            value="${config.map_type || 'hybrid'}">
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
            value="${config.default_zoom || 13}"
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
            value="${config.update_interval || 10}"
            type="number"
            min="1">
          </ha-textfield>
          <div class="config-note">How often to refresh location data</div>
        </div>
      </div>
    `;
  }

  /**
   * Generates appearance section HTML
   * @param {Object} config - Configuration object
   * @returns {string} HTML string
   */
  static _generateAppearanceSection(config) {
    return `
      <div class="config-section">
        <div class="config-section-header">
          Appearance Settings
        </div>
        <div class="config-row">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--primary-text-color);">
            Marker Border Radius
          </label>
          <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <input
              type="range"
              id="marker_border_radius"
              min="0"
              max="50"
              value="${parseInt(config.marker_border_radius) || 50}"
              class="radius-slider">
            <span id="marker-radius-value" style="min-width: 50px; text-align: right; font-weight: 600;">${config.marker_border_radius || '50%'}</span>
          </div>
          <div class="config-note">0% for square, 50% for circle</div>
        </div>

        <div class="config-row">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; color: var(--primary-text-color);">
            Badge Border Radius
          </label>
          <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <input
              type="range"
              id="badge_border_radius"
              min="0"
              max="50"
              value="${parseInt(config.badge_border_radius) || 50}"
              class="radius-slider">
            <span id="badge-radius-value" style="min-width: 50px; text-align: right; font-weight: 600;">${config.badge_border_radius || '50%'}</span>
          </div>
          <div class="config-note">0% for square, 50% for circle</div>
        </div>
      </div>
    `;
  }

  /**
   * Generates entities section HTML
   * @param {string} entitiesHtml - Pre-generated entities HTML
   * @param {string} datalists - Pre-generated datalists HTML
   * @returns {string} HTML string
   */
  static _generateEntitiesSection(entitiesHtml, datalists) {
    return `
      <div class="config-section">
        <div class="config-section-header">
          Entities
        </div>
        <div id="entities-container">${entitiesHtml}</div>
        ${datalists}
        <ha-button class="add-button" id="add-entity">
          Add Entity
        </ha-button>
      </div>
    `;
  }

  /**
   * Generates zones section HTML
   * @param {string} zonesHtml - Pre-generated zones HTML
   * @returns {string} HTML string
   */
  static _generateZonesSection(zonesHtml) {
    return `
      <div class="config-section">
        <div class="config-section-header">
          Zone Configuration
        </div>
        <div id="zones-container">${zonesHtml}</div>
        <ha-button class="add-button" id="add-zone">
          Add Zone
        </ha-button>
      </div>
    `;
  }

  /**
   * Generates activities section HTML
   * @param {string} activitiesHtml - Pre-generated activities HTML
   * @returns {string} HTML string
   */
  static _generateActivitiesSection(activitiesHtml) {
    return `
      <div class="config-section">
        <div class="config-section-header">
          Activity Configuration
        </div>
        <div id="activities-container">${activitiesHtml}</div>
      </div>
    `;
  }

  /**
   * Generates entities HTML
   * @param {Object} config - Configuration object
   * @param {Object} hass - Home Assistant instance
   * @returns {string} HTML string
   */
  static _generateEntitiesHTML(config, hass) {
    return config.entities
      .map((entity, idx) => `
        <div class="config-item">
          <div class="input-wrapper">
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
          <div class="input-wrapper">
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
  }

  /**
   * Generates zones HTML
   * @param {Object} config - Configuration object
   * @returns {string} HTML string
   */
  static _generateZonesHTML(config) {
    return Object.entries(config.zones)
      .map(([state, zoneConfig], idx) => `
        <div class="config-item">
          <div class="input-wrapper">
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
          <div class="input-wrapper" style="flex: 0 0 100px;">
            <label>Color</label>
            <input type="color" value="${zoneConfig.color}" data-zone-idx="${idx}" data-zone-field="color" class="entity-input" style="height: 40px; padding: 4px;">
          </div>
          <ha-icon-button
            data-zone-delete="${idx}">
            <ha-icon icon="mdi:delete"></ha-icon>
          </ha-icon-button>
        </div>
      `).join('');
  }

  /**
   * Generates activities HTML
   * @param {Object} config - Configuration object
   * @returns {string} HTML string
   */
  static _generateActivitiesHTML(config) {
    // Group activities by unique name
    const uniqueActivities = new Map();
    const activityGroups = {};

    Object.entries(config.activities).forEach(([state, activityConfig]) => {
      const displayName = activityConfig.name || state.replace(/_/g, ' ');

      // Skip hidden activities
      if (HIDDEN_ACTIVITIES.includes(displayName)) {
        return;
      }

      if (!uniqueActivities.has(displayName)) {
        uniqueActivities.set(displayName, { ...activityConfig, states: [state] });
        activityGroups[displayName] = [state];
      } else {
        activityGroups[displayName].push(state);
      }
    });

    return Array.from(uniqueActivities.entries())
      .map(([displayName, activityConfig]) => {
        const haIconFormat = activityConfig.icon.replace('mdi-', 'mdi:');
        const states = activityGroups[displayName].join(',');
        return `
        <div class="config-item" style="align-items: center; gap: 16px;">
          <ha-icon icon="${haIconFormat}" style="--mdc-icon-size: 24px; color: var(--primary-text-color); flex-shrink: 0;"></ha-icon>
          <div class="input-wrapper" style="flex: 1;">
            <label>${displayName}</label>
          </div>
          <div class="input-wrapper" style="width: 100px;">
            <label>Color</label>
            <input type="color" value="${activityConfig.color || '#000000'}" data-activity-states="${states}" style="width: 100%; height: 40px; border-radius: 4px; border: 1px solid var(--divider-color); cursor: pointer;">
          </div>
        </div>
      `;
      }).join('');
  }

  /**
   * Generates datalists HTML for autocomplete
   * @param {Object} hass - Home Assistant instance
   * @returns {string} HTML string
   */
  static _generateDatalistsHTML(hass) {
    if (!hass || !hass.states) {
      return '<datalist id="person-entities-list"></datalist><datalist id="sensor-entities-list"></datalist>';
    }

    const personEntities = Object.keys(hass.states)
      .filter(e => e.startsWith('person.'))
      .sort();

    const sensorEntities = Object.keys(hass.states)
      .filter(e => e.startsWith('sensor.'))
      .sort();

    const personDatalist = `
      <datalist id="person-entities-list">
        ${personEntities.map(e => {
          const friendlyName = hass.states[e]?.attributes?.friendly_name || e;
          return `<option value="${e}">${friendlyName}</option>`;
        }).join('')}
      </datalist>
    `;

    const sensorDatalist = `
      <datalist id="sensor-entities-list">
        ${sensorEntities.map(e => {
          const friendlyName = hass.states[e]?.attributes?.friendly_name || e;
          return `<option value="${e}">${friendlyName}</option>`;
        }).join('')}
      </datalist>
    `;

    return personDatalist + sensorDatalist;
  }
}
