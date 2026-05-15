import React from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Save, Upload, Thermometer } from 'lucide-react';

export default function SettingsTab() {
  const { splOffset, setSplOffset, inputGain, setInputGain, invertPolarity, setInvertPolarity } = useAudioEngine();

  const exportConfig = () => {
    const config = { splOffset, inputGain, invertPolarity, date: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sonicalign-config.json`;
    link.click();
  };

  const importConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const json = JSON.parse(ev.target.result);
      if (json.splOffset !== undefined) setSplOffset(json.splOffset);
      if (json.inputGain !== undefined) setInputGain(json.inputGain);
      if (json.invertPolarity !== undefined) setInvertPolarity(json.invertPolarity);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-6 font-mono text-xs">
      <section className="panel p-4 border border-zinc-800 rounded">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2"><Thermometer size={14}/> CALIBRATION</h3>
        <div className="flex flex-col gap-4">
          <label className="flex justify-between items-center text-gray-500">
            SPL OFFSET (dB)
            <input type="number" value={splOffset} onChange={(e)=>setSplOffset(parseFloat(e.target.value))} className="bg-zinc-900 border border-zinc-700 w-20 p-1 text-right text-neon-green" />
          </label>
          <label className="flex justify-between items-center text-gray-500">
            INVERT PULSE PHASE
            <input type="checkbox" checked={invertPolarity} onChange={(e)=>setInvertPolarity(e.target.checked)} className="w-4 h-4 accent-neon-blue" />
          </label>
        </div>
      </section>

      <section className="panel p-4 border border-zinc-800 rounded">
        <h3 className="text-neon-green mb-4 flex items-center gap-2"><Save size={14}/> DATA MANAGEMENT</h3>
        <div className="grid grid-cols-2 gap-4">
          <button onClick={exportConfig} className="flex items-center justify-center gap-2 p-3 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded">
            <Save size={16}/> EXPORT JSON
          </button>
          <label className="flex items-center justify-center gap-2 p-3 bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 rounded cursor-pointer">
            <Upload size={16}/> IMPORT JSON
            <input type="file" accept=".json" onChange={importConfig} className="hidden" />
          </label>
        </div>
      </section>
    </div>
  );
}
