import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Share2, Copy, MapPin, X, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function generateSessionId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function LiveLocation() {
  const { currentUser, userData, isLocationSharing, setIsLocationSharing } = useAuth();
  const navigate = useNavigate();
  const [copySuccess, setCopySuccess] = useState(false);
  const [contactCount, setContactCount] = useState(0);
  const [batteryWarning, setBatteryWarning] = useState(false);
  const intervalRef = useRef(null);

  // Derive the sessionId directly from current user UID
  const sessionId = currentUser ? `bg-${currentUser.uid}` : null;
  const shareableLink = sessionId ? `${window.location.origin}/track/${sessionId}` : '';

  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        if (battery.level <= 0.2) setBatteryWarning(true);
      });
    }
  }, []);

  const shareLocation = async (sessionId) => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      await setDoc(doc(db, 'liveSessions', sessionId), {
        userId: currentUser.uid,
        name: userData?.name || 'SafeStep User',
        lat: latitude,
        lng: longitude,
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hours
      });
    }, (err) => {
      console.error('Location error:', err);
    });
  };

  const startSharing = async () => {
    setIsLocationSharing(true);
    setContactCount(userData?.contacts?.length || 0);
  };

  const stopSharing = async () => {
    setIsLocationSharing(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`I'm sharing my live location with you via Nirbhaya Nari. Track me here: ${shareableLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex items-center gap-3 p-4 bg-white shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-secondary">Live Location Sharing</h1>
      </div>

      <div className="p-6 flex flex-col gap-5 flex-1">
        {batteryWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-700 text-sm font-medium flex items-center gap-2">
            🔋 Battery below 20%. Location sharing may drain battery faster.
          </div>
        )}

        {!isLocationSharing ? (
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <MapPin size={36} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-secondary mb-2">Share Live Location</h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                Generate a link your trusted contacts can open to see your real-time location. Updates every 10 seconds.
              </p>
            </div>

            <button
              onClick={startSharing}
              className="w-full py-5 bg-green-500 text-white font-black text-xl rounded-2xl shadow-lg hover:bg-green-600 active:scale-95 transition"
            >
              📍 Start Sharing Location
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Active banner */}
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                <div className="w-3.5 h-3.5 rounded-full bg-white animate-ping"></div>
              </div>
              <div>
                <p className="font-bold text-green-800 text-lg leading-tight italic">Live Sharing ACTIVE</p>
                <p className="text-green-600 text-sm mt-0.5">Anyone with the link can track your position.</p>
              </div>
            </div>

            {/* Shareable link */}
            <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-100 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider pl-1">Your Tracking Link</p>
                <div className="bg-gray-50 rounded-2xl p-4 text-xs text-gray-700 break-all font-mono border border-indigo-50 leading-relaxed shadow-inner">
                  {shareableLink}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={copyLink}
                  className={`flex-1 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all transform active:scale-95 ${copySuccess ? 'bg-green-600 text-white shadow-lg' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                >
                  {copySuccess ? <CheckCircle size={20} /> : <Copy size={20} />}
                  {copySuccess ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={shareViaWhatsApp}
                  className="flex-1 py-4 bg-[#25D366] text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg hover:bg-[#1ebe57] transition-all transform active:scale-95"
                >
                  <Share2 size={20} />
                  WhatsApp
                </button>
              </div>
            </div>

            {/* Stop sharing */}
            <button
              onClick={stopSharing}
              className="w-full py-4 bg-red-50 text-primary border-2 border-red-200 font-bold text-lg rounded-2xl flex items-center justify-center gap-2 hover:bg-red-100 transition active:scale-95"
            >
              <X size={20} />
              Stop Sharing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
