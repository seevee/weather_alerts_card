import { describe, it, expect } from 'vitest';
import {
  buildGeometrySvg,
  buildGeometryMap,
  framePointsBbox,
  markerPath,
  mapTilesUrl,
  fetchMapTilesToken,
  DEFAULT_TILE_URL,
  DEFAULT_TILE_ATTRIBUTION,
  POINT_FRAME_RADIUS_KM,
  type Bbox,
  type LonLat,
  type GeoJsonPolygon,
  type GeoJsonMultiPolygon,
  type GeoJsonGeometry,
} from '../src/geometry';

// Boulder-ish box: lon-first [minlon, minlat, maxlon, maxlat].
const BBOX: Bbox = [-105.3, 39.9, -105.1, 40.1];

function viewBoxDims(viewBox: string): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = viewBox.split(' ').map(Number);
  return { x, y, w, h };
}

describe('buildGeometrySvg', () => {
  it('projects the bbox into a cos-latitude-corrected, y-up viewBox', () => {
    const { viewBox } = buildGeometrySvg(BBOX);
    const { x, y, w, h } = viewBoxDims(viewBox);
    expect(x).toBe(0);
    expect(y).toBe(0);
    // width = (maxlon - minlon) * cos(centroidLat)
    const kx = Math.cos((40.0 * Math.PI) / 180);
    expect(w).toBeCloseTo(0.2 * kx, 5);
    // height = maxlat - minlat (unscaled)
    expect(h).toBeCloseTo(0.2, 5);
    // cos-lat correction shrinks x relative to y away from the equator
    expect(w).toBeLessThan(h);
  });

  it('returns an empty shapePath for a valid bbox with no geometry', () => {
    const { shapePath } = buildGeometrySvg(BBOX);
    expect(shapePath).toBe('');
  });

  it('builds one path for a Polygon and emits a closed M…Z path', () => {
    const poly: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[
        [-105.3, 39.9],
        [-105.1, 39.9],
        [-105.1, 40.1],
        [-105.3, 40.1],
        [-105.3, 39.9],
      ]],
    };
    const { shapePath } = buildGeometrySvg(BBOX, poly);
    expect(subpaths(shapePath)).toHaveLength(1);
    expect(shapePath).toMatch(/^M/);
    expect(shapePath).toMatch(/Z$/);
    // Top-left corner of the box projects to (0, 0): minlon, maxlat.
    expect(shapePath).toContain('M0,0');
  });

  it('ignores interior holes — one outer ring per Polygon', () => {
    const poly: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [[-105.3, 39.9], [-105.1, 39.9], [-105.1, 40.1], [-105.3, 39.9]],
        [[-105.25, 39.95], [-105.15, 39.95], [-105.15, 40.05], [-105.25, 39.95]],
      ],
    };
    expect(subpaths(buildGeometrySvg(BBOX, poly).shapePath)).toHaveLength(1);
  });

  it('builds one path with one closed subpath per polygon for a MultiPolygon (#348)', () => {
    const multi: GeoJsonMultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [[[-105.3, 39.9], [-105.2, 39.9], [-105.2, 40.0], [-105.3, 39.9]]],
        [[[-105.2, 40.0], [-105.1, 40.0], [-105.1, 40.1], [-105.2, 40.0]]],
      ],
    };
    const { shapePath } = buildGeometrySvg(BBOX, multi);
    expect(subpaths(shapePath)).toHaveLength(2);
    // One `d`, so the card can fill the union once and mask one stroke.
    expect(shapePath).toMatch(/^M[^M]*ZM[^M]*Z$/);
  });

  it('winds every ring the same way so a nonzero fill is the union, not a hole (#348)', () => {
    // The same square, listed clockwise and counter-clockwise.
    const cw: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[[-105.3, 40.1], [-105.1, 40.1], [-105.1, 39.9], [-105.3, 39.9], [-105.3, 40.1]]],
    };
    const ccw: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [[[-105.3, 40.1], [-105.3, 39.9], [-105.1, 39.9], [-105.1, 40.1], [-105.3, 40.1]]],
    };
    const a = buildGeometrySvg(BBOX, cw).shapePath;
    const b = buildGeometrySvg(BBOX, ccw).shapePath;
    expect(pathNumbers(a)).toEqual(pathNumbers(b));
    // Both land on the orientation with positive shoelace area in y-down space.
    expect(shoelace(pathNumbers(a))).toBeGreaterThan(0);
    // Mixed rings in one MultiPolygon come out uniformly wound too.
    const mixed: GeoJsonMultiPolygon = { type: 'MultiPolygon', coordinates: [cw.coordinates, ccw.coordinates] };
    const [first, second] = subpaths(buildGeometrySvg(BBOX, mixed).shapePath);
    expect(shoelace(pathNumbers(first))).toBeGreaterThan(0);
    expect(shoelace(pathNumbers(second))).toBeGreaterThan(0);
  });

  it('returns an empty shapePath for an unknown geometry type without throwing', () => {
    const point = { type: 'Point', coordinates: [-105.2, 40.0] } as unknown as GeoJsonGeometry;
    expect(() => buildGeometrySvg(BBOX, point)).not.toThrow();
    expect(buildGeometrySvg(BBOX, point).shapePath).toBe('');
  });

  it('clamps a degenerate (zero-span) bbox to a non-zero viewBox', () => {
    const degenerate: Bbox = [-105.2, 40.0, -105.2, 40.0];
    const { w, h } = viewBoxDims(buildGeometrySvg(degenerate).viewBox);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('tolerates a Polygon with empty coordinates', () => {
    const empty = { type: 'Polygon', coordinates: [] } as GeoJsonPolygon;
    expect(buildGeometrySvg(BBOX, empty).shapePath).toBe('');
  });

  describe('markers', () => {
    const CENTRE: LonLat = [-105.2, 40.0];

    it('leaves both marker fields undefined when no points are supplied', () => {
      const out = buildGeometrySvg(BBOX);
      expect(out.marker).toBeUndefined();
      expect(out.referenceMarker).toBeUndefined();
      expect('marker' in out).toBe(false);
    });

    it('projects the incident point into the viewBox — the bbox centre lands mid-frame', () => {
      const { viewBox, marker } = buildGeometrySvg(BBOX, undefined, CENTRE);
      const { w, h } = viewBoxDims(viewBox);
      expect(marker?.x).toBeCloseTo(w / 2, 4);
      expect(marker?.y).toBeCloseTo(h / 2, 4);
    });

    it('projects the reference point independently of the incident point', () => {
      const nw: LonLat = [-105.3, 40.1];
      const { marker, referenceMarker } = buildGeometrySvg(BBOX, undefined, CENTRE, nw);
      expect(referenceMarker).toEqual({ x: 0, y: 0 });
      expect(marker).not.toEqual(referenceMarker);
    });

    it('accepts a reference point alone', () => {
      const out = buildGeometrySvg(BBOX, undefined, undefined, CENTRE);
      expect(out.marker).toBeUndefined();
      expect(out.referenceMarker).toBeDefined();
    });

    it('does not clamp a point outside the bbox — it projects past the frame and clips', () => {
      const { viewBox, referenceMarker } = buildGeometrySvg(BBOX, undefined, undefined, [-106, 40.0]);
      expect(referenceMarker!.x).toBeLessThan(0);
      expect(viewBoxDims(viewBox).w).toBeGreaterThan(0);
    });
  });
});

