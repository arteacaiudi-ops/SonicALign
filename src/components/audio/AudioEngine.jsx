import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const AudioEngineContext = createContext(null);
export const useAudioEngine = () => useContext(AudioEngineContext);

const SAMPLE_RATE = 48000;
const BUFFER_DURATION = 8; 

export function AudioEngineProvider({ children }) {
  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState(null);
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [inputGain, setInputGain] = useState(1.0);
  const [invertPolarity, setInvertPolarity] = useState(false);
  const [splOffset, setSplOffset] = useState(0);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const gainNodeRef = useRef(null);
  const streamRef = useRef(null);
  const circularBufferRef = useRef(null);
  const bufferWriteIdxRef = useRef(0);
  const BUFFER_SIZE = SAMPLE_RATE * BUFFER_DURATION;

  useEffect(() => {
    const load = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputDevices(devices.filter(d => d.kind === 'audioinput'));
    };
    load();
  }, []);

  const playReferenceSignal = useCallback((type, interval = 1) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    if (type === 'pink') {
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      const node = ctx.createBufferSource();
      node.buffer = noiseBuffer;
      node.loop = true;
      node.connect(ctx.destination);
      node.start();
      return node;
    } 

    if (type === 'pulse') {
      const timer = setInterval(() => {
        const g = ctx.createGain();
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 1;
        const amp = invertPolarity ? -0.8 : 0.8;
        g.gain.setValueAtTime(amp, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.012);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.02);
      }, interval * 1000);
      return { stop: () => clearInterval(timer) };
    }
  }, [invertPolarity]);

  const start = useCallback(async (deviceId) => {
    if (isRunning) return;
    setIsStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      if (ctx.state === 'suspended') await ctx.resume();
      audioCtxRef.current = ctx;

      const gainNode = ctx.createGain();
      gainNode.gain.value = inputGain;
      gainNodeRef.current = gainNode;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyserRef.current = analyser;

      circularBufferRef.current = new Float32Array(BUFFER_SIZE);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const buf = circularBufferRef.current;
        let idx = bufferWriteIdxRef.current;
        for (let i = 0; i < input.length; i++) {
          buf[idx % BUFFER_SIZE] = input[i];
          idx++;
        }
        bufferWriteIdxRef.current = idx;
      };

      ctx.createMediaStreamSource(stream).connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(processor);
      processor.connect(ctx.destination);
      setIsRunning(true);
    } catch (err) { setError(err.message); }
    setIsStarting(false);
  }, [isRunning, inputGain, BUFFER_SIZE]);

  const stop = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = inputGain;
  }, [inputGain]);

  return (
    <AudioEngineContext.Provider value={{
      isRunning, isStarting, error, inputGain, setInputGain, invertPolarity, setInvertPolarity, splOffset, setSplOffset,
      inputDevices, selectedDevice, setSelectedDevice, start, stop, playReferenceSignal,
      getFrequencyData: () => {
        if (!analyserRef.current) return null;
        const data = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatFrequencyData(data);
        return data;
      },
      getCircularBufferSlice: (count) => {
        if (!circularBufferRef.current) return null;
        const buf = circularBufferRef.current;
        const writeIdx = bufferWriteIdxRef.current;
        const result = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          const readIdx = ((writeIdx - count + i) % BUFFER_SIZE + BUFFER_SIZE) % BUFFER_SIZE;
          result[i] = buf[readIdx];
        }
        return result;
      },
      getSampleRate: () => audioCtxRef.current?.sampleRate || SAMPLE_RATE
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
}
