import React from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Save, Upload, Thermometer, Zap, FileJson } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, 
    inputGain, setInputGain, 
    invertPolarity, setInvertPolarity 
  } = useAudioEngine();

  const exportConfig = () => {
    const config = {
      version: "1.0.3",
      splOffset,
      inputGain,
      invertPolarity,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sonicalign-v103-config.json`;
    link.click();
  };

  const importConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (json.splOffset !== undefined) setSplOffset(json.splOffset);
        if (json.inputGain !== undefined) setInputGain(json.inputGain);
        if (json.invertPolarity !== undefined) setInvertPolarity(json.invertPolarity);
        alert("Configurações carregadas com sucesso!");
      } catch (err) {
        alert("Erro ao ler o arquivo JSON.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-6 font-mono text-xs overflow-y-auto">
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950/50">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-bold uppercase tracking-tighter">
          <Thermometer size={14}/> Calibração de Sistema
        </h3>
        <div className="flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Referência Externa (SPL dB)</span>
            <input 
              type="number" 
              value={splOffset} 
              onChange={(e) => setSplOffset(parseFloat(e.target.value))}
              className="bg-zinc-900 border border-zinc-700 w-24 p-2 text-right text-neon-green rounded"
            />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Inverter Polaridade do Pulso</span>
            <button 
              onClick={() => setInvertPolarity(!invertPolarity)}
              className={`p-2 rounded border transition-all ${invertPolarity ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-zinc-700 text-zinc-500'}`}
            >
              <Zap size={16} fill={invertPolarity ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950/50">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase tracking-tighter">
          <FileJson size={14}/> Gerenciamento de Dados
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={exportConfig}
            className="flex items-center justify-center gap-2 p-4 bg-zinc-900 border border-zinc-700 hover:border-neon-green rounded-lg transition-colors"
          >
            <Save size={16}/> EXPORTAR
          </button>
          <label className="flex items-center justify-center gap-2 p-4 bg-zinc-900 border border-zinc-700 hover:border-neon-blue rounded-lg cursor-pointer transition-colors">
            <Upload size={16}/> IMPORTAR
            <input type="file" accept=".json" onChange={importConfig} className="hidden" />
          </label>
        </div>
      </section>

      <div className="mt-auto p-4 text-center text-zinc-700 text-[10px]">
        SonicAlign Pro Engine v1.0.3 | Ready for Field Use
      </div>
    </div>
  );
}
