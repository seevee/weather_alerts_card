// Mock NwsAlert data with timestamps relative to now so progress bars always
// show a realistic in-progress state regardless of when the script runs.

const now = Date.now();
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
    Event: 'Tornado Warning',
    Severity: 'Extreme',
    Certainty: 'Observed',
    Urgency: 'Immediate',
    Sent: iso(-2 * H),
    Onset: iso(-2 * H),
    Ends: iso(1 * H),
    Expires: iso(1 * H),
    Headline: 'Tornado Warning issued for Larimer County until 3:00 PM MDT',
    AreaDesc: 'Larimer; Boulder',
    Description: 'At 1:00 PM MDT, a confirmed tornado was located near Fort Collins, moving northeast at 35 mph.\n\nHazard: Damaging tornado.\n\nSource: Law enforcement.\n\nImpact: Flying debris will be dangerous to those caught without shelter. Mobile homes will be damaged or destroyed.',
    Instruction: 'TAKE COVER NOW! Move to a basement or an interior room on the lowest floor of a sturdy building. Avoid windows. If you are outdoors, in a mobile home, or in a vehicle, move to the closest substantial shelter and protect yourself from flying debris.',
    URL: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.screenshot-1',
    AffectedZones: ['https://api.weather.gov/zones/county/COC059'],
    Geocode: { UGC: ['COC059'], SAME: ['008069'] },
  },
  {
    ID: ALERT_ID_2,
    Event: 'High Wind Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'High Wind Warning issued until 7:00 PM MDT',
    AreaDesc: 'Larimer County Below 6000 Feet/Northwest Weld County',
    Description: 'Southwest winds 45 to 55 mph with gusts up to 75 mph expected through this evening.\n\nLocations impacted include Fort Collins, Loveland, Estes Park, and Red Feather Lakes.',
    Instruction: 'Winds this strong can make driving difficult, especially for high profile vehicles. Secure outdoor objects. Use extra caution near trees and power lines.',
    URL: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.screenshot-2',
    AffectedZones: ['https://api.weather.gov/zones/county/COC059'],
    Geocode: { UGC: ['COC059'], SAME: ['008069'] },
  },
  {
    ID: ALERT_ID_2B,
    Event: 'High Wind Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'High Wind Warning issued until 7:00 PM MDT',
    AreaDesc: 'Boulder And Jefferson Counties Below 6000 Feet/West Broomfield County',
    Description: 'Southwest winds 45 to 55 mph with gusts up to 75 mph expected through this evening.\n\nLocations impacted include Fort Collins, Loveland, Estes Park, and Red Feather Lakes.',
    Instruction: 'Winds this strong can make driving difficult, especially for high profile vehicles. Secure outdoor objects. Use extra caution near trees and power lines.',
    URL: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.screenshot-2b',
    AffectedZones: ['https://api.weather.gov/zones/county/COC013'],
    Geocode: { UGC: ['COC013'], SAME: ['008013'] },
  },
  {
    ID: ALERT_ID_2C,
    Event: 'High Wind Warning',
    Severity: 'Severe',
    Certainty: 'Likely',
    Urgency: 'Expected',
    Sent: iso(-1 * H),
    Onset: iso(-1 * H),
    Ends: iso(4 * H),
    Expires: iso(4 * H),
    Headline: 'High Wind Warning issued until 7:00 PM MDT',
    AreaDesc: 'North Douglas County Below 6000 Feet',
    Description: 'Southwest winds 45 to 55 mph with gusts up to 75 mph expected through this evening.\n\nLocations impacted include Fort Collins, Loveland, Estes Park, and Red Feather Lakes.',
    Instruction: 'Winds this strong can make driving difficult, especially for high profile vehicles. Secure outdoor objects. Use extra caution near trees and power lines.',
    URL: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.screenshot-2c',
    AffectedZones: ['https://api.weather.gov/zones/county/COC035'],
    Geocode: { UGC: ['COC035'], SAME: ['008035'] },
  },
  {
    ID: ALERT_ID_3,
    Event: 'Winter Storm Watch',
    Severity: 'Moderate',
    Certainty: 'Possible',
    Urgency: 'Future',
    Sent: iso(-0.5 * H),
    Onset: iso(2 * H),
    Ends: iso(10 * H),
    Expires: iso(10 * H),
    Headline: 'Winter Storm Watch issued from this evening through tomorrow morning',
    AreaDesc: 'Northern Colorado Mountains',
    Description: 'Total snow accumulations of 6 to 12 inches possible above 9000 feet. Winds gusting as high as 45 mph.',
    Instruction: 'Travel could be very difficult. If you must travel, keep an extra flashlight, food, and water in your vehicle in case of an emergency.',
    URL: 'https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.screenshot-3',
    AffectedZones: ['https://api.weather.gov/zones/forecast/COZ039'],
    Geocode: { UGC: ['COZ039'], SAME: ['008069'] },
  },
];
