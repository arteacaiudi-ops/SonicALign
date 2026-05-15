import React from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Save, Upload, Thermometer, Zap, Mic } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, 
    invertPolarity, setInvertPolarity,
    inputDevices, selectedDevice, setSelectedDevice
  } = useAudioEngine();

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono text-xs overflow-y-auto">
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase"><Mic size={14}/> Entrada de Áudio</h3>
        <select 
          value={selectedDevice} 
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded-md mb-2 outline-none focus:border-neon-green"
        >
          {inputDevices.length > 0 ? (
            inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Entrada ${d.deviceId.slice(0,5)}`}</option>)
          ) : (
            <option value="default">Microfone Padrão</option>
          )}
        </select>
        <p className="text-[9px] text-zinc-500 italic">Dica: Para usar a XR18, conecte-a via USB antes de abrir o app.</p>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-bold uppercase"><Thermometer size={14}/> Calibração SPL</h3>
        <div className="flex justify-between items-center bg-black p-3 rounded border border-zinc-800">
          <span className="text-zinc-400 font-bold uppercase">Offset dB</span>
          <input 
            type="number" value={splOffset} 
            onChange={(e) => setSplOffset(parseFloat(e.target.value))} 
            className="bg-zinc-900 border border-zinc-700 w-24 p-2 text-right text-neon-green rounded font-mono" 
          />
        </div>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-red-500 mb-4 flex items-center gap-2 font-bold uppercase"><Zap size={14}/> Fase</h3>
        <button 
          onClick={() => setInvertPolarity(!invertPolarity)} 
          className={`w-full p-4 rounded-lg border-2 flex items-center justify-between transition-all ${invertPolarity ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-zinc-800 text-zinc-600'}`}
        >
          <span className="font-bold uppercase">{invertPolarity ? 'Polaridade Invertida (-)' : 'Polaridade Normal (+)'}</span>
          <Zap size={20} fill={invertPolarity ? 'currentColor' : 'none'}/>
        </button>
      </section>
    </div>
  );
}
