# Technical Specification: Map Badge Card Enhanced Features

**Created**: 2025-11-19  
**Planner**: @planner  
**Status**: Draft → Ready for Implementation

## Overview

This technical specification details the implementation of four enhanced features for the Home Assistant Map Badge Card:

1. **Adjustable Marker Size** - Configurable marker presets (small/medium/large) via UI
2. **Speed Calculation** - Real-time speed tracking using position history with Haversine formula
3. **Popup Follow Fix** - Ensure info popups remain anchored to moving markers
4. **Predicted Activity** - Speed-based activity inference as alternative to sensor data

### Objectives

- [ ] Enable users to customize marker appearance with three size presets
- [ ] Calculate and display accurate travel speed in entity popups
- [ ] Fix popup positioning bugs for moving entities across both map providers
- [ ] Provide fallback activity detection based on movement patterns
- [ ] Maintain 100% backward compatibility with existing configurations
- [ ] Ensure consistent behavior across Leaflet and Google Maps providers

### Success Criteria

- [ ] Marker sizes render correctly at 36px, 48px, and 64px dimensions
- [ ] Speed calculations show < 10% error compared to GPS accuracy
- [ ] Popups track marker movement without reposition lag
- [ ] Activity prediction matches documented thresholds (1, 7, 25 km/h)
- [ ] All new configuration options appear in UI editor
- [ ] Existing cards continue functioning without configuration changes
- [ ] Unit test coverage ≥ 80% for new calculation logic
- [ ] Manual testing confirms functionality on both map providers

## Architecture

### Component Structure

```
Map Badge Card System
├── Main Component (map-badge-card.js)
│   └── ConfigManager (config-manager.js)
│       ├── EntityDataFetcher (entity-data-fetcher.js) ← ADD: Speed calc & history
│       ├── IframeMessenger (iframe-messenger.js) ← UPDATE: Pass marker_size
│       └── Editor UI Layer (editor-ui.js, editor-handlers.js) ← UPDATE: New controls
└── Map Renderer (map-badge-v2.html) ← UPDATE: Dynamic sizes, popup tracking
    ├── Leaflet Implementation
    └── Google Maps Implementation
```

### Technology Stack

- **Language**: JavaScript ES6 Modules
- **Framework**: Home Assistant Custom Card (Legacy API)
- **Map Libraries**: Leaflet 1.x, Google Maps JavaScript API
- **Key Algorithms**: Haversine formula for distance calculation
- **Browser APIs**: PostMessage for iframe communication

### Design Patterns

1. **Configuration Cascade**: Default → User Config → Runtime Override
   - Prevents cascading re-renders by batching config updates
   - Maintains backward compatibility with optional fields

2. **Position History Ring Buffer**: Fixed-size array (5 entries) per entity
   - Prevents memory leaks from infinite history growth
   - Provides sufficient data points for accurate speed averaging

3. **Data Transformation Pipeline**: Raw HA State → Cached Entity Data → Map Parameters
   - Centralizes calculation logic in EntityDataFetcher
   - Ensures consistent data format across consumers

4. **Provider Abstraction**: Unified interface for Leaflet/Google Maps
   - Minimizes provider-specific code duplication
   - Enables feature parity across implementations

## Implementation Phases

### Phase 1: Foundation (Data Structures & Configuration)

**Objective**: Establish constants, config validation, and parameter passing infrastructure

**Assigned to**: @coder-mid

**Tasks**:

1. **Update Constants** (`src/constants.js`)
   - Add `MARKER_SIZES` object with small/medium/large presets (marker width, badge size, popup offset)
   - Add `ACTIVITY_THRESHOLDS` object defining speed boundaries (still, walking, cycling, vehicle)
   - Extend `DEFAULT_CONFIG` with `marker_size`, `use_predicted_activity`, `activity_source`
   - **Complexity**: Simple (data definition only)
   - **Dependencies**: None
   - **Deliverables**: Updated constants file with 3 new exports

2. **Update ConfigManager** (`src/config-manager.js`)
   - Extend `setConfig()` to validate and store new marker/activity configuration
   - Add marker_size to `buildIframeParams()` return value
   - Add boolean flag tracking for config change detection
   - **Complexity**: Simple (config pass-through, no logic changes)
   - **Dependencies**: Phase 1.1
   - **Deliverables**: Modified config manager with new parameter handling

