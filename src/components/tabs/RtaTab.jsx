import React, { useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { ISO_31_BANDS, TARGET_CURVES } from '@/lib/app-params';
import { Play, Square, Crosshair, Activity } from 'lucide-react';

export default function RtaTab() {
  const { 
    isRunning, get31BandData, start, stop, selectedDevice, 
    inputGain, setInputGain, playReferenceSignal 
  } = useAudioEngine();

  const [bands, setBands] = useState(new Array(31).fill(-100));
  const [selectedCurve, setSelectedCurve] = useState('FLAT');
  const [isPinkRunning, setIsPinkRunning] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Toggle para o Ruído Rosa local
  const togglePink = async () => {
    if (isPinkRunning) { setIsPinkRunning(false); }
    else { await playReferenceSignal('pink'); setIsPinkRunning(true); }
  };

  // Função de Autogain para o RTA
  const handleAutoGain = () => {
    setIsCalibrating(true);
    const data = get31BandData();
    if (data) {
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      const diff = -25 - avg; // Alvo de -25dB para o RTA
      const newGain = Math.max(0.1, Math.min(10, inputGain * Math.pow(10, diff / 20)));
      setInputGain(newGain);
    }
    setTimeout(() => setIsCalibrating(false), 500);
  };

  // Loop de atualização em tempo real
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const data = get31BandData();
      if (data) setBands(data);
    }, 40); // 20fps para suavidade
    return () => clearInterval(interval);
  }, [isRunning, get31BandData]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden p-2">
      {/* Header da Aba RTA */}
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center mb-2 shrink-0 gap-2">
        <button 
          onClick={() => isRunning ? stop() : start(selectedDevice)} 
          className={`px-3 py-2 rounded font-black text-[9px] border transition-all ${isRunning ? 'border-red-500 text-red-500 bg-red-500/5' : 'border-neon-green text-neon-green'}`}
        >
          {isRunning ? 'PARAR' : 'INICIAR ANÁLISE'}
        </button>

        <select 
          value={selectedCurve} 
          onChange={(e) => setSelectedCurve(e.target.value)}
          className="bg-black text-neon-green text-[9px] font-black p-2 border border-zinc-800 rounded uppercase flex-1 outline-none"
        >
          {Object.keys(TARGET_CURVES).map(k => (
            <option key={k} value={k}>{TARGET_CURVES[k].label}</option>
          ))}
        </select>

        <div className="flex gap-1">
          <button 
            onClick={handleAutoGain} 
            title="Auto Gain"
            className={`p-2 border border-zinc-800 rounded-md transition-colors ${isCalibrating ? 'text-neon-blue animate-pulse' : 'text-zinc-400 hover:text-white'}`}
          >
            <Crosshair size={16}/>
          </button>
          <button 
            onClick={togglePink} 
            title="Pink Noise"
            className={`p-2 border rounded-md transition-all ${isPinkRunning ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-zinc-800 text-zinc-400'}`}
          >
            <Activity size={16}/>
          </button>
        </div>
      </div>

      {/* Gráfico de 31 Bandas */}
      <div className="flex-1 flex items-end gap-[1px] bg-zinc-950/30 p-2 rounded-lg border border-zinc-900 relative overflow-hidden shadow-inner">
        {/* Grid de Escala em dB */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
            {[0, -10, -20, -30, -40, -50, -60, -70].map(v => (
              <div key={v} className="border-t border-zinc-800 w-full h-[1px] flex items-start">
                <span className="text-[5px] text-zinc-700 ml-1">{v}</span>
              </div>
            ))}
        </div>

        {bands.map((val, i) => {
          const target = TARGET_CURVES[selectedCurve].values[i] || 0;
          // Normaliza o valor para a altura da barra (0 a 100%)
          // Consideramos -80dB como silêncio e 0dB como topo
          const barHeight = Math.max(0, val + 80); 
          const targetPos = target + 40; // Ajuste visual da linha de referência

          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
              {/* Linha de Referência (Target) */}
              <div 
                className="absolute w-full h-[1px] bg-yellow-500/50 z-10 shadow-[0_0_2px_#eab308]" 
                style={{ bottom: `${targetPos}%` }}
              />
              
              {/* Barra de Áudio */}
              <div 
                className="w-full bg-neon-green transition-all duration-75 rounded-t-[1px] shadow-[0_-2px_10px_rgba(0,255,0,0.1)]" 
                style={{ 
                  height: `${(barHeight / 80) * 100}%`, 
                  opacity: val > -70 ? 1 : 0.3 
                }}
              />
              
              {/* Label de Frequência */}
              <span className="text-[5px] text-zinc-600 mt-1 rotate-90 h-6 shrink-0 font-bold">
                {ISO_31_BANDS[i] < 1000 ? ISO_31_BANDS[i] : (ISO_31_BANDS[i]/1000)+'k'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
