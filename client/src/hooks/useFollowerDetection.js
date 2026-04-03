import { useState, useEffect, useRef } from 'react';

/**
 * useFollowerDetection
 * Simulates detecting a consistent nearby entity based on GPS pattern matching.
 */
export default function useFollowerDetection() {
  const [isActive, setIsActive] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState([]);
  const [isThreatDetected, setIsThreatDetected] = useState(false);
  const [scanningStatus, setScanningStatus] = useState('idle'); // idle | scanning | alert
  
  const pathHistory = useRef([]);
  const mockFollowerPath = useRef([]);
  const startTime = useRef(null);

  const startDetection = () => {
    setIsActive(true);
    setScanningStatus('scanning');
    startTime.current = Date.now();
    pathHistory.current = [];
    
    // Simulate initial scan results
    setNearbyDevices([
      { id: 'dev-9921', name: 'Unknown Device (Nearby)', signal: 85, duration: 0 },
      { id: 'dev-4412', name: 'Samsung-S22', signal: 40, duration: 0 }
    ]);
  };

  const stopDetection = () => {
    setIsActive(false);
    setScanningStatus('idle');
    setIsThreatDetected(false);
  };

  useEffect(() => {
    let interval;
    if (isActive && !isThreatDetected) {
      interval = setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          pathHistory.current.push({ lat: latitude, lng: longitude });

          // Update durations for mock devices
          setNearbyDevices(prev => prev.map(dev => {
            if (dev.id === 'dev-9921') {
              const newDuration = dev.duration + 5; // adding 5 seconds cada interval
              
              // HEURISTIC: If device follows for > 3 minutes (simulated) and maintains strong signal
              if (newDuration >= 180) {
                 setIsThreatDetected(true);
                 setScanningStatus('alert');
                 if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
              }
              return { ...dev, duration: newDuration, signal: Math.min(95, dev.signal + 2) };
            }
            return dev;
          }));
        });
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isActive, isThreatDetected]);

  // Simulated "Manual Trigger" for Hackathon Judges
  const triggerMockAlert = () => {
    setIsActive(true);
    setScanningStatus('alert');
    setIsThreatDetected(true);
    setNearbyDevices([
      { id: 'dev-9921', name: 'Suspicious Device (Following)', signal: 98, duration: 360 }
    ]);
    if (navigator.vibrate) navigator.vibrate([1000, 500, 1000]);
  };

  return { 
    isActive, 
    startDetection, 
    stopDetection, 
    nearbyDevices, 
    isThreatDetected, 
    scanningStatus,
    triggerMockAlert
  };
}
