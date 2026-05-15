import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { ISO_31_BANDS } from '@/lib/app-params';

const AudioEngineContext = createContext(null);
export const useAudioEngine = () => useContext(AudioEngineContext);

const SAMPLE_RATE = 48000;

export function AudioEngineProvider({ children }) {
  const [isRunning, setIsRunning] = useState(false);
  const [inputDevices, setInputDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [inputGain, setInputGain] = useState(1.0);
  const [splOffset, setSplOffset] = useState(0);
  const [rtaComp, setRtaComp] = useState(new Array(31).fill(0));
  const [batterySave, setBatterySave] = useState(true);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const gainNodeRef = useRef(null);
  const streamRef = useRef(null);
  const circularBufferRef = useRef(null);
  const bufferWriteIdxRef = useRef(0);
  const activeSignalRef = useRef(null);

  const stop = useCallback(() => {
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
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const gainNode = ctx.createGain();
      gainNode.gain.value = inputGain;
      gainNodeRef.current = gainNode;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 16384; // Maior precisão para 31 bandas
      analyserRef.current = analyser;

      circularBufferRef.current = new Float32Array(SAMPLE_RATE * 10);
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
    } catch (err) { console.error(err); }
  }, [isRunning, inputGain]);

  const get31BandData = useCallback(() => {
    if (!analyserRef.current) return null;
    const freqData = new Float32Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getFloatFrequencyData(freqData);
    
    return ISO_31_BANDS.map((freq, i) => {
      const bin = Math.round(freq / (SAMPLE_RATE / analyserRef.current.fftSize));
      const val = freqData[bin] || -100;
      return val + rtaComp[i]; // Aplica a compensação da calibração
    });
  }, [rtaComp]);

  const playReferenceSignal = useCallback(async (type) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    if (activeSignalRef.current?.stop) activeSignalRef.current.stop();

    if (type === 'pink') {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0, b1, b2, b3, b4, b5, b6; b0=b1=b2=b3=b4=b5=b6=0;
      for (let i = 0; i < buffer.length; i++) {
        let white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179; b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520; b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522; b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      const node = ctx.createBufferSource();
      node.buffer = buffer; node.loop = true;
      node.connect(ctx.destination); node.start();
      activeSignalRef.current = { stop: () => node.stop() };
    } 
    else if (type === 'sweep') {
      const now = ctx.currentTime;
      // Tom de sincronia
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(1000, now);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.5, now+0.1);
      g.gain.setValueAtTime(0.5, now+0.3); g.gain.linearRampToValueAtTime(0, now+0.4);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(now); osc.stop(now+0.4);
      // Sweep
      const sOsc = ctx.createOscillator();
      const sG = ctx.createGain();
      sOsc.frequency.setTargetAtTime(20000, now + 0.8, 1.5);
      sG.gain.setValueAtTime(0, now+0.8); sG.gain.linearRampToValueAtTime(0.7, now+1.0);
      sG.gain.setValueAtTime(0.7, now+5.8); sG.gain.linearRampToValueAtTime(0, now+6.0);
      sOsc.connect(sG); sG.connect(ctx.destination);
      sOsc.start(now+0.8); sOsc.stop(now+6.0);
      activeSignalRef.current = { stop: () => sOsc.stop() };
    }
    return activeSignalRef.current;
  }, []);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(devices => setInputDevices(devices.filter(d => d.kind === 'audioinput')));
  }, []);

  return (
    <AudioEngineContext.Provider value={{
      isRunning, inputGain, setInputGain, splOffset, setSplOffset, rtaComp, setRtaComp, batterySave, setBatterySave,
      inputDevices, selectedDevice, setSelectedDevice, start, stop, playReferenceSignal, get31BandData,
      getCircularBufferSlice: (count) => {
        if (!circularBufferRef.current) return null;
        const buf = circularBufferRef.current; const idx = bufferWriteIdxRef.current;
        const res = new Float32Array(count);
        for (let i = 0; i < count; i++) res[i] = buf[((idx - count + i) % buf.length + buf.length) % buf.length];
        return res;
      },
      getSampleRate: () => SAMPLE_RATE
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
}
