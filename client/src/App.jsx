import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Helplines from './pages/Helplines';
import FakeCall from './pages/FakeCall';
import LiveLocation from './pages/LiveLocation';
import JourneyTracker from './pages/JourneyTracker';
import EvidenceCapture from './pages/EvidenceCapture';
import MapPage from './pages/MapPage';
import ReportIncident from './pages/ReportIncident';
import SafeRoute from './pages/SafeRoute';
import Profile from './pages/Profile';
import Feed from './pages/Feed';
import FollowerDetector from './pages/FollowerDetector';
import Landing from './pages/Landing';
import Blog from './pages/Blog';
import useVolunteerAlerts from './hooks/useVolunteerAlerts';
import { AlertTriangle, MapPin, User, Navigation, X } from 'lucide-react';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { currentUser, userData, loading } = useAuth();
  
  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        <p className="text-gray-500 font-medium tracking-wide">Securing your connection...</p>
      </div>
    </div>
  );

  if (!currentUser) return <Navigate to="/login" />;

  // Redirect to onboarding if not complete, unless already on onboarding page
  const isDocOnboarding = window.location.pathname === '/onboarding';
  if (!userData?.onboardingComplete && !isDocOnboarding) {
    return <Navigate to="/onboarding" />;
  }
  
  // If onboarded and trying to go to onboarding, send home
  if (userData?.onboardingComplete && isDocOnboarding) {
    return <Navigate to="/" />;
  }
  
  return children;
};

// Global Volunteer Alert Overlay
const GlobalVolunteerAlert = () => {
  const { activeAlert, respondToAlert, dismissAlert } = useVolunteerAlerts();

  if (!activeAlert) return null;

  const openInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeAlert.lat},${activeAlert.lng}&travelmode=walking`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl border-4 border-red-500 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-red-500 p-6 text-white text-center relative">
          <button 
            onClick={dismissAlert}
            className="absolute top-4 right-4 p-1 rounded-full bg-white/20 hover:bg-white/30 transition"
          >
            <X size={20} />
          </button>
          <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg border-4 border-red-400">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">EMERGENCY SOS</h2>
          <p className="text-red-100 text-sm font-bold opacity-90 uppercase">Within {activeAlert.distance} km of you</p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-xl">
              {activeAlert.victimName?.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Victim</p>
              <p className="text-lg font-black text-secondary">{activeAlert.victimName}</p>
            </div>
          </div>

          <p className="text-gray-500 text-sm text-center mb-8 leading-relaxed">
            Sending help quickly can save lives. Please respond if you are nearby and safe.
          </p>

          <div className="flex flex-col gap-3">
            <button 
              onClick={() => {
                respondToAlert(activeAlert.id);
                openInMaps();
              }}
              className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-[0_8px_20px_rgba(230,57,70,0.3)] hover:bg-red-600 active:scale-95 transition flex items-center justify-center gap-2"
            >
              <Navigation size={20} />
              RESPOND & NAVIGATE
            </button>
            
            <button 
              onClick={dismissAlert}
              className="w-full py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition"
            >
              DISMISS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <GlobalVolunteerAlert />
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/help" element={<Helplines />} />

          {/* Onboarding */}
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          
          {/* Phase 1 */}
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />

          {/* Phase 2 */}
          <Route path="/fake-call" element={<ProtectedRoute><FakeCall /></ProtectedRoute>} />
          <Route path="/live-location" element={<ProtectedRoute><LiveLocation /></ProtectedRoute>} />
          <Route path="/journey" element={<ProtectedRoute><JourneyTracker /></ProtectedRoute>} />
          <Route path="/evidence" element={<ProtectedRoute><EvidenceCapture /></ProtectedRoute>} />

          {/* Phase 3 */}
          <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><ReportIncident /></ProtectedRoute>} />
          <Route path="/safe-route" element={<ProtectedRoute><SafeRoute /></ProtectedRoute>} />
          <Route path="/follower-detector" element={<ProtectedRoute><FollowerDetector /></ProtectedRoute>} />
          <Route path="/feed" element={<ProtectedRoute><Feed /></ProtectedRoute>} />

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
