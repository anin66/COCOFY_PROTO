import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { groupWorkerLocations } from "@/lib/locationUtils";
import { Truck, Users, TreePine, MapPin } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

// Set Mapbox token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

interface WorkerLocation {
  uid: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
}

interface DeliveryTrackingMapProps {
  deliveryLocation?: { latitude: number; longitude: number; heading?: number } | null;
  workerStayLocations?: WorkerLocation[];
  harvestLocation?: Location | null;
  height?: string;
}

export default function DeliveryTrackingMap({
  deliveryLocation,
  workerStayLocations = [],
  harvestLocation,
  height = "450px",
}: DeliveryTrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const deliveryMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const workerMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const harvestMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Group workers to stay locations to de-duplicate stops
  const groupedStops = groupWorkerLocations(workerStayLocations);

  // Helper to create HTML element for custom markers
  const createMarkerElement = (type: "delivery" | "worker" | "harvest", label = "", heading = 0) => {
    const el = document.createElement("div");
    el.className = `custom-map-marker marker-${type}`;
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.width = "40px";
    el.style.height = "40px";
    el.style.borderRadius = "50%";
    el.style.cursor = "pointer";
    el.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)";
    el.style.border = "2px solid #fff";
    el.style.transition = "transform 0.3s ease, border-color 0.3s ease";

    // Styles for premium dark mode aesthetics
    if (type === "delivery") {
      el.style.background = "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)";
      el.style.borderColor = "#60a5fa";
      el.style.boxShadow = "0 0 15px rgba(59,130,246,0.6)";
      el.style.transform = `rotate(${heading}deg)`;
      el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`;
    } else if (type === "worker") {
      el.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
      el.style.borderColor = "#fbbf24";
      el.style.boxShadow = "0 0 15px rgba(245,158,11,0.5)";
      
      // Badge count for multiple workers at same location
      el.innerHTML = `
        <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          ${label ? `<span style="position: absolute; top: -6px; right: -6px; background: red; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; font-weight: bold; display: flex; align-items: center; justify-content: center; border: 1px solid white;">${label}</span>` : ""}
        </div>
      `;
    } else {
      el.style.background = "linear-gradient(135deg, #10b981 0%, #047857 100%)";
      el.style.borderColor = "#34d399";
      el.style.boxShadow = "0 0 15px rgba(16,185,129,0.5)";
      el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
    }

    return el;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use Mapbox Dark Navigation style to match premium COCOFY aesthetics
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/navigation-dark-v1",
      center: [76.2673, 9.9312], // Default Cochin
      zoom: 12,
      attributionControl: false,
    });

    mapRef.current = map;

    // Cleanup on unmount
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers and Route Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous worker markers
    workerMarkersRef.current.forEach((m) => m.remove());
    workerMarkersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    // 1. Add/Update Delivery Marker
    if (deliveryLocation?.latitude && deliveryLocation?.longitude) {
      const lngLat: [number, number] = [deliveryLocation.longitude, deliveryLocation.latitude];
      bounds.extend(lngLat);
      hasPoints = true;

      if (deliveryMarkerRef.current) {
        // Animate position smoothly
        deliveryMarkerRef.current.setLngLat(lngLat);
        const el = deliveryMarkerRef.current.getElement();
        if (el) {
          el.style.transform = `rotate(${deliveryLocation.heading || 0}deg)`;
        }
      } else {
        const el = createMarkerElement("delivery", "", deliveryLocation.heading || 0);
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(lngLat)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div class="map-popup"><h4 style="margin:0;color:black;">Delivery Vehicle</h4><p style="margin:4px 0 0;color:gray;font-size:12px;">Active Tracking</p></div>`
            )
          )
          .addTo(map);
        deliveryMarkerRef.current = marker;
      }
    } else {
      if (deliveryMarkerRef.current) {
        deliveryMarkerRef.current.remove();
        deliveryMarkerRef.current = null;
      }
    }

    // 2. Add Grouped Worker Markers
    groupedStops.forEach((stop) => {
      const lngLat: [number, number] = [stop.longitude, stop.latitude];
      bounds.extend(lngLat);
      hasPoints = true;

      const label = stop.names.length > 1 ? String(stop.names.length) : "";
      const el = createMarkerElement("worker", label);
      
      const popupContent = `
        <div style="color: black; padding: 4px; font-family: sans-serif;">
          <h4 style="margin: 0 0 6px; font-size: 14px;">Pickup Stop</h4>
          <p style="margin: 0 0 4px; font-weight: 600; font-size: 12px; color: #d97706;">
            Workers (${stop.names.length}):
          </p>
          <ul style="margin: 0; padding-left: 16px; font-size: 11px;">
            ${stop.names.map((name) => `<li>${name}</li>`).join("")}
          </ul>
          ${stop.address ? `<p style="margin: 6px 0 0; font-size: 11px; color: #555; border-top: 1px solid #eee; padding-top: 4px;">${stop.address}</p>` : ""}
        </div>
      `;

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(lngLat)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
        .addTo(map);

      workerMarkersRef.current.push(marker);
    });

    // 3. Add Harvest Marker
    if (harvestLocation?.latitude && harvestLocation?.longitude) {
      const lngLat: [number, number] = [harvestLocation.longitude, harvestLocation.latitude];
      bounds.extend(lngLat);
      hasPoints = true;

      if (harvestMarkerRef.current) {
        harvestMarkerRef.current.setLngLat(lngLat);
      } else {
        const el = createMarkerElement("harvest");
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(lngLat)
          .setPopup(
            new mapboxgl.Popup({ offset: 25 }).setHTML(
              `<div style="color:black;"><h4 style="margin:0;">Harvest Location</h4><p style="margin:4px 0 0;font-size:12px;color:gray;">${harvestLocation.address || "Destination"}</p></div>`
            )
          )
          .addTo(map);
        harvestMarkerRef.current = marker;
      }
    } else {
      if (harvestMarkerRef.current) {
        harvestMarkerRef.current.remove();
        harvestMarkerRef.current = null;
      }
    }

    // 4. Fit map bounds to show all markers
    if (hasPoints) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1500 });
    }

    // 5. Fetch Route and draw line
    const fetchRoute = async () => {
      const waypoints: [number, number][] = [];

      // Start: Delivery location (or first worker location if no delivery boy active)
      if (deliveryLocation?.latitude && deliveryLocation?.longitude) {
        waypoints.push([deliveryLocation.longitude, deliveryLocation.latitude]);
      }

      // Middle: Grouped worker stops
      groupedStops.forEach((stop) => {
        waypoints.push([stop.longitude, stop.latitude]);
      });

      // End: Harvest location
      if (harvestLocation?.latitude && harvestLocation?.longitude) {
        waypoints.push([harvestLocation.longitude, harvestLocation.latitude]);
      }

      // We need at least 2 points to draw a route
      if (waypoints.length < 2) {
        if (map.getSource("route")) {
          map.removeLayer("route-glow");
          map.removeLayer("route");
          map.removeSource("route");
        }
        return;
      }

      setRouteLoading(true);

      const coordsStr = waypoints.map((pt) => `${pt[0]},${pt[1]}`).join(";");
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?geometries=geojson&overview=full&access_token=${mapboxgl.accessToken}`;

      try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          const routeGeoJSON = data.routes[0].geometry;

          if (map.getSource("route")) {
            const source = map.getSource("route") as mapboxgl.GeoJSONSource;
            source.setData({
              type: "Feature",
              properties: {},
              geometry: routeGeoJSON,
            });
          } else {
            map.addSource("route", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: routeGeoJSON,
              },
            });

            // Glowing line aesthetic layer
            map.addLayer({
              id: "route-glow",
              type: "line",
              source: "route",
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": "#38bdf8",
                "line-width": 8,
                "line-opacity": 0.35,
              },
            });

            // Core solid routing line
            map.addLayer({
              id: "route",
              type: "line",
              source: "route",
              layout: {
                "line-join": "round",
                "line-cap": "round",
              },
              paint: {
                "line-color": "#0284c7",
                "line-width": 4,
                "line-opacity": 0.9,
              },
            });
          }
        }
      } catch (err) {
        console.error("Error fetching routing details:", err);
      } finally {
        setRouteLoading(false);
      }
    };

    // Make sure map style is loaded before adding layers/sources
    if (map.isStyleLoaded()) {
      fetchRoute();
    } else {
      map.once("style.load", fetchRoute);
    }
  }, [deliveryLocation, workerStayLocations, harvestLocation]);

  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: "16px", overflow: "hidden", border: "1px solid var(--surface-border)" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      {routeLoading && (
        <div style={{
          position: "absolute",
          top: "16px",
          left: "16px",
          background: "rgba(0,0,0,0.85)",
          color: "white",
          padding: "6px 12px",
          borderRadius: "8px",
          fontSize: "12px",
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid var(--surface-border)",
          boxShadow: "0 4px 10px rgba(0,0,0,0.3)"
        }}>
          <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "1.5px" }} />
          <span>OPTIMIZING ROUTE...</span>
        </div>
      )}
    </div>
  );
}
