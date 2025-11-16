/**
 * Manages fetching and caching entity data from Home Assistant
 */
export class EntityDataFetcher {
  constructor(debugMode = false) {
    this._entityCache = {};
    this._debug = debugMode;
    this._hass = null;
    this._entities = [];
  }

  /**
   * Sets the Home Assistant instance
   * @param {Object} hass - Home Assistant instance
   */
  setHass(hass) {
    this._hass = hass;
  }

  /**
   * Sets the entities to fetch
   * @param {Array} entities - Array of entity configurations
   */
  setEntities(entities) {
    this._entities = entities;
  }

  /**
   * Sets debug mode
   * @param {boolean} debug - Debug mode flag
   */
  setDebugMode(debug) {
    this._debug = debug;
  }

  /**
   * Logs debug messages
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  _log(message, ...args) {
    if (this._debug) {
      console.log(`[EntityDataFetcher ${new Date().toISOString()}] ${message}`, ...args);
    }
  }

  /**
   * Fetches entity data from Home Assistant
   * @returns {Promise<Object|null>} Prepared entity data or null if no valid data
   */
  async fetchEntities() {
    if (!this._hass || !this._entities) {
      this._log('Cannot fetch entities: hass or entities not available');
      return null;
    }

    this._log('Fetching entities from hass...');

    let hasValidData = false;

    for (const entityConfig of this._entities) {
      try {
        // Fetch person entity from hass states
        const personState = this._hass.states[entityConfig.person];
        if (!personState) {
          console.error(`[EntityDataFetcher] Entity not found: ${entityConfig.person}`);
          continue;
        }

        // Check for valid GPS data
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
        console.error(`[EntityDataFetcher] Error fetching ${entityConfig.person}:`, error);
      }
    }

    if (!hasValidData) {
      this._log('No valid entity data to return');
      return null;
    }

    return this.prepareEntityData();
  }

  /**
   * Prepares entity data for sending to iframe
   * @returns {Object} Formatted entity data
   */
  prepareEntityData() {
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

  /**
   * Gets the entity cache
   * @returns {Object} Entity cache
   */
  getCache() {
    return this._entityCache;
  }

  /**
   * Checks if cache has data
   * @returns {boolean} True if cache has data
   */
  hasData() {
    return Object.keys(this._entityCache).length > 0;
  }

  /**
   * Gets the timestamp of the most recent cache update
   * @returns {number} Most recent timestamp
   */
  getLastUpdateTime() {
    if (!this.hasData()) return 0;
    return Math.max(...Object.values(this._entityCache).map(e => e.timestamp || 0));
  }
}
