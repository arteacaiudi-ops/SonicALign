import React, { useState } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Download, Activity, Music } from 'lucide-react';

export default function GenTab() {
  const { playReferenceSignal, invertPolarity } = useAudioEngine();
  const [activeSignal, setActiveSignal] = useState(null);
  const [pulseInterval, setPulseInterval] = useState(1);

  const toggleSignal = async (type) => {
    if (activeSignal) {
      activeSignal.stop?.();
      setActiveSignal(null);
    } else {
      const sig = await playReferenceSignal(type, type === 'pulse' ? pulseInterval : 1);
      setActiveSignal(sig);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono overflow-y-auto">
      <div className="panel p-6 bg-zinc-950 border border-zinc-900 rounded-2xl shadow-2xl">
        <h3 className="text-zinc-600 text-[10px] mb-6 font-black tracking-[0.2em] uppercase flex items-center gap-2">
          <Music size={12}/> Gerador de Referência
        </h3>
        
        <div className="flex flex-col gap-6">
          {/* Pink Noise Card */}
          <button 
            onClick={() => toggleSignal('pink')} 
            className={`p-8 border-2 rounded-2xl flex flex-col items-center gap-3 transition-all ${activeSignal && !activeSignal.clearInterval ? 'border-red-500 text-red-500 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-neon-green text-neon-green bg-zinc-900/50'}`}
          >
            <Activity size={40} className={activeSignal && !activeSignal.clearInterval ? 'animate-pulse' : ''} />
            <span className="font-black text-sm tracking-widest uppercase">PINK NOISE</span>
          </button>
          
          {/* Pulse Control Card */}
          <div className="border-2 border-zinc-800 p-6 rounded-2xl bg-black/40 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <span className="text-white text-xs font-black uppercase tracking-tighter">Pulso Quadrado</span>
              <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                {[1, 4].map(s => (
                  <button 
                    key={s} 
                    onClick={() => setPulseInterval(s)} 
                    className={`px-4 py-1.5 rounded-md text-[10px] font-black transition-all ${pulseInterval === s ? 'bg-neon-blue text-black' : 'text-zinc-500'}`}
                  >
                    {s}s
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => toggleSignal('pulse')} 
              className={`w-full py-5 rounded-xl border-2 flex items-center justify-center gap-3 font-black text-xs transition-all ${activeSignal?.stop && activeSignal.clearInterval ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-neon-blue text-neon-blue bg-zinc-900/50'}`}
            >
              {activeSignal?.clearInterval ? <Square size={18} fill="currentColor"/> : <Play size={18} fill="currentColor"/>} 
              {activeSignal?.clearInterval ? 'PARAR PULSO' : `DISPARAR (${pulseInterval}s)`}
            </button>
          </div>
        </div>
      </div>
      
      <p className="text-[9px] text-zinc-700 text-center px-8 leading-relaxed italic">
        "Modo Gerador: Independente da análise. Conecte este dispositivo à mesa XR18 para injetar o sinal no sistema."
      </p>
    </div>
  );
}
