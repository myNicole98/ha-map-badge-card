/**
 * Handles event listeners for the configuration editor
 */
export class EditorHandlers {
  /**
   * Attaches all event listeners to the editor
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   * @param {Function} onRender - Callback to trigger re-render
   */
  static attachListeners(element, config, onChange, onRender) {
    this._attachMapProviderListeners(element, config, onChange);
    this._attachBasicConfigListeners(element, config, onChange);
    this._attachBorderRadiusListeners(element, config, onChange);
    this._attachMarkerSizeListener(element, config, onChange);
    this._attachActivitySourceListener(element, config, onChange);
    this._attachSpeedSourceListener(element, config, onChange);
    this._attachEntityListeners(element, config, onChange, onRender);
    this._attachZoneListeners(element, config, onChange, onRender);
    this._attachActivityListeners(element, config, onChange);
  }

  /**
   * Attaches marker size listener
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   */
  static _attachMarkerSizeListener(element, config, onChange) {
    element.querySelector('#marker_size')?.addEventListener('selected', (e) => {
      config.marker_size = e.target.value;
      onChange();
    });
  }

  /**
   * Attaches activity source listener
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   */
  static _attachActivitySourceListener(element, config, onChange) {
    element.querySelector('#activity_source')?.addEventListener('selected', (e) => {
      config.activity_source = e.target.value;
      onChange();
    });
  }

  /**
   * Attaches speed source listener
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   */
  static _attachSpeedSourceListener(element, config, onChange) {
    element.querySelector('#speed_source')?.addEventListener('selected', (e) => {
      config.speed_source = e.target.value;
      onChange();
    });
  }

  /**
   * Attaches map provider listeners
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   */
  static _attachMapProviderListeners(element, config, onChange) {
    element.querySelector('#map_provider')?.addEventListener('selected', (e) => {
      config.map_provider = e.target.value;

      // Show/hide Google Maps fields
      const googleApiKeyRow = element.querySelector('#google-api-key-row');
      const mapTypeRow = element.querySelector('#map-type-row');
      const display = e.target.value === 'google' ? 'block' : 'none';

      if (googleApiKeyRow) googleApiKeyRow.style.display = display;
      if (mapTypeRow) mapTypeRow.style.display = display;

      onChange();
    });

    // Toggle API key visibility
    element.querySelector('#toggle-api-key-visibility')?.addEventListener('click', (e) => {
      const apiKeyField = element.querySelector('#google_api_key');
      const toggleIcon = e.currentTarget.querySelector('ha-icon');

      if (apiKeyField) {
        const isPassword = apiKeyField.getAttribute('type') === 'password';
        apiKeyField.setAttribute('type', isPassword ? 'text' : 'password');
        toggleIcon.setAttribute('icon', isPassword ? 'mdi:eye-off' : 'mdi:eye');
      }
    });
  }

  /**
   * Attaches basic config listeners (API key, map type, zoom, etc.)
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   */
  static _attachBasicConfigListeners(element, config, onChange) {
    element.querySelector('#google_api_key')?.addEventListener('change', (e) => {
      config.google_api_key = e.target.value;
      onChange();
    });

    element.querySelector('#map_type')?.addEventListener('selected', (e) => {
      config.map_type = e.target.value;
      onChange();
    });

    element.querySelector('#default_zoom')?.addEventListener('change', (e) => {
      config.default_zoom = parseInt(e.target.value);
      onChange();
    });

    element.querySelector('#update_interval')?.addEventListener('change', (e) => {
      config.update_interval = parseInt(e.target.value);
      onChange();
    });
  }

