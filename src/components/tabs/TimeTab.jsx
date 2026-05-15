import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, Square, Snowflake, RotateCcw } from 'lucide-react';

export default function TimeTab() {
  const { getCircularBufferSlice, getSampleRate, playReferenceSignal, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [threshold, setThreshold] = useState(0.2);
  const [timeWindow, setTimeWindow] = useState(4);
  const [isPulseRunning, setIsPulseRunning] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenData, setFrozenData] = useState(null);
  const [markers, setMarkers] = useState([]); 
  const [delayInfo, setDelayInfo] = useState({ ms: 0, m: 0 });
  const pulseRef = useRef(null);

  const togglePulse = async () => {
    if (isPulseRunning) { pulseRef.current?.stop(); setIsPulseRunning(false); }
    else { pulseRef.current = await playReferenceSignal('pulse', 1); setIsPulseRunning(true); }
  };

  const handleFreeze = () => {
    if (!isFrozen) {
      setFrozenData(getCircularBufferSlice(getSampleRate() * timeWindow));
    }
    setIsFrozen(!isFrozen);
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
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, isFrozen, threshold, timeWindow]);

  return (
    <div className="flex flex-col h-full bg-black font-mono">
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center gap-1 shadow-lg overflow-x-hidden">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className="w-20 px-1 py-2 rounded-md font-black text-[9px] border border-neon-green text-neon-green shrink-0">
          {isRunning ? 'STOP' : 'ANALISAR'}
        </button>
        
        <div className="flex gap-1 bg-black/60 p-1 rounded border border-zinc-800 shrink-0 tabular-nums">
          <div className="min-w-[65px] text-center">
            <span className="text-[6px] text-zinc-500 block">DELTA</span>
            <span className="text-neon-yellow text-[10px] font-black">{delayInfo.ms.toFixed(2)}ms</span>
          </div>
          <div className="min-w-[65px] border-l border-zinc-800 pl-1 text-center">
            <span className="text-[6px] text-zinc-500 block">DIST</span>
            <span className="text-neon-blue text-[10px] font-black">{delayInfo.m.toFixed(2)}m</span>
          </div>
        </div>

        <div className="flex gap-1 ml-auto">
          <button onClick={handleFreeze} className={`p-2 rounded border ${isFrozen ? 'bg-cyan-500 text-black' : 'border-zinc-800 text-zinc-400'}`}><Snowflake size={14}/></button>
          <button onClick={()=>setMarkers([])} className="p-2 rounded border border-zinc-800 text-zinc-400"><RotateCcw size={14}/></button>
          <button onClick={togglePulse} className={`px-2 py-1 rounded border text-[9px] font-black ${isPulseRunning ? 'bg-red-500 text-white' : 'text-neon-blue border-neon-blue'}`}>PULSE</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-8 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>
        <div className="flex-1 relative">
          <RollingGraph 
            data={isFrozen ? frozenData : getCircularBufferSlice(getSampleRate() * timeWindow)}
            threshold={threshold}
            timeWindow={timeWindow}
            sr={getSampleRate()}
            markers={markers}
            isFrozen={isFrozen}
          />
        </div>
      </div>
    </div>
  );
}
