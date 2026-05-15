import React from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Save, Upload, Thermometer, Zap, FileJson, Mic } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, 
    invertPolarity, setInvertPolarity,
    inputDevices, selectedDevice, setSelectedDevice
  } = useAudioEngine();

  const exportConfig = () => {
    const config = { version: "1.0.3", splOffset, invertPolarity, selectedDevice };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sonicalign-config.json`;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-6 font-mono text-xs overflow-y-auto">
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950/50">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase"><Mic size={14}/> Entrada de Áudio</h3>
        <select 
          value={selectedDevice} 
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded mb-2"
        >
          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
        </select>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950/50">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-bold uppercase"><Thermometer size={14}/> Calibração</h3>
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Referência SPL (dB)</span>
            <input type="number" value={splOffset} onChange={(e) => setSplOffset(parseFloat(e.target.value))} className="bg-zinc-900 border border-zinc-700 w-24 p-2 text-right text-neon-green rounded" />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Inverter Polaridade</span>
            <button onClick={() => setInvertPolarity(!invertPolarity)} className={`p-2 rounded border ${invertPolarity ? 'border-red-500 text-red-500' : 'border-zinc-700 text-zinc-500'}`}><Zap size={16}/></button>
          </div>
        </div>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950/50">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase"><FileJson size={14}/> Arquivos</h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={exportConfig} className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg flex items-center justify-center gap-2"><Save size={16}/> EXPORTAR</button>
          <label className="p-4 bg-zinc-900 border border-zinc-700 rounded-lg flex items-center justify-center gap-2 cursor-pointer"><Upload size={16}/> IMPORTAR<input type="file" className="hidden" /></label>
        </div>
      </section>
    </div>
  );
}