### Phase 2: Core Features (Calculation & Rendering)

**Objective**: Implement speed calculation engine and dynamic marker sizing

**Assigned to**: @coder-senior

**Tasks**:

3. **Enhance EntityDataFetcher** (`src/entity-data-fetcher.js`)
   - Add `_positionHistory` Map (entityId → PositionEntry[])
   - Implement `_calculateHaversineDistance()` (returns meters)
   - Implement `calculateSpeed()` (returns {speed_kmh, speed_mph, time_diff})
   - Implement `_updatePositionHistory()` with ring buffer logic (max 5 entries)
   - Implement `predictActivity()` (returns string: 'still', 'walking', 'on_bicycle', 'in_vehicle')
   - Modify `fetchEntities()` to calculate/store speed, update history
   - Modify `prepareEntityData()` to include speed and predicted_activity fields
   - **Complexity**: Medium (requires mathematical accuracy + caching)
   - **Dependencies**: Phase 1.1
   - **Deliverables**: Enhanced data fetcher with calculation methods

4. **Update Map HTML Rendering** (`src/map-badge-v2.html`)
   - Parse `marker_size` URL parameter on load
   - Create CSS variables: `--marker-size`, `--badge-size`, `--popup-offset`
   - Update `.custom-marker-wrapper` CSS to use variables
   - Modify Leaflet icon creation to use dynamic `iconSize`, `iconAnchor`, `popupAnchor`
   - Modify Google Maps `CustomMarker.draw()` to use dynamic dimensions
   - Ensure marker CSS class names remain consistent
   - **Complexity**: Medium (requires CSS/JS synchronization)
   - **Dependencies**: Phase 2.1, Phase 1.2
   - **Deliverables**: Map renderer supporting 3 size presets

### Phase 3: UI Integration (Editor Controls)

**Objective**: Add configuration controls to visual editor

**Assigned to**: @coder-junior

**Tasks**:

5. **Add Marker Size Control** (`src/editor-ui.js`)
   - Extend `_generateAppearanceSection()` with `<ha-select id="marker_size">`
   - Include three `<mwc-list-item>` entries: small (36px), medium (48px), large (64px)
   - Add descriptive helper text below dropdown
   - **Complexity**: Simple (HTML template modification)
   - **Dependencies**: Phase 2.2
   - **Deliverables**: Editor UI with marker size dropdown

6. **Add Activity Source Control** (`src/editor-ui.js`)
   - Extend appearance section with `<ha-select id="activity_source">`
   - Include two options: 'Activity Sensor' and 'Speed-Based Prediction'
   - Add multi-line helper text explaining speed thresholds
   - **Complexity**: Simple (HTML template modification)
   - **Dependencies**: Phase 3.1
   - **Deliverables**: Editor UI with activity source selector

7. **Attach Editor Event Handlers** (`src/editor-handlers.js`)
   - Add `_attachMarkerSizeListener()` method
   - Add `_attachActivitySourceListener()` method
   - Register both in `attachListeners()` call
   - Ensure handlers use `onChange()` callback properly
   - **Complexity**: Simple (event listener pattern)
   - **Dependencies**: Phase 3.2
   - **Deliverables**: Functional UI controls with state management

### Phase 4: Popup & Display Logic

**Objective**: Fix popup anchoring and enhance content with speed data

**Assigned to**: @coder-mid

**Tasks**:

8. **Fix Popup Following Behavior** (`src/map-badge-v2.html`)
   - **Leaflet**: Ensure `marker.update()` called when popup open during position change
   - **Google Maps**: Store InfoWindow reference per marker, call `setPosition()` on update
   - Add position change detection to trigger popup reposition
   - Prevent popup flicker during rapid updates
   - **Complexity**: Medium (requires timing/animation testing)
   - **Dependencies**: Phase 2.2
   - **Deliverables**: Anchored popups that track marker movement

