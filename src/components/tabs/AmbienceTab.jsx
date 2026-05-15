import React, { useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, Square, LayoutGrid, TrendingDown, BarChart3, Waves, SlidersHorizontal, Activity, Crosshair } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice, autoGainNormalize } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [activeView, setActiveView] = useState('summary');
  const [threshold, setThreshold] = useState(0.25);
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const [liveData, setLiveData] = useState(new Float32Array(0));
  
  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'bands', label: 'Bandas', icon: BarChart3 },
    { id: 'waterfall', label: 'Cachoeira', icon: Waves },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  const toggleTest = async () => {
    if (isTestRunning) { setIsTestRunning(false); }
    else { await playReferenceSignal('pulse', 4); setIsTestRunning(true); }
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const sr = getSampleRate();
      const samples = getCircularBufferSlice(sr * 8); 
      setLiveData(samples);

      if (isTestRunning) {
        let pulseIdx = -1;
        for (let i = samples.length - 1; i > sr; i--) {
          if (Math.abs(samples[i]) > threshold && Math.abs(samples[i-1]) < threshold) {
            pulseIdx = i; break;
          }
        }
        if (pulseIdx !== -1) {
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
        }
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, isTestRunning, getCircularBufferSlice, getSampleRate, threshold]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-1 py-1 gap-1 shrink-0">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`w-16 h-10 rounded-md font-black text-[9px] border ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-blue text-neon-blue'}`}>
          {isRunning ? 'STOP' : 'START'}
        </button>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`flex-shrink-0 px-3 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${activeView === v.id ? 'text-neon-blue border-neon-blue bg-blue-900/10' : 'text-zinc-600 border-transparent'}`}>
            <v.icon size={12}/> {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-7 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900 shrink-0 text-red-500 uppercase text-[6px] font-black">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
          <span className="rotate-90 mt-4">THR</span>
        </div>

        <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto">
          <div className="h-24 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden shrink-0 shadow-inner">
              <RollingGraph data={liveData} threshold={threshold} color="#0088ff" />
              <div className="absolute top-1 left-2 flex items-center gap-2 bg-black/70 px-2 rounded border border-zinc-800">
                <Activity size={8} className="text-neon-blue animate-pulse"/>
                <span className="text-[7px] text-white font-black uppercase tracking-widest">Monitor 8s</span>
              </div>
          </div>

          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex justify-between items-center shrink-0">
             <button onClick={() => autoGainNormalize(-20)} className="p-2 rounded border border-zinc-800 text-zinc-400"><Crosshair size={14}/></button>
             <span className={`text-[8px] font-black uppercase tracking-widest ${isRunning ? 'text-neon-green animate-pulse' : 'text-zinc-700'}`}>
                {isRunning ? (isTestRunning ? 'ANALISANDO AMBIENTE' : 'MIC ATIVO') : 'MIC OFF'}
             </span>
             <button onClick={toggleTest} className="px-3 py-2 rounded-lg font-black text-[9px] border border-neon-blue text-neon-blue">
                {isTestRunning ? <Square size={12} className="inline mr-1"/> : <Play size={12} className="inline mr-1"/>} EMITIR PULSO
             </button>
          </div>

          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-2 animate-in fade-in">
               <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-neon-blue opacity-50"></div>
                  <p className="text-[8px] text-zinc-500 mb-1 uppercase font-black text-left border-b border-zinc-800 pb-1 flex justify-between tracking-widest">RT60 <span className="text-neon-blue">REVERB</span></p>
                  <p className="text-5xl font-black text-white py-2">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-800 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-neon-yellow opacity-50"></div>
                  <p className="text-[8px] text-zinc-500 mb-1 uppercase font-black text-left border-b border-zinc-800 pb-1 flex justify-between tracking-widest">C50 <span className="text-neon-yellow">CLAREZA</span></p>
                  <p className={`text-5xl font-black py-2 ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
