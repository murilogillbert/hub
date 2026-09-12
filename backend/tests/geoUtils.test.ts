import { describe, expect, it } from 'vitest';
import { distanceKm } from '../src/domain/geoUtils.js';

describe('geoUtils', () => {
  it('computes distance between two points (Haversine)', () => {
    // São Paulo (Sé) → Rio de Janeiro (Centro), ~360km em linha reta.
    const km = distanceKm(-23.5505, -46.6333, -22.9068, -43.1729);
    expect(km).toBeGreaterThan(350);
    expect(km).toBeLessThan(370);
  });

  it('returns 0 for the same point', () => {
    expect(distanceKm(-23.5505, -46.6333, -23.5505, -46.6333)).toBe(0);
  });
});
