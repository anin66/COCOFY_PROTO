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

export function parseCoordinates(input: string, ignoreCamera = false): { latitude: number; longitude: number } | null {
  if (!input) return null;

  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch (e) {
    // Ignore decoding errors
  }

  // 1. Try DMS (Degrees, Minutes, Seconds) coordinate format: e.g. 9°55'52.3"N 76°16'02.3"E
  const dmsRegex = /(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"\s*([NSns])[\s,+/]*(\d+)\s*°\s*(\d+)\s*'\s*([\d.]+)\s*"\s*([EWew])/;
  const dmsMatch = decoded.match(dmsRegex);
  if (dmsMatch) {
    const latDeg = parseFloat(dmsMatch[1]);
    const latMin = parseFloat(dmsMatch[2]);
    const latSec = parseFloat(dmsMatch[3]);
    const latDir = dmsMatch[4].toUpperCase();

    const lngDeg = parseFloat(dmsMatch[5]);
    const lngMin = parseFloat(dmsMatch[6]);
    const lngSec = parseFloat(dmsMatch[7]);
    const lngDir = dmsMatch[8].toUpperCase();

    let latitude = latDeg + latMin / 60 + latSec / 3600;
    if (latDir === "S") latitude = -latitude;

    let longitude = lngDeg + lngMin / 60 + lngSec / 3600;
    if (lngDir === "W") longitude = -longitude;

    if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
      return { latitude, longitude };
    }
  }

  // 2. Try Google Maps internal coordinate format in URL data: !3dLAT!4dLNG
  const googleDataMatch = decoded.match(/!3d([-+]?[0-9]*\.[0-9]+).*?!4d([-+]?[0-9]*\.[0-9]+)/);
  if (googleDataMatch) {
    const lat = parseFloat(googleDataMatch[1]);
    const lng = parseFloat(googleDataMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 3. Try static map center format (e.g., staticmap?center=9.9312%2C76.2673 or staticmap?center=9.9312,76.2673)
  const staticMapMatch = decoded.match(/staticmap\?center=([-+]?[0-9]*\.[0-9]+)(?:%2C|,)([-+]?[0-9]*\.[0-9]+)/i);
  if (staticMapMatch) {
    const lat = parseFloat(staticMapMatch[1]);
    const lng = parseFloat(staticMapMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 4. Try standard comma-separated coordinates NOT prefixed with @ (e.g. in URL path or query params)
  const nonCameraRegex = /(?:^|[^@\d.-])([-+]?[0-9]*\.[0-9]+)\s*,\s*([-+]?[0-9]*\.[0-9]+)/;
  const nonCameraMatch = decoded.match(nonCameraRegex);
  if (nonCameraMatch) {
    const lat = parseFloat(nonCameraMatch[1]);
    const lng = parseFloat(nonCameraMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  // 5. Try standard camera-prefixed coordinates (e.g. /@lat,lng, only if not ignored)
  if (!ignoreCamera) {
    const cameraRegex = /@([-+]?[0-9]*\.[0-9]+)\s*,\s*([-+]?[0-9]*\.[0-9]+)/;
    const cameraMatch = decoded.match(cameraRegex);
    if (cameraMatch) {
      const lat = parseFloat(cameraMatch[1]);
      const lng = parseFloat(cameraMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { latitude: lat, longitude: lng };
      }
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
      const coords = parseCoordinates(content, true);
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
