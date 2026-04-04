import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

// Haversine formula to calculate distance between two lat/lng points in km
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d;
};

export default function useVolunteerAlerts() {
  const { currentUser, userData } = useAuth();
  const [activeAlert, setActiveAlert] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [dismissedIds, setDismissedIds] = useState([]);

  // 1. Keep track of user's current location
  useEffect(() => {
    if (!userData?.isVolunteer) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => console.error('Error watching location:', err),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [userData?.isVolunteer]);

  // 2. Listen for active SOS alerts
  useEffect(() => {
    if (!userData?.isVolunteer || !userLocation) {
      setActiveAlert(null);
      return;
    }

    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const q = query(
      collection(db, 'sos_alerts'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let foundAlert = null;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const alertData = { id: doc.id, ...data };
        
        // Filter by timestamp (Ignore if older than 15 mins)
        const alertTime = data.timestamp?.toMillis() || Date.now();
        if (alertTime < fifteenMinsAgo) return;

        // Don't alert for yourself
        if (alertData.victimId === currentUser?.uid) return;

        // Check distance
        const distance = getDistance(
          userLocation.lat,
          userLocation.lng,
          alertData.lat,
          alertData.lng
        );

        // Within 1km and NOT dismissed
        if (distance <= 1.0 && !dismissedIds.includes(alertData.id)) {
          foundAlert = { ...alertData, distance: distance.toFixed(2) };
        }
      });

      setActiveAlert(foundAlert);
    });

    return () => unsubscribe();
  }, [userData?.isVolunteer, userLocation, currentUser?.uid, dismissedIds]);

  const respondToAlert = async (alertId) => {
    if (!currentUser) return;
    try {
      const alertRef = doc(db, 'sos_alerts', alertId);
      await updateDoc(alertRef, {
        responders: arrayUnion(currentUser.uid)
      });
    } catch (err) {
      console.error('Error responding to alert:', err);
    }
  };

  const dismissAlert = () => {
    if (activeAlert) {
      setDismissedIds(prev => [...prev, activeAlert.id]);
    }
    setActiveAlert(null);
  };

  return { activeAlert, respondToAlert, dismissAlert };
}
