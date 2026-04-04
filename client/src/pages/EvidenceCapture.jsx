import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Download, Trash2, Video, Mic, FolderOpen, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { db } from '../firebase';
import { collection, query, where, getDocs, updateDoc, doc, onSnapshot, addDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { uploadToCloudinary } from '../utils/cloudinary';

export default function EvidenceCapture() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [evidenceList, setEvidenceList] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recordingType, setRecordingType] = useState(null); // 'audio'|'video'
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(''); // 'uploading' | 'success' | 'error'
  const [uploadMessage, setUploadMessage] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const fallbackUnsubRef = useRef(null);

  // Listen for evidence from Firestore
  useEffect(() => {
    if (!currentUser) return;
    
    // Use a simple query without orderBy to avoid needing a composite index
    const q = query(
      collection(db, 'user_evidence'),
      where('userId', '==', currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const records = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        timestamp: d.data().timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
      }));
      // Sort client-side (newest first)
      records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setEvidenceList(records);
      console.log(`📁 Loaded ${records.length} evidence records`);
    }, (error) => {
      console.error('Evidence query error:', error.message);
    });

    return () => {
      unsub();
      if (fallbackUnsubRef.current) fallbackUnsubRef.current();
    };
  }, [currentUser]);

  const startRecording = async (type) => {
    try {
      setUploadStatus('');
      setUploadMessage('');
      
      const constraints = type === 'video'
        ? { video: { facingMode: 'environment' }, audio: true }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Pick a supported mimeType
      let mimeType = '';
      const typesToTry = type === 'video'
        ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
        : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      
      for (const t of typesToTry) {
        try {
          if (MediaRecorder.isTypeSupported(t)) { mimeType = t; break; }
        } catch(e) { /* skip */ }
      }
      
      const recorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Immediately snapshot chunks
        const savedChunks = [...chunksRef.current];
        
        if (savedChunks.length === 0) {
          console.error('❌ No data was recorded');
          setUploadStatus('error');
          setUploadMessage('No data was recorded. Please try again.');
          stream.getTracks().forEach(t => t.stop());
          setRecording(false);
          setRecordingType(null);
          setElapsed(0);
          clearInterval(timerRef.current);
          return;
        }

        const blobMime = type === 'video' ? (mimeType || 'video/webm') : (mimeType || 'audio/webm');
        const blob = new Blob(savedChunks, { type: blobMime });
        const fileName = `manual_${currentUser?.uid?.slice(0, 6)}_${Date.now()}.webm`;

        console.log(`🎥 Recording stopped. Blob size: ${blob.size} bytes, chunks: ${savedChunks.length}`);

        setUploading(true);
        setUploadStatus('uploading');
        setUploadMessage('Uploading evidence...');

        try {
          // Upload to Cloudinary
          const downloadUrl = await uploadToCloudinary(blob);

          console.log('✅ Upload complete:', downloadUrl);

          // Save to Firestore user_evidence collection
          await addDoc(collection(db, 'user_evidence'), {
            userId: currentUser.uid,
            fileName,
            url: downloadUrl,
            timestamp: serverTimestamp(),
            type,
            size: blob.size
          });

          console.log('✅ Saved to Firestore user_evidence');
          setUploadStatus('success');
          setUploadMessage('Evidence saved successfully!');

          // Best-effort: link to active SOS if one exists
          try {
            const sosQ = query(
              collection(db, 'sos_alerts'), 
              where('victimId', '==', currentUser.uid), 
              where('status', '==', 'active')
            );
            const querySnapshot = await getDocs(sosQ);
            
            if (!querySnapshot.empty) {
              const sosDoc = querySnapshot.docs[0];
              await updateDoc(doc(db, 'sos_alerts', sosDoc.id), { evidenceUrl: downloadUrl });
            }
          } catch (sosErr) {
            console.warn("Couldn't link to SOS alert (non-critical):", sosErr);
          }

        } catch (err) {
          console.error("❌ Evidence upload failed:", err);
          setUploadStatus('error');
          setUploadMessage(`Upload failed: ${err.message}`);
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
      // Use 1-second timeslice to ensure data is captured continuously
      recorder.start(1000);
      setRecording(true);
      setRecordingType(type);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
      console.log(`🚀 Manual ${type} recording started (mimeType: ${mimeType || 'default'})`);
    } catch (err) {
      console.error('Recording start error:', err);
      alert(`Could not access ${type} device: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const deleteEvidence = async (id) => {
    try {
      await deleteDoc(doc(db, 'user_evidence', id));
      console.log('🗑️ Evidence deleted from Firestore:', id);
    } catch (err) {
      console.error('Delete failed:', err);
      // Fallback: remove from local state
      setEvidenceList(prev => prev.filter(e => e.id !== id));
    }
  };

  const downloadEvidence = (item) => {
    if (!item.url) return alert('No download URL available.');
    window.open(item.url, '_blank');
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
              disabled={uploading}
              className="bg-white border-2 border-gray-100 p-5 rounded-2xl flex flex-col items-center gap-3 shadow-sm hover:border-primary hover:bg-red-50 transition active:scale-95 disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
                <Mic size={28} className="text-primary" />
              </div>
              <span className="font-bold text-secondary text-sm">{t('record_audio')}</span>
            </button>
            <button
              onClick={() => startRecording('video')}
              disabled={uploading}
              className="bg-white border-2 border-gray-100 p-5 rounded-2xl flex flex-col items-center gap-3 shadow-sm hover:border-secondary hover:bg-blue-50 transition active:scale-95 disabled:opacity-50"
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
              onClick={stopRecording}
              className="px-8 py-3 bg-red-500 text-white font-bold rounded-xl active:scale-95 transition"
            >
              {t('stop_recording')}
            </button>
          </div>
        )}

        {/* Upload Status Banner */}
        {uploadStatus === 'uploading' && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 animate-pulse">
            <Loader2 size={20} className="text-blue-500 animate-spin" />
            <span className="text-blue-700 font-bold text-sm">{uploadMessage}</span>
          </div>
        )}
        {uploadStatus === 'success' && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <CheckCircle size={20} className="text-emerald-500" />
            <span className="text-emerald-700 font-bold text-sm">{uploadMessage}</span>
          </div>
        )}
        {uploadStatus === 'error' && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={20} className="text-red-500" />
            <span className="text-red-700 font-bold text-sm">{uploadMessage}</span>
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
