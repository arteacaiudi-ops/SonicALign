import React, { useState } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Download, Activity } from 'lucide-react';

export default function GenTab() {
  const { playReferenceSignal, invertPolarity } = useAudioEngine();
  const [activeSignal, setActiveSignal] = useState(null);
  const [pulseInterval, setPulseInterval] = useState(1);

  const toggleSignal = (type) => {
    if (activeSignal) {
      activeSignal.stop?.();
      setActiveSignal(null);
    } else {
      const sig = playReferenceSignal(type, type === 'pulse' ? pulseInterval : 1);
      setActiveSignal(sig);
    }
  };

  const downloadWav = () => {
    // Lógica simplificada para gerar um WAV de pulso
    const sr = 48000;
    const length = sr * 0.1; 
    const buffer = new Float32Array(length);
    const amp = invertPolarity ? -0.8 : 0.8;
    for(let i=0; i<sr*0.01; i++) buffer[i] = amp; // 10ms pulse
    
    // Aqui geramos o blob WAV (resumo técnico)
    const blob = new Blob([buffer], {type: 'audio/wav'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pulse_${pulseInterval}s.wav`; a.click();
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono">
      <div className="panel p-6 bg-zinc-950 border border-zinc-900 rounded-xl">
        <h3 className="text-neon-green text-xs mb-4">REFERÊNCIA GLOBAL</h3>
        <div className="grid grid-cols-1 gap-4">
          <button onClick={() => toggleSignal('pink')} className={`p-6 border-2 rounded-xl flex flex-col items-center gap-2 ${activeSignal ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}>
            <Activity size={32} />
            <span className="font-bold">PINK NOISE</span>
          </button>
          
          <div className="border-2 border-zinc-800 p-4 rounded-xl flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-white text-sm font-bold">PULSO QUADRADO</span>
              <div className="flex gap-2">
                {[1, 4].map(s => (
                  <button key={s} onClick={() => setPulseInterval(s)} className={`px-3 py-1 rounded border ${pulseInterval === s ? 'bg-neon-blue text-black border-neon-blue' : 'text-zinc-500 border-zinc-700'}`}>{s}s</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => toggleSignal('pulse')} className="p-4 bg-zinc-900 text-neon-blue border border-neon-blue/20 rounded-lg flex items-center justify-center gap-2">
                {activeSignal ? <Square size={18}/> : <Play size={18}/>} {activeSignal ? 'PARAR' : 'TESTAR'}
              </button>
              <button onClick={downloadWav} className="p-4 bg-zinc-900 text-white border border-zinc-700 rounded-lg flex items-center justify-center gap-2">
                <Download size={18}/> EXPORTAR
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