  /**
   * Attaches border radius slider listeners
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   */
  static _attachBorderRadiusListeners(element, config, onChange) {
    // Marker border radius
    const markerSlider = element.querySelector('#marker_border_radius');
    const markerValueDisplay = element.querySelector('#marker-radius-value');

    markerSlider?.addEventListener('input', (e) => {
      markerValueDisplay.textContent = e.target.value + '%';
    });

    markerSlider?.addEventListener('change', (e) => {
      config.marker_border_radius = e.target.value + '%';
      onChange();
    });

    // Badge border radius
    const badgeSlider = element.querySelector('#badge_border_radius');
    const badgeValueDisplay = element.querySelector('#badge-radius-value');

    badgeSlider?.addEventListener('input', (e) => {
      badgeValueDisplay.textContent = e.target.value + '%';
    });

    badgeSlider?.addEventListener('change', (e) => {
      config.badge_border_radius = e.target.value + '%';
      onChange();
    });
  }

  /**
   * Attaches entity listeners
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   * @param {Function} onRender - Callback to trigger re-render
   */
  static _attachEntityListeners(element, config, onChange, onRender) {
    // Entity input fields
    element.querySelectorAll('input.entity-input[data-entity-idx]').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.entityIdx);
        const field = e.target.dataset.entityField;

        if (idx < config.entities.length) {
          config.entities[idx][field] = e.target.value || '';
          onChange();
        }
      });
    });

    // Delete entity buttons
    element.querySelectorAll('[data-entity-delete]').forEach(el => {
      el.addEventListener('click', (e) => {
        const button = e.target.closest('ha-icon-button');
        if (button) {
          const idx = parseInt(button.dataset.entityDelete);
          config.entities.splice(idx, 1);
          onRender();
          onChange();
        }
      });
    });

    // Add entity button
    element.querySelector('#add-entity')?.addEventListener('click', () => {
      config.entities.push({ person: '', activity: '', speed: '' });
      onRender();
      onChange();
    });
  }

  /**
   * Attaches zone listeners
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   * @param {Function} onRender - Callback to trigger re-render
   */
  static _attachZoneListeners(element, config, onChange, onRender) {
    // Zone state name inputs
    element.querySelectorAll('input[data-zone-idx][data-zone-field="state"]').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.zoneIdx);
        const zones = Object.entries(config.zones);

        if (idx >= zones.length) return;

        const [oldState, oldConfig] = zones[idx];
        const newValue = e.target.value;

        if (newValue && oldState !== newValue) {
          delete config.zones[oldState];
          config.zones[newValue] = oldConfig;
        }

        onChange();
      });
    });

    // Zone color inputs
    element.querySelectorAll('input[data-zone-idx][data-zone-field="color"]').forEach(el => {
      el.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.zoneIdx);
        const zones = Object.entries(config.zones);

        if (idx >= zones.length) return;

        const [state, zoneConfig] = zones[idx];
        zoneConfig.color = e.target.value;
        onChange();
      });
    });

    // Delete zone buttons
    element.querySelectorAll('[data-zone-delete]').forEach(el => {
      el.addEventListener('click', (e) => {
        const button = e.target.closest('ha-icon-button');
        if (button) {
          const idx = parseInt(button.dataset.zoneDelete);
          const zones = Object.entries(config.zones);
          const [state] = zones[idx];
          delete config.zones[state];
          onRender();
          onChange();
        }
      });
    });

    // Add zone button
    element.querySelector('#add-zone')?.addEventListener('click', () => {
      config.zones[''] = { color: '#757575' };
      onRender();
      onChange();
    });
  }

  /**
   * Attaches activity listeners
   * @param {HTMLElement} element - Root element
   * @param {Object} config - Configuration object
   * @param {Function} onChange - Callback when config changes
   */
  static _attachActivityListeners(element, config, onChange) {
    // Activity color inputs
    element.querySelectorAll('input[data-activity-states]').forEach(el => {
      el.addEventListener('change', (e) => {
        const states = e.target.dataset.activityStates.split(',');
        const newColor = e.target.value;

        // Update color for all states in this group
        states.forEach(state => {
          if (config.activities[state]) {
            config.activities[state].color = newColor;
          }
        });

        onChange();
      });
    });
  }
}
