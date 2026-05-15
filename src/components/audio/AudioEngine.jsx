import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const AudioEngineContext = createContext(null);

export const useAudioEngine = () => {
  const context = useContext(AudioEngineContext);
  if (!context) {
    throw new Error('useAudioEngine must be used within an AudioEngineProvider');
  }
  return context;
};

const FFT_SIZE = 4096;
const SAMPLE_RATE = 48000;
const BUFFER_DURATION = 8; 

export function AudioEngineProvider({ children }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [micCalibration, setMicCalibration] = useState(null);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const streamRef = useRef(null);
  const circularBufferRef = useRef(null);
  const bufferWriteIdxRef = useRef(0);
  const BUFFER_SIZE = SAMPLE_RATE * BUFFER_DURATION;
  const processorRef = useRef(null);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      setInputDevices(audioInputs);
    } catch (e) {
      console.error("Erro ao listar dispositivos", e);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const start = useCallback(async (deviceId) => {
    if (isRunning) return;
    setIsStarting(true);
    setError(null);

    try {
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googHighpassFilter: false,
          googNoiseSuppression2: false,
          googEchoCancellation2: false,
          googAutoGainControl2: false,
          latency: 0,
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: SAMPLE_RATE,
        latencyHint: 'interactive',
      });
      
      // Ensure AudioContext is resumed on mobile devices
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.0;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      circularBufferRef.current = new Float32Array(BUFFER_SIZE);
      bufferWriteIdxRef.current = 0;

      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const buf = circularBufferRef.current;
        if (!buf) return;
        
        let idx = bufferWriteIdxRef.current;
        for (let i = 0; i < input.length; i++) {
          buf[idx % BUFFER_SIZE] = input[i];
          idx++;
        }
        bufferWriteIdxRef.current = idx;
      };
      processorRef.current = processor;

      // Connect source to analyser and processor
      source.connect(analyser);
      source.connect(processor);
      // Connect processor to destination to ensure audio processing continues
      processor.connect(ctx.destination);

      setIsRunning(true);
      setIsStarting(false);
      await loadDevices();
    } catch (err) {
      setError(err.message || 'Acesso negado');
      setIsStarting(false);
    }
  }, [isRunning, BUFFER_SIZE]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setIsRunning(false);
  }, []);

  const getFrequencyData = useCallback(() => {
    if (!analyserRef.current) return null;
    const data = new Float32Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getFloatFrequencyData(data);
    return data;
  }, []);

  const getCircularBufferSlice = useCallback((count) => {
    if (!circularBufferRef.current) return null;
    const buf = circularBufferRef.current;
    const writeIdx = bufferWriteIdxRef.current;
    const result = new Float32Array(count);
    const startIdx = writeIdx - count;
    for (let i = 0; i < count; i++) {
      const readIdx = ((startIdx + i) % BUFFER_SIZE + BUFFER_SIZE) % BUFFER_SIZE;
      result[i] = buf[readIdx];
    }
    return result;
  }, [BUFFER_SIZE]);

  const getSampleRate = useCallback(() => audioCtxRef.current?.sampleRate || SAMPLE_RATE, []);

  return (
    <AudioEngineContext.Provider value={{
      isRunning, isStarting, error,
      inputDevices, selectedDevice, setSelectedDevice,
      micCalibration, setMicCalibration,
      start, stop,
      getFrequencyData,
      getCircularBufferSlice,
      getSampleRate,
      analyserRef, audioCtxRef,
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
}
