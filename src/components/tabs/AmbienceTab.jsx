import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Activity, Info, ChevronRight } from 'lucide-react';

export default function AmbienceTab() {
  const { isRunning, playReferenceSignal, getCircularBufferSlice, getSampleRate } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const [eqSuggestion, setEqSuggestion] = useState(null);
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
    const rt60 = 1.2 + (late * 10); // Simulação de decaimento para demonstração técnica

    setMetrics({ c50, rt60 });

    // Lógica do Assistente de EQ
    if (rt60 > 1.8) {
      setEqSuggestion([
        { band: 1, type: 'Low Cut', freq: '80Hz', gain: '--', q: '--' },
        { band: 2, type: 'Peaking', freq: '250Hz', gain: '-4.5dB', q: '1.4' },
        { band: 5, type: 'High Shelf', freq: '8kHz', gain: '+2.0dB', q: '0.7' }
      ]);
    } else {
      setEqSuggestion(null);
    }
  }, [getCircularBufferSlice, getSampleRate]);

  useEffect(() => {
    if (isTestRunning) {
      const timer = setInterval(processAcoustics, 3500);
      return () => clearInterval(timer);
    }
  }, [isTestRunning, processAcoustics]);

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono overflow-y-auto">
      <div className="panel p-6 bg-zinc-950 border border-zinc-900 rounded-lg flex flex-col gap-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-zinc-500 text-[10px] tracking-widest uppercase">Room Analysis</p>
            <h2 className="text-neon-blue text-xl font-bold">AMBIENCE</h2>
          </div>
          <button onClick={toggleTest} className={`p-4 rounded-full transition-all ${isTestRunning ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-neon-blue/10 text-neon-blue'}`}>
            {isTestRunning ? <Square size={24}/> : <Play size={24}/>}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black p-4 rounded border border-zinc-900">
            <p className="text-[9px] text-zinc-600 mb-1 uppercase">RT60 Decay</p>
            <p className="text-2xl font-bold text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
          </div>
          <div className="bg-black p-4 rounded border border-zinc-900">
            <p className="text-[9px] text-zinc-600 mb-1 uppercase">Intelligibility (C50)</p>
            <p className={`text-2xl font-bold ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>
              {metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}
            </p>
          </div>
        </div>
      </div>

      {eqSuggestion && (
        <div className="panel p-4 bg-neon-blue/5 border border-neon-blue/20 rounded-lg animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-neon-blue text-xs font-bold mb-3 flex items-center gap-2">
            <Activity size={14}/> XR18 SUGGESTED CORRECTION
          </h3>
          <div className="space-y-2">
            {eqSuggestion.map((s, i) => (
              <div key={i} className="flex justify-between items-center text-[10px] bg-black/40 p-2 rounded">
                <span className="text-zinc-400">B{s.band}</span>
                <span className="text-white font-bold">{s.type}</span>
                <span className="text-neon-blue">{s.freq}</span>
                <span className="text-neon-green">{s.gain}</span>
                <span className="text-zinc-500">Q:{s.q}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-zinc-900/30 rounded flex gap-3 items-start">
        <Info size={16} className="text-zinc-500 mt-0.5" />
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          O RT60 acima de 1.6s em locais fechados pode "borrar" a mixagem. 
          O C50 positivo garante que a voz seja entendida com clareza no fundo da sala.
        </p>
      </div>
    </div>
  );
}
