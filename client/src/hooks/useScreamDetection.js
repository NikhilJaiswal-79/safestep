import { useEffect, useRef, useState } from 'react';

/**
 * useScreamDetection
 * Uses Web Audio API to listen to microphone amplitude in real time.
 * If amplitude consistently exceeds threshold for 2+ seconds → triggers onScreamDetected().
 * 
 * Simplified version (no TensorFlow): uses loudness as proxy for distress sounds.
 */
const THRESHOLD = 0.25; // Amplitude from 0.0 to 1.0. Screams are usually > 0.2
const REQUIRED_FRAMES = 120; // 120 frames at ~60fps ≈ 2 seconds of sustained noise

export default function useScreamDetection(onScreamDetected) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  
  const streamRef = useRef(null);
  const contextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const isListeningRef = useRef(false);
  const triggerCountRef = useRef(0);

  const stopListening = () => {
    isListeningRef.current = false;
    setIsListening(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (contextRef.current && contextRef.current.state !== 'closed') {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    triggerCountRef.current = 0;
  };

  const startListening = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const context = new (window.AudioContext || window.webkitAudioContext)();
      contextRef.current = context;

      // Resume context if suspended (common in browsers)
      if (context.state === 'suspended') {
        await context.resume();
      }

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const detectLoop = () => {
        if (!isListeningRef.current || !analyserRef.current) return;
        
        // Use Time Domain data for more accurate loudness (RMS)
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate RMS amplitude from PCM data
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          // dataArray values are 0-255, offset by 128 (silence)
          const normalized = (dataArray[i] / 128.0) - 1.0;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);

        if (rms > THRESHOLD) {
          triggerCountRef.current += 1;
          if (triggerCountRef.current >= REQUIRED_FRAMES) {
            triggerCountRef.current = 0;
            onScreamDetected();
          }
        } else {
          triggerCountRef.current = Math.max(0, triggerCountRef.current - 1);
        }

        animFrameRef.current = requestAnimationFrame(detectLoop);
      };

      isListeningRef.current = true;
      setIsListening(true);
      detectLoop();
    } catch (err) {
      setError('Microphone access denied. Enable mic for Scream Detection.');
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => stopListening();
  }, []);

  return { isListening, toggleListening, error };
}
