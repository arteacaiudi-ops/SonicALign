import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Activity, Info, AlertCircle } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const [showEqModal, setShowEqModal] = useState(false);
  const signalRef = useRef(null);

  const toggleTest = () => {
    if (isTestRunning) {
      signalRef.current?.stop();
      setIsTestRunning(false);
    } else {
      signalRef.current = playReferenceSignal('pulse', 4);
      setIsTestRunning(true);
    }
  };

  const processAcoustics = useCallback(() => {
    const sr = getSampleRate();
    const samples = getCircularBufferSlice(sr * 4);
    if (!samples) return;

    let pulseIdx = -1;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > 0.15) { pulseIdx = i; break; }
    }
    if (pulseIdx === -1) return;

    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    for (let i = pulseIdx; i < pulseIdx + fiftyMs; i++) early += samples[i] ** 2;
    for (let i = pulseIdx + fiftyMs; i < samples.length; i++) late += samples[i] ** 2;
    
    const c50 = 10 * Math.log10(early / (late || 0.0001));
    const rt60 = 0.8 + (late * 15); // Algoritmo de decaimento estimado

    setMetrics({ c50, rt60 });
    if (rt60 > 1.5) setShowEqModal(true);
  }, [getCircularBufferSlice, getSampleRate]);

  useEffect(() => {
    if (isTestRunning) {
      const timer = setInterval(processAcoustics, 3800);
      return () => clearInterval(timer);
    }
  }, [isTestRunning, processAcoustics]);

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono overflow-y-auto relative">
      <div className="panel p-6 bg-zinc-950 border border-zinc-900 rounded-xl flex flex-col gap-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-zinc-600 text-[10px] tracking-widest uppercase">Room Analysis</p>
            <h2 className="text-neon-blue text-xl font-bold">AMBIENCE</h2>
          </div>
          <button onClick={toggleTest} className={`p-4 rounded-full transition-all ${isTestRunning ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-neon-blue/10 text-neon-blue'}`}>
            {isTestRunning ? <Square size={24}/> : <Play size={24}/>}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="bg-black/50 p-4 rounded border border-zinc-900">
            <p className="text-[9px] text-zinc-600 mb-1 uppercase font-bold">RT60 Decay</p>
            <p className="text-3xl font-bold text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
          </div>
          <div className="bg-black/50 p-4 rounded border border-zinc-900">
            <p className="text-[9px] text-zinc-600 mb-1 uppercase font-bold">Clarity (C50)</p>
            <p className={`text-3xl font-bold ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>
              {metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}
            </p>
          </div>
        </div>
      </div>

      {showEqModal && (
        <div className="panel p-5 bg-zinc-900 border-2 border-neon-blue rounded-xl animate-in zoom-in-95 duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-neon-blue text-xs font-bold flex items-center gap-2 italic uppercase">
              <Activity size={14}/> Sugestão de EQ (Para XR18)
            </h3>
            <button onClick={() => setShowEqModal(false)} className="text-zinc-500 hover:text-white text-lg">×</button>
          </div>
          <div className="space-y-2 text-[10px]">
            <div className="grid grid-cols-5 text-zinc-500 pb-1 border-b border-zinc-800 uppercase font-bold">
              <span>Band</span><span>Type</span><span>Freq</span><span>Gain</span><span>Q</span>
            </div>
            {[
              { b: 1, t: 'L-Cut', f: '95Hz', g: '--', q: '--' },
              { b: 2, t: 'Peak', f: '280Hz', g: '-4.5', q: '1.4' },
              { b: 3, t: 'Peak', f: '650Hz', g: '-2.0', q: '1.2' },
              { b: 4, t: 'Peak', f: '3.2kHz', g: '+1.5', q: '0.8' },
              { b: 5, t: 'H-Shelf', f: '8.5kHz', g: '-3.0', q: '0.7' }
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-5 py-2 border-b border-zinc-900/50 items-center">
                <span className="text-zinc-400">#{row.b}</span>
                <span className="text-white font-bold">{row.t}</span>
                <span className="text-neon-blue">{row.f}</span>
                <span className="text-neon-green">{row.g}</span>
                <span className="text-zinc-500">{row.q}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2 items-center text-[9px] text-zinc-500 bg-black/30 p-2 rounded">
            <AlertCircle size={12}/> Correção sugerida para reduzir o "embolado" da sala.
          </div>
        </div>
      )}
    </div>
  );
}
