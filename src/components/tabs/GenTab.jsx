import React, { useState } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Activity, Music, Waves } from 'lucide-react';

export default function GenTab() {
  const { playReferenceSignal } = useAudioEngine();
  const [activeSignal, setActiveSignal] = useState(null);
  const [mode, setMode] = useState('pink'); // pink, pulse, sweep

  const toggleSignal = async (type) => {
    if (activeSignal) { activeSignal.stop?.(); setActiveSignal(null); }
    else { 
      const sig = await playReferenceSignal(type, 1);
      setActiveSignal(sig);
      setMode(type);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono overflow-y-auto">
      <div className="panel p-6 bg-zinc-950 border border-zinc-900 rounded-2xl">
        <h3 className="text-zinc-600 text-[10px] mb-6 font-black tracking-widest uppercase flex items-center gap-2"><Music size={12}/> Gerador de Referência</h3>
        <div className="flex flex-col gap-4">
          <button onClick={() => toggleSignal('pink')} className={`p-8 border-2 rounded-2xl flex flex-col items-center gap-3 transition-all ${activeSignal && mode==='pink' ? 'border-neon-green bg-neon-green/10 shadow-[0_0_20px_#aaff0033]' : 'border-zinc-800 text-zinc-500'}`}>
            <Activity size={32}/><span className="font-black text-xs">PINK NOISE (FLAT)</span>
          </button>
          
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => toggleSignal('pulse')} className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all ${activeSignal && mode==='pulse' ? 'border-neon-yellow bg-neon-yellow/10' : 'border-zinc-800 text-zinc-500'}`}>
              <Play size={24}/><span className="font-black text-[8px] uppercase">1s - TIME / DELAY</span>
            </button>
            <button onClick={() => toggleSignal('sweep')} className={`p-6 border-2 rounded-2xl flex flex-col items-center gap-2 transition-all ${activeSignal && mode==='sweep' ? 'border-neon-blue bg-neon-blue/10 shadow-[0_0_20px_#00c8ff33]' : 'border-zinc-800 text-zinc-500'}`}>
              <Waves size={24}/><span className="font-black text-[8px] uppercase">5s - SINE SWEEP PRO</span>
            </button>
          </div>
        </div>
      </div>
      <p className="text-[9px] text-zinc-700 text-center px-8 italic leading-relaxed">"Modo Remoto: Dispare o Sine Sweep e o outro dispositivo detectará o tom de sincronia para iniciar a leitura."</p>
    </div>
  );
}
