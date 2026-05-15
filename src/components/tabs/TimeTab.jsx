import React, { useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, Square, Snowflake, RotateCcw, Crosshair } from 'lucide-react';

export default function TimeTab() {
  const { getCircularBufferSlice, getSampleRate, playReferenceSignal, isRunning, start, stop, selectedDevice, peakHoldAutoGain } = useAudioEngine();
  const [threshold, setThreshold] = useState(0.2);
  const [timeWindow, setTimeWindow] = useState(4);
  const [isPulseRunning, setIsPulseRunning] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenData, setFrozenData] = useState(null);
  const [markers, setMarkers] = useState([]); 
  const [delayInfo, setDelayInfo] = useState({ ms: 0, m: 0 });
  const [isCalibrating, setIsCalibrating] = useState(false);

  const togglePulse = async () => {
    if (isPulseRunning) { setIsPulseRunning(false); }
    else { await playReferenceSignal('pulse'); setIsPulseRunning(true); }
  };

  const handleAutoGain = async () => {
    setIsCalibrating(true);
    await peakHoldAutoGain(5000);
    setIsCalibrating(false);
  };

  useEffect(() => {
    if (!isRunning || isFrozen) return;
    const interval = setInterval(() => {
      const sr = getSampleRate();
      const raw = getCircularBufferSlice(sr * timeWindow);
      let found = [];
      for (let i = raw.length - 1; i > sr * 0.1; i--) {
        if (Math.abs(raw[i]) > threshold && Math.abs(raw[i-1]) < threshold) {
          if (found.length === 0 || (found[0] - i) > sr * 0.05) found.push(i);
        }
        if (found.length >= 2) break;
      }
      if (found.length === 2) {
        setMarkers([found[1], found[0]]);
        const ms = ((found[0] - found[1]) / sr) * 1000;
        setDelayInfo({ ms, m: ms * 0.343 });
      }
    }, 50);
    return () => clearInterval(interval);
  }, [isRunning, isFrozen, threshold, timeWindow]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden tabular-nums">
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center gap-1 shrink-0 shadow-lg">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`w-16 h-10 rounded-md font-black text-[9px] border ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}>
          {isRunning ? 'STOP' : 'INICIAR ANÁLISE'}
        </button>
        
        <div className="flex flex-1 justify-around bg-black/60 py-1 rounded border border-zinc-800 mx-1">
          <div className="text-center"><span className="text-[6px] text-zinc-500 block uppercase">Delta</span><span className="text-neon-yellow text-[11px] font-black">{delayInfo.ms.toFixed(2)}ms</span></div>
          <div className="text-center border-l border-zinc-800 pl-1"><span className="text-[6px] text-zinc-500 block uppercase">Dist</span><span className="text-neon-blue text-[11px] font-black">{delayInfo.m.toFixed(2)}m</span></div>
        </div>

        <div className="flex gap-1 shrink-0">
          <button onClick={handleAutoGain} className={`p-2 rounded border border-zinc-800 ${isCalibrating ? 'text-neon-green animate-spin' : 'text-zinc-400'}`}><Crosshair size={14}/></button>
          <select value={timeWindow} onChange={(e)=>setTimeWindow(parseInt(e.target.value))} className="bg-zinc-900 text-[10px] text-white p-1 rounded border border-zinc-700 outline-none">
            {[2, 4, 6, 8].map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
          <button onClick={() => { if(!isFrozen) setFrozenData(getCircularBufferSlice(getSampleRate() * timeWindow)); setIsFrozen(!isFrozen); }} className={`p-2 rounded border ${isFrozen ? 'bg-cyan-500 text-black' : 'border-zinc-800 text-zinc-400'}`}><Snowflake size={14}/></button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-7 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>
        <div className="flex-1 relative bg-black"><RollingGraph data={isFrozen ? frozenData : getCircularBufferSlice(getSampleRate() * timeWindow)} threshold={threshold} markers={markers} isFrozen={isFrozen}/></div>
      </div>
    </div>
  );
}
