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
        // Busca o transiente mais recente que cruzou o threshold
        let pulseIdx = -1;
        for (let i = samples.length - 1; i > sr * 0.1; i--) {
          if (Math.abs(samples[i]) > threshold && Math.abs(samples[i-100]) < threshold * 0.5) {
            pulseIdx = i; break;
          }
        }
        
        if (pulseIdx !== -1 && pulseIdx < samples.length - sr) {
          const fiftyMs = Math.floor(sr * 0.05);
          let early = 0, late = 0;
          for (let i = pulseIdx; i < pulseIdx + fiftyMs; i++) early += samples[i] ** 2;
          for (let i = pulseIdx + fiftyMs; i < pulseIdx + sr; i++) late += samples[i] ** 2;
          
          if (early > 0) {
            setMetrics({ 
              c50: 10 * Math.log10(early / (late || 0.00001)), 
              rt60: 0.3 + (late / early) * 18 
            });
          }
        }
      }
    }, 150);
    return () => clearInterval(interval);
  }, [isRunning, isTestRunning, getCircularBufferSlice, getSampleRate, threshold]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-1 py-1 gap-1 shrink-0">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`w-16 h-10 rounded-md font-black text-[9px] border ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-blue text-neon-blue'}`}>
          {isRunning ? 'STOP' : 'START'}
        </button>
        {['summary', 'etc', 'bands', 'waterfall', 'eq'].map(id => (
          <button key={id} onClick={() => setActiveView(id)} className={`flex-shrink-0 px-3 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${activeView === id ? 'text-neon-blue border-neon-blue' : 'text-zinc-600 border-transparent'}`}>
            {id}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-7 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900 shrink-0">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>

        <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto">
          <div className="h-24 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden shrink-0">
              <RollingGraph data={liveData} threshold={threshold} color="#0088ff" />
          </div>

          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex justify-between items-center shrink-0">
             <button onClick={() => autoGainNormalize(-20)} className="p-2 rounded border border-zinc-800 text-zinc-400"><Crosshair size={14}/></button>
             <span className={`text-[8px] font-black uppercase ${isRunning ? 'text-neon-green animate-pulse' : 'text-zinc-700'}`}>
                {isRunning ? (isTestRunning ? 'LENDO PULSO' : 'MIC ON') : 'MIC OFF'}
             </span>
             <button onClick={toggleTest} className="px-3 py-2 rounded-lg font-black text-[9px] border border-neon-blue text-neon-blue">
                {isTestRunning ? 'STOP PULSE' : 'EMITIR 4s'}
             </button>
          </div>

          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-2 animate-in fade-in">
               <div className="bg-zinc-900/40 p-6 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-black">RT60 (Decaimento)</p>
                  <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-6 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-black">C50 (Clareza)</p>
                  <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
