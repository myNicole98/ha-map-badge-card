/**
 * Default activity configurations
 * Maps activity types from Google/iOS activity detection to icons and friendly names
 */
export const DEFAULT_ACTIVITIES = {
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

/**
 * Marker size presets
 */
export const MARKER_SIZES = {
  small: {
    marker: 36,
    badge: 15,
    popupOffset: -52
  },
  medium: {
    marker: 48,
    badge: 20,
    popupOffset: -68
  },
  large: {
    marker: 64,
    badge: 24,
    popupOffset: -88
  }
};

/**
 * Activity speed thresholds in km/h
 */
export const ACTIVITY_THRESHOLDS = {
  still: 1,
  walking: 7,
  cycling: 25,
  vehicle: 25
};

/**
 * Default zone configurations
 */
export const DEFAULT_ZONES = {
  home: { color: '#cef595' },
  not_home: { color: '#757575' }
};

/**
 * Default card configuration
 */
export const DEFAULT_CONFIG = {
  entities: [],
  map_provider: 'osm',
  google_api_key: '',
  map_type: 'hybrid',
  default_zoom: 13,
  update_interval: 10, // in seconds
  marker_border_radius: '50%',
  badge_border_radius: '50%',
  marker_size: 'medium',
  use_predicted_activity: false,
  activity_source: 'sensor',
  debug: false,
  zones: DEFAULT_ZONES,
  activities: {}
};

/**
 * Activities that should be hidden from the configuration UI
 */
export const HIDDEN_ACTIVITIES = ['Unknown'];
