import { describe, it, expect } from 'vitest';
import {
  buildGeometrySvg,
  buildGeometryMap,
  DEFAULT_TILE_URL,
  type Bbox,
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

  it('returns empty polygonPaths for a valid bbox with no geometry', () => {
    const { polygonPaths } = buildGeometrySvg(BBOX);
    expect(polygonPaths).toEqual([]);
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
    const { polygonPaths } = buildGeometrySvg(BBOX, poly);
    expect(polygonPaths).toHaveLength(1);
    expect(polygonPaths[0]).toMatch(/^M/);
    expect(polygonPaths[0]).toMatch(/Z$/);
    // Top-left corner of the box projects to (0, 0): minlon, maxlat.
    expect(polygonPaths[0]).toContain('M0,0');
  });

  it('ignores interior holes — one outer ring per Polygon', () => {
    const poly: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [[-105.3, 39.9], [-105.1, 39.9], [-105.1, 40.1], [-105.3, 39.9]],
        [[-105.25, 39.95], [-105.15, 39.95], [-105.15, 40.05], [-105.25, 39.95]],
      ],
    };
    expect(buildGeometrySvg(BBOX, poly).polygonPaths).toHaveLength(1);
  });

  it('builds one path per polygon for a MultiPolygon', () => {
    const multi: GeoJsonMultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [[[-105.3, 39.9], [-105.2, 39.9], [-105.2, 40.0], [-105.3, 39.9]]],
        [[[-105.2, 40.0], [-105.1, 40.0], [-105.1, 40.1], [-105.2, 40.0]]],
      ],
    };
    expect(buildGeometrySvg(BBOX, multi).polygonPaths).toHaveLength(2);
  });

  it('returns empty paths for an unknown geometry type without throwing', () => {
    const point = { type: 'Point', coordinates: [-105.2, 40.0] } as unknown as GeoJsonGeometry;
    expect(() => buildGeometrySvg(BBOX, point)).not.toThrow();
    expect(buildGeometrySvg(BBOX, point).polygonPaths).toEqual([]);
  });

  it('clamps a degenerate (zero-span) bbox to a non-zero viewBox', () => {
    const degenerate: Bbox = [-105.2, 40.0, -105.2, 40.0];
    const { w, h } = viewBoxDims(buildGeometrySvg(degenerate).viewBox);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('tolerates a Polygon with empty coordinates', () => {
    const empty = { type: 'Polygon', coordinates: [] } as GeoJsonPolygon;
    expect(buildGeometrySvg(BBOX, empty).polygonPaths).toEqual([]);
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
    const { viewBox, aspect, tiles, polygonPaths, attribution } = buildGeometryMap(BBOX);
    const { x, y, w, h } = viewBoxDims(viewBox);
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    expect(aspect).toBe(`${w} / ${h}`);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThanOrEqual(16);
    expect(polygonPaths).toEqual([]); // no geometry → tiles only
    expect(attribution).toMatch(/OpenStreetMap/);
  });

  it('emits default CARTO tile hrefs with z/x/y substituted and z in range', () => {
    const { tiles } = buildGeometryMap(BBOX);
    for (const t of tiles) {
      expect(t.href).toMatch(/^https:\/\/basemaps\.cartocdn\.com\/light_all\/\d+\/\d+\/\d+\.png$/);
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
    const { viewBox, polygonPaths } = buildGeometryMap(BBOX, BBOX_POLY);
    expect(polygonPaths).toHaveLength(1);
    const { w, h } = viewBoxDims(viewBox);
    const nums = pathNumbers(polygonPaths[0]);
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

  it('builds one path per polygon for a MultiPolygon', () => {
    const multi: GeoJsonMultiPolygon = {
      type: 'MultiPolygon',
      coordinates: [
        [[[-105.3, 39.9], [-105.2, 39.9], [-105.2, 40.0], [-105.3, 39.9]]],
        [[[-105.2, 40.0], [-105.1, 40.0], [-105.1, 40.1], [-105.2, 40.0]]],
      ],
    };
    expect(buildGeometryMap(BBOX, multi).polygonPaths).toHaveLength(2);
  });

  it('returns tiles but no paths for unknown geometry', () => {
    const point = { type: 'Point', coordinates: [-94.4, 37.7] } as unknown as GeoJsonGeometry;
    const out = buildGeometryMap(BBOX, point);
    expect(out.polygonPaths).toEqual([]);
    expect(out.tiles.length).toBeGreaterThan(0);
  });

  it('clamps a degenerate bbox without throwing', () => {
    const degenerate: Bbox = [-94.4, 37.7, -94.4, 37.7];
    expect(() => buildGeometryMap(degenerate)).not.toThrow();
    const { w, h } = viewBoxDims(buildGeometryMap(degenerate).viewBox);
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  it('exposes a CORS-friendly default tile URL constant with z/x/y tokens', () => {
    expect(DEFAULT_TILE_URL).toContain('{z}/{x}/{y}');
    expect(DEFAULT_TILE_URL).toContain('cartocdn.com');
  });
});