9. **Enhance Popup HTML** (`src/map-badge-v2.html`)
   - Modify `createPopupHTML()` to accept `speedData` parameter
   - Add speed display row with icon when `speedData.speed_kmh !== null`
   - Format speed as "X.X km/h" (one decimal place)
   - Position speed below state, above activity in visual hierarchy
   - **Complexity**: Medium (requires styling + conditional rendering)
   - **Dependencies**: Phase 4.1
   - **Deliverables**: Richer popup content with speed information

10. **Implement Activity Selection Logic** (`src/entity-data-fetcher.js`)
    - Add `_getActivityToUse(data, config)` helper method
    - Respect `config.activity_source` when determining displayed activity
    - Return predicted activity when `speed_predicted` selected and speed exists
    - Fallback to sensor activity otherwise
    - Modify `prepareEntityData()` to use activity selection logic
    - **Complexity**: Simple (conditional logic)
    - **Dependencies**: Phase 4.2
    - **Deliverables**: Configurable activity source behavior

### Phase 5: Integration & Dynamic Updates

**Objective**: Enable runtime config changes and ensure system-wide consistency

**Assigned to**: @coder-mid

**Tasks**:

11. **Extend IframeMessenger** (`src/iframe-messenger.js`)
    - Add `markerSize` parameter to `sendConfigUpdate()`
    - Include marker_size in PostMessage payload
    - Maintain backward compatibility (default to 'medium')
    - **Complexity**: Simple (parameter pass-through)
    - **Dependencies**: Phase 4.3
    - **Deliverables**: Messenger supporting marker size propagation

12. **Update Config Change Detection** (`src/map-badge-card.js`)
    - Add `'marker_size'` to `visualPropsChanged` check array
    - Pass `config.marker_size` to `_messenger.sendConfigUpdate()`
    - Ensure config reload triggers re-render with new marker size
    - **Complexity**: Simple (property tracking)
    - **Dependencies**: Phase 5.1
    - **Deliverables**: Main card component integrated with new features

13. **Handle Runtime Marker Size Changes** (`src/map-badge-v2.html`)
    - Listen for `marker_size` in config-update PostMessage
    - Update CSS variables when new size received
    - Trigger `updateAllMarkers()` to re-render with new dimensions
    - Preserve popup open/close state during re-render toggle
    - **Complexity**: Simple (event handler + batch update)
    - **Dependencies**: Phase 5.2
    - **Deliverables**: Live marker size adjustment without reload

## API Contracts

### Configuration Schema

**Location**: User config passed to `setConfig()`

**New Properties**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `marker_size` | string | No | `'medium'` | Marker preset: 'small', 'medium', 'large' |
| `activity_source` | string | No | `'sensor'` | Activity mode: 'sensor' or 'speed_predicted' |
| `use_predicted_activity` | boolean | No | `false` | (Deprecated) Backward compatibility flag |

**Example Valid Configurations**:

```yaml
# Minimal config (uses defaults)
type: custom:map-badge-card
entities:
  - person: person.john

# Marker size only
type: custom:map-badge-card
marker_size: large
google_api_key: YOUR_KEY

# Full feature set
type: custom:map-badge-card
marker_size: medium
activity_source: speed_predicted
entities:
  - person: person.john
    activity: sensor.john_phone_activity
```

### Iframe Parameters

**Location**: URL query string passed to `map-badge-v2.html`

**New Parameters**:

| Parameter | Type | Example | Description |
|-----------|------|---------|-------------|
| `marker_size` | string | `marker_size=large` | Selected size preset |

**Complete URL Example**:
```
map-badge-v2.html?marker_size=medium&dark_mode=false&theme_color=%23ff9800&...
```

### PostMessage API (Config Updates)

**Location**: Communication from main card to iframe

**Enhanced Message Structure**:

```typescript
interface ConfigUpdateMessage {
  type: 'config-update';
  zones: ZoneConfig[];
  activities: ActivityConfig[];
  marker_border_radius: number;
  badge_border_radius: number;
  marker_size: string;  // NEW: Size preset
  timestamp: number;
}
```

**Sending Example**:
```javascript
// From map-badge-card.js
_messenger.sendConfigUpdate(
  config.zones,
  config.activities,
  config.marker_border_radius,
  config.badge_border_radius,
  config.marker_size  // New parameter
);
```

**Receiving Example**:
```javascript
// In map-badge-v2.html
if (event.data.type === 'config-update') {
  if (event.data.marker_size) {
    applyMarkerSize(event.data.marker_size);
  }
}
```