describe('framePointsBbox', () => {
  // Sydney-ish: mid-latitude, so the cos-lat widening is measurable.
  const P: LonLat = [151.2093, -33.8688];

  it('frames a single point in a box whose half-span is the minimum radius', () => {
    const [minlon, minlat, maxlon, maxlat] = framePointsBbox([P]);
    expect((minlon + maxlon) / 2).toBeCloseTo(P[0], 9);
    expect((minlat + maxlat) / 2).toBeCloseTo(P[1], 9);
    // ~20 km tall: 2 × 10 km / 111.32 km per degree.
    expect((maxlat - minlat) * 111.32).toBeCloseTo(2 * POINT_FRAME_RADIUS_KM, 3);
    // Wider in degrees on the lon axis (cos-lat), but the same on the ground.
    expect(maxlon - minlon).toBeGreaterThan(maxlat - minlat);
    const cos = Math.cos((P[1] * Math.PI) / 180);
    expect((maxlon - minlon) * 111.32 * cos).toBeCloseTo(2 * POINT_FRAME_RADIUS_KM, 3);
  });

  it('honours a custom minimum radius', () => {
    const [, minlat, , maxlat] = framePointsBbox([P], 25);
    expect((maxlat - minlat) * 111.32).toBeCloseTo(50, 3);
  });

  it('covers two points ~40 km apart and keeps the minimum half-span on the other axis', () => {
    const west: LonLat = [150.7776, -33.8688]; // ~40 km west of P
    const [minlon, minlat, maxlon, maxlat] = framePointsBbox([P, west]);
    expect(minlon).toBeLessThanOrEqual(west[0]);
    expect(maxlon).toBeGreaterThanOrEqual(P[0]);
    expect(minlat).toBeLessThanOrEqual(P[1]);
    expect(maxlat).toBeGreaterThanOrEqual(P[1]);
    // The lon axis is driven by the spread (≈40 km), not the 10 km floor.
    expect(maxlon - minlon).toBeCloseTo(P[0] - west[0], 9);
    // The lat axis has no spread, so it falls back to the floor.
    expect((maxlat - minlat) * 111.32).toBeCloseTo(2 * POINT_FRAME_RADIUS_KM, 3);
  });

  it('yields a clamped, finite, non-degenerate box near the pole', () => {
    const box = framePointsBbox([[10, 89.9]]);
    for (const n of box) expect(Number.isFinite(n)).toBe(true);
    expect(box[3]).toBeLessThanOrEqual(85.05112878);
    expect(box[3] - box[1]).toBeGreaterThan(0.1);
    expect(box[2] - box[0]).toBeGreaterThan(0);
  });

  it('is a usable frame for both builders (tiles at a town-scale zoom)', () => {
    const box = framePointsBbox([P]);
    const svgOut = buildGeometrySvg(box, undefined, P);
    expect(viewBoxDims(svgOut.viewBox).w).toBeGreaterThan(0);
    expect(svgOut.marker).toBeDefined();
    const mapOut = buildGeometryMap(box, undefined, { point: P });
    expect(mapOut.tiles.length).toBeGreaterThan(0);
    expect(mapOut.tiles.length).toBeLessThanOrEqual(16);
    expect(tileZoom(mapOut.tiles[0].href)).toBe(11);
  });
});

