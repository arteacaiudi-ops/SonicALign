import React, { useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, Square, LayoutGrid, TrendingDown, BarChart3, Waves, SlidersHorizontal, Activity, Crosshair, AlertCircle, CheckCircle } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice, peakHoldAutoGain } = useAudioEngine();
  const [activeView, setActiveView] = useState('summary');
  const [threshold, setThreshold] = useState(0.25);
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const [isListening, setIsListening] = useState(false);
  const [liveData, setLiveData] = useState(new Float32Array(0));
  const [isCalibrating, setIsCalibrating] = useState(false);

  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'bands', label: 'Bandas', icon: BarChart3 },
    { id: 'waterfall', label: 'Cachoeira', icon: Waves },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  const handleAutoGain = async () => {
    setIsCalibrating(true);
    await peakHoldAutoGain(5000);
    setIsCalibrating(false);
  };

  const processAcoustics = useCallback((samples) => {
    const sr = getSampleRate();
    let pulseIdx = -1;
    for (let i = samples.length - 1; i > sr; i--) {
      if (Math.abs(samples[i]) > threshold && Math.abs(samples[i-100]) < threshold * 0.3) {
        pulseIdx = i; break;
      }
    }
    if (pulseIdx !== -1 && pulseIdx < samples.length - sr) {
      const fiftyMs = Math.floor(sr * 0.05);
      let early = 0, late = 0;
      for (let i = pulseIdx; i < pulseIdx + fiftyMs; i++) early += samples[i] ** 2;
      for (let i = pulseIdx + fiftyMs; i < pulseIdx + sr; i++) late += samples[i] ** 2;
      if (early > 0) {
        setMetrics({ c50: 10 * Math.log10(early / (late || 0.00001)), rt60: 0.3 + (late / early) * 15 });
        setIsListening(false);
        stop(); // Para a escuta após sucesso ("One-Shot")
      }
    }
  }, [getSampleRate, threshold, stop]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const samples = getCircularBufferSlice(getSampleRate() * 8); 
      setLiveData(samples);
      if (isListening) processAcoustics(samples);
    }, 150);
    return () => clearInterval(interval);
  }, [isRunning, isListening, getCircularBufferSlice, getSampleRate, processAcoustics]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-1 py-1 gap-1 shrink-0">
        <button onClick={() => { setIsListening(false); isRunning ? stop() : start(selectedDevice); }} className={`w-16 px-1 py-2 my-1 rounded border font-black text-[9px] ${isRunning ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue'}`}>
          {isRunning ? 'STOP' : 'INICIAR ANÁLISE'}
        </button>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`flex-shrink-0 px-3 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${activeView === v.id ? 'text-neon-blue border-neon-blue' : 'text-zinc-600 border-transparent'}`}>{v.label}</button>
        ))}
      </div>

      {isListening && (
        <div className="bg-neon-blue/20 p-3 flex items-center gap-3 animate-pulse border-b border-neon-blue/30">
          <AlertCircle className="text-neon-blue" size={20}/>
          <div className="text-[10px] text-white font-bold leading-tight">NÃO MOVA O DISPOSITIVO.<br/>DISPARE O SINAL E AGUARDE A FINALIZAÇÃO.</div>
        </div>
      )}

      {metrics.rt60 && !isListening && !isRunning && (
        <div className="bg-neon-green/20 p-2 flex items-center gap-2 border-b border-neon-green/30 text-[10px] text-neon-green font-black">
            <CheckCircle size={14}/> LEITURA REGISTRADA.
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-7 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900 shrink-0">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>

        <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto">
          <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden shrink-0 shadow-inner">
              <RollingGraph data={liveData} threshold={threshold} color="#0088ff" />
          </div>

          <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex justify-between items-center shrink-0">
             <button onClick={handleAutoGain} className={`p-2 rounded border border-zinc-800 ${isCalibrating ? 'text-neon-blue animate-spin' : 'text-zinc-400'}`}><Crosshair size={14}/></button>
             <button 
                onClick={() => setIsListening(!isListening)} 
                className={`px-4 py-2 rounded-lg font-black text-[9px] border transition-all ${isListening ? 'bg-neon-green text-black border-neon-green' : 'border-neon-blue text-neon-blue'}`}
             >
                {isListening ? 'OUVINDO SWEEP...' : 'AGUARDAR SINAL'}
             </button>
             <button onClick={() => playReferenceSignal('sweep')} className="p-2 border border-zinc-800 text-zinc-400 rounded-lg bg-zinc-900 font-black text-[9px]"><Play size={10} className="inline mr-1"/> EMITIR SINAL</button>
          </div>

          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-2 animate-in fade-in">
               <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[9px] text-zinc-500 mb-1 uppercase font-black flex justify-between">RT60 (Decaimento) <Activity size={10}/></p>
                  <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800 text-center">
                  <p className="text-[9px] text-zinc-500 mb-1 uppercase font-black flex justify-between">C50 (Clareza) <Activity size={10}/></p>
                  <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
          {activeView === 'etc' && <div className="p-4 text-zinc-500 text-center text-xs">Módulo ETC (Breve)</div>}
          {activeView === 'bands' && <div className="p-4 text-zinc-500 text-center text-xs">Módulo Oitavas (Breve)</div>}
          {activeView === 'waterfall' && <div className="p-4 text-zinc-500 text-center text-xs">Módulo Waterfall (Breve)</div>}
          {activeView === 'eq' && <div className="p-4 text-zinc-500 text-center text-xs">Módulo Correção EQ (Breve)</div>}
        </div>
      </div>
    </div>
  );
}