## Data Models

### Marker Size Presets

**Location**: `src/constants.js`

```javascript
interface MarkerSize {
  marker: number;    // Base marker diameter (pixels)
  badge: number;     // Badge diameter (pixels)
  popupOffset: number; // Popup anchor offset (pixels, negative)
}

export const MARKER_SIZES: Record<string, MarkerSize> = {
  small:  {
    marker: 36,
    badge: 15,
    popupOffset: -52
  },
  medium: {
    marker: 48,
    badge: 20,
    popupOffset: -68
  },
  large:  {
    marker: 64,
    badge: 24,
    popupOffset: -88
  }
};
```

**Usage**: 
- Leaflet: `iconSize = [marker, marker + 14]`
- Google Maps: `div.style.width = marker + 'px'`
- CSS: `--marker-size: ${marker}px`

### Activity Thresholds

**Location**: `src/constants.js`

```javascript
interface ActivityThresholds {
  still: number;     // km/h threshold for "still" (upper bound)
  walking: number;   // km/h threshold for "on_bicycle" (upper bound)
  cycling: number;   // km/h threshold for "in_vehicle" (upper bound)
  vehicle: number;   // km/h threshold for "vehicle" (unused, for parity)
}

export const ACTIVITY_THRESHOLDS: ActivityThresholds = {
  still: 1,      // < 1 km/h → 'still'
  walking: 7,    // 1-7 km/h → 'walking'
  cycling: 25,   // 7-25 km/h → 'on_bicycle'
  vehicle: 25    // > 25 km/h → 'in_vehicle'
};
```

**Activity Mapping**:
```javascript
function predictActivity(speedKmh: number): string {
  if (speedKmh < ACTIVITY_THRESHOLDS.still) return 'still';
  if (speedKmh < ACTIVITY_THRESHOLDS.walking) return 'walking';
  if (speedKmh < ACTIVITY_THRESHOLDS.cycling) return 'on_bicycle';
  return 'in_vehicle';
}
```

### Position History Entry

**Location**: Internal to `EntityDataFetcher`

```typescript
interface PositionEntry {
  latitude: number;
  longitude: number;
  timestamp: number;  // Unix timestamp in milliseconds
}

// Storage structure
private _positionHistory: Map<string, PositionEntry[]>;
```

**History Management**:
- Maximum 5 entries per entity (ring buffer)
- Oldest entries removed automatically
- New entries appended with current timestamp
- Speed calculation requires ≥ 2 entries

### Speed Calculation Result

**Location**: Calculated in `EntityDataFetcher`, passed to map

```typescript
interface SpeedData {
  speed_kmh: number;      // Speed in kilometers per hour
  speed_mph: number;      // Speed in miles per hour
  time_diff: number;      // Time difference in seconds
  distance_m?: number;    // Optional: distance in meters
  accuracy?: number;      // Optional: GPS accuracy if available
}
```

**Calculation Formula**:
```javascript
const distance = haversine(prevLat, prevLon, currLat, currLon); // meters
const timeDiff = (currTime - prevTime) / 1000; // seconds
const speedKmh = (distance / 1000) / (timeDiff / 3600); // km/h
```

### Entity Data Output

**Location**: `EntityDataFetcher.prepareEntityData()` return value

```typescript
interface EntityDataMap {
  [entityId: string]: {
    state: string;
    attributes: {
      friendly_name: string;
      latitude: number;
      longitude: number;
      entity_picture?: string;
      // ... other HA attributes
    };
    activity: string;              // Selected activity ('sensor' or 'speed_predicted')
    speed: SpeedData | null;       // Calculated speed (null if insufficient history)
    predicted_activity: string | null;  // Calculated activity (null if no speed)
    zone: string | null;
    zone_color: string | null;
  };
}
```

**Activity Selection Logic**:
```javascript
const activity = config.activity_source === 'speed_predicted' && speedData
  ? predictActivity(speedData.speed_kmh)
  : sensorActivity;
```

## Testing Requirements

### Unit Tests (Target: 80% coverage)

**Location**: New test files or existing test structure

