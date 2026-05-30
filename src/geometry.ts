import type { Connection } from 'home-assistant-js-websocket';

// --- GeoJSON types (subset) ---------------------------------------------
// The cap_alerts geometry store only ever emits Polygon / MultiPolygon (its
// CAP parser reads <polygon> elements; circles/points are dropped). We model
// those two explicitly and keep a permissive fallback so an unexpected `type`
// is handled (→ bbox-only frame) rather than rejected at the type level.

export interface GeoJsonPolygon {
  type: 'Polygon';
  // Array of linear rings; ring[0] is the exterior, the rest are holes.
  // Each position is [lon, lat] (GeoJSON order).
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  // Array of polygons; each polygon is an array of linear rings.
  coordinates: number[][][][];
}

export interface GeoJsonOtherGeometry {
  type: string;
  coordinates?: unknown;
}

export type GeoJsonGeometry = GeoJsonPolygon | GeoJsonMultiPolygon | GeoJsonOtherGeometry;

export interface GeoJsonFeature {
  type?: string;
  geometry?: GeoJsonGeometry;
  properties?: Record<string, unknown>;
}

export interface GeoJsonFeatureCollection {
  type?: string;
  features?: GeoJsonFeature[];
}

export type Bbox = [number, number, number, number];

export interface GeometrySvg {
  viewBox: string;
  polygonPaths: string[];
}

/**
 * One-shot WS fetch of an alert's cached geometry. Returns the first feature's
 * geometry, or `null` for any failure mode — 404 / unknown-or-evicted ref /
 * malformed payload — which the caller treats as "draw the bbox frame only".
 * Never rejects, so callers can `await` it without a try/catch.
 */
export async function fetchGeometry(
  conn: Connection,
  ref: string,
): Promise<GeoJsonGeometry | null> {
  try {
    const result = await conn.sendMessagePromise<GeoJsonFeatureCollection>({
      type: 'cap_alerts/geometry',
      geometry_ref: ref,
    });
    const geometry = result?.features?.[0]?.geometry;
    if (!geometry || typeof geometry.type !== 'string') return null;
    return geometry;
  } catch {
    return null;
  }
}

// Smallest span we allow in projected space — guards against a zero/degenerate
// viewBox (single-point bbox or a numerically collapsed axis).
const MIN_SPAN = 1e-4;

/**
 * Projects a bbox (+ optional polygon geometry) into a compact SVG coordinate
 * space and returns the viewBox plus one path `d` per outer ring.
 *
 * Projection: cos-latitude-corrected equirectangular, y-flipped so north is up.
 *   kx = cos(centroidLat)
 *   (lon, lat) → ( (lon - minlon)·kx , maxlat - lat )
 * Pure: no DOM, no Lit, no network. Unknown/absent geometry → empty paths.
 */
export function buildGeometrySvg(bbox: Bbox, geometry?: GeoJsonGeometry | null): GeometrySvg {
  const [minlon, minlat, maxlon, maxlat] = bbox;
  const centroidLat = (minlat + maxlat) / 2;
  const kx = Math.cos((centroidLat * Math.PI) / 180) || MIN_SPAN;

  const width = Math.max((maxlon - minlon) * kx, MIN_SPAN);
  const height = Math.max(maxlat - minlat, MIN_SPAN);
  const viewBox = `0 0 ${fmt(width)} ${fmt(height)}`;

  const project = (lon: number, lat: number): [number, number] => [
    (lon - minlon) * kx,
    maxlat - lat,
  ];

  const polygonPaths = outerRings(geometry)
    .map(ring => ringToPath(ring, project))
    .filter((d): d is string => d !== null);

  return { viewBox, polygonPaths };
}

// Extracts the exterior ring of each polygon. Polygon → its one outer ring;
// MultiPolygon → one outer ring per polygon. Any other type → none.
function outerRings(geometry?: GeoJsonGeometry | null): number[][][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    const rings = (geometry as GeoJsonPolygon).coordinates;
    return Array.isArray(rings) && rings.length > 0 ? [rings[0]] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = (geometry as GeoJsonMultiPolygon).coordinates;
    if (!Array.isArray(polys)) return [];
    return polys
      .map(poly => (Array.isArray(poly) && poly.length > 0 ? poly[0] : null))
      .filter((ring): ring is number[][] => Array.isArray(ring) && ring.length > 0);
  }
  return [];
}

function ringToPath(
  ring: number[][],
  project: (lon: number, lat: number) => [number, number],
): string | null {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let d = '';
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const [x, y] = project(pt[0], pt[1]);
    d += `${i === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`;
  }
  if (!d) return null;
  return `${d}Z`;
}

// Deterministic compact number formatting: round to 5 decimals, trim trailing
// zeros (and a bare trailing dot). Keeps SVG output stable across runs.
function fmt(n: number): string {
  return Number(n.toFixed(5)).toString();
}

// --- Web-Mercator raster-tile basemap (geometryStyle: 'map') ----------------
// Self-rendered slippy-map tiles as <image> elements behind the polygon. Pure:
// computes tile URLs + pixel positions from the bbox; the browser does the
// actual tile loading. Web Mercator (not the 'shape' cos-lat projection) so the
// polygon aligns with the tiles.

