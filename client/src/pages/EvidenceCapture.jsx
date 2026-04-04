import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Download, Trash2, Video, Mic, FolderOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

const STORAGE_KEY = 'nirbhaya_nari_evidence';

function loadEvidence() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function saveEvidence(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function EvidenceCapture() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [evidenceList, setEvidenceList] = useState(loadEvidence);
  const [recording, setRecording] = useState(false);
  const [recordingType, setRecordingType] = useState(null); // 'audio'|'video'
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async (type) => {
    try {
      const constraints = type === 'video'
        ? { video: { facingMode: 'environment' }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const mimeType = type === 'video' ? 'video/webm' : 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString();
        const ext = type === 'video' ? 'webm' : 'webm';
        const fileName = `evidence_${currentUser?.uid?.slice(0, 6)}_${Date.now()}.${ext}`;

        const newItem = { id: Date.now(), type, url, fileName, timestamp, size: blob.size };
        setEvidenceList(prev => {
          const updated = [newItem, ...prev];
          saveEvidence(updated.map(e => ({ ...e, url: null }))); // Don't save blob URLs to localStorage
          return updated;
        });

        // 🚀 Upload Evidence to Firebase Storage & Notify Contacts if SOS active
        setUploading(true);
        try {
          const storageRef = ref(storage, `evidence/${currentUser.uid}/${fileName}`);
          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);

          // Check if there is an active SOS for this user
          const q = query(collection(db, 'sos_alerts'), where('victimId', '==', currentUser.uid), where('status', '==', 'active'));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const sosDoc = querySnapshot.docs[0];
            await updateDoc(doc(db, 'sos_alerts', sosDoc.id), {
              evidenceUrl: downloadUrl
            });

            // Send to Backend for SMS notification to contacts
            await fetch('http://localhost:5000/api/sos-evidence', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: currentUser.uid,
                evidenceLink: downloadUrl,
                contacts: userData?.contacts || []
              })
            });
          }
        } catch (err) {
          console.error("Evidence upload failed:", err);
        } finally {
          setUploading(false);
        }

        stream.getTracks().forEach(t => t.stop());
        setRecording(false);
        setRecordingType(null);
        setElapsed(0);
        clearInterval(timerRef.current);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordingType(type);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (err) {
      alert(`Could not access ${type} device: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
  };

  const deleteEvidence = (id) => {
    setEvidenceList(prev => {
      const updated = prev.filter(e => e.id !== id);
      saveEvidence(updated.map(e => ({ ...e, url: null })));
      return updated;
    });
  };

  const downloadEvidence = (item) => {
    if (!item.url) return alert('This recording is only stored as metadata. Start a new recording to capture fresh evidence.');
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.fileName;
    a.click();
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background pb-8">
      <div className="flex items-center gap-3 p-4 bg-white shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-secondary">Evidence Capture</h1>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {/* Recording Controls */}
        {!recording ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => startRecording('audio')}
              className="bg-white border-2 border-gray-100 p-5 rounded-2xl flex flex-col items-center gap-3 shadow-sm hover:border-primary hover:bg-red-50 transition active:scale-95"
            >
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <Mic size={28} className="text-primary" />
              </div>
              <span className="font-bold text-secondary text-sm">{t('record_audio')}</span>
            </button>
            <button
              onClick={() => startRecording('video')}
              className="bg-white border-2 border-gray-100 p-5 rounded-2xl flex flex-col items-center gap-3 shadow-sm hover:border-secondary hover:bg-blue-50 transition active:scale-95"
            >
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                <Video size={28} className="text-secondary" />
              </div>
              <span className="font-bold text-secondary text-sm">{t('record_video')}</span>
            </button>
          </div>
        ) : (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-red-600 font-bold text-lg">
                {recordingType === 'video' ? t('recording_video') : t('recording_audio')}
              </span>
            </div>
            <div className="text-4xl font-black text-red-600 font-mono">{formatTime(elapsed)}</div>
            <button
              disabled={uploading}
              onClick={stopRecording}
              className="px-8 py-3 bg-red-500 text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-50"
            >
              {uploading ? "Uploading..." : t('stop_recording')}
            </button>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-yellow-700 text-xs">
          🔒 {t('evidence_warning')}
        </div>

        {/* Evidence List */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={18} className="text-secondary" />
            <h2 className="font-bold text-secondary">{t('my_evidence')} ({evidenceList.length})</h2>
          </div>

          {evidenceList.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
              <p>{t('no_evidence')}</p>
              <p className="text-xs mt-1">{t('auto_capture_desc')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {evidenceList.map(item => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.type === 'video' ? 'bg-blue-100' : 'bg-red-100'}`}>
                    {item.type === 'video' ? <Video size={22} className="text-secondary" /> : <Mic size={22} className="text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-secondary text-sm truncate">{item.fileName}</p>
                    <p className="text-gray-400 text-xs">{new Date(item.timestamp).toLocaleString()} {item.size ? `· ${formatSize(item.size)}` : ''}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => downloadEvidence(item)} className="p-2 text-secondary bg-blue-50 rounded-lg hover:bg-blue-100">
                      <Download size={16} />
                    </button>
                    <button onClick={() => deleteEvidence(item.id)} className="p-2 text-red-500 bg-red-50 rounded-lg hover:bg-red-100">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
