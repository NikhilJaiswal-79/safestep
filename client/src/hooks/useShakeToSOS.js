import { useState, useEffect, useRef } from 'react';

export default function useShakeToSOS(onShakeDetected) {
  const [isShakeEnabled, setIsShakeEnabled] = useState(() => {
    return localStorage.getItem('shakeToSos') === 'true';
  });
  const [permissionError, setPermissionError] = useState('');

  const shakeTimes = useRef([]);

  const handleMotion = (event) => {
    // Android Chrome often returns null for `acceleration` but supports `accelerationIncludingGravity`
    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;
    const totalAcceleration = Math.sqrt((x * x) + (y * y) + (z * z));

    // Threshold lowered to 15 m/s^2 to make it highly sensitive for all Androids
    if (totalAcceleration > 15) {
      const now = Date.now();
      const lastShake = shakeTimes.current.length > 0 ? shakeTimes.current[shakeTimes.current.length - 1] : 0;
      
      // Throttle: only register one distinct "move" per 200ms so a single violent swing doesn't count as 5 shakes.
      if (now - lastShake > 200) {
        shakeTimes.current.push(now);
      }

      // Filter shakes within last 3 seconds
      shakeTimes.current = shakeTimes.current.filter(time => now - time <= 3000);

      // If we detect 3 distinct strong movements within 3 seconds
      if (shakeTimes.current.length >= 3) {
        shakeTimes.current = []; // Reset
        onShakeDetected();
      }
    }
  };

  const requestPermissionAndToggle = () => {
    if (isShakeEnabled) {
      // Toggle OFF
      setIsShakeEnabled(false);
      localStorage.setItem('shakeToSos', 'false');
      setPermissionError('');
      return;
    }

    // Toggle ON - check permission if iOS 13+
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission()
        .then(permissionState => {
          if (permissionState === 'granted') {
            setIsShakeEnabled(true);
            localStorage.setItem('shakeToSos', 'true');
            setPermissionError('');
          } else {
            setPermissionError('Shake to SOS unavailable. Please use the SOS button on screen instead.');
          }
        })
        .catch(console.error);
    } else {
      // Non iOS 13+ devices
      setIsShakeEnabled(true);
      localStorage.setItem('shakeToSos', 'true');
      setPermissionError('');
    }
  };

  useEffect(() => {
    if (isShakeEnabled) {
      window.addEventListener('devicemotion', handleMotion);
    } else {
      window.removeEventListener('devicemotion', handleMotion);
    }

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isShakeEnabled, onShakeDetected]);

  return {
    isShakeEnabled,
    toggleShake: requestPermissionAndToggle,
    permissionError
  };
}
