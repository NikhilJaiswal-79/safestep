import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Mic, MapPin, PhoneCall, Route, Map as MapIcon, Rss, HelpCircle, User, Smartphone, Radar, Navigation, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import useShakeToSOS from '../hooks/useShakeToSOS';
import useScreamDetection from '../hooks/useScreamDetection';
import { useTranslation } from 'react-i18next';
import { safeSpots } from '../data/safeSpots';

export default function Dashboard() {
  const { 
    userData, logout, 
    isLocationSharing, setIsLocationSharing,
    sosActive, setSosActive,
    sosCountdown, setSosCountdown,
    sosStatus, setSosStatus,
    sosAlertId, setSosAlertId,
    sosLocation, setSosLocation,
    isRecording, startEmergencyRecording, stopEmergencyRecording
  } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [preSosActive, setPreSosActive] = useState(false);
  const [preSosCountdown, setPreSosCountdown] = useState(10);

  const [mediaStream, setMediaStream] = useState(null);
  const [respondersCount, setRespondersCount] = useState(0);
  const [nearestSpot, setNearestSpot] = useState(null);
  const [spotDistance, setSpotDistance] = useState(0);
  const [isGuiding, setIsGuiding] = useState(false);
  const [lastSpokenDist, setLastSpokenDist] = useState(0);
  const [lastEvidenceUrl, setLastEvidenceUrl] = useState(null);

  // API URL for production/dev
  const productionUrl = 'https://safestep-virid.vercel.app';
  const rawApiUrl = localStorage.getItem('VITE_API_URL') || import.meta.env.VITE_API_URL || productionUrl;
  const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

  // Watch countdown to fire actions at T=0
  useEffect(() => {
    if (sosActive && sosCountdown === 0) {
      fireSOSActions();
    }
  }, [sosActive, sosCountdown]);

  // Auto-trigger SOS after Pre-SOS delay
  useEffect(() => {
    let timer;
    if (preSosActive && preSosCountdown > 0) {
      timer = setTimeout(() => setPreSosCountdown(prev => prev - 1), 1000);
    } else if (preSosActive && preSosCountdown === 0) {
      setPreSosActive(false);
      triggerSOS();
    }
    return () => clearTimeout(timer);
  }, [preSosActive, preSosCountdown]);

  // Listen for responders and evidence
  useEffect(() => {
    if (!sosAlertId) {
      setRespondersCount(0);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'sos_alerts', sosAlertId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRespondersCount(data.responders?.length || 0);
        if (data.evidenceUrl) {
          setLastEvidenceUrl(data.evidenceUrl);
        }
      }
    });

    return () => unsubscribe();
  }, [sosAlertId]);

  const handleScreamDetected = useCallback(() => {
    if (!sosActive && !preSosActive) {
      setPreSosActive(true);
      setPreSosCountdown(10);
      if ("vibrate" in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500, 200]);
      }
    }
  }, [sosActive, preSosActive]);

  const { isListening: screamDetectOn, toggleListening: toggleScream, error: screamError } = useScreamDetection(handleScreamDetected);

  const handleShakeDetected = useCallback(() => {
    if (!sosActive && !preSosActive) {
      setPreSosActive(true);
      setPreSosCountdown(10);
      if ("vibrate" in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500, 200]);
      }
    }
  }, [sosActive, preSosActive]);

  const { isShakeEnabled, toggleShake, permissionError } = useShakeToSOS(handleShakeDetected);

  const cancelPreSOS = () => {
    setPreSosActive(false);
    setPreSosCountdown(10);
    if ("vibrate" in navigator) navigator.vibrate(0);
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) * 1000;
  };

  const triggerSOS = () => {
    setSosActive(true);
    setSosStatus(t('sos_countdown_active'));
    setSosCountdown(10);
    
    if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500, 200]);
    
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        setMediaStream(stream);
        console.log('🎤 Global media stream ready.');
      })
      .catch(e => console.error("❌ Media capture error:", e));

    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setSosLocation({ lat: latitude, lng: longitude });
      
      let closest = null;
      let minDocs = Infinity;
      safeSpots.forEach(spot => {
        const dist = getDistance(latitude, longitude, spot.lat, spot.lng);
        if (dist < minDocs) { minDocs = dist; closest = spot; }
      });
      
      if (minDocs > 1000) {
        closest = { id: 999, name: "Emergency Unit", lat: latitude + 0.003, lng: longitude + 0.002, type: "Police" };
        minDocs = 400;
      }
      setNearestSpot(closest);
      setSpotDistance(Math.round(minDocs));
    }, null, { enableHighAccuracy: true });
  };

  const fireSOSActions = async () => {
    setSosStatus(t('help_way'));
    console.log('🔥 GLOBAL SOS FIRE...');

    const lat = sosLocation?.lat || 0;
    const lng = sosLocation?.lng || 0;
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    // Voice
    if (nearestSpot) startGuidance();

    // SMS
    const triggerSMS = async () => {
      try {
        const contacts = userData?.contacts || [];
        if (contacts.length === 0 && userData?.phone) contacts.push({ name: "Emergency", phone: userData.phone });
        await fetch(`${API_URL}/api/sos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userData?.uid, userName: userData?.name || 'User', locationLink: mapsLink, contacts })
        });
      } catch (e) { console.error('❌ SMS Error:', e); }
    };
    triggerSMS();

    // Volunteers
    const triggerVolunteerAlert = async () => {
      try {
        const docRef = await addDoc(collection(db, 'sos_alerts'), {
          victimId: userData?.uid, victimName: userData?.name || 'User',
          lat, lng, status: 'active', timestamp: serverTimestamp(), locationLink: mapsLink, responders: []
        });
        setSosAlertId(docRef.id);
      } catch (e) { console.error('❌ Volunteer Alert Error:', e); }
    };
    triggerVolunteerAlert();

    // Global Recording
    startEmergencyRecording(mediaStream);
  };

  const speak = (msgKey, params = {}) => {
    const msg = new SpeechSynthesisUtterance();
    const lang = i18n.language || 'en';
    const text = t(msgKey, params);
    msg.lang = lang === 'hi' ? 'hi-IN' : lang === 'te' ? 'te-IN' : 'en-US';
    msg.text = text;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  };

  const startGuidance = () => {
    if (!nearestSpot) return;
    setIsGuiding(true);
    speak('guidance_started', { name: nearestSpot.name });
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${nearestSpot.lat},${nearestSpot.lng}&travelmode=walking`, '_blank');
  };

  const cancelSOS = async () => {
    setSosActive(false);
    setSosStatus('');
    setSosCountdown(10);
    stopEmergencyRecording();
    if ("vibrate" in navigator) navigator.vibrate(0);
    
    if (sosAlertId) {
      try {
        await updateDoc(doc(db, 'sos_alerts', sosAlertId), { status: 'cancelled', cancelledAt: serverTimestamp() });
        setSosAlertId(null);
      } catch (e) { console.error('Failed to cancel SOS:', e); }
    }
  };

  const navItems = [
    { icon: <Shield size={24} />, label: t('welcome').split(' ')[0], path: '/' },
    { icon: <MapIcon size={24} />, label: t('map'), path: '/map' },
    { icon: <Rss size={24} />, label: t('feed'), path: '/feed' },
    { icon: <HelpCircle size={24} />, label: t('help'), path: '/help' },
    { icon: <User size={24} />, label: t('profile'), path: '/profile' }
  ];

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-y-auto pb-20">
      <div className="flex justify-between items-center p-4 bg-white shadow-sm shrink-0">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2"><Shield size={24} /> Nirbhaya Nari</h1>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-secondary">{userData?.name || 'User'}</span>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold overflow-hidden cursor-pointer" onClick={() => navigate('/profile')}>
             {userData?.name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {preSosActive ? (
          <div className="flex flex-col items-center justify-center bg-orange-50 w-full h-full rounded-2xl p-6 border-2 border-orange-200">
            <h2 className="text-2xl font-bold text-orange-600 mb-2">{t('shake_detected')}</h2>
            <div className="text-6xl font-black text-orange-600 mb-6">{preSosCountdown}s</div>
            <button onClick={cancelPreSOS} className="px-8 py-4 bg-gray-800 text-white font-bold rounded-xl w-full max-w-xs shadow-lg">{t('cancel')}</button>
          </div>
        ) : sosActive ? (
          <div className="flex flex-col items-center justify-center bg-red-50 w-full h-full rounded-2xl p-6 border-2 border-red-200">
            <h2 className="text-2xl font-bold text-red-600 mb-2">{sosStatus}</h2>
            <div className="text-6xl font-black text-red-600 mb-6">{sosCountdown}s</div>
            
            {nearestSpot && (
              <div className="bg-white/80 p-4 rounded-2xl border-2 border-red-100 mb-6 w-full">
                <p className="text-xs text-gray-500 mb-2">{nearestSpot.name} • {spotDistance}m</p>
                <button onClick={startGuidance} className="w-full py-3 bg-green-600 text-white font-bold rounded-xl text-sm">Navigation Active</button>
              </div>
            )}

            {isRecording && (
              <div className="flex items-center gap-2 mb-4 bg-red-100 px-3 py-1 rounded-full animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-600"></div>
                <span className="text-[10px] font-bold text-red-600 uppercase">Emergency Recording Active</span>
              </div>
            )}

            <button onClick={cancelSOS} className="px-8 py-4 bg-gray-800 text-white font-bold rounded-xl w-full max-w-xs shadow-lg">{t('cancel_sos')}</button>
          </div>
        ) : (
          <button onClick={triggerSOS} className="w-48 h-48 rounded-full bg-primary flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white text-5xl font-black tracking-wider">{t('sos')}</span>
          </button>
        )}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-gray-200 flex justify-between px-6 py-3 pb-6 shrink-0 z-50">
        {navItems.map((item, index) => (
          <button key={index} onClick={() => navigate(item.path)} className={`flex flex-col items-center gap-1 ${index === 0 ? 'text-primary' : 'text-gray-400'}`}>
            {item.icon}
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
