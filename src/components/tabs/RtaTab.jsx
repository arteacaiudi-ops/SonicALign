import React, { useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { ISO_31_BANDS, TARGET_CURVES } from '@/lib/app-params';
import { Crosshair, Activity } from 'lucide-react';

export default function RtaTab() {
  const { isRunning, get31BandData, start, stop, selectedDevice, peakHoldAutoGain, playReferenceSignal } = useAudioEngine();
  const [bands, setBands] = useState(new Array(31).fill(-100));
  const [selectedCurve, setSelectedCurve] = useState('FLAT');
  const [isPinkRunning, setIsPinkRunning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  const togglePink = async () => {
    if (isPinkRunning) { setIsPinkRunning(false); }
    else { await playReferenceSignal('pink'); setIsPinkRunning(true); }
  };

  const handleAutoGain = async () => {
    setIsCalibrating(true);
    await peakHoldAutoGain(3000);
    setIsCalibrating(false);
  };

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const data = get31BandData(false); // Obtém os dados COMPENSADOS do microfone
      if (data) setBands(data);
    }, 40);
    return () => clearInterval(interval);
  }, [isRunning, get31BandData]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden p-2">
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center mb-2 shrink-0 gap-2">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`w-24 py-2 rounded font-black text-[9px] border ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}>
          {isRunning ? 'STOP' : 'INICIAR ANÁLISE'}
        </button>
        
        <select value={selectedCurve} onChange={(e) => setSelectedCurve(e.target.value)} className="bg-black text-neon-green text-[9px] font-bold p-2 border border-zinc-800 rounded uppercase flex-1 outline-none">
          {Object.keys(TARGET_CURVES).map(k => <option key={k} value={k}>{TARGET_CURVES[k].label}</option>)}
        </select>

        <div className="flex gap-1">
          <button onClick={handleAutoGain} className={`p-2 border border-neon-blue rounded-md ${isCalibrating ? 'animate-spin text-neon-blue' : 'text-zinc-400'}`}><Crosshair size={14}/></button>
          <button onClick={togglePink} className={`p-2 border rounded-md ${isPinkRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}><Activity size={14}/></button>
        </div>
      </div>

      <div className="flex-1 flex items-end gap-[1px] bg-zinc-950/50 p-2 rounded-lg border border-zinc-900 relative overflow-hidden">
        {/* Linhas de Grade dB */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10">
            {[0, -10, -20, -30, -40, -50, -60].map(v => <div key={v} className="border-t border-white w-full h-[1px]"></div>)}
        </div>

        {bands.map((val, i) => {
          const target = TARGET_CURVES[selectedCurve].values[i] || 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
              {/* Target Indicator (Linha amarela pequena indicando a curva alvo) */}
              <div 
                className="absolute w-full h-[2px] bg-yellow-500/40 z-10" 
                style={{ bottom: `${target + 45}%` }}
              />
              
              <div 
                className="w-full bg-neon-green transition-all duration-75 rounded-t-[1px] shadow-[0_0_5px_rgba(0,255,0,0.2)]" 
                style={{ height: `${Math.max(2, val + 100)}%`, opacity: val > -70 ? 1 : 0.2 }}
              />
              <span className="text-[5px] text-zinc-600 mt-1 rotate-90 h-6 shrink-0">{ISO_31_BANDS[i] < 1000 ? ISO_31_BANDS[i] : (ISO_31_BANDS[i]/1000)+'k'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