// Default basemap = CARTO (the same tiles Home Assistant's own map uses):
// CORS-enabled (access-control-allow-origin:*) and embed-tolerant, unlike
// tile.openstreetmap.org which 403s hotlinked tiles ("Referer required" per its
// usage policy). Light/dark variants for theme matching.
export const DEFAULT_TILE_URL = 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
export const DEFAULT_TILE_URL_DARK = 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
export const DEFAULT_TILE_ATTRIBUTION = '© OpenStreetMap, CARTO';
const TILE_SIZE = 256;
const TARGET_PX = 512;        // fit padded bbox within ~this many px → ≤ ~9 tiles
const MIN_ZOOM = 1;
const MAX_ZOOM = 16;
const MAX_TILES = 16;         // hard safety cap; over → no tiles (frame fallback)
const MERCATOR_LAT = 85.05112878; // Web-Mercator latitude limit
const BBOX_PAD = 0.15;        // fractional bbox padding so the shape isn't flush

export interface MercatorTile {
  href: string;
  x: number;
  y: number;
  size: number;
}

export interface GeometryMap {
  viewBox: string;
  aspect: string;            // "w / h" for CSS aspect-ratio (no letterbox bars)
  tiles: MercatorTile[];
  polygonPaths: string[];
  attribution: string;
}

export interface BuildGeometryMapOptions {
  tileUrl?: string;
  attribution?: string;
}

function clampLat(lat: number): number {
  return Math.max(-MERCATOR_LAT, Math.min(MERCATOR_LAT, lat));
}

// (lon, lat) → world-pixel coords at zoom z (origin top-left, y increases south).
function worldPx(lon: number, lat: number, z: number): [number, number] {
  const n = TILE_SIZE * Math.pow(2, z);
  const x = ((lon + 180) / 360) * n;
  const latRad = (clampLat(lat) * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return [x, y];
}

// Largest zoom whose padded bbox spans ≤ TARGET_PX on both axes (most detail,
// still bounded). Falls back to MIN_ZOOM.
function chooseZoom(minlon: number, minlat: number, maxlon: number, maxlat: number): number {
  for (let z = MAX_ZOOM; z >= MIN_ZOOM; z--) {
    const [x0, yN] = worldPx(minlon, maxlat, z);
    const [x1, yS] = worldPx(maxlon, minlat, z);
    if (x1 - x0 <= TARGET_PX && yS - yN <= TARGET_PX) return z;
  }
  return MIN_ZOOM;
}

function tileHref(template: string, z: number, x: number, y: number): string {
  return template
    .split('{z}').join(String(z))
    .split('{x}').join(String(x))
    .split('{y}').join(String(y))
    .split('{s}').join('a');
}

/**
 * Projects the bbox (+ optional polygon) into Web-Mercator tile space and
 * returns the SVG viewBox, the covering raster tiles, and the polygon paths in
 * that same space. Tiles are bounded; geometry that is absent/unknown yields no
 * paths (tiles + frame still render). Pure — no DOM, no network.
 */
export function buildGeometryMap(
  bbox: Bbox,
  geometry?: GeoJsonGeometry | null,
  opts?: BuildGeometryMapOptions,
): GeometryMap {
  const tileUrl = opts?.tileUrl || DEFAULT_TILE_URL;
  const attribution = opts?.attribution || DEFAULT_TILE_ATTRIBUTION;

  // Pad the bbox so the polygon isn't flush against the edge.
  const [rminlon, rminlat, rmaxlon, rmaxlat] = bbox;
  const lonPad = Math.max((rmaxlon - rminlon) * BBOX_PAD, MIN_SPAN);
  const latPad = Math.max((rmaxlat - rminlat) * BBOX_PAD, MIN_SPAN);
  const minlon = rminlon - lonPad;
  const maxlon = rmaxlon + lonPad;
  const minlat = clampLat(rminlat - latPad);
  const maxlat = clampLat(rmaxlat + latPad);

  const z = chooseZoom(minlon, minlat, maxlon, maxlat);
  const n = Math.pow(2, z);

  const [ox, oyN] = worldPx(minlon, maxlat, z); // NW origin (min x, min y)
  const [ex, eyS] = worldPx(maxlon, minlat, z); // SE corner (max x, max y)
  const w = Math.max(ex - ox, MIN_SPAN);
  const h = Math.max(eyS - oyN, MIN_SPAN);
  const viewBox = `0 0 ${fmt(w)} ${fmt(h)}`;
  const aspect = `${fmt(w)} / ${fmt(h)}`;

  // Covering tiles. x wraps mod n; out-of-range y is skipped.
  const tiles: MercatorTile[] = [];
  const xt0 = Math.floor(ox / TILE_SIZE);
  const xt1 = Math.floor((ex - 1e-6) / TILE_SIZE);
  const yt0 = Math.floor(oyN / TILE_SIZE);
  const yt1 = Math.floor((eyS - 1e-6) / TILE_SIZE);
  if ((xt1 - xt0 + 1) * (yt1 - yt0 + 1) <= MAX_TILES) {
    for (let yt = yt0; yt <= yt1; yt++) {
      if (yt < 0 || yt >= n) continue;
      for (let xt = xt0; xt <= xt1; xt++) {
        const wx = ((xt % n) + n) % n;
        tiles.push({
          href: tileHref(tileUrl, z, wx, yt),
          x: Number((xt * TILE_SIZE - ox).toFixed(3)),
          y: Number((yt * TILE_SIZE - oyN).toFixed(3)),
          size: TILE_SIZE,
        });
      }
    }
  }

  const project = (lon: number, lat: number): [number, number] => {
    const [px, py] = worldPx(lon, lat, z);
    return [px - ox, py - oyN];
  };
  const polygonPaths = outerRings(geometry)
    .map(ring => ringToPath(ring, project))
    .filter((d): d is string => d !== null);

  return { viewBox, aspect, tiles, polygonPaths, attribution };
}
