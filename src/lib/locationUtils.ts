/**
 * Calculates the Haversine distance in kilometers between two coordinates.
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface WorkerLocation {
  uid: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

interface GroupedStop {
  latitude: number;
  longitude: number;
  names: string[];
  address?: string;
}

/**
 * Groups multiple coordinates (e.g. workers staying in the same room/house)
 * if they are within a certain threshold (e.g., 150 meters).
 */
export function groupWorkerLocations(
  workers: WorkerLocation[],
  maxDistanceKm = 0.15
): GroupedStop[] {
  const groups: GroupedStop[] = [];

  workers.forEach((w) => {
    let merged = false;
    for (let group of groups) {
      if (getDistanceKm(w.latitude, w.longitude, group.latitude, group.longitude) < maxDistanceKm) {
        // Average coordinates to find central point, add name
        const count = group.names.length;
        group.latitude = (group.latitude * count + w.latitude) / (count + 1);
        group.longitude = (group.longitude * count + w.longitude) / (count + 1);
        group.names.push(w.name);
        if (w.address && !group.address) {
          group.address = w.address;
        }
        merged = true;
        break;
      }
    }
    if (!merged) {
      groups.push({
        latitude: w.latitude,
        longitude: w.longitude,
        names: [w.name],
        address: w.address || "Worker Stay Location",
      });
    }
  });

  return groups;
}

export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  if (!input) return null;

  // 1. Try Google Maps internal coordinate format in URL data: !3dLAT!4dLNG
  const googleDataMatch = input.match(/!3d([-+]?[0-9]*\.[0-9]+).*?!4d([-+]?[0-9]*\.[0-9]+)/);
  if (googleDataMatch) {
    const lat = parseFloat(googleDataMatch[1]);
    const lng = parseFloat(googleDataMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 2. Try static map center format (e.g., staticmap?center=9.9312%2C76.2673 or staticmap?center=9.9312,76.2673)
  const staticMapMatch = input.match(/staticmap\?center=([-+]?[0-9]*\.[0-9]+)(?:%2C|,)([-+]?[0-9]*\.[0-9]+)/i);
  if (staticMapMatch) {
    const lat = parseFloat(staticMapMatch[1]);
    const lng = parseFloat(staticMapMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 3. Try standard comma-separated coordinates or URL coordinates (e.g. 9.9312,76.2673 or @9.9312,76.2673)
  const coordRegex = /([-+]?[0-9]*\.[0-9]+)\s*,\s*([-+]?[0-9]*\.[0-9]+)/;
  const match = input.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}

/**
 * Safely extracts coordinates from Google Maps HTML page content.
 * Instead of searching the raw HTML globally (which might match random JS numbers),
 * it scans specific meta tags or static maps center parameters.
 */
export function extractCoordinatesFromHtml(html: string): { latitude: number; longitude: number } | null {
  if (!html) return null;

  // 1. Scan content attributes of meta tags (e.g. og:url, og:image)
  const metaRegex = /<meta[^>]+content=["']([^"']+)["']/g;
  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    const content = match[1];
    if (content.startsWith("http") || content.includes("maps")) {
      const coords = parseCoordinates(content);
      if (coords) return coords;
    }
  }

  // 2. Scan for static maps center parameters
  const staticMapMatch = html.match(/staticmap\?center=([-+]?[0-9]*\.[0-9]+)(?:%2C|,)([-+]?[0-9]*\.[0-9]+)/i);
  if (staticMapMatch) {
    const lat = parseFloat(staticMapMatch[1]);
    const lng = parseFloat(staticMapMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}
