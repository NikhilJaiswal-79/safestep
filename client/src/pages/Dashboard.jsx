import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Mic, MapPin, PhoneCall, Map as MapIcon, Rss, HelpCircle, User, Smartphone, Radar, Navigation, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
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
    sosMediaStream, setSosMediaStream,
    isRecording, startEmergencyRecording, stopEmergencyRecording
  } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [preSosActive, setPreSosActive] = useState(false);
  const [preSosCountdown, setPreSosCountdown] = useState(10);
  const [respondersCount, setRespondersCount] = useState(0);
  const [nearestSpot, setNearestSpot] = useState(null);
  const [spotDistance, setSpotDistance] = useState(0);
  const [isGuiding, setIsGuiding] = useState(false);
  const [lastSpokenDist, setLastSpokenDist] = useState(0);
  const [lastEvidenceUrl, setLastEvidenceUrl] = useState(null);

  // API URL logic
  const productionUrl = 'https://safestep-virid.vercel.app';
  const rawApiUrl = localStorage.getItem('VITE_API_URL') || import.meta.env.VITE_API_URL || productionUrl;
  const API_URL = rawApiUrl.endsWith('/') ? rawApiUrl.slice(0, -1) : rawApiUrl;

  // Watch countdown to fire actions at T=0
  useEffect(() => {
    if (sosActive && sosCountdown === 0) {
      fireSOSActions();
    }
  }, [sosActive, sosCountdown]);

  // Auto-trigger logic
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

  // Listen for responders
  useEffect(() => {
    if (!sosAlertId) {
      setRespondersCount(0);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, 'sos_alerts', sosAlertId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRespondersCount(data.responders?.length || 0);
        if (data.evidenceUrl) setLastEvidenceUrl(data.evidenceUrl);
      }
    });
    return () => unsubscribe();
  }, [sosAlertId]);

  const handleScreamDetected = useCallback(() => {
    if (!sosActive && !preSosActive) {
      setPreSosActive(true);
      setPreSosCountdown(10);
      if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500, 200]);
    }
  }, [sosActive, preSosActive]);

  const { isListening: screamDetectOn, toggleListening: toggleScream, error: screamError } = useScreamDetection(handleScreamDetected);

  const handleShakeDetected = useCallback(() => {
    if (!sosActive && !preSosActive) {
      setPreSosActive(true);
      setPreSosCountdown(10);
      if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500, 200]);
    }
  }, [sosActive, preSosActive]);

  const { isShakeEnabled, toggleShake, permissionError } = useShakeToSOS(handleShakeDetected);

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
    
    // Pre-capture media globally
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => {
        setSosMediaStream(stream);
        console.log('🎤 Global media stream ready.');
      })
      .catch(e => console.error("❌ Media capture error:", e));

    // Pre-capture location
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
    const lat = sosLocation?.lat || 0;
    const lng = sosLocation?.lng || 0;
    
    // Use legacy but robust maps link format for all devices
    const mapsLink = `https://maps.google.com/maps?q=${lat},${lng}`;

    if (nearestSpot) startGuidance();

    // SMS
    try {
      const contacts = userData?.contacts || [];
      if (contacts.length === 0 && userData?.phone) contacts.push({ name: "Emergency", phone: userData.phone });
      await fetch(`${API_URL}/api/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userData?.uid, userName: userData?.name || 'User', locationLink: mapsLink, contacts })
      });
    } catch (e) { console.error('❌ SMS Error:', e); }

    // Volunteers
    try {
      const docRef = await addDoc(collection(db, 'sos_alerts'), {
        victimId: userData?.uid, victimName: userData?.name || 'User',
        lat, lng, status: 'active', timestamp: serverTimestamp(), locationLink: mapsLink, responders: []
      });
      setSosAlertId(docRef.id);
    } catch (e) { console.error('❌ Volunteer Alert Error:', e); }

    // Global Recording (using pre-captured stream)
    startEmergencyRecording(sosMediaStream);
  };

  const startGuidance = () => {
    if (!nearestSpot) return;
    setIsGuiding(true);
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
    <div className="flex flex-col h-screen bg-slate-50 relative overflow-y-auto pb-24">
      {/* Header */}
      <div className="flex justify-between items-center p-5 bg-white shadow-sm shrink-0 sticky top-0 z-20">
        <h1 className="text-2xl font-black text-rose-600 flex items-center gap-2 italic">
          <Shield className="fill-rose-600" size={28} /> NIRBHAYA NARI
        </h1>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Welcome back</p>
            <p className="font-bold text-slate-700 text-sm">{userData?.name || 'User'}</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white font-bold shadow-lg shadow-rose-200 cursor-pointer overflow-hidden" onClick={() => navigate('/profile')}>
             {userData?.name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        {preSosActive ? (
          <div className="flex flex-col items-center justify-center bg-orange-50 w-full aspect-square rounded-[40px] p-8 border-4 border-orange-200 shadow-2xl shadow-orange-100 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-orange-200 rounded-full flex items-center justify-center mb-4 animate-bounce">
              <Smartphone size={40} className="text-orange-600" />
            </div>
            <h2 className="text-3xl font-black text-orange-600 mb-2">{t('shake_detected')}</h2>
            <div className="text-8xl font-black text-orange-600 mb-6 drop-shadow-sm">{preSosCountdown}</div>
            <p className="text-center text-orange-500/80 font-bold text-sm mb-8 leading-tight">
              SOS firing in {preSosCountdown}s.<br/>Shake to dismiss or click below.
            </p>
            <button onClick={() => {setPreSosActive(false); setPreSosCountdown(10); if(navigator.vibrate) navigator.vibrate(0);}} className="w-full py-5 bg-slate-800 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-transform tracking-widest text-lg uppercase">
              {t('cancel')}
            </button>
          </div>
        ) : sosActive ? (
          <div className="flex flex-col items-center justify-center bg-rose-50 w-full min-h-[500px] rounded-[40px] p-8 border-4 border-rose-200 shadow-2xl shadow-rose-100 animate-in zoom-in-95 duration-300">
            <h2 className="text-2xl font-black text-rose-600 mb-2 uppercase tracking-tight">{sosStatus}</h2>
            <div className="text-9xl font-black text-rose-600 mb-8 drop-shadow-md leading-none">{sosCountdown}</div>
            
            {nearestSpot && (
              <div className="bg-white p-5 rounded-3xl border-2 border-rose-100 mb-6 w-full shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Navigation size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-slate-700 text-sm leading-none mb-1 uppercase tracking-tighter">Next Safe Destination</h3>
                    <p className="text-xs text-slate-400 font-bold">{nearestSpot.name} • {spotDistance}m away</p>
                  </div>
                </div>
                <button onClick={startGuidance} className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all">
                  <Radar size={18} /> OPEN NAVIGATION MAP
                </button>
              </div>
            )}

            {isRecording && (
              <div className="flex items-center gap-3 mb-8 bg-rose-600 text-white px-6 py-2 rounded-full animate-pulse shadow-lg shadow-rose-200">
                <div className="w-3 h-3 rounded-full bg-white animate-ping"></div>
                <span className="text-xs font-black uppercase tracking-widest">Live Evidence Recording</span>
              </div>
            )}

            <p className="text-center text-slate-400 font-bold text-[10px] uppercase mb-8 tracking-widest px-4 leading-relaxed">
              {respondersCount > 0 ? (
                <span className="text-emerald-500 block animate-bounce">✨ {respondersCount} Volunteers have been notified!</span>
              ) : t('sos_desc')}
            </p>
            
            <button onClick={cancelSOS} className="w-full py-5 bg-slate-800 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-transform tracking-widest text-lg uppercase">
              {t('cancel_sos')}
            </button>
          </div>
        ) : (
          <div className="relative group">
            <div className="absolute -inset-10 bg-rose-500/20 rounded-full blur-[60px] animate-[pulse_4s_infinite] group-hover:bg-rose-500/30 transition-all"></div>
            <button onClick={triggerSOS} className="w-56 h-56 rounded-full bg-gradient-to-tr from-rose-600 to-rose-400 flex items-center justify-center shadow-2xl shadow-rose-200 border-8 border-white active:scale-90 transition-all relative z-10 overflow-hidden">
               <div className="absolute inset-0 bg-white/20 opacity-0 group-active:opacity-100 transition-opacity"></div>
               <span className="text-white text-6xl font-black italic tracking-tighter drop-shadow-md">SOS</span>
            </button>
          </div>
        )}
      </div>

      {/* Feature Toggles */}
      {!sosActive && !preSosActive && (
        <>
          <div className="px-8 mb-8 grid gap-4 shrink-0">
             <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-2xl ${isShakeEnabled ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                      <Smartphone size={24} className={isShakeEnabled ? "animate-bounce" : ""} />
                   </div>
                   <div>
                      <p className="font-black text-slate-700 text-sm tracking-tight">{t('shake_sos')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Triple shake to fire</p>
                   </div>
                </div>
                <button onClick={toggleShake} className={`w-14 h-8 rounded-full p-1.5 transition-all ${isShakeEnabled ? 'bg-rose-600' : 'bg-slate-200'}`}>
                   <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-all ${isShakeEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
             </div>

             <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-2xl ${screamDetectOn ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                      <Mic size={24} className={screamDetectOn ? "animate-pulse" : ""} />
                   </div>
                   <div>
                      <p className="font-black text-slate-700 text-sm tracking-tight">{t('scream_detection')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Mic always listening</p>
                   </div>
                </div>
                <button onClick={toggleScream} className={`w-14 h-8 rounded-full p-1.5 transition-all ${screamDetectOn ? 'bg-rose-600' : 'bg-slate-200'}`}>
                   <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-all ${screamDetectOn ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
             </div>

             <div className="flex justify-between items-center bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                   <div className={`p-3 rounded-2xl ${isLocationSharing ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                      <MapPin size={24} className={isLocationSharing ? "animate-pulse" : ""} />
                   </div>
                   <div>
                      <p className="font-black text-slate-700 text-sm tracking-tight">{t('location_sharing')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Real-time tracking</p>
                   </div>
                </div>
                <button onClick={() => { setIsLocationSharing(!isLocationSharing); if(!isLocationSharing) navigate('/live-location'); }} className={`w-14 h-8 rounded-full p-1.5 transition-all ${isLocationSharing ? 'bg-emerald-600' : 'bg-slate-200'}`}>
                   <div className={`bg-white w-5 h-5 rounded-full shadow-sm transform transition-all ${isLocationSharing ? 'translate-x-6' : 'translate-x-0'}`}></div>
                </button>
             </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="px-8 grid grid-cols-2 gap-4 mb-12">
            {[
              { id: 'fake-call', label: t('fake_call'), color: 'bg-indigo-50', iconColor: 'bg-indigo-600', icon: <PhoneCall size={24} /> },
              { id: 'safe-route', label: t('safe_route'), color: 'bg-orange-50', iconColor: 'bg-orange-500', icon: <Navigation size={24} /> },
              { id: 'contacts', label: t('add_contacts'), color: 'bg-emerald-50', iconColor: 'bg-emerald-600', icon: <User size={24} /> },
              { id: 'follower-detector', label: t('follower_detector'), color: 'bg-rose-50', iconColor: 'bg-rose-500', icon: <Radar size={24} /> }
            ].map(card => (
              <div key={card.id} onClick={() => navigate(`/${card.id}`)} className={`${card.color} p-6 rounded-[32px] flex flex-col items-center gap-3 cursor-pointer group active:scale-95 transition-all hover:shadow-lg border border-white`}>
                <div className={`w-14 h-14 rounded-2xl ${card.iconColor} text-white flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform`}>
                  {card.icon}
                </div>
                <span className="font-black text-slate-700 text-xs text-center tracking-tight uppercase">{card.label}</span>
              </div>
            ))}
          </div>

          {/* Debug Footer */}
          <div className="pb-8 px-8 flex flex-col items-center gap-4">
            <div className="flex flex-col items-center gap-1.5 grayscale opacity-40">
               <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Universal System Node</span>
               <span className="text-[10px] font-mono text-slate-700 break-all text-center px-6 leading-tight">{API_URL}</span>
            </div>
            <button onClick={() => {
              const u = prompt("Emergency Node Override:", API_URL);
              if(u) { localStorage.setItem("VITE_API_URL", u); window.location.reload(); }
            }} className="text-[8px] font-black text-slate-400 bg-white border border-slate-200 px-4 py-2 rounded-full uppercase tracking-[0.1em] hover:bg-slate-50 transition-colors">
              Configure Network
            </button>
          </div>
        </>
      )}

      {/* Persistent Navigation */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white/90 backdrop-blur-xl border-t border-slate-100 flex justify-between px-8 py-4 pb-10 z-50 rounded-t-[40px] shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        {navItems.map((item, index) => (
          <button key={index} onClick={() => navigate(item.path)} className={`flex flex-col items-center gap-1.5 ${index === 0 ? 'text-rose-600 scale-110' : 'text-slate-300'} transition-all`}>
            {item.icon}
            <span className="text-[8px] font-black uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