describe('markerPath', () => {
  it('emits a sub-pixel segment (not a zero-length subpath) at the marker', () => {
    expect(markerPath({ x: 1.5, y: 2 })).toBe('M1.5,2l0.0001,0');
  });

  it('is deterministic and rounds to 5 decimals', () => {
    expect(markerPath({ x: 1 / 3, y: 0 })).toBe('M0.33333,0l0.0001,0');
  });
});

// A polygon that fills BBOX, so its projected vertices sit inside the padded
// tile viewBox.
const BBOX_POLY: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [[
    [-105.3, 39.9],
    [-105.1, 39.9],
    [-105.1, 40.1],
    [-105.3, 40.1],
    [-105.3, 39.9],
  ]],
};

// Splits a multi-subpath `d` into its closed "M…Z" pieces.
function subpaths(d: string): string[] {
  return d.match(/M[^M]*Z/g) ?? [];
}

// Shoelace area over a flat [x0, y0, x1, y1, …] list; the sign is the winding.
function shoelace(nums: number[]): number {
  let area = 0;
  const n = nums.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += nums[2 * i] * nums[2 * j + 1] - nums[2 * j] * nums[2 * i + 1];
  }
  return area / 2;
}

function pathNumbers(d: string): number[] {
  return (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
}

// Extract the zoom from a slippy-map href regardless of host/path layout.
function tileZoom(href: string): number {
  const m = href.match(/\/(\d+)\/\d+\/\d+(?:[.@][\w.]+)?$/);
  return m ? Number(m[1]) : NaN;
}

describe('buildGeometryMap', () => {
  it('returns bounded tiles + a valid viewBox/aspect for a bbox alone', () => {
    const { viewBox, aspect, tiles, shapePath, attribution } = buildGeometryMap(BBOX);
    const { x, y, w, h } = viewBoxDims(viewBox);
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    expect(aspect).toBe(`${w} / ${h}`);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(16);
    expect(shapePath).toBe(''); // no geometry → tiles only
    expect(attribution).toMatch(/OpenStreetMap/);
  });

  it('emits proxy-relative tile hrefs with z/x/y substituted and z in range', () => {
    const { tiles } = buildGeometryMap(BBOX);
    for (const t of tiles) {
      expect(t.href).toMatch(/^\/api\/map_tiles\/raster\/\d+\/\d+\/\d+\.png$/);
      expect(t.size).toBe(256);
      const z = tileZoom(t.href);
      expect(z).toBeGreaterThanOrEqual(1);
      expect(z).toBeLessThanOrEqual(16);
    }
  });

  it('honors a custom tileUrl template', () => {
    const { tiles } = buildGeometryMap(BBOX, undefined, {
      tileUrl: 'https://tiles.example.com/{z}/{x}/{y}@2x.png',
    });
    expect(tiles[0].href).toMatch(/^https:\/\/tiles\.example\.com\/\d+\/\d+\/\d+@2x\.png$/);
  });

  it('picks a higher zoom (more detail) for a smaller bbox', () => {
    const small: Bbox = [-94.40, 37.70, -94.38, 37.72];
    const big: Bbox = [-100, 30, -90, 40];
    const zOf = (b: Bbox) => tileZoom(buildGeometryMap(b).tiles[0].href);
    expect(zOf(small)).toBeGreaterThan(zOf(big));
  });

  it('projects the polygon into the tile viewBox (paths inside bounds)', () => {
    const { viewBox, shapePath } = buildGeometryMap(BBOX, BBOX_POLY);
    expect(subpaths(shapePath)).toHaveLength(1);
    const { w, h } = viewBoxDims(viewBox);
    const nums = pathNumbers(shapePath);
    for (let i = 0; i < nums.length; i += 2) {
      const px = nums[i];
      const py = nums[i + 1];
      // bbox sits inside the padded tile viewBox, so every vertex is interior.
      expect(px).toBeGreaterThanOrEqual(0);
      expect(px).toBeLessThanOrEqual(w);
      expect(py).toBeGreaterThanOrEqual(0);
      expect(py).toBeLessThanOrEqual(h);
    }
  });

  it('builds one path with one subpath per polygon for a MultiPolygon', () => {
    const multi: GeoJsonMultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [[[-105.3, 39.9], [-105.2, 39.9], [-105.2, 40.0], [-105.3, 39.9]]],
        [[[-105.2, 40.0], [-105.1, 40.0], [-105.1, 40.1], [-105.2, 40.0]]],
      ],
    };
    expect(subpaths(buildGeometryMap(BBOX, multi).shapePath)).toHaveLength(2);
  });

  it('returns tiles but an empty path for unknown geometry', () => {
    const point = { type: 'Point', coordinates: [-94.4, 37.7] } as unknown as GeoJsonGeometry;
    const out = buildGeometryMap(BBOX, point);
    expect(out.shapePath).toBe('');
    expect(out.tiles.length).toBeGreaterThan(0);
  });

  it('clamps a degenerate bbox without throwing', () => {
    const degenerate: Bbox = [-94.4, 37.7, -94.4, 37.7];
    expect(() => buildGeometryMap(degenerate)).not.toThrow();
    const { w, h } = viewBoxDims(buildGeometryMap(degenerate).viewBox);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('projects incident + reference points into tile space, inside the viewBox', () => {
    const point: LonLat = [-105.2, 40.0];
    const ref: LonLat = [-105.25, 40.05];
    const { viewBox, marker, referenceMarker } = buildGeometryMap(BBOX, undefined, { point, referencePoint: ref });
    const { w, h } = viewBoxDims(viewBox);
    for (const m of [marker!, referenceMarker!]) {
      expect(m.x).toBeGreaterThan(0);
      expect(m.x).toBeLessThan(w);
      expect(m.y).toBeGreaterThan(0);
      expect(m.y).toBeLessThan(h);
    }
    // North-west of the incident ⇒ smaller x and smaller y (y grows south).
    expect(referenceMarker!.x).toBeLessThan(marker!.x);
    expect(referenceMarker!.y).toBeLessThan(marker!.y);
  });

  it('omits marker fields when no points are supplied', () => {
    const out = buildGeometryMap(BBOX);
    expect('marker' in out).toBe(false);
    expect('referenceMarker' in out).toBe(false);
  });

  it('defaults to the HA map_tiles proxy and credits OSM contributors', () => {
    expect(DEFAULT_TILE_URL).toContain('{z}/{x}/{y}');
    expect(DEFAULT_TILE_URL).toContain('/api/map_tiles/raster/');
    expect(DEFAULT_TILE_ATTRIBUTION).toBe('© OpenStreetMap contributors');
  });
});

describe('mapTilesUrl', () => {
  it('builds the base-plus-token template and keeps z/x/y tokens', () => {
    const url = mapTilesUrl('http://homeassistant.local:8123', 'abc123');
    expect(url).toBe('http://homeassistant.local:8123/api/map_tiles/raster/{z}/{x}/{y}.png?token=abc123');
    const { tiles } = buildGeometryMap(BBOX, undefined, { tileUrl: url });
    expect(tiles[0].href).toMatch(/^http:\/\/homeassistant\.local:8123\/api\/map_tiles\/raster\/\d+\/\d+\/\d+\.png\?token=abc123$/);
  });

  it('strips a trailing slash from the base and falls back to a relative path', () => {
    expect(mapTilesUrl('https://example.ui.nabu.casa/', 't')).toBe(
      'https://example.ui.nabu.casa/api/map_tiles/raster/{z}/{x}/{y}.png?token=t',
    );
    expect(mapTilesUrl(undefined, 't')).toBe('/api/map_tiles/raster/{z}/{x}/{y}.png?token=t');
  });

  it('URL-encodes the token', () => {
    expect(mapTilesUrl('', 'a b&c')).toContain('?token=a%20b%26c');
  });
});

describe('fetchMapTilesToken', () => {
  const conn = (impl: (msg: { type: string }) => Promise<unknown>) =>
    ({ sendMessagePromise: impl } as unknown as Parameters<typeof fetchMapTilesToken>[0]);

  it('sends map_tiles/access_token and returns the token', async () => {
    const seen: string[] = [];
    const token = await fetchMapTilesToken(conn(async (msg) => {
      seen.push(msg.type);
      return { token: 'deadbeef' };
    }));
    expect(seen).toEqual(['map_tiles/access_token']);
    expect(token).toBe('deadbeef');
  });

  it('resolves null (never rejects) on an unknown command or a malformed reply', async () => {
    await expect(fetchMapTilesToken(conn(async () => { throw new Error('unknown_command'); })))
      .resolves.toBeNull();
    await expect(fetchMapTilesToken(conn(async () => ({})))).resolves.toBeNull();
    await expect(fetchMapTilesToken(conn(async () => ({ token: '' })))).resolves.toBeNull();
  });
});
