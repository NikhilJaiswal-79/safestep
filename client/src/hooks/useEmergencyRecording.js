import { useState, useRef, useCallback } from 'react';
import { storage, db } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export default function useEmergencyRecording() {
  const { currentUser } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async (alertId = null, existingStream = null) => {
    try {
      // Use existing stream if provided (to bypass user gesture check at T=0)
      const stream = existingStream || await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      });
      
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const fileName = `emergency_${currentUser?.uid?.slice(0, 6)}_${Date.now()}.webm`;
        
        console.log('🎥 Recording stopped. Uploading evidence...');
        
        try {
          const storageRef = ref(storage, `evidence/${currentUser.uid}/${fileName}`);
          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);

          // If we have an alertId, update it. Otherwise find the active one.
          let targetAlertId = alertId;
          if (!targetAlertId) {
            const q = query(
              collection(db, 'sos_alerts'), 
              where('victimId', '==', currentUser.uid), 
              where('status', '==', 'active')
            );
            const snap = await getDocs(q);
            if (!snap.empty) targetAlertId = snap.docs[0].id;
          }

          if (targetAlertId) {
            await updateDoc(doc(db, 'sos_alerts', targetAlertId), {
              evidenceUrl: downloadUrl,
              evidenceTimestamp: serverTimestamp()
            });
            console.log('✅ Alert updated with evidence link.');
          }
        } catch (err) {
          console.error("Failed to upload emergency evidence:", err);
        }
        
        // Stop all tracks to release camera/mic
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      console.log('🚀 Emergency recording started...');
      
      return recorder;
    } catch (err) {
      console.error("Could not start emergency recording:", err);
      return null;
    }
  }, [currentUser]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { isRecording, startRecording, stopRecording };
}
