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

/**
 * Parses a string containing coordinates or a Google Maps URL,
 * and returns latitude and longitude numbers, or null if invalid.
 */
export function parseCoordinates(input: string): { latitude: number; longitude: number } | null {
  if (!input) return null;

  // Regular expression to match lat, lng coordinates
  // Example: 9.9312, 76.2673 or 9.9312,76.2673 or inside a URL like @9.9312,76.2673
  const coordRegex = /([-+]?[0-9]*\.[0-9]+)\s*,\s*([-+]?[0-9]*\.[0-9]+)/;
  
  const match = input.match(coordRegex);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    // Validate range
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }

  return null;
}
