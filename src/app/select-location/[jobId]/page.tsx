"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import mapboxgl from "mapbox-gl";
import { MapPin, Search, CheckCircle2, Navigation, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import "mapbox-gl/dist/mapbox-gl.css";

const rawToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
mapboxgl.accessToken = rawToken.replace(/^["']|["']$/g, "");

interface JobData {
  customerName?: string;
  date?: string;
  time?: string;
  location?: string;
  locationToken?: string;
  harvestLocation?: {
    address: string;
    latitude: number;
    longitude: number;
  };
}

export default function CustomerLocationPicker() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const jobId = params.jobId as string;
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<JobData | null>(null);
  const [authError, setAuthError] = useState(false);
  const [address, setAddress] = useState("");
  
  // Geolocation & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Map & Marker states
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 10.9834, lng: 76.4232 }); // default Kerala/Palakkad
  
  // Submit states
  const [submitting, setSubmitting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Fetch job details and validate token
  useEffect(() => {
    if (!jobId || !token) {
      setAuthError(true);
      setLoading(false);
      return;
    }

    const fetchJobAndValidate = async () => {
      try {
        const docRef = doc(db, "jobs", jobId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          setAuthError(true);
          setLoading(false);
          return;
        }

        const data = snap.data() as JobData;

        // Check if the URL token matches the stored token
        if (!data.locationToken || data.locationToken !== token) {
          setAuthError(true);
          setLoading(false);
          return;
        }

        setJob(data);
        if (data.harvestLocation) {
          setAddress(data.harvestLocation.address || "");
          setCoords({
            lat: data.harvestLocation.latitude,
            lng: data.harvestLocation.longitude,
          });
        } else {
          setAddress(data.location || "");
        }
      } catch (err) {
        console.error("Error loading job details:", err);
        setAuthError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchJobAndValidate();
  }, [jobId, token]);

  // Initialize Map once Job details are successfully loaded
  useEffect(() => {
    if (loading || authError || !mapContainerRef.current || mapRef.current) return;

    // Default Cochin if no coordinates
    const startCoords: [number, number] = coords ? [coords.lng, coords.lat] : [76.2673, 9.9312];

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: startCoords,
      zoom: 14,
      attributionControl: false,
    });

    mapRef.current = map;

    // Create custom pin element
    const el = document.createElement("div");
    el.style.width = "38px";
    el.style.height = "38px";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.background = "linear-gradient(135deg, #ff9900 0%, #ff5e00 100%)";
    el.style.borderRadius = "50%";
    el.style.border = "3px solid white";
    el.style.boxShadow = "0 0 15px rgba(255, 153, 0, 0.6)";
    el.style.cursor = "grab";
    el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

    const marker = new mapboxgl.Marker({
      element: el,
      draggable: true,
    })
      .setLngLat(startCoords)
      .addTo(map);

    markerRef.current = marker;

    // Event listener when marker is dragged
    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      setCoords({ lat: lngLat.lat, lng: lngLat.lng });
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [loading, authError]);

  // Request browser geolocation to center map on current device location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.", "error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newCoords: [number, number] = [longitude, latitude];

        setCoords({ lat: latitude, lng: longitude });

        if (mapRef.current) {
          mapRef.current.flyTo({ center: newCoords, zoom: 16 });
        }
        if (markerRef.current) {
          markerRef.current.setLngLat(newCoords);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        showToast("Unable to fetch device location. Please enable GPS.", "warning");
      },
      { enableHighAccuracy: true }
    );
  };

  // Perform geocoding address search using Mapbox Places API
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      searchQuery
    )}.json?access_token=${mapboxgl.accessToken}&country=IN&limit=5`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.features) {
        setSearchResults(data.features);
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      showToast("Error searching address.", "error");
    } finally {
      setSearching(false);
    }
  };

  // Choose a search result and position the marker
  const selectSearchResult = (feat: any) => {
    const [lng, lat] = feat.center;
    const newCoords: [number, number] = [lng, lat];
    
    setCoords({ lat, lng });
    setSearchQuery("");
    setSearchResults([]);

    if (mapRef.current) {
      mapRef.current.flyTo({ center: newCoords, zoom: 16 });
    }
    if (markerRef.current) {
      markerRef.current.setLngLat(newCoords);
    }

    // Autofill address text if empty or simple
    if (!address || address === job?.location) {
      setAddress(feat.place_name);
    }
  };

  // Save location to Firestore database
  const handleSaveLocation = async () => {
    if (!address.trim()) {
      showToast("Please enter an address description or landmark.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      const docRef = doc(db, "jobs", jobId);
      await updateDoc(docRef, {
        harvestLocation: {
          address: address.trim(),
          latitude: coords.lat,
          longitude: coords.lng,
        },
      });

      setSavedSuccess(true);
      showToast("precise location updated successfully!", "success");
    } catch (err) {
      console.error("Error writing coordinates to Firestore:", err);
      showToast("Failed to save location. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--background)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem"
      }}>
        <Loader2 className="spinner" size={40} color="var(--accent)" />
        <span style={{ fontSize: "1rem", color: "var(--text-light)", fontWeight: 500 }}>Securing Connection...</span>
      </div>
    );
  }

  // Access Denied Screen
  if (authError || !job) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--background)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "2rem", textAlign: "center"
      }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--surface-border)",
          borderRadius: "20px", padding: "3rem 2rem", maxWidth: "450px", width: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem",
          boxShadow: "0 20px 40px rgba(0,0,0,0.5)"
        }}>
          <div style={{ background: "rgba(239, 35, 60, 0.1)", padding: "1rem", borderRadius: "50%", color: "var(--error)" }}>
            <AlertTriangle size={48} />
          </div>
          <h3 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Secure Link Expired</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
            This location-sharing link is invalid or has expired. Please contact your manager to request a new link.
          </p>
        </div>
      </div>
    );
  }

  // Congratulations Success Screen
  if (savedSuccess) {
    return (
      <div style={{
        minHeight: "100vh", background: "var(--background)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "2rem", textAlign: "center"
      }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--surface-border)",
          borderRadius: "24px", padding: "3.5rem 2rem", maxWidth: "450px", width: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem",
          boxShadow: "0 25px 50px rgba(0,0,0,0.6)"
        }}>
          <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "1.25rem", borderRadius: "50%", color: "#10b981" }}>
            <CheckCircle2 size={54} />
          </div>
          <h3 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "white" }}>Location Confirmed!</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.95rem", lineHeight: 1.6, margin: 0 }}>
            Thank you, <strong>{job.customerName}</strong>. Your precise location has been saved to your job confirmation.
          </p>
          <div style={{
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "12px", padding: "1rem", width: "100%", display: "flex", flexDirection: "column", gap: "6px",
            textAlign: "left", fontSize: "0.85rem"
          }}>
            <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>CONFIRMED DETAILS:</span>
            <span>Date: <strong>{job.date}</strong></span>
            <span>Estimated Time: <strong>{job.time}</strong></span>
            <span>Landmark: <strong>{address}</strong></span>
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontStyle: "italic", marginTop: "1rem" }}>
            You can close this browser tab now.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--background)",
      display: "flex", flexDirection: "column", position: "relative"
    }}>
      {/* Header Panel */}
      <header style={{
        background: "rgba(30, 26, 24, 0.8)", backdropFilter: "blur(8px)",
        borderBottom: "1px solid var(--surface-border)", padding: "1.25rem 1.5rem",
        display: "flex", flexDirection: "column", gap: "6px", zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <MapPin size={20} color="var(--accent)" />
          <h1 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, letterSpacing: "0.02em" }}>COCOFY | Share Location</h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-light)", lineHeight: 1.4 }}>
          Hello <strong>{job.customerName}</strong>, please drag the map pin or use GPS to set your precise harvest stop location.
        </p>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        
        {/* Map Container */}
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%", flex: 1, position: "absolute", inset: 0 }} />

        {/* Locate Me Floating Button */}
        <button
          onClick={handleLocateMe}
          style={{
            position: "absolute", bottom: "24px", right: "20px", zIndex: 5,
            width: "48px", height: "48px", borderRadius: "50%",
            background: "linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%)",
            border: "1px solid var(--surface-border)", color: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 15px rgba(0,0,0,0.5)", cursor: "pointer",
            transition: "transform 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          title="Center on my GPS"
        >
          <Navigation size={22} />
        </button>

        {/* Floating Search Container */}
        <div style={{
          position: "absolute", top: "16px", left: "16px", right: "16px", zIndex: 5,
          maxWidth: "400px", display: "flex", flexDirection: "column", gap: "6px"
        }}>
          <form onSubmit={handleSearch} style={{
            display: "flex", background: "var(--surface)", border: "1px solid var(--surface-border)",
            borderRadius: "12px", overflow: "hidden", boxShadow: "0 10px 25px rgba(0,0,0,0.5)"
          }}>
            <input
              type="text"
              placeholder="Search address or landmark..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, padding: "0.75rem 1rem", background: "transparent",
                border: "none", color: "white", outline: "none", fontSize: "0.88rem",
                fontFamily: "inherit"
              }}
            />
            <button
              type="submit"
              disabled={searching}
              style={{
                background: "rgba(255,255,255,0.02)", borderLeft: "1px solid var(--surface-border)",
                color: "var(--text-light)", padding: "0 1rem", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              {searching ? (
                <Loader2 className="spinner" size={16} />
              ) : (
                <Search size={16} />
              )}
            </button>
          </form>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <div style={{
              background: "var(--surface)", border: "1px solid var(--surface-border)",
              borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column",
              boxShadow: "0 15px 30px rgba(0,0,0,0.6)"
            }}>
              {searchResults.map((feat) => (
                <button
                  key={feat.id}
                  onClick={() => selectSearchResult(feat)}
                  style={{
                    width: "100%", padding: "0.8rem 1rem", background: "transparent",
                    border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
                    color: "var(--text-light)", fontSize: "0.8rem", textAlign: "left",
                    cursor: "pointer", transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  {feat.place_name}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer Save Drawer */}
      <footer style={{
        background: "var(--surface)", borderTop: "1px solid var(--surface-border)",
        padding: "1.25rem", zIndex: 10, display: "flex", flexDirection: "column", gap: "1rem",
        boxShadow: "0 -10px 30px rgba(0,0,0,0.5)"
      }}>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "6px", fontWeight: 700, textTransform: "uppercase" }}>
            Stay Address / Room Description / Landmark
          </label>
          <input
            type="text"
            placeholder="e.g. Red house near temple, Room 3"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={{
              width: "100%", background: "var(--surface-2)", border: "1px solid var(--surface-border)",
              color: "white", padding: "0.75rem", borderRadius: "8px", outline: "none",
              fontSize: "0.88rem", fontFamily: "inherit"
            }}
          />
          <span style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Currently pinned coordinates: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
          </span>
        </div>

        <button
          onClick={handleSaveLocation}
          disabled={submitting}
          style={{
            width: "100%", padding: "0.9rem", borderRadius: "10px",
            background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
            border: "none", color: "white", fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", fontSize: "0.95rem", boxShadow: "0 4px 15px var(--primary-glow-border)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? (
            <>
              <Loader2 className="spinner" size={18} />
              Saving Precise Location...
            </>
          ) : (
            "Save Harvest Location"
          )}
        </button>
      </footer>
    </div>
  );
}
