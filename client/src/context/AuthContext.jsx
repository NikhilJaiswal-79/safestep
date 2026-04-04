import { createContext, useContext, useEffect, useState, useRef } from "react";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { uploadToCloudinary } from "../utils/cloudinary";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// Helper: pick a supported mimeType for MediaRecorder
function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
    ''  // empty string = browser default
  ];
  for (const t of types) {
    try {
      if (t === '' || MediaRecorder.isTypeSupported(t)) return t;
    } catch (e) { /* skip */ }
  }
  return '';
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  
  // PERSISTENT SOS STATE
  const [sosActive, setSosActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(10);
  const [sosStatus, setSosStatus] = useState('');
  const [sosAlertId, setSosAlertId] = useState(null);
  const [sosLocation, setSosLocation] = useState(null);
  const [sosMediaStream, setSosMediaStream] = useState(null);

  // GLOBAL RECORDING STATE
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  // Keep a snapshot of the userId at recording-start time so cancel can't null it out
  const recordingUserIdRef = useRef(null);
  // Keep the SOS alert id captured at recording-start in case cancelSOS clears it
  const recordingAlertIdRef = useRef(null);

  // Restore SOS state from localStorage on load (survives refreshes)
  useEffect(() => {
    const saved = localStorage.getItem('NIRBHAYA_SOS_STATE');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.sosActive) {
          setSosActive(true);
          setSosCountdown(parsed.sosCountdown);
          setSosStatus(parsed.sosStatus || '');
          setSosAlertId(parsed.sosAlertId);
          setSosLocation(parsed.sosLocation);
        }
      } catch (e) {
        console.error("SOS Restore Error:", e);
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
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        } catch (e) {
          console.error("UserData Fetch Error:", e);
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

  // GLOBAL RECORDING ACTIONS
  const startEmergencyRecording = async (existingStream = null) => {
    try {
      const stream = existingStream || await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });

      // Pick a supported mimeType (avoid silent failures)
      const mimeType = getSupportedMimeType();
      const recorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];

      // Snapshot user & alert IDs NOW, before cancel can null them out
      const capturedUserId = currentUser?.uid;
      const capturedAlertId = sosAlertId;
      recordingUserIdRef.current = capturedUserId;
      recordingAlertIdRef.current = capturedAlertId;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Immediately snapshot chunks so a subsequent startRecording can't wipe them
        const savedChunks = [...chunksRef.current];
        const detectedMime = mimeType || 'video/webm';
        const blob = new Blob(savedChunks, { type: detectedMime });

        // Use the IDs captured at start-time (immune to cancelSOS clearing state)
        const uid = recordingUserIdRef.current || capturedUserId;
        if (!uid) {
          console.error('❌ No user ID available for evidence upload');
          stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
          return;
        }

        const fileName = `emergency_${uid.slice(0, 6)}_${Date.now()}.webm`;
        console.log('🎥 Recording stopped. Uploading evidence...', fileName);

        // Save to Cloudinary FIRST (so evidence shows up even if alert-update fails)
        let downloadUrl = null;
        try {
          downloadUrl = await uploadToCloudinary(blob);
          console.log('✅ Evidence uploaded to Cloudinary:', downloadUrl);
        } catch (err) {
          console.error("Failed to upload emergency evidence to Cloudinary:", err);
        }

        if (downloadUrl) {
          // Save to user_evidence collection (this is what the Evidence page reads)
          try {
            await addDoc(collection(db, 'user_evidence'), {
              userId: uid,
              fileName,
              url: downloadUrl,
              timestamp: serverTimestamp(),
              type: 'video'
            });
            console.log('✅ Evidence saved to user_evidence collection.');
          } catch (err) {
            console.error("Failed to save to user_evidence:", err);
          }

          // Try to link to active SOS alert (best-effort, may already be cancelled)
          const alertId = recordingAlertIdRef.current || capturedAlertId;
          if (alertId) {
            try {
              await updateDoc(doc(db, 'sos_alerts', alertId), {
                evidenceUrl: downloadUrl,
                evidenceTimestamp: serverTimestamp()
              });
              console.log(`✅ Alert ${alertId} updated with evidence link.`);
            } catch (err) {
              console.error("Failed to update SOS alert (may be cancelled):", err);
            }
          }
        }
        
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      // Use a 1-second timeslice so data is captured continuously (not just on stop)
      recorder.start(1000);
      setIsRecording(true);
      console.log('🚀 Global emergency recording started...');
    } catch (err) {
      console.error("Could not start global recording:", err);
    }
  };

  const stopEmergencyRecording = (alsoStopStream = false) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    // Only stop the shared stream if explicitly requested (e.g. full SOS cancel)
    if (alsoStopStream && sosMediaStream) {
      sosMediaStream.getTracks().forEach(track => track.stop());
      setSosMediaStream(null);
    }
  };

  // BACKGROUND LOCATION SHARING
  useEffect(() => {
    let interval = null;

    const pushLocation = async () => {
      if (!currentUser) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
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
      pushLocation(); 
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
    // SOS STATE
    sosActive, setSosActive,
    sosCountdown, setSosCountdown,
    sosStatus, setSosStatus,
    sosAlertId, setSosAlertId,
    sosLocation, setSosLocation,
    sosMediaStream, setSosMediaStream,
    // Recording
    isRecording, startEmergencyRecording, stopEmergencyRecording
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
