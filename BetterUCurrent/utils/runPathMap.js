/**
 * Parse and normalize GPS paths for MapView (runs, walks, bikes).
 * Handles JSON strings, lat/lng aliases, and invalid points.
 */

export function normalizeRunPathPoint(point) {
  if (!point || typeof point !== 'object') return null;

  const lat = point.latitude ?? point.lat;
  const lng = point.longitude ?? point.lng ?? point.lon;

  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { latitude: lat, longitude: lng };
}

export function parseRunPath(pathInput) {
  if (pathInput == null) return [];

  let raw = pathInput;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      raw = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(raw)) return [];

  return raw.map(normalizeRunPathPoint).filter(Boolean);
}

export function downsampleRunPath(coordinates, maxPoints = 200) {
  if (!Array.isArray(coordinates) || coordinates.length <= maxPoints) {
    return coordinates || [];
  }

  const step = Math.ceil(coordinates.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < coordinates.length; i += step) {
    sampled.push(coordinates[i]);
  }
  const last = coordinates[coordinates.length - 1];
  const tail = sampled[sampled.length - 1];
  if (tail?.latitude !== last?.latitude || tail?.longitude !== last?.longitude) {
    sampled.push(last);
  }
  return sampled;
}

export function calculateRunMapRegion(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) return null;

  const lats = coordinates.map((c) => c.latitude);
  const lngs = coordinates.map((c) => c.longitude);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;
  const latDelta = Math.max((maxLat - minLat) * 1.2, 0.01);
  const lngDelta = Math.max((maxLng - minLng) * 1.2, 0.01);

  return {
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export function hasDrawableRunPath(pathInput, minPoints = 2) {
  return parseRunPath(pathInput).length >= minPoints;
}
