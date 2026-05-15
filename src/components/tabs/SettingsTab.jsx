import React, { useState } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { ISO_31_BANDS } from '@/lib/app-params';
import { Settings2, Mic, Activity, CheckCircle, Download, Sliders } from 'lucide-react';

export default function SettingsTab() {
  const { rtaComp, setRtaComp, isRunning, get31BandData, playReferenceSignal, selectedDevice, start, stop } = useAudioEngine();
  const [showManual, setShowManual] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  const autoCalibrate = async () => {
    setCalibrating(true);
    const pink = await playReferenceSignal('pink');
    setTimeout(() => {
        const data = get31BandData(); // Pega leitura crua
        const newComp = data.map(v => -30 - v); // Tenta alinhar tudo em -30dB
        setRtaComp(newComp);
        pink.stop();
        setCalibrating(false);
        alert("Calibração finalizada!");
    }, 5000);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ rtaComp })], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'calib_rta.json'; a.click();
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono text-xs overflow-y-auto pb-20">
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-black uppercase"><Activity size={14}/> Calibrar RTA (KRK)</h3>
        <button onClick={autoCalibrate} className={`w-full p-4 rounded-lg font-black border-2 transition-all ${calibrating ? 'border-neon-green animate-pulse' : 'border-neon-blue text-neon-blue'}`}>
            {calibrating ? 'ANALISANDO RUÍDO ROSA...' : 'INICIAR ALINHAMENTO AUTO'}
        </button>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-white mb-4 flex items-center gap-2 font-black uppercase"><Sliders size={14}/> Calibrar Manualmente</h3>
        <button onClick={() => setShowManual(true)} className="w-full p-4 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-400 font-bold">ABRIR RACK DE EQ (31 BANDS)</button>
      </section>

      <button onClick={exportJSON} className="p-4 bg-neon-blue text-black font-black rounded-lg flex items-center justify-center gap-2">
        <Download size={16}/> EXPORTAR BACKUP JSON
      </button>

      {/* Modal do EQ de 31 Bandas */}
      {showManual && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-2 animate-in slide-in-from-bottom">
           <div className="flex justify-between items-center p-2 border-b border-zinc-800">
              <span className="font-black text-neon-green">MANUAL RTA COMPENSATOR</span>
              <button onClick={() => setShowManual(false)} className="text-red-500 font-black px-4">FECHAR</button>
           </div>
           
           <div className="flex-1 flex overflow-x-auto gap-[2px] py-10 px-4 bg-zinc-950">
              {ISO_31_BANDS.map((freq, i) => (
                <div key={i} className="flex flex-col items-center min-w-[30px] h-full relative">
                    <div className="absolute top-[-25px] text-[7px] text-zinc-500 font-bold">{rtaComp[i] > 0 ? '+'+rtaComp[i].toFixed(1) : rtaComp[i].toFixed(1)}</div>
                    <input 
                        type="range" min="-15" max="15" step="0.1" orientation="vertical"
                        value={rtaComp[i]} 
                        onChange={(e) => {
                            const newComp = [...rtaComp];
                            newComp[i] = parseFloat(e.target.value);
                            setRtaComp(newComp);
                        }}
                        className="h-full accent-neon-green" style={{ appearance: 'slider-vertical' }}
                    />
                    <span className="mt-4 text-[6px] text-zinc-600 rotate-90">{freq}</span>
                </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
