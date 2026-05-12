// Mock NwsAlert data with FIXED timestamps so screenshots are deterministic
// across runs (no diff noise from changing times).
//
// Uses obviously-fake placeholder data — no real event names, locations, or
// severity language that could alarm users.  Matches the card-picker preview
// philosophy from #43.
//
// The "now" anchor is 2025-06-15T20:00:00Z.  The screenshot script injects
// a Date.now override to match, so progress bars render consistently.

export const SCREENSHOT_NOW = Date.UTC(2025, 5, 15, 20, 0, 0); // months are 0-indexed

const now = SCREENSHOT_NOW;
const H = 3600 * 1000;

function iso(offsetMs) {
  return new Date(now + offsetMs).toISOString();
}

export const ALERT_ID_1 = 'urn:oid:2.49.0.1.840.0.screenshot-1';
export const ALERT_ID_2 = 'urn:oid:2.49.0.1.840.0.screenshot-2';
export const ALERT_ID_2B = 'urn:oid:2.49.0.1.840.0.screenshot-2b';
export const ALERT_ID_2C = 'urn:oid:2.49.0.1.840.0.screenshot-2c';
export const ALERT_ID_3 = 'urn:oid:2.49.0.1.840.0.screenshot-3';
export const ALERT_ID_4 = 'urn:oid:2.49.0.1.840.0.screenshot-4';

export const ALERTS = [
  {
    ID: ALERT_ID_1,
    Event: 'Tornado of Compliments',
    Severity: 'Extreme',
    Certainty: 'Observed',
    Urgency: 'Immediate',
    Sent: iso(-2 * H),
    Onset: iso(-2 * H),
    Ends: iso(1.5 * H),
    Expires: iso(1.5 * H),
    Headline: 'SWIRLING WAVE OF KIND WORDS EXPECTED THROUGH THIS AFTERNOON',
    AreaDesc: 'Pleasantville; Sunnyside',
    Description: 'At 1:00 PM, an exciting weather event was observed near Pleasantville, moving northeast at 35 mph.\n\nHazard: Dramatic skies.\n\nSource: Neighborhood watch.\n\nImpact: You might want to grab an umbrella, just in case.',
    Instruction: 'Stay calm and enjoy the show! This is sample data for the card preview. No real action is needed.',
    URL: 'https://example.com/alerts/screenshot-1',
    AffectedZones: ['https://api.weather.gov/zones/county/SAM001'],
    Geocode: { UGC: ['SAM001'], SAME: ['000001'] },
  },
  {
    ID: ALERT_ID_2,
    Event: 'Gusty Wind Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'Gusty Wind Warning issued until 7:00 PM',
    AreaDesc: 'Sampletown County Below 6000 Feet',
    Description: 'Brisk winds expected through this evening. Hats may blow off.\n\nLocations impacted include Sampletown, Demoville, and Testburg.',
    Instruction: 'Hold onto your hat! Secure lightweight outdoor objects. This is sample alert data for demonstration purposes.',
    URL: 'https://example.com/alerts/screenshot-2',
    AffectedZones: ['https://api.weather.gov/zones/county/SAM002'],
    Geocode: { UGC: ['SAM002'], SAME: ['000002'] },
  },
  {
    ID: ALERT_ID_2B,
    Event: 'Gusty Wind Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'Gusty Wind Warning issued until 7:00 PM',
    AreaDesc: 'Demoville And Mockton Counties',
    Description: 'Brisk winds expected through this evening. Hats may blow off.\n\nLocations impacted include Sampletown, Demoville, and Testburg.',
    Instruction: 'Hold onto your hat! Secure lightweight outdoor objects. This is sample alert data for demonstration purposes.',
    URL: 'https://example.com/alerts/screenshot-2b',
    AffectedZones: ['https://api.weather.gov/zones/county/SAM003'],
    Geocode: { UGC: ['SAM003'], SAME: ['000003'] },
  },
  {
    ID: ALERT_ID_2C,
    Event: 'Gusty Wind Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'Gusty Wind Warning issued until 7:00 PM',
    AreaDesc: 'North Testburg County',
    Description: 'Brisk winds expected through this evening. Hats may blow off.\n\nLocations impacted include Sampletown, Demoville, and Testburg.',
    Instruction: 'Hold onto your hat! Secure lightweight outdoor objects. This is sample alert data for demonstration purposes.',
    URL: 'https://example.com/alerts/screenshot-2c',
    AffectedZones: ['https://api.weather.gov/zones/county/SAM004'],
    Geocode: { UGC: ['SAM004'], SAME: ['000004'] },
  },
  {
    ID: ALERT_ID_3,
    Event: 'Snowflake Watch',
    Severity: 'Moderate',
    Certainty: 'Possible',
    Urgency: 'Future',
    Sent: iso(-0.5 * H),
    Onset: iso(2.25 * H),
    Ends: iso(10 * H),
    Expires: iso(10 * H),
    Headline: 'LIGHT FLURRIES AND MILD CHILL POSSIBLE OVERNIGHT',
    AreaDesc: 'Northern Placeholder Mountains',
    Description: 'Total snow accumulations of a dusting to a few inches possible. Winds gusting as high as "pretty breezy".',
    Instruction: 'Travel could be slightly inconvenient. Pack a thermos of cocoa, just to be safe.',
    URL: 'https://example.com/alerts/screenshot-3',
    AffectedZones: ['https://api.weather.gov/zones/forecast/SAM005'],
    Geocode: { UGC: ['SAM005'], SAME: ['000005'] },
  },
];