1. **Haversine Distance Calculation**
   ```javascript
   // Test: Known locations with expected distances
   test('haversine: New York to London', () => {
     const distance = haversine(40.7128, -74.0060, 51.5074, -0.1278);
     expect(distance).toBeCloseTo(5570000, -4); // ~5570km
   });
   
   // Edge: Same location → distance = 0
   // Edge: Antipodal points → half circumference
   ```

2. **Speed Calculation**
   ```javascript
   // Test: Simulated position history
   test('speed: 100m in 10 seconds', () => {
     const history = [
       { lat: 0, lon: 0, timestamp: 0 },
       { lat: 0.0009, lon: 0, timestamp: 10000 } // ~100m north
     ];
     const speed = calculateSpeed('person.test', history[1]);
     expect(speed.speed_kmh).toBeCloseTo(36, 1); // 100m/10s = 36 km/h
   });
   
   // Edge: Single history entry → returns null
   // Edge: Zero time difference → returns null
   // Edge: Negative coordinates → still calculates correctly
   ```

3. **Activity Prediction**
   ```javascript
   // Test: All threshold boundaries
   test('predictActivity: walking threshold', () => {
     expect(predictActivity(0.5)).toBe('still');
     expect(predictActivity(1)).toBe('still');     // Edge case
     expect(predictActivity(1.1)).toBe('walking');
     expect(predictActivity(6.9)).toBe('walking');
     expect(predictActivity(7)).toBe('walking');   // Edge case
     expect(predictActivity(7.1)).toBe('on_bicycle');
     expect(predictActivity(24.9)).toBe('on_bicycle');
     expect(predictActivity(25)).toBe('on_bicycle'); // Edge case
     expect(predictActivity(25.1)).toBe('in_vehicle');
   });
   
   // Edge: Negative speed → should not occur, but handle gracefully
   // Edge: Null/undefined speed → returns null
   ```

4. **Marker Size CSS Application**
   ```javascript
   // Test: CSS variable setting
   test('applyMarkerSize: small preset', () => {
     applyMarkerSize('small');
     expect(document.documentElement.style.getPropertyValue('--marker-size')).toBe('36px');
   });
   
   // Edge: Invalid preset → defaults to medium
   // Edge: Empty string → defaults to medium
   ```

### Integration Tests

**Location**: Test card loading with configuration

1. **Config Propagation Flow**
   ```javascript
   // Test: marker_size flows through entire system
   test('config propagation: marker_size', async () => {
     const config = { marker_size: 'large', /* ... */ };
     card.setConfig(config);
     await card.updateComplete;
     
     // Verify iframe URL contains marker_size=large
     expect(iframe.src).toContain('marker_size=large');
     
     // Verify CSS variable set in iframe
     expect(iframe.contentDocument.documentElement.style.getPropertyValue('--marker-size')).toBe('64px');
   });
   ```

2. **Position History Persistence**
   ```javascript
   // Test: History maintained across multiple updates
   test('position history: 5 updates', async () => {
     const fetcher = new EntityDataFetcher();
     
     // Simulate 5 position updates
     for (let i = 0; i < 5; i++) {
       await fetcher.fetchEntities();
       await sleep(1000);
     }
     
     // Verify history has 5 entries
     const history = fetcher._positionHistory['person.test'];
     expect(history.length).toBe(5);
     
     // 6th update should still have 5 (ring buffer)
     await fetcher.fetchEntities();
     expect(history.length).toBe(5);
   });
   ```

3. **Popup Following Behavior**
   ```javascript
   // Test: Markers + markers move → popup stays anchored
   test('popup following: Leaflet', async () => {
     const marker = createMarkerOSM(entityData);
     marker.bindPopup('Test').openPopup();
     
     const initialPopupPos = marker.getPopup().getLatLng();
     
     // Move marker
     marker.setLatLng([newLat, newLon]);
     marker.update();
     
     const newPopupPos = marker.getPopup().getLatLng();
     expect(newPopupPos.lat).toBeCloseTo(newLat, 6);
     expect(newPopupPos.lng).toBeCloseTo(newLon, 6);
   });
   
   // Repeat for Google Maps with InfoWindow.setPosition()
   ```

