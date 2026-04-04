import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  
  // PERSISTENT SOS STATE
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(10);
  const [sosStatus, setSosStatus] = useState('');
  const [sosAlertId, setSosAlertId] = useState(null);
  const [sosLocation, setSosLocation] = useState(null);

  // Restore SOS state from localStorage on load (survives refreshes)
  useEffect(() => {
    const saved = localStorage.getItem('NIRBHAYA_SOS_STATE');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.sosActive) {
        setSosActive(true);
        setSosCountdown(parsed.sosCountdown);
        setSosStatus(parsed.sosStatus || '');
        setSosAlertId(parsed.sosAlertId);
        setSosLocation(parsed.sosLocation);
      }
    }
  }, []);

  // Save SOS state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('NIRBHAYA_SOS_STATE', JSON.stringify({
      sosActive, sosCountdown, sosStatus, sosAlertId, sosLocation
    }));
  }, [sosActive, sosCountdown, sosStatus, sosAlertId, sosLocation]);

  // Handle SOS countdown globally
  useEffect(() => {
    let timer;
    if (sosActive && sosCountdown > 0) {
      timer = setInterval(() => setSosCountdown(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [sosActive, sosCountdown]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch additional user data from firestore
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        } else {
          setUserData(null);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const logout = () => {
    return auth.signOut();
  };

  const updateProfile = async (uid, data) => {
    await setDoc(doc(db, "users", uid), data, { merge: true });
    setUserData(prev => ({ ...prev, ...data }));
  };

  // BACKGROUND LOCATION SHARING
  useEffect(() => {
    let interval = null;

    const pushLocation = async () => {
      if (!currentUser) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Use a generic session name for background sharing
        await setDoc(doc(db, 'liveSessions', `bg-${currentUser.uid}`), {
          userId: currentUser.uid,
          name: userData?.name || 'Nirbhaya Nari User',
          lat: latitude,
          lng: longitude,
          updatedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        });
      }, (err) => console.error("BG Location Error:", err));
    };

    if (isLocationSharing && currentUser) {
      pushLocation(); // Initial
      interval = setInterval(pushLocation, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLocationSharing, currentUser, userData]);

  const value = {
    currentUser,
    userData,
    loading,
    loginWithGoogle,
    logout,
    updateProfile,
    isLocationSharing,
    setIsLocationSharing,
    // SOS State
    sosActive, setSosActive,
    sosCountdown, setSosCountdown,
    sosStatus, setSosStatus,
    sosAlertId, setSosAlertId,
    sosLocation, setSosLocation
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