// Extended set with a Minor alert — used by MeteoAlarm theme screenshots
// to showcase all four awareness level colors.
export const ALERT_MINOR = {
  ID: ALERT_ID_4,
  Event: 'Drizzle Advisory',
  Severity: 'Minor',
  Certainty: 'Possible',
  Urgency: 'Future',
  Sent: iso(-0.25 * H),
  Onset: iso(3 * H),
  Ends: iso(12 * H),
  Expires: iso(12 * H),
  Headline: 'OCCASIONAL LIGHT DRIZZLE POSSIBLE TOMORROW MORNING',
  AreaDesc: 'Greater Exampleville Metro Area',
  Description: 'A slight chance of light drizzle. Puddles may form. Umbrellas optional.',
  Instruction: 'Consider bringing a light jacket. This is sample data for demonstration purposes.',
  URL: 'https://example.com/alerts/screenshot-4',
  AffectedZones: ['https://api.weather.gov/zones/forecast/SAM006'],
  Geocode: { UGC: ['SAM006'], SAME: ['000006'] },
};

export const ALERTS_WITH_MINOR = [...ALERTS, ALERT_MINOR];

// Contrast demo fixture — real NWS event names so getNwsEventColor hits the
// help-map lookup directly (not the pattern-match fallback). Mix chosen to
// walk through every boost tier at its boundary:
//
//   CONTROL              never boosted, saturated on both themes
//     - Tornado Warning       (#FF0000, CR 4.00 white / 4.26 dark)
//
//   DARK-ONLY            dark hues that fail 2.0:1 on the dark card only
//     - Flash Flood Warning   (#8B0000, CR 10.01 / 1.70)
//     - Freeze Warning        (#483D8B, CR 9.07 / 1.88)
//
//   BORDERLINE LIGHT     bright-but-legible hues that USED to boost at the
//                        old 3.0:1 threshold but now pass the tightened
//                        2.0:1 text tier (no boost at all)
//     - Winter Storm Warning  (#FF69B4, CR 2.65 white)
//     - Heat Advisory         (#FF7F50, CR 2.50 white)
//
//   TEXT-ONLY LIGHT      fail the 2.0:1 text tier, pass the 1.3:1 progress
//                        tier → icon/label darken, progress bar keeps raw tint
//     - Severe Thunderstorm Warning (#FFA500, CR 1.97 white)
//     - Wind Advisory               (#D2B48C, CR 1.97 white)
//
//   BOTH TIERS LIGHT     near-invisible on white — fail 1.3:1 too, so the
//                        progress bar gets re-tinted as well
//     - Tornado Watch         (#FFFF00, CR 1.07 white)
//     - Freeze Watch          (#00FFFF, CR 1.25 white)
//
// AreaDesc values are fictional so screenshots read as demos, not real alerts.
function makeContrastAlert(id, event, severity, areaDesc, { certainty = 'Likely', urgency = 'Expected', onsetOffset = -0.5, endsOffset = 5 } = {}) {
  return {
    ID: `urn:oid:${id}`,
    Event: event,
    Severity: severity,
    Certainty: certainty,
    Urgency: urgency,
    Sent: iso(-1 * H),
    Onset: iso(onsetOffset * H),
    Ends: iso(endsOffset * H),
    Expires: iso(endsOffset * H),
    Headline: '',
    AreaDesc: areaDesc,
    Description: 'Sample event for contrast demo.',
    Instruction: 'Sample instruction.',
    URL: `https://example.com/alerts/${id}`,
    AffectedZones: [`https://api.weather.gov/zones/forecast/SAMC-${id}`],
  };
}

const watchTiming = { certainty: 'Possible', urgency: 'Future', onsetOffset: 2, endsOffset: 8 };

