import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  User, Phone, Shield, Map, AlertCircle,
  LogOut, ChevronRight, Video, Settings, Star, Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Profile() {
  const { currentUser, userData, logout, updateProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [updatingVolunteer, setUpdatingVolunteer] = useState(false);
  const [updatingLang, setUpdatingLang] = useState(false);

  const handleLanguageChange = async (lang) => {
    setUpdatingLang(true);
    try {
      await i18n.changeLanguage(lang);
      await updateProfile(currentUser.uid, { language: lang });
    } catch (err) {
      console.error("Language update failed", err);
    } finally {
      setUpdatingLang(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleToggleVolunteer = async () => {
    setUpdatingVolunteer(true);
    try {
      await updateProfile(currentUser.uid, {
        isVolunteer: !userData?.isVolunteer
      });
    } catch (err) {
      console.error("Failed to update volunteer status", err);
    } finally {
      setUpdatingVolunteer(false);
    }
  };

  const menuItems = [
    {
      section: t('safety'),
      items: [
        { icon: <User size={20} className="text-blue-600" />, label: t('contacts'), path: '/contacts', bg: 'bg-blue-50' },
        { icon: <Map size={20} className="text-orange-500" />, label: t('map'), path: '/map', bg: 'bg-orange-50' },
        { icon: <Shield size={20} className="text-red-500" />, label: t('safe_route'), path: '/safe-route', bg: 'bg-red-50' },
        { icon: <AlertCircle size={20} className="text-purple-600" />, label: t('report_incident') || 'Report Incident', path: '/report', bg: 'bg-purple-50' },
      ]
    },
    {
      section: t('profile'),
      items: [
        { icon: <Video size={20} className="text-green-600" />, label: t('evidence') || 'Evidence', path: '/evidence', bg: 'bg-green-50' },
        { icon: <Phone size={20} className="text-secondary" />, label: t('help'), path: '/help', bg: 'bg-blue-50' },
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="bg-gradient-to-br from-secondary to-blue-800 px-6 pt-12 pb-8 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-black text-white">
            {userData?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="text-xl font-black">{userData?.name || 'SafeStep User'}</h1>
            <p className="text-blue-200 text-sm">{currentUser?.email || currentUser?.phoneNumber || ''}</p>
          </div>
        </div>
        
        {/* Language Badge */}
        <div className="mt-4 flex gap-2">
          <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
            {userData?.language === 'hi' ? 'Hindi' : (userData?.language === 'te' ? 'Telugu' : 'English')}
          </span>
        </div>
      </div>

      {/* Menu */}
      <div className="p-5 flex flex-col gap-5">
        {menuItems.map((section) => (
          <div key={section.section}>
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
              {section.section}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {section.items.map((item, idx) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-4 px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition text-left ${
                    idx < section.items.length - 1 ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
                    {item.icon}
                  </div>
                  <span className="flex-1 font-semibold text-secondary">{item.label}</span>
                  <ChevronRight size={18} className="text-gray-300" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Language Selection */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-primary" />
            <h2 className="font-bold text-secondary">{t('language_settings')}</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: 'en', label: 'English' },
              { code: 'hi', label: 'हिंदी' },
              { code: 'te', label: 'తెలుగు' }
            ].map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                disabled={updatingLang}
                className={`py-3 rounded-xl text-xs font-bold border-2 transition ${
                  i18n.language === lang.code
                    ? 'border-primary bg-red-50 text-primary'
                    : 'border-gray-100 bg-gray-50 text-gray-500'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Volunteer Toggle */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-start gap-3">
          <Star size={22} className={`${userData?.isVolunteer ? 'text-yellow-600 fill-yellow-400' : 'text-yellow-500'} shrink-0 mt-0.5`} />
          <div>
            <h3 className="font-bold text-yellow-800">
              {t('volunteer_mode')} {userData?.isVolunteer && '✅'}
            </h3>
            <p className="text-yellow-700 text-xs mt-0.5">
              {userData?.isVolunteer 
                ? t('volunteer_desc_active')
                : t('volunteer_desc_inactive')}
            </p>
            <button 
              disabled={updatingVolunteer}
              onClick={handleToggleVolunteer}
              className={`mt-3 px-6 py-2 rounded-xl text-sm font-bold active:scale-95 transition flex items-center gap-2 ${
                userData?.isVolunteer 
                ? 'bg-red-100 text-red-700 border border-red-200' 
                : 'bg-yellow-400 text-yellow-900 shadow-md'
              } disabled:opacity-50`}
            >
              {updatingVolunteer ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  {t('updating')}
                </>
              ) : (
                userData?.isVolunteer ? t('disable_volunteer') : t('enable_volunteer')
              )}
            </button>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-4 bg-white border-2 border-red-100 text-primary font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-50 active:scale-95 transition"
        >
          <LogOut size={20} />
          {t('sign_out')}
        </button>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto bg-white border-t border-gray-200 flex justify-between px-6 py-3 pb-6 z-50">
        {[
          { icon: '🏠', label: t('welcome').split(' ')[0], path: '/' },
          { icon: '🗺️', label: t('map'), path: '/map' },
          { icon: '📡', label: t('feed'), path: '/feed' },
          { icon: '📞', label: t('help'), path: '/help' },
          { icon: '👤', label: t('profile'), path: '/profile', active: true },
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
