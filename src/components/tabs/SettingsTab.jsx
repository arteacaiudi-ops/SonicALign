import React, { useState } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Save, Upload, Thermometer, Zap, Mic, Activity, Check } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, 
    invertPolarity, setInvertPolarity,
    inputDevices, selectedDevice, setSelectedDevice,
    playReferenceSignal, getFrequencyData, isRunning
  } = useAudioEngine();

  const [calibrating, setCalibrating] = useState(false);
  const [extValue, setExtValue] = useState(85);
  const [currentLvl, setCurrentLvl] = useState(0);

  const startCal = () => {
    if (!isRunning) return alert("Ative 'ANALISAR' no topo primeiro!");
    setCalibrating(true);
    const pink = playReferenceSignal('pink');
    
    const interval = setInterval(() => {
      const data = getFrequencyData();
      if (data) {
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setCurrentLvl(avg + 100); // dBFS -> SPL Relativo
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      pink.stop();
    }, 10000);
  };

  const finishCal = () => {
    const offset = extValue - currentLvl;
    setSplOffset(offset);
    setCalibrating(false);
    alert(`Offset calculado: ${offset.toFixed(1)} dB`);
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono text-xs overflow-y-auto pb-20">
      {/* Entrada de Áudio */}
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase"><Mic size={14}/> Entrada de Áudio</h3>
        <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded-md mb-2 outline-none">
          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
        </select>
      </section>

      {/* NOVO FLOW DE CALIBRAÇÃO SPL */}
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-bold uppercase"><Thermometer size={14}/> Assistente de SPL</h3>
        
        {!calibrating ? (
          <button onClick={startCal} className="w-full p-4 border border-neon-blue text-neon-blue bg-blue-900/10 rounded-lg font-black flex items-center justify-center gap-2">
            <Activity size={16}/> INICIAR CALIBRAÇÃO
          </button>
        ) : (
          <div className="flex flex-col gap-4 animate-in fade-in">
            <div className="bg-black p-4 rounded border border-zinc-800 text-center">
              <span className="text-[10px] text-zinc-500 block mb-1 uppercase tracking-widest">Leitura Atual App</span>
              <span className="text-3xl font-black text-white">{currentLvl.toFixed(1)} dB</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] text-zinc-500 uppercase font-bold">Valor no seu Decibelímetro:</span>
              <input type="number" value={extValue} onChange={(e)=>setExtValue(parseFloat(e.target.value))} className="bg-zinc-900 border-2 border-neon-blue p-3 text-white text-center text-xl rounded-md" />
            </div>
            <button onClick={finishCal} className="w-full p-4 bg-neon-blue text-black rounded-lg font-black flex items-center justify-center gap-2">
              <Check size={18}/> APLICAR OFFSET
            </button>
          </div>
        )}
        <div className="mt-4 text-[9px] text-zinc-600 italic">Offset Atual: {splOffset.toFixed(1)} dB</div>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-red-500 mb-4 flex items-center gap-2 font-bold uppercase"><Zap size={14}/> Fase</h3>
        <button onClick={() => setInvertPolarity(!invertPolarity)} className={`w-full p-4 rounded-lg border-2 flex items-center justify-between transition-all ${invertPolarity ? 'border-red-500 text-red-500 bg-red-900/10' : 'border-zinc-800 text-zinc-600'}`}>
          <span className="font-bold uppercase">{invertPolarity ? 'Invertida (-)' : 'Normal (+)'}</span>
          <Zap size={20} fill={invertPolarity ? "currentColor" : "none"}/>
        </button>
      </section>
    </div>
  );
}
