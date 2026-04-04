import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, Timestamp, addDoc, serverTimestamp } from 'firebase/firestore';
import { Star, X as CloseIcon } from 'lucide-react';
import {
  MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap, Marker
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

// Custom Marker Icons
const createPinIcon = (color, iconType = 'dot') => {
  const iconHtml = `
    <div style="position: relative; width: 30px; height: 30px;">
      <div style="background: ${color}; width: 30px; height: 30px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3);"></div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
    </div>
  `;
  return L.divIcon({
    html: iconHtml,
    className: 'custom-pin',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
};

const createUserIcon = () => {
  return L.divIcon({
    html: `<div style="width: 20px; height: 20px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 15px rgba(59,130,246,0.8); animation: pulse 2s infinite;"></div>
           <style>@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.5; } 100% { transform: scale(1); opacity: 1; } }</style>`,
    className: 'user-marker',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Tirupati Static Data Hub
const TIRUPATI_LANDMARKS = [
  // Safe Spots
  { id: 't1', name: 'SVIMS Hospital', type: 'Hospital', lat: 13.6426, lng: 79.4064, icon: '🏥', color: '#DC2626', isSafe: true },
  { id: 't2', name: 'RUIA Govt Hospital', type: 'Hospital', lat: 13.6395, lng: 79.4185, icon: '🏥', color: '#DC2626', isSafe: true },
  { id: 't3', name: 'Railway Station (G RP)', type: 'Police', lat: 13.6279, lng: 79.4194, icon: '🚔', color: '#1E40AF', isSafe: true },
  { id: 't4', name: 'APSRTC Central Bus Stand', type: 'Safe Hub', lat: 13.6298, lng: 79.4263, icon: '🏢', color: '#059669', isSafe: true },
  { id: 't5', name: 'Alipiri Mettu Gateway', type: 'Police', lat: 13.6550, lng: 79.3780, icon: '🚔', color: '#1E40AF', isSafe: true },
  { id: 't6', name: 'East Police Station', type: 'Police', lat: 13.6373, lng: 79.4294, icon: '🚔', color: '#1E40AF', isSafe: true },
  { id: 't7', name: 'West Police Station', type: 'Police', lat: 13.6300, lng: 79.4100, icon: '🚔', color: '#1E40AF', isSafe: true },
  { id: 't8', name: 'SPMVV Women\'s University', type: 'Safe Zone', lat: 13.6330, lng: 79.3900, icon: '🎓', color: '#7C3AED', isSafe: true },
  { id: 't9', name: 'ISKCON Temple Area', type: 'Safe Hub', lat: 13.6500, lng: 79.4250, icon: '🛕', color: '#D97706', isSafe: true },
  { id: 't10', name: 'Padmavati Temple', type: 'Police', lat: 13.6100, lng: 79.4500, icon: '🚔', color: '#1E40AF', isSafe: true },
  { id: 't11', name: 'Bairagipatteda Park', type: 'Safe Hub', lat: 13.6150, lng: 79.4100, icon: '🌳', color: '#059669', isSafe: true },
  { id: 't12', name: 'PGR Cinemas Hub', type: 'Public Instance', lat: 13.6250, lng: 79.4180, icon: '🎬', color: '#D97706', isSafe: true },
  { id: 't13', name: 'Pasuparthi Supermarket', type: 'Safe Haven', lat: 13.6310, lng: 79.4210, icon: '🛒', color: '#059669', isSafe: true },
  { id: 't14', name: 'Balaji Colony Center', type: 'Residential Safe', lat: 13.6350, lng: 79.4150, icon: '🏘️', color: '#3B82F6', isSafe: true },
  { id: 't15', name: 'Bhavani Nagar Square', type: 'Safe Hub', lat: 13.6300, lng: 79.4350, icon: '🏢', color: '#1E40AF', isSafe: true },
  { id: 't16', name: 'Srinivasam Guest House', type: 'Safe House', lat: 13.6320, lng: 79.4260, icon: '🏠', color: '#059669', isSafe: true },
  { id: 't17', name: 'Mahathi Auditorium', type: 'Public Instance', lat: 13.6320, lng: 79.4110, icon: '🏛️', color: '#7C3AED', isSafe: true },
  { id: 't18', name: 'Srinivasa Sports Complex', type: 'Safe Haven', lat: 13.6360, lng: 79.4050, icon: '🏟️', color: '#059669', isSafe: true },
  { id: 't19', name: 'Reliance Mart Area', type: 'Safe Haven', lat: 13.6200, lng: 79.4250, icon: '🛒', color: '#059669', isSafe: true },
  
  // Simulated Incidents/Unsafe Zones for Demo
  { id: 'i1', type: 'Poor Lighting', lat: 13.6400, lng: 79.4800, description: 'Renigunta Highway - dark stretches at night.', isSafe: false },
  { id: 'i2', type: 'Unsafe Road', lat: 13.6300, lng: 79.3850, description: 'SVU Backgate Road - deserted after 7PM.', isSafe: false },
  { id: 'i3', type: 'Suspicious Person', lat: 13.6200, lng: 79.4600, description: 'Tiruchanoor industrial bypass area.', isSafe: false },
  { id: 'i4', type: 'Eve Teasing', lat: 13.6100, lng: 79.4150, description: 'MR Palli inner bypass reported incidents.', isSafe: false },
  { id: 'i5', type: 'Stalking', lat: 13.6350, lng: 79.4400, description: 'Auto-stand cluster poorly managed.', isSafe: false },
  { id: 'i6', type: 'Unsafe Road', lat: 13.6600, lng: 79.4500, description: 'Karakambadi Industrial Road - poorly policed.', isSafe: false },
  { id: 'i7', type: 'Poor Lighting', lat: 13.6050, lng: 79.4200, description: 'Bairagipatteda back lanes - dark after sunset.', isSafe: false }
];

// Mock Safe Spots Generator
function generateSafeSpots(userPos) {
  const dynamicSpots = [];
  if (userPos) {
    const [lat, lng] = userPos;
    const types = [
      { label: 'Nearby Pharmacy', type: 'Medical', color: '#059669', icon: '💊' },
      { label: 'Well-lit Cafe', type: 'Safe Haven', color: '#D97706', icon: '☕' }
    ];

    types.forEach((t, i) => {
      const angle = (i * 180) * (Math.PI / 180);
      const dist = 0.005 + (Math.random() * 0.005);
      dynamicSpots.push({
        id: `dyn-${i}`,
        name: t.label,
        type: t.type,
        color: t.color,
        icon: t.icon,
        lat: lat + Math.sin(angle) * dist,
        lng: lng + Math.cos(angle) * dist,
        distance: (dist * 111).toFixed(1)
      });
    });
  }
  
  // Combine with Tirupati static safe spots
  const staticSafe = TIRUPATI_LANDMARKS.filter(l => l.isSafe);
  return [...staticSafe, ...dynamicSpots];
}

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
  const [safeSpots, setSafeSpots] = useState([]);
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
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(p);
        setSafeSpots(generateSafeSpots(p));
      },
      () => {
        const p = [17.385, 78.4867];
        setUserPos(p);
        setSafeSpots(generateSafeSpots(p));
      }
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
      let data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Combine with Tirupati static incidents
      const staticIncidents = TIRUPATI_LANDMARKS.filter(l => !l.isSafe);
      data = [...data, ...staticIncidents];

      setIncidents(data);

      // Group by rounded coords to find unsafe zones (3+ reports)
      const grouped = {};
      data.forEach(inc => {
        const latR = inc.latRounded || Math.round(inc.lat * 100) / 100;
        const lngR = inc.lngRounded || Math.round(inc.lng * 100) / 100;
        const key = `${latR}_${lngR}`;
        grouped[key] = (grouped[key] || []);
        grouped[key].push(inc);
      });
      const zones = Object.values(grouped)
        .filter(g => g.length >= 2) // Reduced to 2 for demo visibility
        .map(g => {
          const latR = g[0].latRounded || Math.round(g[0].lat * 100) / 100;
          const lngR = g[0].lngRounded || Math.round(g[0].lng * 100) / 100;
          return { lat: latR, lng: lngR, count: g.length };
        });
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

          {/* User's location - pulsating dot */}
          <CircleMarker
            center={userPos}
            pathOptions={{ fillColor: 'transparent', color: 'transparent' }}
            radius={2}
          >
            <Marker position={userPos} icon={createUserIcon()} />
            <Popup>📍 {t('you_are_here')}</Popup>
          </CircleMarker>

          {/* Unsafe zones - red translucent circles */}
          {unsafeZones.map((zone, i) => (
            <Circle
              key={i}
              center={[zone.lat, zone.lng]}
              radius={400}
              pathOptions={{ fillColor: '#E63946', fillOpacity: 0.2, color: '#E63946', weight: 2, dashArray: '5, 10' }}
            >
              <Popup className="custom-popup">
                <div className="p-1">
                  <p className="font-black text-red-600 uppercase text-[10px] tracking-widest mb-1">Unsafe Zone</p>
                  <p className="text-sm font-bold text-secondary">{zone.count} Frequent Incident Reports</p>
                </div>
              </Popup>
            </Circle>
          ))}

          {/* Incident markers */}
          {activeTab === 'heatmap' && filteredIncidents.map((inc) => (
            <Marker 
              key={inc.id} 
              position={[inc.lat, inc.lng]} 
              icon={createPinIcon(INCIDENT_COLORS[inc.type] || '#E63946')}
            >
              <Popup className="custom-popup">
                <div className="text-sm p-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: INCIDENT_COLORS[inc.type] }} />
                    <p className="font-black text-secondary tracking-tight">{inc.type}</p>
                  </div>
                  <p className="text-gray-500 text-[10px] uppercase font-bold mb-2">
                    {inc.incidentTime ? new Date(inc.incidentTime).toLocaleDateString() : 'Community Report'}
                  </p>
                  {inc.description && <p className="mt-2 text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 text-xs italic">"{inc.description}"</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Safe Spots tab - Realistic pins */}
          {activeTab === 'safespots' && safeSpots.map((spot) => (
            <Marker 
              key={spot.id} 
              position={[spot.lat, spot.lng]} 
              icon={createPinIcon('#059669')} // Trustworthy green
            >
              <Popup className="custom-popup">
                <div className="text-sm p-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{spot.icon}</span>
                    <p className="font-black text-green-700">{spot.name}</p>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">{spot.type} • {spot.distance} km away</p>
                  <button 
                    onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}`, '_blank')}
                    className="w-full py-2 bg-green-600 text-white rounded-lg font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1"
                  >
                    <Navigation size={12} /> GET DIRECTIONS
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
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
