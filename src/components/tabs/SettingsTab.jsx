import React, { useState } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Save, Upload, Thermometer, Zap, Mic, Battery, Activity, Check } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, 
    invertPolarity, setInvertPolarity,
    inputDevices, selectedDevice, setSelectedDevice,
    batterySave, setBatterySave,
    playReferenceSignal, getFrequencyData, isRunning
  } = useAudioEngine();

  const [calibrating, setCalibrating] = useState(false);
  const [extValue, setExtValue] = useState(85);
  const [currentLvl, setCurrentLvl] = useState(0);

  const startCal = async () => {
    if (!isRunning) return alert("Ative o microfone em qualquer guia primeiro!");
    setCalibrating(true);
    const pink = await playReferenceSignal('pink');
    
    const interval = setInterval(() => {
      const data = getFrequencyData();
      if (data) {
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setCurrentLvl(avg + 100); 
      }
    }, 500);

    setTimeout(() => {
      clearInterval(interval);
      pink.stop();
    }, 10000);
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono text-xs overflow-y-auto">
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase"><Mic size={14}/> Entrada de Áudio</h3>
        <select 
          value={selectedDevice} 
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded-md mb-2 outline-none"
        >
          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
        </select>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-bold uppercase"><Thermometer size={14}/> Calibração SPL</h3>
        {!calibrating ? (
          <button onClick={startCal} className="w-full p-4 border border-neon-blue text-neon-blue bg-blue-900/10 rounded-lg font-black flex items-center justify-center gap-2">
            <Activity size={16}/> INICIAR CALIBRAÇÃO
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-black p-4 rounded border border-zinc-800 text-center">
              <span className="text-[10px] text-zinc-500 block mb-1">Leitura do App</span>
              <span className="text-3xl font-black text-white">{currentLvl.toFixed(1)} dB</span>
            </div>
            <input type="number" value={extValue} onChange={(e)=>setExtValue(parseFloat(e.target.value))} className="bg-zinc-900 border-2 border-neon-blue p-3 text-white text-center text-xl rounded-md" />
            <button onClick={() => { setSplOffset(extValue - currentLvl); setCalibrating(false); }} className="w-full p-4 bg-neon-blue text-black rounded-lg font-black flex items-center justify-center gap-2">
              <Check size={18}/> APLICAR OFFSET
            </button>
          </div>
        )}
        <div className="mt-4 text-[9px] text-zinc-600 italic text-center">Offset Atual: {splOffset.toFixed(1)} dB</div>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-yellow mb-4 flex items-center gap-2 font-bold uppercase"><Battery size={14}/> Economia de Energia</h3>
        <button 
          onClick={() => setBatterySave(!batterySave)} 
          className={`w-full p-4 rounded-lg border-2 flex items-center justify-between transition-all ${batterySave ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/5' : 'border-zinc-800 text-zinc-600'}`}
        >
          <span className="font-bold uppercase">Auto-Stop (2 min)</span>
          <span className="font-black">{batterySave ? 'ON' : 'OFF'}</span>
        </button>
      </section>
    </div>
  );
}
