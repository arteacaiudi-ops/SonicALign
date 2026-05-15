import React, { useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, Square, LayoutGrid, TrendingDown, BarChart3, Waves, SlidersHorizontal, Activity, CheckCircle } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [activeView, setActiveView] = useState('summary');
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const [isCaptured, setIsCaptured] = useState(false);
  const [liveData, setLiveData] = useState(new Float32Array(0));
  
  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'bands', label: 'Bandas', icon: BarChart3 },
    { id: 'waterfall', label: 'Cachoeira', icon: Waves },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  const handleCapture = useCallback(() => {
    const sr = getSampleRate();
    const samples = getCircularBufferSlice(sr * 8);
    if (!samples) return;

    let pulseIdx = -1;
    for (let i = samples.length - 1; i > sr; i--) {
      if (Math.abs(samples[i]) > 0.25 && Math.abs(samples[i-100]) < 0.1) {
        pulseIdx = i; break;
      }
    }

    if (pulseIdx !== -1) {
      const fiftyMs = Math.floor(sr * 0.05);
      let early = 0, late = 0;
      for (let i = pulseIdx; i < pulseIdx + fiftyMs; i++) early += samples[i] ** 2;
      for (let i = pulseIdx + fiftyMs; i < pulseIdx + (sr * 2); i++) late += samples[i] ** 2;
      
      setMetrics({ c50: 10 * Math.log10(early / (late || 0.0001)), rt60: 0.3 + (late / early) * 15 });
      setIsCaptured(true);
      stop(); // Interrompe a análise após o sucesso
    }
  }, [getCircularBufferSlice, getSampleRate, stop]);

  useEffect(() => {
    if (!isRunning || isCaptured) return;
    const interval = setInterval(() => {
      setLiveData(getCircularBufferSlice(getSampleRate() * 8));
      handleCapture();
    }, 200);
    return () => clearInterval(interval);
  }, [isRunning, isCaptured, handleCapture, getCircularBufferSlice, getSampleRate]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-1 py-1 gap-1 shrink-0">
        <button 
          onClick={() => { setIsCaptured(false); isRunning ? stop() : start(selectedDevice); }} 
          className={`w-28 px-1 py-2 my-1 rounded border font-black text-[9px] ${isRunning ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue'}`}
        >
          {isRunning ? 'PARAR' : 'INICIAR ANÁLISE'}
        </button>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`flex-shrink-0 px-3 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${activeView === v.id ? 'text-neon-blue border-neon-blue' : 'text-zinc-600 border-transparent'}`}>
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
        {isRunning && (
            <div className="bg-neon-blue/20 p-3 rounded-lg border border-neon-blue/30 text-[10px] text-white font-bold animate-pulse">
                AGUARDANDO SINAL... MANTENHA O DISPOSITIVO ESTÁTICO.
            </div>
        )}

        {isCaptured && (
            <div className="bg-neon-green/20 p-3 rounded-lg border border-neon-green/30 text-[10px] text-neon-green font-black flex items-center gap-2">
                <CheckCircle size={14}/> LEITURA FINALIZADA E REGISTRADA.
            </div>
        )}

        <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden shrink-0">
            <RollingGraph data={liveData} threshold={0.25} color="#0088ff" />
        </div>

        <div className="flex justify-between gap-2">
            <button onClick={() => playReferenceSignal('sweep')} className="flex-1 bg-zinc-900 border border-zinc-800 py-3 rounded-xl text-[10px] font-black text-white active:bg-neon-blue">
                EMITIR SINAL (SWEEP 5s)
            </button>
        </div>

        <div className="flex-1">
          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-3">
               <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[9px] text-zinc-500 mb-1 uppercase font-black tracking-widest">Reverb Time (RT60)</p>
                  <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[9px] text-zinc-500 mb-1 uppercase font-black tracking-widest">Clarity (C50)</p>
                  <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
          {/* As outras views agora usam os mesmos dados de 'metrics' e 'liveData' fixados */}
        </div>
      </div>
    </div>
  );
}