4. **Activity Override Logic**
   ```javascript
   // Test: speed_predicted overrides sensor
   test('activity source: speed_predicted', () => {
     const config = { activity_source: 'speed_predicted' };
     const data = {
       activity: { state: 'walking' },
       speed: { speed_kmh: 50 }
     };
     
     const result = entityDataFetcher.prepareEntityData(config);
     expect(result['person.test'].activity).toBe('in_vehicle'); // From speed, not sensor
   });
   ```

### Manual Testing Scenarios

**Environment**: Real Home Assistant instance + mobile device

1. **Marker Size Visualization**
   - [ ] Configure card with `marker_size: small` → verify 36px markers
   - [ ] Configure card with `marker_size: medium` → verify 48px markers (default)
   - [ ] Configure card with `marker_size: large` → verify 64px markers
   - [ ] Test both Leaflet and Google Maps providers
   - [ ] Verify badges scale proportionally within markers
   - [ ] Check popup positioning aligns correctly at all sizes

2. **Speed Calculation Accuracy**
   - [ ] Walk 100m at constant speed, verify calculated speed matches expected
   - [ ] Drive at 50 km/h, verify speed display within ±2 km/h
   - [ ] First card load shows no speed (waiting for history)
   - [ ] After 2+ position updates, speed appears in popup
   - [ ] Check speed updates smoothly (not jumping erratically)

3. **Popup Tracking Behavior**
   - [ ] Open popup, move ~10 meters → popup should move with marker
   - [ ] Rapid movement (driving) → popup stays anchored without lag
   - [ ] Switch between map providers → behavior consistent
   - [ ] Popup close/reopen during movement → re-anchors correctly
   - [ ] No visual flicker or reposition artifacts

4. **Activity Prediction Validation**
   - [ ] Stand still (< 1 km/h) → shows 'still'
   - [ ] Walk slowly (3 km/h) → shows 'walking'
   - [ ] Cycle (15 km/h) → shows 'on_bicycle'
   - [ ] Drive (60 km/h) → shows 'in_vehicle'
   - [ ] Switch between sensor and speed_predicted → activity updates
   - [ ] Speed-based mode works without activity sensor configured

5. **Configuration Editor UX**
   - [ ] Marker size dropdown shows preview text with pixel dimensions
   - [ ] Activity source selector includes helpful threshold explanation
   - [ ] Changes reflect immediately in preview (if available)
   - [ ] Configuration YAML updates correctly when UI changed
   - [ ] Form validation prevents invalid values

6. **Backward Compatibility**
   - [ ] Existing cards without new config options → work unchanged
   - [ ] Default values match previous hardcoded behavior
   - [ ] Migration from old to new config → seamless transition
   - [ ] No console errors or warnings with legacy configurations

### Performance Requirements

- **Speed Calculation**: < 5ms per entity (single haversine calculation)
- **Position History**: Memory < 1KB per entity (5 entries × ~24 bytes)
- **Popup Updates**: < 16ms frame time (60 FPS target)
- **Config Updates**: < 50ms full re-render with new marker size
- **Concurrent Entities**: Tested with 10+ entities without degradation

## Dependencies & Risks

### External Dependencies

- **Home Assistant Frontend**: Must support existing card API
- **Browser Support**: ES6 modules, CSS variables (Chrome 49+, Firefox 31+, Safari 9.1+)
- **Map APIs**: Leaflet (bundled), Google Maps (external API key required)
- **No new runtime dependencies** (Haversine formula self-implemented)

### Internal Dependencies

1. **ConfigManager must be updated before EntityDataFetcher**
   - Reason: Default values required for speed calculation logic
   - Mitigation: Phased implementation with clear ordering

2. **EntityDataFetcher must be complete before Map HTML**
   - Reason: Map renderer consumes speed/speed/predicted_activity fields
   - Mitigation: Phase 2 fully completes before Phase 4 begins

3. **Editor UI must be complete before integration testing**
   - Reason: Manual testing requires UI configuration controls
   - Mitigation: Phase 3 prioritized early in development cycle

### Risk Assessment

#### Risk 1: GPS Jitter Causes Erratic Speed Readings
**Likelihood**: Medium  
**Impact**: Medium (poor user experience)  
**Mitigation**:
- Implement minimum time threshold (5 seconds) between speed calculations
- Average across multiple history points (not just last 2)
- Add GPS accuracy filtering if available in HA attributes
- Display "-- km/h" when accuracy below threshold

