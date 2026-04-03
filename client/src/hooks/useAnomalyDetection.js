import { useState, useEffect, useRef } from 'react';

/**
 * useAnomalyDetection
 * 
 * Monitors the user's location and calculates a "Threat Score" 
 * based on path deviations, sudden stops, and speed anomalies.
 * 
 * @param {Object} options 
 * @param {boolean} options.active - Whether to monitor
 * @param {Array} options.destination - [lat, lng] of destination
 * @param {Function} options.onAnomaly - Callback when threat score > threshold
 */
export default function useAnomalyDetection({ active, destination, onAnomaly }) {
  const [threatScore, setThreatScore] = useState(0);
  const pathHistory = useRef([]);
  const lastActiveTime = useRef(Date.now());
  
  // Thresholds
  const MAX_STOP_TIME = 5 * 60 * 1000; // 5 minutes
  const DEVIATION_THRESHOLD = 0.5; // 500 meters from expected line
  const THREAT_THRESHOLD = 5;

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Distance from point to line (origin-destination)
  const calculatePathDeviation = (current, origin, dest) => {
    if (!origin || !dest) return 0;
    
    // Cross-track distance is a complex formula, 
    // using a simplification for demo: distance from current to dest vs origin to dest
    const dDest = calculateDistance(current[0], current[1], dest[0], dest[1]);
    const dOrigin = calculateDistance(current[0], current[1], origin[0], origin[1]);
    const totalPath = calculateDistance(origin[0], origin[1], dest[0], dest[1]);
    
    // if dDest + dOrigin is significantly more than totalPath, user is deviating
    const deviation = (dDest + dOrigin) - totalPath;
    return deviation; 
  };

  useEffect(() => {
    if (!active) {
      setThreatScore(0);
      pathHistory.current = [];
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        const currentLoc = [latitude, longitude];
        
        // 1. Check for Stop Anomaly
        if (speed < 0.2) { // slower than 0.7 km/h
          const idleTime = Date.now() - lastActiveTime.current;
          if (idleTime > MAX_STOP_TIME) {
            setThreatScore(prev => prev + 2); // Increment threat
            lastActiveTime.current = Date.now(); // Reset to avoid constant firing
          }
        } else {
          lastActiveTime.current = Date.now();
        }

        // 2. Check for Path Deviation
        if (pathHistory.current.length > 0 && destination) {
          const origin = pathHistory.current[0];
          const deviation = calculatePathDeviation(currentLoc, origin, destination);
          
          if (deviation > DEVIATION_THRESHOLD) {
            setThreatScore(prev => prev + 3);
          }
        }

        pathHistory.current = [...pathHistory.current, currentLoc].slice(-50); // Keep last 50 points
      },
      (err) => console.error(err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, destination]);

  useEffect(() => {
    if (threatScore >= THREAT_THRESHOLD) {
      onAnomaly?.(threatScore);
      setThreatScore(0); // Reset after notification
    }
  }, [threatScore, onAnomaly]);

  return { threatScore };
}
