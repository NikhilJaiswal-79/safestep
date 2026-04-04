import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function useVolunteerAlerts() {
  const { currentUser, userData } = useAuth();
  const [activeAlert, setActiveAlert] = useState(null);
  const [dismissedIds, setDismissedIds] = useState([]);

  // Instead of passing userLocation as a dependency which causes onSnapshot to restart,
  // we can use a ref for values that change often but shouldn't restart the listener.
  const [alertsList, setAlertsList] = useState([]);

  // 2. Listen for active SOS alerts ONCE
  useEffect(() => {
    if (!userData?.isVolunteer) {
      setAlertsList([]);
      return;
    }

    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    const q = query(
      collection(db, 'sos_alerts'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeData = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const alertTime = data.timestamp?.toMillis() || Date.now();
        
        // Ignore old alerts
        if (data.timestamp && alertTime < fifteenMinsAgo) return;
        
        // Don't alert for yourself
        if (data.victimId === currentUser?.uid) return;

        activeData.push({ id: doc.id, ...data });
      });
      setAlertsList(activeData);
    });

    return () => unsubscribe();
  }, [userData?.isVolunteer, currentUser?.uid]);

  // 3. Evaluate alerts against dismissals
  useEffect(() => {
    if (!alertsList.length) {
      setActiveAlert(null);
      return;
    }

    let foundAlert = null;

    for (const alertData of alertsList) {
      if (!dismissedIds.includes(alertData.id)) {
        foundAlert = { ...alertData };
        break; // Show the first valid one
      }
    }

    setActiveAlert(foundAlert);
  }, [alertsList, dismissedIds]);

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
