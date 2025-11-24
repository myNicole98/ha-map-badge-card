import { DEFAULT_ACTIVITIES, DEFAULT_CONFIG } from './constants.js';

/**
 * Manages card configuration, including merging defaults with user config
 */
export class ConfigManager {
  constructor() {
    this._config = null;
  }

  /**
   * Validates and sets the configuration
   * @param {Object} config - User configuration
   * @throws {Error} If entities are not defined or invalid configuration values
   */
  setConfig(config) {
    if (!config.entities || !Array.isArray(config.entities)) {
      throw new Error('You need to define entities');
    }

    // Validate speed_source configuration
    if (config.speed_source && !['calculated', 'sensor'].includes(config.speed_source)) {
      throw new Error(`Invalid speed_source "${config.speed_source}". Must be either 'calculated' or 'sensor'.`);
    }

    // Validate activity_source configuration
    if (config.activity_source && !['sensor', 'speed_predicted'].includes(config.activity_source)) {
      throw new Error(`Invalid activity_source "${config.activity_source}". Must be either 'sensor' or 'speed_predicted'.`);
    }

    const mergedActivities = this._mergeActivities(config.activities);

    this._config = {
      entities: config.entities,
      map_provider: config.map_provider || DEFAULT_CONFIG.map_provider,
      google_api_key: config.google_api_key || DEFAULT_CONFIG.google_api_key,
      map_type: config.map_type || DEFAULT_CONFIG.map_type,
      default_zoom: config.default_zoom || DEFAULT_CONFIG.default_zoom,
      update_interval: config.update_interval || DEFAULT_CONFIG.update_interval,
      marker_border_radius: config.marker_border_radius || DEFAULT_CONFIG.marker_border_radius,
      badge_border_radius: config.badge_border_radius || DEFAULT_CONFIG.badge_border_radius,
      marker_size: config.marker_size || DEFAULT_CONFIG.marker_size,
      use_predicted_activity: config.use_predicted_activity || DEFAULT_CONFIG.use_predicted_activity,
      activity_source: config.activity_source || DEFAULT_CONFIG.activity_source,
      speed_source: config.speed_source || DEFAULT_CONFIG.speed_source,
      zones: config.zones || DEFAULT_CONFIG.zones,
      activities: mergedActivities,
      debug: config.debug || DEFAULT_CONFIG.debug
    };

    return this._config;
  }

  /**
   * Merges user activity colors with default activity icons and names
   * @param {Object} userActivities - User-provided activity configurations
   * @returns {Object} Merged activity configurations
   */
  _mergeActivities(userActivities) {
    const activities = {};

    Object.keys(DEFAULT_ACTIVITIES).forEach(key => {
      activities[key] = {
        icon: DEFAULT_ACTIVITIES[key].icon,
        name: DEFAULT_ACTIVITIES[key].name,
        color: (userActivities && userActivities[key] && userActivities[key].color)
          ? userActivities[key].color
          : DEFAULT_ACTIVITIES[key].color
      };
    });

    return activities;
  }

  /**
   * Checks if specific config properties have changed
   * @param {Object} oldConfig - Previous configuration
   * @param {Array<string>} properties - Properties to check
   * @returns {boolean} True if any property changed
   */
  hasChanged(oldConfig, properties) {
    if (!oldConfig) return false;

    return properties.some(prop => {
      return JSON.stringify(oldConfig[prop]) !== JSON.stringify(this._config[prop]);
    });
  }

  /**
   * Gets the current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return this._config;
  }

  /**
   * Builds URL parameters for the iframe
   * @returns {URLSearchParams} URL parameters
   */
  buildIframeParams() {
    if (!this._config) {
      throw new Error('Configuration not set');
    }

    const params = new URLSearchParams({
      provider: this._config.map_provider,
      apikey: this._config.google_api_key || '',
      maptype: this._config.map_type,
      zoom: this._config.default_zoom,
      mode: 'proxy',
      activity_source: this._config.activity_source,
      speed_source: this._config.speed_source,
      debug: this._config.debug ? '1' : '0'
    });

    // Add entities
    const entitiesParam = this._config.entities
      .map(e => {
        let entityStr = e.person;
        const params = [];
        if (e.activity) params.push(`activity=${e.activity}`);
        if (e.speed) params.push(`speed=${e.speed}`);
        if (params.length > 0) entityStr += ':' + params.join(',');
        return entityStr;
      })
      .join(',');
    params.append('entities', entitiesParam);

    // Add zones (only colors)
    const zonesParam = Object.entries(this._config.zones)
      .map(([state, config]) => `${state}:${encodeURIComponent(config.color)}`)
      .join(',');
    params.append('zones', zonesParam);

    // Add activities
    const activitiesParam = Object.entries(this._config.activities)
      .map(([state, config]) => `${state}:${config.icon}:${encodeURIComponent(config.color)}:${encodeURIComponent(config.name)}`)
      .join(',');
    params.append('activities', activitiesParam);

    // Add border radius
    params.append('marker_radius', encodeURIComponent(this._config.marker_border_radius));
    params.append('badge_radius', encodeURIComponent(this._config.badge_border_radius));
    params.append('marker_size', encodeURIComponent(this._config.marker_size));

    return params;
  }

  /**
   * Gets a stub configuration for initial setup
   * @returns {Object} Stub configuration
   */
  static getStubConfig() {
    return { ...DEFAULT_CONFIG };
  }
}
