import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, MapPin, Mic, Phone } from 'lucide-react';

export default function Onboarding() {
  const { currentUser, userData, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('English');
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  // Auto-skip if already onboarded
  useEffect(() => {
    if (userData?.onboardingComplete) {
      navigate('/');
    }
  }, [userData, navigate]);

  const requestPermissions = async () => {
    setIsRequesting(true);
    try {
      // 1. Microphone test
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Immediately stop the stream so the mic icon disappears
      stream.getTracks().forEach(t => t.stop());

      // 2. Geolocation test
      navigator.geolocation.getCurrentPosition(
        () => {
          setPermissionsGranted(true);
          setIsRequesting(false);
        },
        (err) => {
          setIsRequesting(false);
          alert("Location permission is required for SOS features to work.");
        },
        { timeout: 10000 } // Add timeout to avoid "page not loading" feeling
      );
    } catch (err) {
      setIsRequesting(false);
      alert("Microphone permission is required for Scream Detection.");
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!permissionsGranted) {
      alert("Please grant permissions to continue.");
      return;
    }
    
    try {
      await updateProfile(currentUser.uid, {
        name,
        phone,
        language,
        onboardingComplete: true,
        contacts: [], // Initialize empty contacts
        createdAt: new Date().toISOString()
      });
      navigate('/');
    } catch (err) {
      alert("Failed to save profile. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
      <div className="w-full max-w-sm bg-white rounded-[32px] shadow-2xl p-8 border border-gray-100">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck size={32} className="text-primary" />
          </div>
          <h2 className="text-2xl font-black text-secondary tracking-tight">Complete Profile</h2>
          <p className="text-sm text-gray-400 font-medium">Protecting you with every step.</p>
        </div>

        <form onSubmit={handleComplete} className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Priya Sharma"
              className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary transition-all text-secondary font-semibold"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Your Phone Number</label>
            <input
              type="tel"
              placeholder="+91 98765 43210"
              className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary transition-all text-secondary font-semibold"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Preferred Language</label>
            <select
              className="w-full p-4 rounded-2xl border border-gray-100 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary transition-all text-secondary font-semibold appearance-none"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="English">English</option>
              <option value="Hindi">हिंदी (Hindi)</option>
              <option value="Telugu">తెలుగు (Telugu)</option>
            </select>
          </div>

          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 mt-2">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <MapPin size={18} />
              </div>
              <p className="text-xs text-blue-800 leading-relaxed font-medium">
                Nirbhaya Nari requires **Location** and **Microphone** access to trigger SOS alerts and detect screams.
              </p>
            </div>
            
            <button
              type="button"
              disabled={isRequesting || permissionsGranted}
              onClick={requestPermissions}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm ${
                permissionsGranted 
                  ? 'bg-green-500 text-white' 
                  : 'bg-secondary text-white hover:bg-blue-900 active:scale-95'
              } disabled:opacity-70`}
            >
              {isRequesting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : permissionsGranted ? (
                'Permissions Granted ✅'
              ) : (
                'Grant Required Permissions'
              )}
            </button>
          </div>
          
          <button
            type="submit"
            className="w-full bg-primary text-white font-black py-4 rounded-2xl shadow-lg shadow-red-500/20 hover:bg-red-700 active:scale-95 transition-all mt-4 tracking-wide uppercase"
          >
            Complete Setup
          </button>
        </form>
      </div>
    </div>
  );
}
