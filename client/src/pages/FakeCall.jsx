import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const DEFAULT_CALLER = 'Mom';
const DEFAULT_DELAY_OPTIONS = [
  { label: 'Now', value: 0 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
];

export default function FakeCall() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [screen, setScreen] = useState('setup'); // setup | ringing | active
  const [callerName, setCallerName] = useState(DEFAULT_CALLER);
  const [selectedDelay, setSelectedDelay] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [scheduledIn, setScheduledIn] = useState(null);

  const durationTimer = useRef(null);
  const scheduledTimer = useRef(null);
  const vibrateRef = useRef(null);
  const audioRef = useRef(new Audio('https://www.soundboard.com/handler/DownLoadTrack.ashx?cliptitle=iPhone+Ringtone&filename=mt/MTI5NzgxMTI5NzgxMTQx_7f_2fR6W_2fI_2f0.mp3'));

  // Cleanup on unmount
  useEffect(() => {
    audioRef.current.loop = true;
    return () => {
      clearInterval(durationTimer.current);
      clearTimeout(scheduledTimer.current);
      clearInterval(vibrateRef.current);
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      if (navigator.vibrate) navigator.vibrate(0);
    };
  }, []);

  // Countdown for scheduled call
  useEffect(() => {
    if (scheduledIn === null) return;
    if (scheduledIn <= 0) {
      startRinging();
      setScheduledIn(null);
      return;
    }
    const t = setTimeout(() => setScheduledIn(prev => prev - 1), 1000);
    return () => clearTimeout(t);
  }, [scheduledIn]);

  const startRinging = () => {
    setScreen('ringing');
    // Start Ringtone
    audioRef.current.play().catch(e => console.log("Audio play blocked by browser. User must interact first."));
    // Vibrate pattern: vibrate 500ms, pause 500ms repeatedly
    if (navigator.vibrate) {
      vibrateRef.current = setInterval(() => navigator.vibrate([500, 500]), 1000);
    }
  };

  const handleStartFakeCall = () => {
    if (selectedDelay === 0) {
      startRinging();
    } else {
      setScheduledIn(selectedDelay);
    }
  };

  const handleAnswer = () => {
    setScreen('active');
    setCallDuration(0);
    // Stop Ringtone & Vibrate
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    if (navigator.vibrate) { navigator.vibrate(0); clearInterval(vibrateRef.current); }
    durationTimer.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
  };

  const handleDecline = () => {
    // Stop Ringtone & Vibrate
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    if (navigator.vibrate) { navigator.vibrate(0); clearInterval(vibrateRef.current); }
    setScreen('setup');
    setScheduledIn(null);
  };

  const handleEndCall = () => {
    clearInterval(durationTimer.current);
    setScreen('setup');
    setCallDuration(0);
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // SETUP SCREEN
  if (screen === 'setup') {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <div className="flex items-center gap-3 p-4 bg-white shadow-sm">
          <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
            <X size={22} />
          </button>
          <h1 className="text-xl font-bold text-secondary">Fake Call</h1>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-600 mb-2">{t('caller_name')}</label>
            <input
              type="text"
              value={callerName}
              onChange={e => setCallerName(e.target.value)}
              className="w-full p-4 rounded-xl border border-gray-200 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-secondary"
              placeholder={t('caller_name')}
            />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-sm font-semibold text-gray-600 mb-3">
              <Clock size={16} className="inline mr-1" /> {t('delay_before_call')}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {DEFAULT_DELAY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedDelay(opt.value)}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition ${
                    selectedDelay === opt.value
                      ? 'bg-secondary text-white border-secondary'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-secondary'
                  }`}
                >
                  {opt.label === 'Now' ? t('now') : opt.label}
                </button>
              ))}
            </div>
          </div>

          {scheduledIn !== null && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
              <p className="text-blue-700 font-bold text-lg">📳 {t('incoming_call').split(' ')[0]} in {scheduledIn}s</p>
              <button
                onClick={() => setScheduledIn(null)}
                className="mt-2 text-sm text-blue-500 underline"
              >
                {t('cancel')}
              </button>
            </div>
          )}

          <button
            onClick={handleStartFakeCall}
            disabled={scheduledIn !== null}
            className="w-full py-5 bg-secondary text-white font-black text-xl rounded-2xl shadow-lg hover:bg-blue-900 transition active:scale-95 disabled:opacity-50"
          >
            {selectedDelay === 0 ? `📞 ${t('start_fake_call')}` : `⏱ ${t('incoming_call').split(' ')[0]} in ${DEFAULT_DELAY_OPTIONS.find(o => o.value === selectedDelay)?.label}`}
          </button>

          <div className="text-center text-xs text-gray-400 px-4">
            Works completely offline. The call screen overlays your entire screen just like a real call.
          </div>
        </div>
      </div>
    );
  }

  // RINGING SCREEN
  if (screen === 'ringing') {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-between py-16 z-50">
        <div className="flex flex-col items-center gap-4 mt-10">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-5xl font-black shadow-2xl animate-pulse">
            {callerName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-white text-3xl font-bold mt-2">{callerName}</h1>
          <p className="text-gray-400 text-lg">{t('incoming_call')}</p>
        </div>

        <div className="flex justify-around w-full px-16 mb-10">
          {/* Decline */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleDecline}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-xl active:scale-95 transition"
            >
              <PhoneOff size={32} className="text-white" />
            </button>
            <span className="text-gray-400 text-sm">{t('decline')}</span>
          </div>
          {/* Answer */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleAnswer}
              className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center shadow-xl active:scale-95 transition animate-bounce"
            >
              <Phone size={32} className="text-white" />
            </button>
            <span className="text-gray-400 text-sm">{t('answer')}</span>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE CALL SCREEN
  if (screen === 'active') {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-gray-900 to-black flex flex-col items-center justify-between py-16 z-50">
        <div className="flex flex-col items-center gap-4 mt-10">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-5xl font-black shadow-2xl">
            {callerName.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-white text-3xl font-bold mt-2">{callerName}</h1>
          <p className="text-green-400 text-xl font-mono">{formatDuration(callDuration)}</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
            <span className="text-green-400 text-sm">{t('active_call')}</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-3 mb-10">
          <button
            onClick={handleEndCall}
            className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center shadow-xl active:scale-95 transition"
          >
            <PhoneOff size={32} className="text-white" />
          </button>
          <span className="text-gray-400 text-sm">{t('end_call')}</span>
        </div>
      </div>
    );
  }
}
