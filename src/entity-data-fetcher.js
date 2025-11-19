/**
 * Manages fetching and caching entity data from Home Assistant
 */
import { ACTIVITY_THRESHOLDS } from './constants.js';

export class EntityDataFetcher {
  constructor(debugMode = false) {
    this._entityCache = {};
    this._debug = debugMode;
    this._hass = null;
    this._entities = [];
    this._positionHistory = new Map(); // entityId → PositionEntry[]
    this._lastPredictedActivity = new Map(); // entityId → string (last known predicted activity)
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
   * @param {Object} config - Card configuration
   * @returns {Promise<Object|null>} Prepared entity data or null if no valid data
   */
  async fetchEntities(config) {
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

        // Calculate speed and update position history
        const currentPosition = {
          latitude: personState.attributes.latitude,
          longitude: personState.attributes.longitude,
          timestamp: Date.now()
        };

        const speedData = this.calculateSpeed(entityConfig.person, currentPosition);
        this._updatePositionHistory(entityConfig.person, currentPosition);

        // Store in cache
        this._entityCache[entityConfig.person] = {
          person: personState,
          activity: activityState,
          speed: speedData,
          predicted_activity: speedData ? this.predictActivity(speedData.speed_kmh) : null,
          timestamp: Date.now()
        };

        hasValidData = true;

        this._log(`Cached entity ${entityConfig.person}:`, personState.state,
          'Location:', personState.attributes.latitude, personState.attributes.longitude,
          'Speed:', speedData ? `${speedData.speed_kmh.toFixed(1)} km/h` : 'N/A');
      } catch (error) {
        console.error(`[EntityDataFetcher] Error fetching ${entityConfig.person}:`, error);
      }
    }

    if (!hasValidData) {
      this._log('No valid entity data to return');
      return null;
    }

    return this.prepareEntityData(config);
  }

  /**
   * Determines which activity to use based on configuration
   * @param {Object} data - Entity cache data
   * @param {string} entityId - Entity identifier
   * @param {Object} config - Card configuration
   * @returns {string} Selected activity state
   */
  _getActivityToUse(data, entityId, config) {
    // Safety check for config
    if (!config) {
      this._log(`[Warning] No config provided to _getActivityToUse for ${entityId}. Defaulting to sensor.`);
    }

    // Check if speed-based prediction is enabled
    // We use optional chaining and strict equality to ensure we only enter this block
    // if the user explicitly selected 'speed_predicted'
    if (config?.activity_source === 'speed_predicted') {
      if (data.speed) {
        // Use predicted activity and cache it for sticky behavior
        const predictedActivity = data.predicted_activity || 'unknown';
        this._lastPredictedActivity.set(entityId, predictedActivity);
        this._log(`Activity for ${entityId}: predicted(${predictedActivity}) - speed available`);
        return predictedActivity;
      } else {
        // Speed is null, use sticky last predicted activity if available
        const lastActivity = this._lastPredictedActivity.get(entityId);
        if (lastActivity) {
          this._log(`Activity for ${entityId}: sticky(${lastActivity}) - speed null`);
          return lastActivity;
        }
        // Fallback to unknown if no previous predicted activity
        // IMPORTANT: We return 'unknown' here instead of falling back to sensor
        // because the user explicitly requested speed-based prediction.
        this._log(`Activity for ${entityId}: unknown - speed null, no sticky value`);
        return 'unknown';
      }
    }
    
    // Default to sensor activity if available
    const sensorActivity = data.activity ? data.activity.state : 'unknown';
    this._log(`Activity for ${entityId}: sensor(${sensorActivity})`);
    return sensorActivity;
  }

  /**
   * Prepares entity data for sending to iframe
   * @param {Object} config - Card configuration
   * @returns {Object} Formatted entity data
   */
  prepareEntityData(config) {
    if (!config) {
      console.warn('[EntityDataFetcher] prepareEntityData called without config. Activity prediction may be incorrect.');
    }

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
        activity: this._getActivityToUse(data, entityId, config),
        speed: data.speed || null,
        predicted_activity: data.predicted_activity || null
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

  /**
   * Calculates distance between two coordinates using Haversine formula
   * @param {number} lat1 - First latitude
   * @param {number} lon1 - First longitude
   * @param {number} lat2 - Second latitude
   * @param {number} lon2 - Second longitude
   * @returns {number} Distance in meters
   */
  _calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculates average speed based on position history over available points
   * @param {string} entityId - Entity identifier
   * @param {Object} currentPosition - Current position data
   * @returns {Object|null} Speed data or null if insufficient history
   */
  calculateSpeed(entityId, currentPosition) {
    const history = this._positionHistory.get(entityId) || [];
    
    // Need at least 2 points to calculate speed
    if (history.length < 1) {
      return null;
    }

    let totalDistance = 0;
    let totalTime = 0;
    let pointsUsed = 0;
    
    // Use all available history points to average out GPS jitter
    // Start from the oldest point and work forward to current position
    const startIndex = 0;
    
    // Calculate cumulative distance and time across all history points
    for (let i = startIndex; i < history.length; i++) {
      const point1 = history[i];
      const point2 = i + 1 < history.length ? history[i + 1] : currentPosition;
      
      const distance = this._calculateHaversineDistance(
        point1.latitude,
        point1.longitude,
        point2.latitude,
        point2.longitude
      );
      
      const timeDiff = (point2.timestamp - point1.timestamp) / 1000; // seconds
      
      // Only include valid time intervals to avoid skewing the average
      if (timeDiff > 0) {
        totalDistance += distance;
        totalTime += timeDiff;
        pointsUsed++;
      }
    }
    
    // We need at least some valid time intervals
    if (totalTime < 5) { // Increased from 1 to 5 seconds to reduce GPS jitter
      return null;
    }

    const speedKmh = (totalDistance / 1000) / (totalTime / 3600); // km/h
    const speedMph = speedKmh * 0.621371; // mph

    return {
      speed_kmh: speedKmh,
      speed_mph: speedMph,
      time_diff: totalTime,
      distance_m: totalDistance
    };
  }

  /**
   * Predicts activity based on speed
   * @param {number} speedKmh - Speed in km/h
   * @returns {string|null} Predicted activity or null
   */
  predictActivity(speedKmh) {
    if (speedKmh === null || speedKmh === undefined) {
      return null;
    }

    if (speedKmh < ACTIVITY_THRESHOLDS.still) {
      return 'still';
    } else if (speedKmh < ACTIVITY_THRESHOLDS.walking) {
      return 'walking';
    } else if (speedKmh < ACTIVITY_THRESHOLDS.cycling) {
      return 'on_bicycle';
    } else {
      return 'in_vehicle';
    }
  }

  /**
   * Updates position history for an entity (ring buffer of max 5 entries)
   * @param {string} entityId - Entity identifier
   * @param {Object} position - Current position data
   */
  _updatePositionHistory(entityId, position) {
    if (!this._positionHistory.has(entityId)) {
      this._positionHistory.set(entityId, []);
    }

    const history = this._positionHistory.get(entityId);
    history.push({
      latitude: position.latitude,
      longitude: position.longitude,
      timestamp: position.timestamp
    });

    // Keep only the last 5 entries (ring buffer)
    if (history.length > 5) {
      history.shift();
    }

    this._positionHistory.set(entityId, history);
  }
}
