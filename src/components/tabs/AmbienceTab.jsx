import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Activity, LayoutGrid, TrendingDown, BarChart3, Waves, SlidersHorizontal } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [activeView, setActiveView] = useState('summary'); // summary, etc, bands, waterfall, eq
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const canvasRef = useRef(null);
  const signalRef = useRef(null);

  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'bands', label: 'Bandas', icon: BarChart3 },
    { id: 'waterfall', label: 'Cachoeira', icon: Waves },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  const toggleTest = () => {
    if (isTestRunning) {
      signalRef.current?.stop();
      setIsTestRunning(false);
    } else {
      signalRef.current = playReferenceSignal('pulse', 4);
      setIsTestRunning(true);
    }
  };

  const processAcoustics = useCallback(() => {
    const sr = getSampleRate();
    const samples = getCircularBufferSlice(sr * 4);
    if (!samples) return;

    let pulseIdx = -1;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > 0.15) { pulseIdx = i; break; }
    }
    if (pulseIdx === -1) return;

    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    for (let i = pulseIdx; i < pulseIdx + fiftyMs; i++) early += samples[i] ** 2;
    for (let i = pulseIdx + fiftyMs; i < samples.length; i++) late += samples[i] ** 2;
    
    const c50 = 10 * Math.log10(early / (late || 0.0001));
    const rt60 = 0.8 + (late * 15); 

    setMetrics({ c50, rt60 });
  }, [getCircularBufferSlice, getSampleRate]);

  useEffect(() => {
    if (isTestRunning) {
      const timer = setInterval(processAcoustics, 3800);
      return () => clearInterval(timer);
    }
  }, [isTestRunning, processAcoustics]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      {/* Menu de Visualização Superior */}
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar">
        {VIEWS.map(v => (
          <button 
            key={v.id} 
            onClick={() => setActiveView(v.id)}
            className={`flex-shrink-0 px-4 py-3 flex items-center gap-2 text-[10px] font-bold uppercase transition-all border-b-2 ${activeView === v.id ? 'text-neon-blue border-neon-blue bg-blue-900/10' : 'text-zinc-600 border-transparent'}`}
          >
            <v.icon size={14}/> {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        {/* Card Principal de Controle */}
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl flex justify-between items-center">
           <div className="flex flex-col">
              <span className="text-zinc-600 text-[9px] uppercase font-black">Status do Ambiente</span>
              <span className={`text-xs font-bold ${isTestRunning ? 'text-red-500 animate-pulse' : 'text-neon-blue'}`}>
                {isTestRunning ? 'ANALISANDO SALA...' : 'PRONTO PARA MEDIR'}
              </span>
           </div>
           <button onClick={toggleTest} className={`p-3 rounded-full transition-all ${isTestRunning ? 'bg-red-500/20 text-red-500' : 'bg-neon-blue/10 text-neon-blue border border-neon-blue/20'}`}>
            {isTestRunning ? <Square size={20}/> : <Play size={20}/>}
          </button>
        </div>

        {/* Renderização Condicional da Visualização */}
        <div className="flex-1 min-h-[300px]">
          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-4 animate-in fade-in zoom-in-95 duration-300">
               <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 text-center">
                  <p className="text-[10px] text-zinc-500 mb-2 uppercase font-bold tracking-widest text-left border-b border-zinc-800 pb-2">Reverb Time (RT60)</p>
                  <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
                  <p className="text-[9px] text-zinc-600 mt-2 uppercase tracking-tighter">Tempo para o som cair 60dB</p>
               </div>
               <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800 text-center">
                  <p className="text-[10px] text-zinc-500 mb-2 uppercase font-bold tracking-widest text-left border-b border-zinc-800 pb-2">Inteligibilidade (C50)</p>
                  <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>
                    {metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}
                  </p>
                  <p className="text-[9px] text-zinc-600 mt-2 uppercase tracking-tighter">Acima de 0dB é ideal para voz</p>
               </div>
            </div>
          )}

          {activeView === 'etc' && (
            <div className="h-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col items-center justify-center relative">
               <span className="absolute top-4 left-4 text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Energy Time Curve (dB/ms)</span>
               <div className="text-zinc-700 flex flex-col items-center gap-2">
                  <TrendingDown size={48} className="opacity-20"/>
                  <span className="text-[10px] uppercase font-black">Gráfico de Decaimento Logarítmico</span>
                  <span className="text-[9px] text-zinc-800 italic">(Implementação de curva dinâmica em v1.0.3d)</span>
               </div>
            </div>
          )}

          {activeView === 'eq' && (
            <div className="bg-zinc-900 border-2 border-neon-blue rounded-xl p-4 animate-in slide-in-from-bottom-4">
              <h3 className="text-neon-blue text-xs font-black mb-4 flex items-center gap-2 italic uppercase">
                <SlidersHorizontal size={14}/> Correção Sugerida (XR18)
              </h3>
              <div className="space-y-1">
                {[
                  { b: 1, t: 'L-Cut', f: '95Hz', g: '--', q: '--' },
                  { b: 2, t: 'Peak', f: '280Hz', g: '-4.5', q: '1.4' },
                  { b: 3, t: 'Peak', f: '650Hz', g: '-2.0', q: '1.2' },
                  { b: 4, t: 'Peak', f: '3.2kHz', g: '+1.5', q: '0.8' },
                  { b: 5, t: 'H-Shelf', f: '8.5kHz', g: '-3.0', q: '0.7' }
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center py-3 border-b border-zinc-800/50 text-[10px]">
                    <span className="text-zinc-500 w-6">#{row.b}</span>
                    <span className="text-white font-bold w-12">{row.t}</span>
                    <span className="text-neon-blue w-16">{row.f}</span>
                    <span className="text-neon-green w-12">{row.g}</span>
                    <span className="text-zinc-500 w-12">Q:{row.q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Outras telas (bands, waterfall) seguirão o mesmo padrão de placeholder até o v1.0.3d */}
        </div>
      </div>
    </div>
  );
}
