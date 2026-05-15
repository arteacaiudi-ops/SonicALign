import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Activity, LayoutGrid, TrendingDown, SlidersHorizontal, Mic } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [activeView, setActiveView] = useState('summary');
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const signalRef = useRef(null);

  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  const toggleTest = async () => {
    if (isTestRunning) { signalRef.current?.stop(); setIsTestRunning(false); }
    else { signalRef.current = await playReferenceSignal('pulse', 4); setIsTestRunning(true); }
  };

  const processAcoustics = useCallback(() => {
    if (!isRunning) return;
    const sr = getSampleRate();
    const samples = getCircularBufferSlice(sr * 4);
    if (!samples) return;
    let pulseIdx = -1;
    for (let i = 0; i < samples.length; i++) { if (Math.abs(samples[i]) > 0.15) { pulseIdx = i; break; } }
    if (pulseIdx === -1) return;
    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    for (let i = pulseIdx; i < pulseIdx + fiftyMs; i++) early += samples[i] ** 2;
    for (let i = pulseIdx + fiftyMs; i < samples.length; i++) late += samples[i] ** 2;
    setMetrics({ c50: 10 * Math.log10(early / (late || 0.0001)), rt60: 0.8 + (late * 15) });
  }, [getCircularBufferSlice, getSampleRate, isRunning]);

  useEffect(() => { if (isTestRunning && isRunning) { const t = setInterval(processAcoustics, 3800); return () => clearInterval(t); } }, [isTestRunning, isRunning, processAcoustics]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-2 py-1 gap-2">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`px-4 py-2 my-1 rounded border font-black text-[10px] ${isRunning ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue'}`}>
          {isRunning ? 'PARAR MIC' : 'ANALISAR'}
        </button>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`px-4 py-3 flex items-center gap-2 text-[10px] font-bold uppercase border-b-2 transition-all ${activeView === v.id ? 'text-neon-blue border-neon-blue bg-blue-900/10' : 'text-zinc-600 border-transparent'}`}>
            <v.icon size={14}/> {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-2xl flex justify-between items-center shadow-xl">
           <div className="flex flex-col">
              <span className="text-zinc-600 text-[9px] uppercase font-black tracking-widest">Status da Sala</span>
              <span className={`text-xs font-bold ${isRunning ? 'text-neon-green animate-pulse' : 'text-zinc-700'}`}>
                {isRunning ? 'ANALISANDO O AMBIENTE...' : 'MIC DESATIVADO'}
              </span>
           </div>
           <div className="flex items-center gap-3">
              <span className="text-[8px] text-zinc-500 font-bold uppercase">Emitir Pulso</span>
              <button onClick={toggleTest} className={`p-4 rounded-full transition-all border ${isTestRunning ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue/40 text-neon-blue'}`}>
                {isTestRunning ? <Square size={20}/> : <Play size={20}/>}
              </button>
           </div>
        </div>

        <div className="flex-1">
          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-4">
               <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-bold tracking-tighter text-left border-b border-zinc-800 pb-2">Reverb Time (RT60)</p>
                  <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-bold tracking-tighter text-left border-b border-zinc-800 pb-2">Inteligibilidade (C50)</p>
                  <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