export const ALERTS_CONTRAST_DEMO = [
  // control — saturated red, never boosted on either side
  makeContrastAlert('c1', 'Tornado Warning',             'Extreme',  'Control County'),
  // dark-only: dark hues on dark card
  makeContrastAlert('c2', 'Flash Flood Warning',         'Severe',   'Sampletown'),
  makeContrastAlert('c3', 'Freeze Warning',              'Moderate', 'Pleasantville'),
  // borderline light — passes new 2.0:1 threshold, no boost (was boosted at old 3.0:1)
  makeContrastAlert('c4', 'Winter Storm Warning',        'Moderate', 'Demoville'),
  makeContrastAlert('c5', 'Heat Advisory',               'Moderate', 'Sunnyside'),
  // text-only light — text/icon darken, progress keeps raw tint
  makeContrastAlert('c6', 'Severe Thunderstorm Warning', 'Severe',   'Mockton'),
  makeContrastAlert('c7', 'Wind Advisory',               'Minor',    'Testburg'),
  // both tiers light — progress bar also gets re-tinted (watch timing → striped preparation fill)
  makeContrastAlert('c8', 'Tornado Watch',               'Moderate', 'Exampleville', watchTiming),
  makeContrastAlert('c9', 'Freeze Watch',                'Minor',    'Northfield',   watchTiming),
];

// ECCC-format alerts covering all four active color tiers (red/orange/yellow/grey).
// Uses the EcccAlert shape consumed by EcccAdapter: attribution on the entity
// attributes, alerts array with ECCC fields.
export const ECCC_ALERTS = [
  {
    title: 'Rainfall Warning',
    color: 'red',
    type: 'warning',
    impact: 'High',
    confidence: 'High',
    status: 'new',
    alert_code: 'RWW',
    area: 'Sampletown - Demoville',
    issued: new Date(now - 2 * H).toISOString(),
    expiry: new Date(now + 1.5 * H).toISOString(),
    text: 'Heavy rainfall warning in effect. Sample data for demonstration purposes.',
  },
  {
    title: 'Wind Warning',
    color: 'orange',
    type: 'warning',
    impact: 'High',
    confidence: 'High',
    status: 'continued',
    alert_code: 'WW',
    area: 'Mockton County',
    issued: new Date(now - 1 * H).toISOString(),
    expiry: new Date(now + 4 * H).toISOString(),
    text: 'Strong wind warning in effect. Sample data for demonstration purposes.',
  },
  {
    title: 'Winter Storm Watch',
    color: 'yellow',
    type: 'watch',
    impact: 'Medium',
    confidence: 'Moderate',
    status: 'new',
    alert_code: 'WSW',
    area: 'Northern Placeholder Highlands',
    issued: new Date(now - 0.5 * H).toISOString(),
    expiry: new Date(now + 10 * H).toISOString(),
    text: 'Winter storm watch in effect. Sample data for demonstration purposes.',
  },
  {
    title: 'Special Weather Statement',
    color: 'grey',
    type: 'statement',
    impact: 'Low',
    confidence: 'Moderate',
    status: 'new',
    alert_code: 'SWS',
    area: 'Greater Exampleville Region',
    issued: new Date(now - 0.25 * H).toISOString(),
    expiry: new Date(now + 12 * H).toISOString(),
    text: 'Special weather statement in effect. Sample data for demonstration purposes.',
  },
];

// PirateWeather-format duplicates of some NWS alerts (for cross-provider dedup demos).
// Uses the PirateWeather indexed attribute format (title_0, severity_0, etc.)
// with matching event names and expiry times so the card's dedup logic merges them.
export const PIRATE_WEATHER_ATTRS = {
  attribution: 'Powered by Pirate Weather',
  // Duplicate of ALERTS[0] (Tornado of Compliments)
  title_0: ALERTS[0].Event,
  severity_0: ALERTS[0].Severity,
  time_0: ALERTS[0].Sent,
  expires_0: ALERTS[0].Ends,
  regions_0: ['Pleasantville', 'Sunnyside'],
  uri_0: 'https://example.com/pirateweather/screenshot-1',
  description_0: ALERTS[0].Description,
  // Duplicate of ALERTS[1] (Gusty Wind Warning)
  title_1: ALERTS[1].Event,
  severity_1: ALERTS[1].Severity,
  time_1: ALERTS[1].Sent,
  expires_1: ALERTS[1].Ends,
  regions_1: ['Sampletown County'],
  uri_1: 'https://example.com/pirateweather/screenshot-2',
  description_1: ALERTS[1].Description,
  // Unique PirateWeather-only alert (no NWS equivalent)
  title_2: 'Sunshine Heat Advisory',
  severity_2: 'Moderate',
  time_2: iso(-0.75 * H),
  expires_2: iso(6 * H),
  regions_2: ['Greater Exampleville Metro'],
  uri_2: 'https://example.com/pirateweather/screenshot-extra',
  description_2: 'Extended sunshine may cause squinting. Sunglasses recommended.',
};
