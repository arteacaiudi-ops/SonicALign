import React from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Save, Upload, Thermometer, Zap, Mic, Battery } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, 
    invertPolarity, setInvertPolarity,
    inputDevices, selectedDevice, setSelectedDevice,
    batterySave, setBatterySave
  } = useAudioEngine();

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono text-xs overflow-y-auto">
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase"><Mic size={14}/> Entrada de Áudio</h3>
        <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded-md mb-2 outline-none">
          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
        </select>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-yellow mb-4 flex items-center gap-2 font-bold uppercase"><Battery size={14}/> Sistema</h3>
        <button 
          onClick={() => setBatterySave(!batterySave)} 
          className={`w-full p-4 rounded-lg border-2 flex items-center justify-between transition-all ${batterySave ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/5' : 'border-zinc-800 text-zinc-600'}`}
        >
          <span className="font-bold uppercase">Economia de Bateria (2 min)</span>
          <span className="font-black">{batterySave ? 'ON' : 'OFF'}</span>
        </button>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-red-500 mb-4 flex items-center gap-2 font-bold uppercase"><Zap size={14}/> Fase</h3>
        <button onClick={() => setInvertPolarity(!invertPolarity)} className={`w-full p-4 rounded-lg border-2 flex items-center justify-between transition-all ${invertPolarity ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-zinc-800 text-zinc-600'}`}>
          <span className="font-bold uppercase">Inverter Polaridade</span>
          <Zap size={20} fill={invertPolarity ? "currentColor" : "none"}/>
        </button>
      </section>
    </div>
  );
}
