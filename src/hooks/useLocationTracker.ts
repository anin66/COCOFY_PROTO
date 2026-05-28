import { useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";

interface TrackerOptions {
  uid: string | null;
  role: string | null;
  activeJobId?: string | null;
}

export function useLocationTracker({ uid, role, activeJobId = null }: TrackerOptions) {
  const watchIdRef = useRef<number | null>(null);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!uid || !role) return;

    const updateFirestoreLocation = async (latitude: number, longitude: number, heading = 0) => {
      try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, {
          lastLocation: {
            latitude,
            longitude,
            timestamp: new Date().toISOString(),
          },
          locationPermission: true,
        });

        // If this is a delivery boy on an active job, also update the job tracking location
        if (role === "delivery" && activeJobId) {
          const jobRef = doc(db, "jobs", activeJobId);
          await updateDoc(jobRef, {
            deliveryLocation: {
              latitude,
              longitude,
              heading: heading || 0,
              lastUpdated: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        console.error("Error updating location in Firestore:", err);
      }
    };

    const getSingleUpdate = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateFirestoreLocation(latitude, longitude);
        },
        (err) => console.error("Error getting single position:", err),
        { enableHighAccuracy: true }
      );
    };

    // Helper to check if current time is within peak hours (5:00 AM - 1:00 PM)
    const isPeakHours = () => {
      const now = new Date();
      const hours = now.getHours();
      return hours >= 5 && hours < 13;
    };

    // 1. Delivery Boy Active Tracking (Continuous watch)
    if (role === "delivery" && activeJobId) {
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, heading } = position.coords;
            updateFirestoreLocation(latitude, longitude, heading || 0);
          },
          (err) => console.error("Error watching position:", err),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
      }
    } 
    // 2. Adaptive Tracking for Workers and general Delivery tracking
    else {
      // Get initial position
      getSingleUpdate();

      const setupAdaptiveTracking = () => {
        // Clear existing interval
        if (intervalIdRef.current) {
          clearInterval(intervalIdRef.current);
        }

        const peak = isPeakHours();
        // High frequency = 3 mins (180,000 ms), Low frequency = 30 mins (1,800,000 ms)
        const intervalTime = peak ? 3 * 60 * 1000 : 30 * 60 * 1000;

        intervalIdRef.current = setInterval(() => {
          getSingleUpdate();
          
          // Re-evaluate window check on each tick to handle cross-boundary shifts
          const currentPeak = isPeakHours();
          if (currentPeak !== peak) {
            setupAdaptiveTracking();
          }
        }, intervalTime);
      };

      setupAdaptiveTracking();
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (intervalIdRef.current !== null) {
        clearInterval(intervalIdRef.current);
      }
    };
  }, [uid, role, activeJobId]);
}
