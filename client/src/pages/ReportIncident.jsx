import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { ArrowLeft, MapPin, Camera, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const INCIDENT_TYPES = [
  'Eve Teasing',
  'Stalking',
  'Assault',
  'Poor Lighting',
  'Unsafe Road',
  'Suspicious Person',
  'Other'
];

export default function ReportIncident() {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [incidentType, setIncidentType] = useState('');
  const [description, setDescription] = useState('');
  const [incidentTime, setIncidentTime] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!showSuggestions || manualAddress.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (err) {
        console.error("Failed to fetch location suggestions", err);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [manualAddress, showSuggestions]);

  const detectLocation = () => {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => {
        setError('Could not detect location. Please enable location access.');
        setLocationLoading(false);
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!location) return setError('Please detect your location first.');
    if (!incidentType) return setError('Please select an incident type.');

    setSubmitting(true);
    setError('');

    try {
      // Generate a fully anonymous ID — NO user ID stored
      const anonymousId = 'anon_' + Math.random().toString(36).substring(2, 14);

      await addDoc(collection(db, 'incidents'), {
        anonymousId,
        type: incidentType,
        description: description.slice(0, 200),
        lat: location.lat,
        lng: location.lng,
        // Round to 4 decimal places for area-level privacy
        latRounded: parseFloat(location.lat.toFixed(4)),
        lngRounded: parseFloat(location.lng.toFixed(4)),
        incidentTime: incidentTime || new Date().toISOString(),
        createdAt: Timestamp.now(),
        helpful: 0,
        flagged: 0
      });

      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit report. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col min-h-screen bg-background items-center justify-center p-8 text-center">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-5xl">✅</div>
        <h2 className="text-2xl font-black text-secondary mb-3">Report Submitted Anonymously</h2>
        <p className="text-gray-500 mb-8">Thank you for making your community safer. Your report will appear on the safety map within 1 minute.</p>
        <button onClick={() => navigate('/map')} className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-md">
          View on Map
        </button>
        <button onClick={() => navigate(-1)} className="mt-3 w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-xl">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 p-4 bg-white shadow-sm sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-secondary">Report an Incident</h1>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-5">
        {/* Location */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-600 mb-3">📍 Incident Location</label>
          
          {location ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 rounded-lg text-green-700">
                  <MapPin size={16} />
                </div>
                <div>
                  <p className="text-green-700 font-bold text-xs">LOCATION SET</p>
                  <p className="text-green-600 text-[10px] break-all">{manualAddress || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => { setLocation(null); setManualAddress(''); }} 
                className="p-1 text-gray-400 hover:text-red-500 transition"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={detectLocation}
                disabled={locationLoading}
                className="w-full py-3 bg-blue-50 text-secondary border border-blue-100 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-100 transition"
              >
                <MapPin size={16} />
                {locationLoading ? 'Detecting...' : 'Detect My Location'}
              </button>
              
              <div className="relative">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={e => { setManualAddress(e.target.value); setShowSuggestions(true); }}
                  placeholder="Or enter address manually..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute z-20 w-full left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {suggestions.map((s, i) => (
                      <li 
                        key={i} 
                        className="p-3 text-[10px] text-gray-700 hover:bg-gray-50 cursor-pointer line-clamp-2"
                        onClick={() => {
                          setManualAddress(s.display_name);
                          setLocation({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) });
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
          )}
        </div>

        {/* Incident Type */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-600 mb-3">⚠️ Incident Type</label>
          <div className="flex flex-wrap gap-2">
            {INCIDENT_TYPES.map(type => (
              <button
                key={type}
                type="button"
                onClick={() => setIncidentType(type)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border-2 transition ${
                  incidentType === type
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Time of Incident */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-600 mb-2">🕐 Time of Incident</label>
          <input
            type="datetime-local"
            value={incidentTime}
            onChange={e => setIncidentTime(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <label className="block text-sm font-semibold text-gray-600 mb-2">📝 Description (optional)</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Briefly describe what happened..."
            className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/200</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-700 text-xs">
          🔒 Your report is fully anonymous. No name, phone number, or account ID is stored with this report.
        </div>

        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-5 bg-primary text-white font-black text-lg rounded-2xl shadow-lg active:scale-95 transition disabled:opacity-60"
        >
          {submitting ? 'Submitting...' : 'Submit Anonymous Report'}
        </button>
      </form>
    </div>
  );
}
