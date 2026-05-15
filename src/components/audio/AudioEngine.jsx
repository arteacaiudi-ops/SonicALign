import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

const AudioEngineContext = createContext(null);
export const useAudioEngine = () => useContext(AudioEngineContext);

const SAMPLE_RATE = 48000;
const BUFFER_DURATION = 10; 

export function AudioEngineProvider({ children }) {
  const [isRunning, setIsRunning] = useState(false);
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [inputGain, setInputGain] = useState(1.0);
  const [batterySave, setBatterySave] = useState(true);
  const [invertPolarity, setInvertPolarity] = useState(false);
  const [splOffset, setSplOffset] = useState(0);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const gainNodeRef = useRef(null);
  const streamRef = useRef(null);
  const circularBufferRef = useRef(null);
  const bufferWriteIdxRef = useRef(0);
  const activeSignalRef = useRef(null);

  const stop = useCallback(() => {
    if (activeSignalRef.current?.stop) activeSignalRef.current.stop();
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setIsRunning(false);
  }, []);

  const start = useCallback(async (deviceId) => {
    if (isRunning) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: deviceId !== 'default' ? { exact: deviceId } : undefined, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      streamRef.current = stream;
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const gainNode = ctx.createGain();
      gainNode.gain.value = inputGain;
      gainNodeRef.current = gainNode;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyserRef.current = analyser;

      circularBufferRef.current = new Float32Array(SAMPLE_RATE * BUFFER_DURATION);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        const input = e.inputBuffer.getChannelData(0);
        const buf = circularBufferRef.current;
        let idx = bufferWriteIdxRef.current;
        for (let i = 0; i < input.length; i++) {
          buf[idx % buf.length] = input[i];
          idx++;
        }
        bufferWriteIdxRef.current = idx;
      };

      ctx.createMediaStreamSource(stream).connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(processor);
      processor.connect(ctx.destination);
      setIsRunning(true);
    } catch (err) { alert("Erro mic: " + err.message); }
  }, [isRunning, inputGain]);

  const autoGainNormalize = useCallback((targetDb = -25) => {
    if (!analyserRef.current) return;
    const data = new Float32Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getFloatFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const diff = targetDb - avg;
    const newGain = Math.max(0.1, Math.min(10, inputGain * Math.pow(10, diff / 20)));
    setInputGain(newGain);
  }, [inputGain]);

  const playReferenceSignal = useCallback(async (type, interval = 1) => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    if (activeSignalRef.current?.stop) activeSignalRef.current.stop();

    if (type === 'pink') {
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < noiseBuffer.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520; b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      const node = ctx.createBufferSource();
      node.buffer = noiseBuffer; node.loop = true;
      node.connect(ctx.destination); node.start();
      activeSignalRef.current = { stop: () => { try{node.stop()}catch(e){} } };
    } else {
      const timer = setInterval(() => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.setValueAtTime(invertPolarity ? -0.8 : 0.8, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.02);
        osc.connect(g); g.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.02);
      }, interval * 1000);
      activeSignalRef.current = { stop: () => clearInterval(timer) };
    }
    return activeSignalRef.current;
  }, [invertPolarity]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setInputDevices(devices.filter(d => d.kind === 'audioinput'));
    });
  }, []);

  return (
    <AudioEngineContext.Provider value={{
      isRunning, inputGain, setInputGain, batterySave, setBatterySave, invertPolarity, setInvertPolarity, splOffset, setSplOffset,
      inputDevices, selectedDevice, setSelectedDevice, start, stop, playReferenceSignal, autoGainNormalize,
      getFrequencyData: () => {
        if (!analyserRef.current) return null;
        const data = new Float32Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getFloatFrequencyData(data); return data;
      },
      getCircularBufferSlice: (count) => {
        if (!circularBufferRef.current) return null;
        const buf = circularBufferRef.current;
        const writeIdx = bufferWriteIdxRef.current;
        const result = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          result[i] = buf[((writeIdx - count + i) % buf.length + buf.length) % buf.length];
        }
        return result;
      },
      getSampleRate: () => SAMPLE_RATE
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
}
