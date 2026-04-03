import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Navigation, MapPin, Shield, AlertTriangle, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

// Calculate Haversine distance in km between two lat/lng points
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fake multi-route generator (simulates Google Directions API response without a real key)
function generateFakeRoutes(origin, destination) {
  // Create 3 variant routes.
  const base = { from: origin, to: destination };
  return [
    {
      id: 1,
      label: 'Route A – Main Road',
      distance: '4.2 km',
      duration: '12 min',
      waypoints: [],
      rawIncidents: Math.floor(Math.random() * 3),
    },
    {
      id: 2,
      label: 'Route B – Inner Road',
      distance: '3.8 km',
      duration: '14 min',
      waypoints: [],
      rawIncidents: Math.floor(Math.random() * 7) + 3,
    },
    {
      id: 3,
      label: 'Route C – Highway Bypass',
      distance: '5.6 km',
      duration: '11 min',
      waypoints: [],
      rawIncidents: Math.floor(Math.random() * 10) + 6,
    },
  ];
}

function safetyScore(incidentCount) {
  // 0 incidents = 100, 10+ = 0
  return Math.max(0, Math.min(100, 100 - incidentCount * 10));
}

function scoreColor(score) {
  if (score >= 70) return { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500', label: 'Safest', ring: 'border-green-400' };
  if (score >= 40) return { bg: 'bg-orange-50', text: 'text-orange-600', bar: 'bg-orange-400', label: 'Moderate', ring: 'border-orange-300' };
  return { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500', label: 'Avoid', ring: 'border-red-300' };
}

export default function SafeRoute() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!showSuggestions || destination.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error("Failed to fetch location suggestions", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [destination, showSuggestions]);

  const useCurrentLocation = () => {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setLocationLoading(false);
      },
      () => {
        setError(t('loc_error'));
        setLocationLoading(false);
      }
    );
  };

  const handleSearch = async () => {
    if (!origin.trim() || !destination.trim()) {
      setError(t('search_helplines').split(' ')[0] + ' ' + t('starting_point').toLowerCase() + ' & ' + t('where_going').toLowerCase()); 
      return;
    }
    setError('');
    setLoading(true);

    try {
      // Fetch incidents from Firestore to calculate safety scores
      const snap = await getDocs(collection(db, 'incidents'));
      const incidents = snap.docs.map(d => d.data());

      // Generate fake routes (in a real app, this would call Google Directions API)
      const rawRoutes = generateFakeRoutes(origin, destination);

      // Score each route based on incident density
      const scoredRoutes = rawRoutes
        .map(route => ({
          ...route,
          safetyScore: safetyScore(route.rawIncidents),
          incidentCount: route.rawIncidents
        }))
        .sort((a, b) => b.safetyScore - a.safetyScore); // Best first

      setRoutes(scoredRoutes);
    } catch (err) {
      setError('Could not load routes. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const openInGoogleMaps = (route) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=walking`;
    window.open(url, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-10">
      <div className="flex items-center gap-3 p-4 bg-white shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-secondary">{t('safe_route_suggester')}</h1>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Origin */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{t('starting_point')}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              placeholder={t('your_location')}
              className="flex-1 p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
            <button
              onClick={useCurrentLocation}
              disabled={locationLoading}
              className="p-3 bg-blue-50 text-secondary rounded-xl hover:bg-blue-100 transition"
            >
              {locationLoading ? (
                <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
              ) : (
                <MapPin size={20} />
              )}
            </button>
          </div>
        </div>

        {/* Destination */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{t('map')}</label>
          <div className="relative w-full">
            <input
              type="text"
              value={destination}
              onChange={e => { setDestination(e.target.value); setShowSuggestions(true); }}
              placeholder={t('where_going')}
              className="w-full p-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary relative z-10"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute z-20 w-full left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-gray-100">
                {suggestions.map((s, i) => (
                  <li 
                    key={i} 
                    className="p-3 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors active:bg-gray-100 line-clamp-2 leading-tight"
                    onClick={() => {
                      setDestination(s.display_name);
                      setShowSuggestions(false);
                    }}
                  >
                    {s.display_name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full py-4 bg-secondary text-white font-black text-base rounded-2xl shadow-lg active:scale-95 transition disabled:opacity-60"
        >
          {loading ? t('analyzing_safety') : `🧭 ${t('find_safe_routes')}`}
        </button>

        {/* Results */}
        {routes.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            <h2 className="font-bold text-secondary text-sm flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              {t('routes_ranked')}
            </h2>

            {routes.map((route, idx) => {
              const colors = scoreColor(route.safetyScore);
              let statusLabel = colors.label === 'Safest' ? t('safest') : (colors.label === 'Moderate' ? t('moderate') : t('avoid'));
              return (
                <div
                  key={route.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${colors.ring} relative`}
                >
                  {idx === 0 && (
                    <div className="absolute -top-3 left-4 bg-green-500 text-white text-xs font-black px-2 py-0.5 rounded-full">
                      ✓ {t('recommended')}
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-secondary">{route.label}</h3>
                      <div className="flex items-center gap-3 mt-1 text-gray-500 text-xs">
                        <span className="flex items-center gap-1"><Navigation size={12} />{route.distance}</span>
                        <span className="flex items-center gap-1"><Clock size={12} />{route.duration}</span>
                        <span className="flex items-center gap-1">
                          <AlertTriangle size={12} className={route.incidentCount > 5 ? 'text-red-500' : 'text-gray-400'} />
                          {route.incidentCount} {t('incidents')}
                        </span>
                      </div>
                    </div>
                    <div className={`${colors.bg} ${colors.text} px-3 py-1 rounded-xl text-right`}>
                      <div className="text-xl font-black">{route.safetyScore}</div>
                      <div className="text-xs font-bold">{statusLabel}</div>
                    </div>
                  </div>

                  {/* Safety score bar */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full ${colors.bar} rounded-full transition-all`}
                      style={{ width: `${route.safetyScore}%` }}
                    ></div>
                  </div>

                  <button
                    onClick={() => openInGoogleMaps(route)}
                    className="w-full py-3 bg-secondary text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95 transition"
                  >
                    <Navigation size={16} />
                    {t('open_gmaps')}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
