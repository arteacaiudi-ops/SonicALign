import React, { useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { ISO_31_BANDS } from '@/lib/app-params';

export default function RtaTab() {
  const { isRunning, get31BandData, start, stop, selectedDevice } = useAudioEngine();
  const [bands, setBands] = useState(new Array(31).fill(-100));

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const data = get31BandData();
      if (data) setBands(data);
    }, 50);
    return () => clearInterval(interval);
  }, [isRunning, get31BandData]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden p-2">
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center mb-2 shrink-0">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`px-4 py-2 rounded font-black text-[10px] border ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}>
          {isRunning ? 'PARAR' : 'INICIAR ANÁLISE'}
        </button>
        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">31-BAND GEQ ANALYSER</span>
      </div>

      <div className="flex-1 flex items-end gap-[1px] bg-zinc-950/50 p-2 rounded-lg border border-zinc-900 relative overflow-hidden">
        {/* Grid de dB */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
            {[0, -10, -20, -30, -40, -50, -60].map(v => <div key={v} className="border-t border-white w-full h-[1px]"></div>)}
        </div>

        {bands.map((val, i) => (
          <div key={i} className="flex-1 flex flex-col items-center group">
            <div 
              className="w-full bg-neon-green transition-all duration-75 rounded-t-[1px]" 
              style={{ height: `${Math.max(0, val + 100)}%`, opacity: val > -60 ? 1 : 0.3 }}
            />
            <span className="text-[5px] text-zinc-700 mt-1 rotate-90 h-6">{ISO_31_BANDS[i] < 1000 ? ISO_31_BANDS[i] : (ISO_31_BANDS[i]/1000)+'k'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
