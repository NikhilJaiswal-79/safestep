import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, Shield, AlertTriangle, Radar, 
  MapPin, Phone, Share2, Navigation,
  Activity, Search, ShieldAlert, MoreVertical
} from 'lucide-react';
import useFollowerDetection from '../hooks/useFollowerDetection';

export default function FollowerDetector() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { 
    isActive, 
    startDetection, 
    stopDetection, 
    nearbyDevices, 
    isThreatDetected, 
    scanningStatus,
    triggerMockAlert
  } = useFollowerDetection();

  return (
    <div className={`flex flex-col min-h-screen transition-colors duration-500 ${isThreatDetected ? 'bg-red-50' : 'bg-background'}`}>
      
      {/* Header */}
      <div className={`flex items-center justify-between p-4 bg-white shadow-sm border-b transition-colors ${isThreatDetected ? 'border-red-200' : 'border-gray-100'}`}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100 transition">
            <ArrowLeft size={22} className={isThreatDetected ? 'text-red-500' : 'text-gray-600'} />
          </button>
          <h1 className={`text-xl font-bold ${isThreatDetected ? 'text-red-600' : 'text-secondary'}`}>
            {t('follower_detector')}
          </h1>
        </div>
        <button onClick={triggerMockAlert} className="p-2 text-gray-300 hover:text-gray-400">
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="flex-1 p-5 flex flex-col gap-6 overflow-y-auto">
        
        {/* Main Status Area */}
        <div className="relative flex flex-col items-center justify-center pt-8 pb-4">
          
          {/* Radar Animation */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Pulsing circles */}
            <div className={`absolute w-full h-full rounded-full border-2 ${isThreatDetected ? 'border-red-400 animate-ping opacity-20' : 'border-blue-400 animate-[ping_3s_infinite] opacity-10'}`}></div>
            <div className={`absolute w-48 h-48 rounded-full border-2 ${isThreatDetected ? 'border-red-300' : 'border-blue-100'} flex items-center justify-center`}>
               <div className={`absolute w-32 h-32 rounded-full border-2 ${isThreatDetected ? 'border-red-200' : 'border-blue-50'}`}></div>
            </div>

            {/* Radar Sweep */}
            {!isThreatDetected && isActive && (
              <div className="absolute w-full h-full rounded-full border border-blue-500 animate-[spin_4s_linear_infinite] overflow-hidden">
                <div className="w-1/2 h-1/2 bg-gradient-to-tr from-blue-500/0 to-blue-500/20 origin-bottom-right"></div>
              </div>
            )}

            {/* Center Icon */}
            <div className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-500 transform ${isThreatDetected ? 'bg-red-600 scale-125 rotate-12' : 'bg-secondary'}`}>
              {isThreatDetected ? <ShieldAlert size={44} className="text-white animate-pulse" /> : <Radar size={44} className={`text-white ${isActive ? 'animate-pulse' : ''}`} />}
            </div>

            {/* Simulated Points on Radar */}
            {isActive && nearbyDevices.map((dev, i) => (
               <div 
                  key={dev.id} 
                  className={`absolute w-4 h-4 rounded-full border-2 border-white shadow-lg transition-all duration-1000 ${isThreatDetected && dev.signal > 90 ? 'bg-red-500 animate-bounce' : 'bg-blue-500'}`}
                  style={{ 
                    top: `${20 + (i * 25)}%`, 
                    left: `${60 + (i * 10)}%`,
                    opacity: dev.signal / 100 
                  }}
               ></div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <h2 className={`text-2xl font-black ${isThreatDetected ? 'text-red-600 animate-bounce' : 'text-secondary'}`}>
              {isThreatDetected ? t('you_may_be_followed') : (isActive ? t('scanning_nearby') : 'Ready to Scan')}
            </h2>
            <p className={`text-sm mt-1 font-medium ${isThreatDetected ? 'text-red-500' : 'text-gray-400'}`}>
              {isThreatDetected ? t('follower_alert_msg') : (isActive ? t('detection_active') : t('no_threat_detected'))}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {isThreatDetected ? (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-700">
               <button 
                  onClick={() => navigate('/sos-active')} // Assuming SOS page or trigger
                  className="w-full py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition flex items-center justify-center gap-3"
               >
                 <Shield size={24} /> {t('start_sos')}
               </button>
               <button 
                  onClick={() => navigate('/safe-route')}
                  className="w-full py-4 bg-secondary text-white font-black rounded-2xl shadow-lg active:scale-95 transition flex items-center justify-center gap-3"
               >
                 <Navigation size={22} /> {t('go_to_safe_spot')}
               </button>
               <button 
                  onClick={() => navigate('/live-location')}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition flex items-center justify-center gap-3"
               >
                 <Share2 size={22} /> {t('share_live_loc')}
               </button>
            </div>
          ) : (
            <button 
              onClick={isActive ? stopDetection : startDetection}
              className={`w-full py-5 rounded-[28px] font-black text-lg shadow-xl active:scale-95 border-b-4 transition-all ${
                isActive 
                  ? 'bg-blue-50 text-blue-700 border-blue-200' 
                  : 'bg-secondary text-white border-blue-900'
              }`}
            >
              {isActive ? 'STOP MONITORING' : 'START FOLLOWER DETECTION'}
            </button>
          )}
        </div>

        {/* Nearby Data / Logs */}
        <div className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-secondary flex items-center gap-2">
              <Activity size={18} className="text-primary" />
              NEARBY SIGNALS
            </h3>
            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">
              {isActive ? 'Live Scan' : 'Offline'}
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {isActive ? nearbyDevices.map((dev) => (
              <div key={dev.id} className="flex items-center gap-4 group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isThreatDetected && dev.signal > 90 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  {isThreatDetected && dev.signal > 90 ? <AlertTriangle className="text-red-500" size={20} /> : <Search className="text-gray-400" size={18} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between">
                    <span className={`text-sm font-bold ${isThreatDetected && dev.signal > 90 ? 'text-red-700' : 'text-secondary'}`}>
                       {dev.name} {isThreatDetected && dev.signal > 90 && '📍'}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400">{dev.signal}% strength</span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-100 rounded-full mt-1.5 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${isThreatDetected && dev.signal > 90 ? 'bg-red-500' : 'bg-blue-400'}`} 
                      style={{ width: `${dev.signal}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-8 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Radar size={32} strokeWidth={1.5} />
                <p className="text-xs font-bold uppercase tracking-widest">No Active Scan</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
