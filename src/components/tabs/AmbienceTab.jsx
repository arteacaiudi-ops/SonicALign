import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, Square, LayoutGrid, TrendingDown, SlidersHorizontal, Activity } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [activeView, setActiveView] = useState('summary');
  const [threshold, setThreshold] = useState(0.25);
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const signalRef = useRef(null);

  const toggleTest = async () => {
    if (isTestRunning) { signalRef.current?.stop(); setIsTestRunning(false); }
    else { signalRef.current = await playReferenceSignal('pulse', 4); setIsTestRunning(true); }
  };

  const processAcoustics = useCallback(() => {
    if (!isRunning) return;
    const sr = getSampleRate();
    const samples = getCircularBufferSlice(sr * 8); 
    if (!samples) return;

    let pulseIdx = -1;
    for (let i = samples.length - 1; i > sr; i--) {
      if (Math.abs(samples[i]) > threshold && Math.abs(samples[i-1]) < threshold) {
        pulseIdx = i; break;
      }
    }
    if (pulseIdx === -1) return;

    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    for (let i = pulseIdx; i < pulseIdx + fiftyMs && i < samples.length; i++) early += samples[i] ** 2;
    for (let i = pulseIdx + fiftyMs; i < pulseIdx + (sr * 2) && i < samples.length; i++) late += samples[i] ** 2;
    
    if (early > 0) {
        setMetrics({ 
          c50: 10 * Math.log10(early / (late || 0.0001)), 
          rt60: 0.4 + (late / (early || 1)) * 14 
        });
    }
  }, [getCircularBufferSlice, getSampleRate, isRunning, threshold]);

  useEffect(() => {
    if (isTestRunning && isRunning) {
      const t = setInterval(processAcoustics, 2000);
      return () => clearInterval(t);
    }
  }, [isTestRunning, isRunning, processAcoustics]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-2 py-1 gap-1 shrink-0">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className="w-20 px-1 py-2 my-1 rounded border font-black text-[9px] bg-neon-blue/10 border-neon-blue text-neon-blue">
          {isRunning ? 'STOP' : 'ANALISAR'}
        </button>
        {['summary', 'etc', 'eq'].map(id => (
          <button key={id} onClick={() => setActiveView(id)} className={`px-3 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${activeView === id ? 'text-neon-blue border-neon-blue' : 'text-zinc-600 border-transparent'}`}>
            {id === 'summary' ? 'Resumo' : id === 'etc' ? 'Decaimento' : 'EQ'}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-8 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900 shrink-0">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>

        <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto">
          <div className="h-24 bg-zinc-950 border border-zinc-800 rounded-xl relative overflow-hidden shrink-0 shadow-inner">
              <RollingGraph 
                data={getCircularBufferSlice(getSampleRate() * 8)}
                threshold={threshold}
                timeWindow={8}
                sr={getSampleRate()}
                color="#0088ff"
                isFrozen={false}
              />
              <div className="absolute top-1 left-2 flex items-center gap-1 bg-black/60 px-2 rounded border border-zinc-800">
                <Activity size={8} className="text-neon-blue animate-pulse"/>
                <span className="text-[7px] text-white font-black uppercase">Monitor 8s</span>
              </div>
          </div>

          <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl flex justify-between items-center shrink-0">
             <span className={`text-[8px] font-black uppercase ${isRunning ? 'text-neon-green animate-pulse' : 'text-zinc-700'}`}>
                {isRunning ? 'LENDO SALA' : 'MIC OFF'}
             </span>
             <button onClick={toggleTest} className="px-3 py-2 rounded-lg font-black text-[9px] border border-neon-blue text-neon-blue">
                {isTestRunning ? <Square size={12} className="inline mr-1"/> : <Play size={12} className="inline mr-1"/>} PULSO 4s
             </button>
          </div>

          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-2 animate-in fade-in">
               <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[8px] text-zinc-500 mb-1 uppercase font-black text-left border-b border-zinc-800 pb-1 flex justify-between">RT60 <span className="text-neon-blue">REVERB</span></p>
                  <p className="text-4xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[8px] text-zinc-500 mb-1 uppercase font-black text-left border-b border-zinc-800 pb-1 flex justify-between">C50 <span className="text-neon-yellow">CLAREZA</span></p>
                  <p className={`text-4xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
