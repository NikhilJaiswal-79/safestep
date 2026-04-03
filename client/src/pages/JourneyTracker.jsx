import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Navigation, Clock, Users, CheckCircle, AlertTriangle, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAnomalyDetection from '../hooks/useAnomalyDetection';

function generateSessionId() {
  return 'jrny_' + Math.random().toString(36).substring(2, 10);
}

export default function JourneyTracker() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();

  const [journeyActive, setJourneyActive] = useState(false);
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState(30); // minutes
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState(''); // '', 'active', 'stopped', 'anomaly'
  const [safetyCheckVisible, setSafetyCheckVisible] = useState(false);
  const [autoSosCountdown, setAutoSosCountdown] = useState(null);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const [lastPos, setLastPos] = useState(null);
  const [stoppedSince, setStoppedSince] = useState(null);
  const [destCoords, setDestCoords] = useState(null);

  const journeyTimer = useRef(null);
  const locationTracker = useRef(null);
  const autoSosTimer = useRef(null);
  const stoppedTimer = useRef(null);

  // Hook for Anomaly Detection (Phase 4)
  const { threatScore } = useAnomalyDetection({
    active: journeyActive,
    destination: destCoords,
    onAnomaly: (score) => {
      setStatus('anomaly');
      setSafetyCheckVisible(true);
      setAutoSosCountdown(180); // 3 min to respond
    }
  });

  const contacts = userData?.contacts || [];

  useEffect(() => {
    return () => {
      clearInterval(journeyTimer.current);
      clearInterval(locationTracker.current);
      clearTimeout(autoSosTimer.current);
      clearTimeout(stoppedTimer.current);
    };
  }, []);

  // Countdown for auto SOS if safety check ignored
  useEffect(() => {
    if (autoSosCountdown === null) return;
    if (autoSosCountdown <= 0) {
      setAutoSosCountdown(null);
      setSafetyCheckVisible(false);
      triggerSOS();
      return;
    }
    const t = setTimeout(() => setAutoSosCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [autoSosCountdown]);

  const triggerSOS = () => {
    navigate('/?sos=true');
  };

  const startJourney = async () => {
    if (!destination.trim()) return alert('Please enter a destination.');
    if (selectedContacts.length === 0) return alert('Please select at least 1 contact to notify.');

    const sid = generateSessionId();
    setSessionId(sid);
    setJourneyActive(true);
    setStatus('active');
    setElapsedMinutes(0);

    // Save to Firebase
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      const mapsLink = `https://maps.google.com/?q=${latitude},${longitude}`;
      setLastPos({ lat: latitude, lng: longitude });

      await setDoc(doc(db, 'journeys', sid), {
        userId: currentUser.uid,
        userName: userData?.name || 'User',
        destination,
        durationMinutes: duration,
        contacts: selectedContacts,
        startTime: new Date().toISOString(),
        expectedArrival: new Date(Date.now() + duration * 60000).toISOString(),
        startLocation: mapsLink,
        status: 'active'
      });

      // For demo: set dest coords to current + small offset if not real
      setDestCoords([latitude + 0.01, longitude + 0.01]);
    });

    // Elapsed timer
    journeyTimer.current = setInterval(() => {
      setElapsedMinutes(prev => {
        if (prev + 1 >= duration) {
          // Journey should have ended - prompt
          setSafetyCheckVisible(true);
          setAutoSosCountdown(180); // 3 min
        }
        return prev + 1;
      });
    }, 60000);
  };

  const endJourney = async () => {
    clearInterval(journeyTimer.current);
    clearInterval(locationTracker.current);
    clearTimeout(autoSosTimer.current);
    setSafetyCheckVisible(false);
    setAutoSosCountdown(null);

    if (sessionId) {
      await setDoc(doc(db, 'journeys', sessionId), { status: 'completed', endTime: new Date().toISOString() }, { merge: true });
    }
    setJourneyActive(false);
    setStatus('stopped');
    setSessionId(null);
    setElapsedMinutes(0);
    setStoppedSince(null);
  };

  const confirmSafe = () => {
    setSafetyCheckVisible(false);
    setAutoSosCountdown(null);
    setStatus('active');
    setStoppedSince(null);
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const toggleContact = (contact) => {
    setSelectedContacts(prev =>
      prev.some(c => c.phone === contact.phone)
        ? prev.filter(c => c.phone !== contact.phone)
        : [...prev, contact]
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      {/* Safety Check Overlay */}
      {safetyCheckVisible && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <AlertTriangle size={48} className="text-orange-500 mx-auto mb-3" />
            <h2 className="text-xl font-black text-secondary mb-2">Are you okay?</h2>
            <p className="text-gray-500 text-sm mb-4">
              {status === 'anomaly'
                ? 'You appear to have stopped unexpectedly. Tap YES if you are safe.'
                : 'Your journey time has ended. Did you arrive safely?'}
            </p>
            {autoSosCountdown !== null && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-red-600 font-bold text-sm">
                  Auto-SOS in {autoSosCountdown}s if no response
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={confirmSafe}
                className="flex-1 py-4 bg-green-500 text-white font-black rounded-xl text-lg shadow-md active:scale-95"
              >
                YES, I'm safe ✅
              </button>
              <button
                onClick={triggerSOS}
                className="flex-1 py-4 bg-red-500 text-white font-black rounded-xl text-lg shadow-md active:scale-95"
              >
                SOS 🚨
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 p-4 bg-white shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-secondary">Journey Tracker</h1>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {!journeyActive ? (
          <>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="block text-sm font-semibold text-gray-600 mb-2">
                <Navigation size={14} className="inline mr-1" /> Destination
              </label>
              <input
                type="text"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                placeholder="e.g. Home, Office, Metro Station..."
                className="w-full p-4 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <label className="block text-sm font-semibold text-gray-600 mb-3">
                <Clock size={14} className="inline mr-1" /> Expected Travel Time
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5" max="120" step="5"
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-2xl font-black text-secondary w-20 text-right">{duration} min</span>
              </div>
            </div>

            {contacts.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <label className="block text-sm font-semibold text-gray-600 mb-3">
                  <Users size={14} className="inline mr-1" /> Notify Contacts
                </label>
                <div className="flex flex-col gap-2">
                  {contacts.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => toggleContact(c)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                        selectedContacts.some(x => x.phone === c.phone)
                          ? 'border-secondary bg-blue-50'
                          : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {c.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-secondary">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.relation} · {c.phone}</p>
                      </div>
                      {selectedContacts.some(x => x.phone === c.phone) && (
                        <CheckCircle size={20} className="text-secondary" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {contacts.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
                ⚠️ No trusted contacts added. <span className="underline cursor-pointer" onClick={() => navigate('/contacts')}>Add contacts →</span>
              </div>
            )}

            <button
              onClick={startJourney}
              className="w-full py-5 bg-secondary text-white font-black text-xl rounded-2xl shadow-lg hover:bg-blue-900 active:scale-95 transition"
            >
              🧭 Start Journey
            </button>
          </>
        ) : (
          <>
            {/* Active journey UI */}
            <div className="bg-blue-50 border-2 border-secondary rounded-2xl p-5 text-center">
              <div className="text-4xl font-black text-secondary mb-1">{elapsedMinutes} / {duration} min</div>
              <p className="text-secondary font-semibold">Journey to <strong>{destination}</strong></p>
              <div className="flex items-center justify-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-600 text-sm font-medium">Tracking active</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-sm text-gray-600">Notified contacts:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {selectedContacts.map((c, i) => (
                  <span key={i} className="bg-blue-100 text-secondary text-xs font-bold px-3 py-1 rounded-full">{c.name}</span>
                ))}
              </div>
            </div>

            <button
              onClick={endJourney}
              className="w-full py-4 bg-red-50 text-primary border-2 border-red-200 font-bold text-lg rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition"
            >
              <X size={20} />
              End Journey (Arrived Safely)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
