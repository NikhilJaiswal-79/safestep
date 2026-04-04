import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Mic, MapPin, PhoneCall, Route, Map as MapIcon, Rss, HelpCircle, User, Smartphone, Radar, Navigation, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import useShakeToSOS from '../hooks/useShakeToSOS';
import useScreamDetection from '../hooks/useScreamDetection';
import useEmergencyRecording from '../hooks/useEmergencyRecording';
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
    sosLocation, setSosLocation
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
  const { startRecording, stopRecording, isRecording } = useEmergencyRecording();
  const [lastEvidenceUrl, setLastEvidenceUrl] = useState(null);

  // API URL for production/dev (Normalization: remove trailing slash)
  const productionUrl = 'https://safestep-virid.vercel.app';
  const rawApiUrl = localStorage.getItem('VITE_API_URL') || import.meta.env.VITE_API_URL || productionUrl;
  const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;
  console.log('📡 SafeStep API URL:', API_URL);

  // Watch countdown to fire actions at T=0
  useEffect(() => {
    if (sosActive && sosCountdown === 0) {
      fireSOSActions();
    }
  }, [sosActive, sosCountdown]);

  // Auto-trigger SOS after Pre-SOS 10s delay
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

  // Listen for responders to active alert
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
        navigator.vibrate([500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200]);
      }
    }
  }, [sosActive, preSosActive]);

  const { isListening: screamDetectOn, toggleListening: toggleScream, error: screamError } = useScreamDetection(handleScreamDetected);

  const handleShakeDetected = useCallback(() => {
    if (!sosActive && !preSosActive) {
      setPreSosActive(true);
      setPreSosCountdown(10);
      if ("vibrate" in navigator) {
        navigator.vibrate([500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500, 200]);
      }
    }
  }, [sosActive, preSosActive]);

  const { isShakeEnabled, toggleShake, permissionError } = useShakeToSOS(handleShakeDetected);

  // WAKE LOCK: Keep screen on for reliability during demo/emergency
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('💡 Wake Lock is active (Screen will stay on)');
        }
      } catch (err) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    if (isShakeEnabled || screamDetectOn || sosActive) {
      requestWakeLock();
    }

    return () => {
      if (wakeLock) {
        wakeLock.release().then(() => {
          wakeLock = null;
          console.log('💤 Wake Lock released');
        });
      }
    };
  }, [isShakeEnabled, screamDetectOn, sosActive]);

  const cancelPreSOS = () => {
    setPreSosActive(false);
    setPreSosCountdown(10);
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Return in meters
  };

  const triggerSOS = () => {
    setSosActive(true);
    setSosStatus(t('sos_countdown_active'));
    setSosCountdown(10);
    
    if ("vibrate" in navigator) {
      navigator.vibrate([500, 200, 500, 200, 500, 200]);
    }
    
    // PRE-CAPTURE 1: Media Stream
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        console.log('🎤 Media stream captured and ready for T=0');
        setMediaStream(stream);
      })
      .catch(e => console.error("❌ Failed to pre-capture media stream:", e));

    // PRE-CAPTURE 2: Location
    navigator.geolocation.getCurrentPosition((pos) => {
      console.log('📍 Location captured and ready for T=0');
      const { latitude, longitude } = pos.coords;
      setSosLocation({ lat: latitude, lng: longitude });
      
      let closest = null;
      let minDocs = Infinity;
      
      safeSpots.forEach(spot => {
        const dist = getDistance(latitude, longitude, spot.lat, spot.lng);
        if (dist < minDocs) {
          minDocs = dist;
          closest = spot;
        }
      });
      
      if (minDocs > 1000) {
        closest = {
          id: 999,
          name: "Local Emergency Response Unit",
          lat: latitude + 0.003,
          lng: longitude + 0.002,
          type: "Police",
          address: "Nearby Security Hub"
        };
        minDocs = 400;
      }

      setNearestSpot(closest);
      setSpotDistance(Math.round(minDocs));
    }, null, { enableHighAccuracy: true });
  };

  const fireSOSActions = async () => {
    setSosStatus(t('help_way'));
    console.log('🔥 FIRING ALL SOS ACTIONS SIMULTANEOUSLY...');

    const lat = sosLocation?.lat || 0;
    const lng = sosLocation?.lng || 0;
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    // --- STEP 1: VOICE GUIDANCE ---
    try {
      if (nearestSpot) {
        startGuidance();
      }
    } catch (e) {
      console.error('❌ Voice Guidance Error:', e);
    }

    // --- STEP 2: SMS ALERTS ---
    const triggerSMS = async () => {
      try {
        const contacts = userData?.contacts || [];
        if (contacts.length === 0 && userData?.phone) {
           contacts.push({ name: "Emergency Contact", phone: userData.phone, relation: "Self Fallback" });
        }
        await fetch(`${API_URL}/api/sos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userData?.uid,
            userName: userData?.name || 'SafeStep User',
            userPhone: userData?.phone || '',
            locationLink: mapsLink,
            contacts: contacts
          })
        });
        console.log('✅ SMS Dispatched');
      } catch (e) {
        console.error('❌ SMS Fetch Error:', e);
        setSosStatus(t('sms_failed_warning'));
      }
    };
    triggerSMS();

    // --- STEP 3: VOLUNTEER ALERTS ---
    const triggerVolunteerAlert = async () => {
      try {
        const docRef = await addDoc(collection(db, 'sos_alerts'), {
          victimId: userData?.uid,
          victimName: userData?.name || 'SafeStep User',
          lat: lat,
          lng: lng,
          status: 'active',
          timestamp: serverTimestamp(),
          locationLink: mapsLink,
          responders: []
        });
        setSosAlertId(docRef.id);
        console.log('✅ Volunteer Alert Live:', docRef.id);
      } catch (e) {
        console.error('❌ Volunteer Alert Error:', e);
      }
    };
    triggerVolunteerAlert();

    // --- STEP 4: EMERGENCY RECORDING ---
    const triggerRecording = async () => {
      try {
        await startRecording(null, mediaStream);
        console.log('✅ Recording Started');
      } catch (e) {
        console.error('❌ Recording Start Error:', e);
      }
    };
    triggerRecording();
  };

  const sendTestSMS = async () => {
    const testNum = userData?.phone || (userData?.contacts && userData.contacts[0]?.phone);
    if (!testNum) {
      alert("Please add a contact or your own phone number first!");
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/test-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testNum })
      });
      const data = await res.json();
      if (res.ok) alert("Test SMS Sent!");
      else throw new Error(data.error || 'Check server logs');
    } catch (err) {
      console.error('Test SMS failure:', err);
      alert(`TEST SMS FAILED!\n\nError: ${err.message}`);
    }
  };

  const speak = (msgKey, params = {}) => {
    const msg = new SpeechSynthesisUtterance();
    const lang = i18n.language || 'en';
    let text = t(msgKey, params);
    
    if (lang === 'hi') msg.lang = 'hi-IN';
    else if (lang === 'te') msg.lang = 'te-IN';
    else msg.lang = 'en-US';

    msg.text = text;
    msg.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  };

  const startGuidance = () => {
    if (!nearestSpot) return;
    setIsGuiding(true);
    speak('guidance_started', { name: nearestSpot.name });
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${nearestSpot.lat},${nearestSpot.lng}&travelmode=walking`, '_blank');
  };

  useEffect(() => {
    let watchId;
    if (isGuiding && nearestSpot) {
      watchId = navigator.geolocation.watchPosition((pos) => {
        const dist = getDistance(pos.coords.latitude, pos.coords.longitude, nearestSpot.lat, nearestSpot.lng);
        const roundedDist = Math.round(dist);
        setSpotDistance(roundedDist);

        if (roundedDist <= 5) {
          speak('arrived');
          setIsGuiding(false);
        } else if (roundedDist <= 20 && lastSpokenDist > 20) {
          speak('arriving');
          setLastSpokenDist(roundedDist);
        } else if (Math.abs(lastSpokenDist - roundedDist) >= 30) {
          speak('go_straight', { dist: roundedDist });
          setLastSpokenDist(roundedDist);
        }
      }, null, { enableHighAccuracy: true });
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isGuiding, nearestSpot, lastSpokenDist]);

  const cancelSOS = async () => {
    setSosActive(false);
    setSosStatus('');
    setSosCountdown(10);
    setRespondersCount(0);
    stopRecording();
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }
    
    if (sosAlertId) {
      try {
        await updateDoc(doc(db, 'sos_alerts', sosAlertId), {
          status: 'cancelled',
          cancelledAt: serverTimestamp()
        });
        setSosAlertId(null);
      } catch (err) {
        console.error('Failed to cancel broadcast:', err);
      }
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
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <Shield className="text-primary" size={24} /> Nirbhaya Nari
        </h1>
        <div className="flex items-center gap-3">
          <span className="font-semibold text-secondary">{userData?.name || 'User'}</span>
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold overflow-hidden cursor-pointer" onClick={() => navigate('/profile')}>
             {userData?.name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {permissionError && (
          <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg mb-4 text-center mx-4">
            {permissionError}
          </div>
        )}

        {preSosActive ? (
          <div className="flex flex-col items-center justify-center bg-orange-50 w-full h-full rounded-2xl p-6 border-2 border-orange-200">
            <h2 className="text-2xl font-bold text-orange-600 mb-2">{t('shake_detected')}</h2>
            <div className="text-6xl font-black text-orange-600 mb-6">{preSosCountdown}s</div>
            <p className="text-center text-orange-500 font-medium mb-8">
              {t('sos_sent_in')} {preSosCountdown}s. {t('cancel_desc')}.
            </p>
            <button onClick={cancelPreSOS} className="px-8 py-4 bg-gray-800 text-white font-bold rounded-xl w-full max-w-xs shadow-lg">
              {t('cancel')}
            </button>
          </div>
        ) : sosActive ? (
          <div className="flex flex-col items-center justify-center bg-red-50 w-full h-full rounded-2xl p-6 border-2 border-red-200">
            <h2 className="text-2xl font-bold text-red-600 mb-2">{sosStatus}</h2>
            <div className="text-6xl font-black text-red-600 mb-6">{sosCountdown}s</div>
            
            {nearestSpot && (
              <div className="bg-white/80 p-4 rounded-2xl border-2 border-red-100 mb-6 w-full shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                    <MapIcon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-secondary text-sm">{t('nearest_safe_spot')}</h3>
                    <p className="text-xs text-gray-500 font-medium">{nearestSpot.name} • {spotDistance}m</p>
                  </div>
                </div>
                <button onClick={startGuidance} className={`w-full py-3 ${isGuiding ? 'bg-orange-500' : 'bg-green-600'} text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition shadow-md`}>
                  <Navigation size={18} />
                  {isGuiding ? 'GUIDANCE ACTIVE...' : t('quick_navigate')}
                </button>
              </div>
            )}

            {isRecording && (
              <div className="flex items-center gap-2 mb-4 bg-red-100 px-3 py-1 rounded-full animate-pulse border border-red-200">
                <div className="w-2 h-2 rounded-full bg-red-600"></div>
                <span className="text-[10px] font-bold text-red-600 uppercase">Emergency Recording Active</span>
              </div>
            )}

            <p className="text-center text-red-500 font-medium mb-8">
              {t('sos_desc')}
              {respondersCount > 0 && (
                <span className="block mt-2 font-bold text-green-600 animate-bounce">
                  ✨ {respondersCount} {t('volunteers_notified')}!
                </span>
              )}
            </p>
            <button onClick={cancelSOS} className="px-8 py-4 bg-gray-800 text-white font-bold rounded-xl w-full max-w-xs shadow-lg">
              {t('cancel_sos')}
            </button>
          </div>
        ) : (
          <button onClick={triggerSOS} className="w-48 h-48 rounded-full bg-primary flex items-center justify-center shadow-[0_0_40px_rgba(230,57,70,0.4)] active:scale-95 active:bg-red-700 transition animate-[pulse_3s_infinite]">
            <span className="text-white text-5xl font-black tracking-wider">{t('sos')}</span>
          </button>
        )}
      </div>

      <div className="px-6 py-4 grid border-t border-b border-gray-100 bg-white shadow-sm shrink-0 gap-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-700">
            <Smartphone size={20} className={isShakeEnabled ? "text-primary animate-bounce delaya-150" : "text-gray-400"} />
            <span className="font-medium text-sm">{t('shake_sos')}</span>
          </div>
          <button onClick={toggleShake} className={`w-14 h-7 rounded-full p-1 transition-colors ${isShakeEnabled ? 'bg-primary' : 'bg-gray-300'}`}>
            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${isShakeEnabled ? 'translate-x-7' : 'translate-x-0'}`}></div>
          </button>
        </div>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2 text-gray-700">
            <Mic size={20} className={screamDetectOn ? 'text-primary animate-pulse' : 'text-gray-400'} />
            <span className="font-medium text-sm">{t('scream_detection')}</span>
          </div>
          <button onClick={toggleScream} className={`w-14 h-7 rounded-full p-1 transition-colors ${screamDetectOn ? 'bg-primary' : 'bg-gray-300'}`}>
            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${screamDetectOn ? 'translate-x-7' : 'translate-x-0'}`}></div>
          </button>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-700">
            <MapPin size={20} className={isLocationSharing ? "text-accent" : "text-gray-400"} />
            <span className="font-medium text-sm">{t('location_sharing')}</span>
          </div>
          <button onClick={() => { setIsLocationSharing(!isLocationSharing); if (!isLocationSharing) navigate('/live-location'); }} className={`w-14 h-7 rounded-full p-1 transition-colors ${isLocationSharing ? 'bg-accent' : 'bg-gray-300'}`}>
            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${isLocationSharing ? 'translate-x-7' : 'translate-x-0'}`}></div>
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-2 gap-4 shrink-0 bg-gray-50">
        <div onClick={() => navigate('/fake-call')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-300 hover:shadow-md active:scale-95 transition">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600"><PhoneCall size={24} /></div>
          <span className="font-semibold text-sm text-secondary">{t('fake_call')}</span>
        </div>
        <div onClick={() => navigate('/safe-route')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-300 hover:shadow-md active:scale-95 transition">
          <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-500"><MapIcon size={24} /></div>
          <span className="font-semibold text-sm text-secondary">{t('safe_route')}</span>
        </div>
        <div onClick={() => navigate('/contacts')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 cursor-pointer hover:border-green-300 hover:shadow-md active:scale-95 transition">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600"><User size={24} /></div>
          <span className="font-semibold text-sm text-secondary">{t('add_contacts')}</span>
        </div>
        <div onClick={() => navigate('/follower-detector')} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 cursor-pointer hover:border-red-300 hover:shadow-md active:scale-95 transition">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500"><Radar size={24} /></div>
          <span className="font-semibold text-sm text-secondary">{t('follower_detector')}</span>
        </div>
      </div>

      <div className="pb-24 px-6 flex flex-col items-center gap-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Active Backend</span>
          <span className="text-[10px] font-mono text-blue-500 break-all text-center px-4">{API_URL}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={sendTestSMS} className="text-[10px] font-bold text-gray-400 border border-gray-200 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-gray-100 transition">Test SMS</button>
          <button onClick={() => {
            const newUrl = prompt("Enter your Backend URL:", API_URL);
            if (newUrl) { localStorage.setItem("VITE_API_URL", newUrl); window.location.reload(); }
          }} className="text-[10px] font-bold text-blue-400 border border-blue-100 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-blue-50 transition">Update URL</button>
        </div>
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
