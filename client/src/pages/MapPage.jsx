import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { Star, X as CloseIcon } from 'lucide-react';
import {
  MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Shield, TriangleAlert, Crosshair, FileWarning, Navigation, Filter } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Fix leaflet default icon
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const INCIDENT_COLORS = {
  'Eve Teasing': '#E63946',
  'Stalking': '#FF6B35',
  'Assault': '#8B0000',
  'Poor Lighting': '#FFC300',
  'Unsafe Road': '#FF8C00',
  'Suspicious Person': '#9B59B6',
  'Other': '#7F8C8D',
};

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, 14);
  }, [position]);
  return null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [userPos, setUserPos] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [unsafeZones, setUnsafeZones] = useState([]);
  const [filterType, setFilterType] = useState('All');
  const [filterDate, setFilterDate] = useState('month');
  const [showFilters, setShowFilters] = useState(false);
  const [unsafeAlert, setUnsafeAlert] = useState(null);
  const [activeTab, setActiveTab] = useState('heatmap'); // heatmap | safespots
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Get user location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
      () => setUserPos([17.385, 78.4867]) // Default: Hyderabad
    );
  }, []);

  // Load incidents from Firestore with real-time listener
  useEffect(() => {
    let startDate = new Date();
    if (filterDate === 'today') startDate.setHours(0, 0, 0, 0);
    else if (filterDate === 'week') startDate.setDate(startDate.getDate() - 7);
    else startDate.setMonth(startDate.getMonth() - 1);

    const q = query(
      collection(db, 'incidents'),
      where('createdAt', '>=', Timestamp.fromDate(startDate))
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIncidents(data);

      // Group by rounded coords to find unsafe zones (3+ reports)
      const grouped = {};
      data.forEach(inc => {
        const key = `${inc.latRounded}_${inc.lngRounded}`;
        grouped[key] = (grouped[key] || []);
        grouped[key].push(inc);
      });
      const zones = Object.values(grouped)
        .filter(g => g.length >= 3)
        .map(g => ({ lat: g[0].latRounded, lng: g[0].lngRounded, count: g.length }));
      setUnsafeZones(zones);
    });

    return () => unsub();
  }, [filterDate]);

  // Geofencing: check if user is near an unsafe zone every 30s
  useEffect(() => {
    if (!userPos || unsafeZones.length === 0) return;

    const check = () => {
      for (const zone of unsafeZones) {
        const dist = getDistance(userPos[0], userPos[1], zone.lat, zone.lng);
        if (dist <= 0.3) { // 300 meters
          setUnsafeAlert(`⚠️ ${t('unsafe_area_warning')} (${zone.count} ${t('incidents_nearby')}). Stay alert.`);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
          return;
        }
      }
      setUnsafeAlert(null);
    };

    check();
    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        check();
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [userPos, unsafeZones]);

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const filteredIncidents = incidents.filter(inc =>
    filterType === 'All' || inc.type === filterType
  );

  if (!userPos) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
          <p className="text-gray-500">{t('loading_map')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background relative overflow-hidden">
      {/* Unsafe Zone Alert Banner */}
      {unsafeAlert && (
        <div className="absolute top-16 left-0 right-0 z-[1000] mx-3 bg-red-600 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-start gap-2">
          <TriangleAlert size={18} className="shrink-0 mt-0.5" />
          <span>{unsafeAlert}</span>
        </div>
      )}

      {/* Rate Area Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[28px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-secondary">{t('rate_area')}</h2>
                <button onClick={() => setShowRatingModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <CloseIcon size={20} />
                </button>
              </div>

              <p className="text-sm text-gray-500 mb-6 font-medium">
                {t('how_safe_feel')}
              </p>

              <div className="flex justify-center gap-2 mb-8">
                {[1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => setRating(num)}
                    className="transition active:scale-90"
                  >
                    <Star
                      size={40}
                      className={`${
                        num <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder={t('add_comment')}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary mb-6 h-28 resize-none"
              />

              <button
                disabled={rating === 0 || isSubmittingRating}
                onClick={async () => {
                  setIsSubmittingRating(true);
                  try {
                    await addDoc(collection(db, 'location_ratings'), {
                      lat: userPos[0],
                      lng: userPos[1],
                      rating,
                      comment: ratingComment,
                      createdAt: serverTimestamp(),
                      timeOfDay: new Date().getHours(),
                    });
                    setShowRatingModal(false);
                    setRating(0);
                    setRatingComment('');
                    alert('Thank you for rating! Your feedback helps others stay safe.');
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsSubmittingRating(false);
                  }
                }}
                className="w-full py-4 bg-secondary text-white font-black rounded-2xl shadow-lg disabled:opacity-50 active:scale-95 transition"
              >
                {isSubmittingRating ? t('submitting') : t('submit_rating')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white shadow-sm z-10 shrink-0">
        <h1 className="text-lg font-bold text-secondary flex items-center gap-2">
          <Shield size={20} className="text-primary" /> {t('safety_map')}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border transition ${showFilters ? 'bg-secondary text-white border-secondary' : 'bg-white border-gray-200 text-gray-600'}`}
          >
            <Filter size={18} />
          </button>
          <button
            onClick={() => navigate('/report')}
            className="px-3 py-2 bg-primary text-white rounded-lg text-xs font-bold flex items-center gap-1"
          >
            <FileWarning size={14} /> {t('report')}
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white px-4 py-3 border-b border-gray-100 z-10 shrink-0">
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
            {['All', ...Object.keys(INCIDENT_COLORS)].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border-2 transition ${
                  filterType === t ? 'bg-secondary text-white border-secondary' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[
              ['today', t('today')],
              ['week', t('this_week')],
              ['month', t('this_month')]
            ].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setFilterDate(val)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition ${
                  filterDate === val ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="flex bg-white border-b border-gray-100 shrink-0 z-10">
        <button
          onClick={() => setActiveTab('heatmap')}
          className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'heatmap' ? 'text-primary border-b-2 border-primary' : 'text-gray-400'}`}
        >
          🔥 {t('crime_map')}
        </button>
        <button
          onClick={() => setActiveTab('safespots')}
          className={`flex-1 py-3 text-sm font-bold transition ${activeTab === 'safespots' ? 'text-secondary border-b-2 border-secondary' : 'text-gray-400'}`}
        >
          🏥 {t('safe_spots')}
        </button>
        <button
          onClick={() => navigate('/safe-route')}
          className="flex-1 py-3 text-sm font-bold text-gray-400"
        >
          🧭 {t('routes')}
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={userPos}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RecenterMap position={userPos} />

          {/* User's location - blue dot */}
          <CircleMarker
            center={userPos}
            radius={10}
            pathOptions={{ fillColor: '#3B82F6', fillOpacity: 1, color: 'white', weight: 3 }}
          >
            <Popup>📍 {t('you_are_here')}</Popup>
          </CircleMarker>

          {/* Unsafe zones - red translucent circles */}
          {unsafeZones.map((zone, i) => (
            <Circle
              key={i}
              center={[zone.lat, zone.lng]}
              radius={300}
              pathOptions={{ fillColor: '#E63946', fillOpacity: 0.15, color: '#E63946', weight: 1 }}
            />
          ))}

          {/* Incident markers */}
          {activeTab === 'heatmap' && filteredIncidents.map((inc) => (
            <CircleMarker
              key={inc.id}
              center={[inc.lat, inc.lng]}
              radius={8}
              pathOptions={{
                fillColor: INCIDENT_COLORS[inc.type] || '#E63946',
                fillOpacity: 0.85,
                color: 'white',
                weight: 1.5
              }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{inc.type}</p>
                  <p className="text-gray-500">{inc.incidentTime ? new Date(inc.incidentTime).toLocaleDateString() : 'Unknown date'}</p>
                  {inc.description && <p className="mt-1 text-gray-700">{inc.description}</p>}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Safe Spots tab - placeholder markers */}
          {activeTab === 'safespots' && (
            <>
              <CircleMarker center={userPos} radius={6} pathOptions={{ fillColor: '#2563EB', fillOpacity: 1, color: 'white', weight: 2 }}>
                <Popup>🚔 Nearby Police Station<br /><a href="https://maps.google.com/" target="_blank" rel="noreferrer" className="text-blue-600 underline">Get Directions</a></Popup>
              </CircleMarker>
            </>
          )}
        </MapContainer>

        {/* Floating Action Button for Rating */}
        <button
          onClick={() => setShowRatingModal(true)}
          className="absolute bottom-16 right-4 z-[999] bg-white border border-gray-100 text-secondary p-4 rounded-full shadow-2xl flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-90 transition font-bold"
        >
          <Star className="text-yellow-500 fill-yellow-400" size={24} />
          <span className="text-sm">{t('rate_area')}</span>
        </button>

        {/* Incident count badge */}
        <div className="absolute bottom-4 left-4 bg-white rounded-xl px-3 py-2 shadow-lg border border-gray-100 z-[999]">
          <p className="text-xs font-bold text-gray-500">{filteredIncidents.length} incidents shown</p>
        </div>

        {/* Legend */}
        <div className="absolute top-2 right-2 bg-white rounded-xl p-2 shadow-lg border border-gray-100 z-[999]">
          <p className="text-xs font-bold text-gray-600 mb-1">Legend</p>
          <div className="flex items-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-500">You</span>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <div className="w-3 h-3 rounded-full bg-red-500 opacity-60"></div>
            <span className="text-xs text-gray-500">Unsafe Zone</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ background: '#E63946' }}></div>
            <span className="text-xs text-gray-500">Incident</span>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-gray-200 flex justify-between px-6 py-3 pb-6 z-50">
        {[
          { icon: '🏠', label: t('welcome').split(' ')[0], path: '/' },
          { icon: '🗺️', label: t('map'), path: '/map', active: true },
          { icon: '📡', label: t('feed'), path: '/feed' },
          { icon: '📞', label: t('help'), path: '/help' },
          { icon: '👤', label: t('profile'), path: '/contacts' },
        ].map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center gap-1 ${item.active ? 'text-primary' : 'text-gray-400'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