#### Risk 2: Google Maps InfoWindow Performance Issues
**Likelihood**: Low  
**Impact**: High (UI freezes during movement)  
**Mitigation**:
- Throttle setPosition() calls to max 4x per second
- Test with 10+ moving markers simultaneously
- Provide fallback to disable auto-follow for power users
- Document performance considerations in README

#### Risk 3: Position History Lost on Iframe Reload
**Likelihood**: High  
**Impact**: Low-Medium (speed unavailable temporarily)  
**Mitigation**:
- Document that history is main-card-scoped, not persisted across reloads
- Reduce iframe reload frequency (already batched in existing code)
- Accept temporary speed unavailability as acceptable UX
- Consider future enhancement: persist history in localStorage

#### Risk 4: Mobile Browser CSS Variable Support
**Likelihood**: Low  
**Impact**: Medium (marker sizing fails on old browsers)  
**Mitigation**:
- Provide JavaScript fallback: direct style manipulation if CSS variables unsupported
- Test on iOS Safari 10+, Android Chrome 50+
- Document minimum browser requirements in README
- Graceful degradation: stick to medium size if feature detection fails

#### Risk 5: Activity Sensor vs Speed Mismatch Confuses Users
**Likelihood**: Medium  
**Impact**: Low (user education issue)  
**Mitigation**:
- Add explicit UI label: "Activity (from speed)" when in predictive mode
- Include configuration helper text explaining thresholds
- Document in README when to use each mode
- Consider debug logging to help users understand selection logic

## Open Questions

1. **Q**: Should speed calculation continue when device is stationary?  
   **A**: Yes, but will return 0 km/h. Helps indicate "still" vs "no data"

2. **Q**: How to handle time sync issues if HA server clock drifts?  
   **A**: Use `state.last_changed` timestamp (UTC from HA), not client time

3. **Q**: Should popup follow be configurable (enable/disable)?  
   **A**: Defer to future enhancement if requested. Current plan: always follow.

4. **Q**: Add imperial (mph) display option?  
   **A**: Calculate both but display km/h only for now. Add config option if users request.

5. **Q**: Persist position history across browser sessions?  
   **A**: Not in scope. History is ephemeral by design (security/privacy consideration).

## Implementation Notes

### Code Quality Standards

- **ESLint**: Maintain existing rules
- **Formatting**: Match existing 2-space indentation, semicolons
- **Comments**: Add JSDoc for new public methods, inline comments for complex calculations
- **Naming**: `camelCase` for variables/functions, `PascalCase` for classes, `UPPER_CASE` for constants

### Performance Optimizations

- **Memoization**: Cache marker size CSS variable values to avoid repeated calculations
- **Batch Updates**: Use requestAnimationFrame for popup position updates if needed
- **Early Returns**: Return early in speed calc if insufficient history (avoid math operations)
- **Object Pooling**: Reuse PositionEntry objects to reduce GC pressure (if many entities)

### Backward Compatibility

- All new config properties optional with sensible defaults
- Default `marker_size: 'medium'` matches current 48px hardcoded size
- Default `activity_source: 'sensor'` preserves existing behavior
- Graceful fallbacks in map renderer if parameters missing
- Existing card configs continue working without changes

### Debugging Support

Add debug logging (respect existing `debugMode` flag):
```javascript
if (this._debugMode) {
  console.log(`[MapBadge] Speed: ${speedKmh.toFixed(1)} km/h for ${entityId}`);
  console.log(`[MapBadge] Activity: ${activity} (source: ${config.activity_source})`);
}
```

### Future Extensibility

- **Marker Size**: Easy to add 'xlarge' preset (just add to MARKER_SIZES)
- **Activity Thresholds**: Could be user-configurable (expose in UI)
- **Speed Calculation**: Could add averaging window configuration
- **Popup Content**: Speed display could be toggled via config

---

## Status Updates

- **2025-11-19**: Technical specification created by @documentator
- **2025-11-19**: Ready for implementation phase (pending coder assignment)
- **Next**: Phase 1 development to begin upon Vexa delegation

**Specification Status**: ✅ **READY FOR IMPLEMENTATION**