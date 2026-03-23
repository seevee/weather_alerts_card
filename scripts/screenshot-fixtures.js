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

export const ALERTS = [
  {
    ID: ALERT_ID_1,
    Event: 'Thunderboom Advisory',
    Severity: 'Extreme',
    Certainty: 'Observed',
    Urgency: 'Immediate',
    Sent: iso(-2 * H),
    Onset: iso(-2 * H),
    Ends: iso(1.5 * H),
    Expires: iso(1.5 * H),
    Headline: 'Thunderboom Advisory issued for Pleasantville until 3:30 PM',
    AreaDesc: 'Pleasantville; Sunnyside',
    Description: 'At 1:00 PM, an exciting weather event was observed near Pleasantville, moving northeast at 35 mph.\n\nHazard: Dramatic skies.\n\nSource: Neighborhood watch.\n\nImpact: You might want to grab an umbrella, just in case.',
    Instruction: 'Stay calm and enjoy the show! This is sample data for the card preview. No real action is needed.',
    URL: 'https://example.com/alerts/screenshot-1',
    AffectedZones: ['https://api.weather.gov/zones/county/SAM001'],
    Geocode: { UGC: ['SAM001'], SAME: ['000001'] },
  },
  {
    ID: ALERT_ID_2,
    Event: 'Gusty Breeze Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'Gusty Breeze Warning issued until 7:00 PM',
    AreaDesc: 'Sampletown County Below 6000 Feet',
    Description: 'Brisk winds expected through this evening. Hats may blow off.\n\nLocations impacted include Sampletown, Demoville, and Testburg.',
    Instruction: 'Hold onto your hat! Secure lightweight outdoor objects. This is sample alert data for demonstration purposes.',
    URL: 'https://example.com/alerts/screenshot-2',
    AffectedZones: ['https://api.weather.gov/zones/county/SAM002'],
    Geocode: { UGC: ['SAM002'], SAME: ['000002'] },
  },
  {
    ID: ALERT_ID_2B,
    Event: 'Gusty Breeze Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'Gusty Breeze Warning issued until 7:00 PM',
    AreaDesc: 'Demoville And Mockton Counties',
    Description: 'Brisk winds expected through this evening. Hats may blow off.\n\nLocations impacted include Sampletown, Demoville, and Testburg.',
    Instruction: 'Hold onto your hat! Secure lightweight outdoor objects. This is sample alert data for demonstration purposes.',
    URL: 'https://example.com/alerts/screenshot-2b',
    AffectedZones: ['https://api.weather.gov/zones/county/SAM003'],
    Geocode: { UGC: ['SAM003'], SAME: ['000003'] },
  },
  {
    ID: ALERT_ID_2C,
    Event: 'Gusty Breeze Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'Gusty Breeze Warning issued until 7:00 PM',
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
    Headline: 'Snowflake Watch issued from this evening through tomorrow morning',
    AreaDesc: 'Northern Placeholder Mountains',
    Description: 'Total snow accumulations of a dusting to a few inches possible. Winds gusting as high as "pretty breezy".',
    Instruction: 'Travel could be slightly inconvenient. Pack a thermos of cocoa, just to be safe.',
    URL: 'https://example.com/alerts/screenshot-3',
    AffectedZones: ['https://api.weather.gov/zones/forecast/SAM005'],
    Geocode: { UGC: ['SAM005'], SAME: ['000005'] },
  },
];
