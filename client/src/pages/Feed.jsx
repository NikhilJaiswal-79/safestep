import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, increment, Timestamp, GeoPoint } from 'firebase/firestore';
import { Rss, MapPin, ThumbsUp, Flag, RefreshCw, AlertTriangle } from 'lucide-react';

const INCIDENT_ICONS = {
  'Eve Teasing': '😤',
  'Stalking': '👁️',
  'Assault': '🚨',
  'Poor Lighting': '🔦',
  'Unsafe Road': '🚧',
  'Suspicious Person': '⚠️',
  'Other': '❗',
};

function timeAgo(timestamp) {
  if (!timestamp) return 'recently';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Feed() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [userPos, setUserPos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [helpedIds, setHelpedIds] = useState(new Set());
  const [flaggedIds, setFlaggedIds] = useState(new Set());

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setUserPos({ lat: 17.385, lng: 78.4867 }) // Default Hyderabad
    );
  }, []);

  useEffect(() => {
    // Load last 30 days incidents, newest first
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const q = query(
      collection(db, 'incidents'),
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Filter to 10km radius if user location is available
      const filtered = userPos
        ? all.filter(inc => {
            if (!inc.lat || !inc.lng) return false;
            const dist = getDistance(userPos.lat, userPos.lng, inc.lat, inc.lng);
            return dist <= 10;
          })
        : all;

      setIncidents(filtered);
      setLoading(false);
      setLastRefresh(new Date());
    });

    return () => unsub();
  }, [userPos]);

  // Auto-refresh every 60s
  useEffect(() => {
    const t = setInterval(() => setLastRefresh(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const markHelpful = async (id) => {
    if (helpedIds.has(id)) return;
    setHelpedIds(prev => new Set([...prev, id]));
    try {
      await updateDoc(doc(db, 'incidents', id), { helpful: increment(1) });
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, helpful: (i.helpful || 0) + 1 } : i));
    } catch (e) {}
  };

  const flagFalseAlarm = async (id) => {
    if (flaggedIds.has(id)) return;
    setFlaggedIds(prev => new Set([...prev, id]));
    try {
      await updateDoc(doc(db, 'incidents', id), { flagged: increment(1) });
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, flagged: (i.flagged || 0) + 1 } : i));
    } catch (e) {}
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Rss size={20} className="text-primary" />
          <h1 className="text-lg font-bold text-secondary">Community Feed</h1>
        </div>
        <div className="text-xs text-gray-400">
          Updated {Math.floor((Date.now() - lastRefresh.getTime()) / 1000)}s ago
        </div>
      </div>

      {/* Filter pills */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto">
        {['All', ...Object.keys(INCIDENT_ICONS)].slice(0, 6).map(type => (
          <span key={type} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full whitespace-nowrap font-medium shrink-0">
            {INCIDENT_ICONS[type] || ''} {type}
          </span>
        ))}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!loading && incidents.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <Rss size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-semibold">No incidents reported nearby</p>
            <p className="text-gray-400 text-sm mt-1">Your community looks safe right now ✅</p>
          </div>
        )}

        {incidents.map(inc => {
          const distKm = userPos && inc.lat
            ? getDistance(userPos.lat, userPos.lng, inc.lat, inc.lng)
            : null;

          return (
            <div key={inc.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              {/* Header row */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{INCIDENT_ICONS[inc.type] || '❗'}</span>
                  <div>
                    <p className="font-bold text-secondary text-sm">{inc.type}</p>
                    <p className="text-gray-400 text-xs">{timeAgo(inc.createdAt)}</p>
                  </div>
                </div>
                {distKm !== null && (
                  <span className="text-xs bg-blue-50 text-secondary font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <MapPin size={10} />
                    {distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`}
                  </span>
                )}
              </div>

              {inc.description && (
                <p className="text-sm text-gray-600 mb-3 leading-relaxed">{inc.description}</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-gray-50">
                <button
                  onClick={() => markHelpful(inc.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition ${
                    helpedIds.has(inc.id)
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-600'
                  }`}
                >
                  <ThumbsUp size={13} />
                  Helpful {inc.helpful > 0 ? `(${inc.helpful})` : ''}
                </button>
                <button
                  onClick={() => flagFalseAlarm(inc.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition ${
                    flaggedIds.has(inc.id)
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-gray-50 text-gray-500 hover:bg-orange-50 hover:text-orange-500'
                  }`}
                >
                  <Flag size={13} />
                  False Alarm {inc.flagged > 0 ? `(${inc.flagged})` : ''}
                </button>
                <button
                  onClick={() => navigate('/map')}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition ml-auto"
                >
                  <MapPin size={13} />
                  Map
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-gray-200 flex justify-between px-6 py-3 pb-6 z-50">
        {[
          { icon: '🏠', label: 'Home', path: '/' },
          { icon: '🗺️', label: 'Map', path: '/map' },
          { icon: '📡', label: 'Feed', path: '/feed', active: true },
          { icon: '📞', label: 'Help', path: '/help' },
          { icon: '👤', label: 'Profile', path: '/profile' },
        ].map(item => (
          <button key={item.path} onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 ${item.active ? 'text-primary' : 'text-gray-400'}`}>
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
