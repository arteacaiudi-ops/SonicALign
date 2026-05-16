import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, LayoutGrid, TrendingDown, BarChart3, Waves, SlidersHorizontal, Activity, AlertCircle, CheckCircle } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [activeView, setActiveView] = useState('summary');
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const [sweepState, setSweepState] = useState('idle'); // idle, listening, recording, done, error_low, error_high
  const [errorMsg, setErrorMsg] = useState('');
  const [liveData, setLiveData] = useState(new Float32Array(0));
  const timerRef = useRef(null);

  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'bands', label: 'Bandas', icon: BarChart3 },
    { id: 'waterfall', label: 'Cachoeira', icon: Waves },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  const processAcoustics = useCallback((samples) => {
    const sr = getSampleRate();
    
    // VALIDAÇÃO DE VOLUME PÓS-GRAVAÇÃO (POST-FACTO)
    let maxPeak = 0;
    for (let i = 0; i < samples.length; i++) {
      const absVal = Math.abs(samples[i]);
      if (absVal > maxPeak) maxPeak = absVal;
    }

    if (maxPeak < 0.05) {
      setErrorMsg("Volume muito baixo para análise de precisão. Por favor, aumente o ganho nas abas RTA/Time e repita o Sweep.");
      setSweepState('error_low');
      stop();
      return;
    }

    if (maxPeak > 0.97) {
      setErrorMsg("Sinal distorcido ou saturado (Clipping). Por favor, reduza o ganho nas abas RTA/Time e repita o Sweep.");
      setSweepState('error_high');
      stop();
      return;
    }

    // Limiar dinâmico e inteligente baseado no pico real capturado
    const dynamicThreshold = maxPeak * 0.5;
    let sweepEndIdx = -1;
    
    for (let i = samples.length - Math.floor(sr * 0.1); i > sr; i--) {
      if (Math.abs(samples[i]) > dynamicThreshold && Math.abs(samples[i+100] || 0) < dynamicThreshold * 0.3) {
        sweepEndIdx = i; 
        break;
      }
    }
    
    if (sweepEndIdx === -1) sweepEndIdx = samples.length - Math.floor(sr * 1.5);

    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    
    for (let i = sweepEndIdx - fiftyMs; i < sweepEndIdx + fiftyMs; i++) {
        if(samples[i]) early += samples[i] ** 2;
    }
    for (let i = sweepEndIdx + fiftyMs; i < sweepEndIdx + (sr * 1.5); i++) {
        if(samples[i]) late += samples[i] ** 2;
    }
    
    if (early > 0) {
      setMetrics({ 
        c50: 10 * Math.log10(early / (late || 0.00001)), 
        rt60: 0.3 + (late / early) * 12 
      });
      setSweepState('done');
    } else {
      setMetrics({ c50: 0, rt60: 0 });
      setSweepState('done');
    }
    
    stop(); 
  }, [getSampleRate, stop]);

  useEffect(() => {
    if (isRunning) {
      if (sweepState === 'idle' || sweepState === 'done' || sweepState.startsWith('error')) {
        setSweepState('listening');
        setMetrics({ rt60: null, c50: null });
        setErrorMsg('');
      }
    } else {
      if (sweepState !== 'done' && !sweepState.startsWith('error')) {
        setSweepState('idle');
      }
    }
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const samples = getCircularBufferSlice(getSampleRate() * 8); 
      if (samples) setLiveData(samples);

      if (sweepState === 'listening') {
        const recentSamples = getCircularBufferSlice(getSampleRate());
        if (recentSamples) {
          let triggered = false;
          // Trigger de segurança fixo baixo para acordar a escuta contínua
          for (let i = 0; i < recentSamples.length; i++) {
            if (Math.abs(recentSamples[i]) > 0.03) { triggered = true; break; }
          }
          
          if (triggered) {
            setSweepState('recording');
            timerRef.current = setTimeout(() => {
               const finalSamples = getCircularBufferSlice(getSampleRate() * 8);
               processAcoustics(finalSamples);
            }, 6500); 
          }
        }
      }
    }, 150);

    return () => {
        clearInterval(interval);
        if(timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isRunning, sweepState, getCircularBufferSlice, getSampleRate, processAcoustics]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-1 py-1 gap-1 shrink-0">
        <button 
          onClick={() => { 
            if (isRunning) {
              setSweepState('idle');
              if(timerRef.current) clearTimeout(timerRef.current);
              stop();
            } else {
              setMetrics({ rt60: null, c50: null });
              setErrorMsg('');
              setSweepState('listening');
              start(selectedDevice);
            }
          }} 
          className={`w-28 px-1 py-2 my-1 rounded border font-black text-[9px] ${isRunning ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue'}`}
        >
          {isRunning ? 'PARAR' : 'INICIAR ANÁLISE'}
        </button>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`flex-shrink-0 px-3 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${activeView === v.id ? 'text-neon-blue border-neon-blue' : 'text-zinc-600 border-transparent'}`}>{v.label}</button>
        ))}
      </div>

      {sweepState === 'listening' && (
        <div className="bg-neon-blue/20 p-3 flex items-center gap-3 animate-pulse border-b border-neon-blue/30">
          <AlertCircle className="text-neon-blue" size={20}/>
          <div className="text-[10px] text-white font-bold leading-tight">PRONTO PARA MEDIÇÃO...<br/>DISPARE O SWEEP E MANTENHA O TELEMÓVEL ESTÁTICO.</div>
        </div>
      )}
      
      {sweepState === 'recording' && (
        <div className="bg-red-500/20 p-3 flex items-center gap-3 animate-pulse border-b border-red-500/30">
          <Activity className="text-red-500" size={20}/>
          <div className="text-[10px] text-red-500 font-black leading-tight">GRAVANDO SWEEP (6.5s)...<br/>CAPTURANDO RESPOSTA DE SALA E CAUDA DE REVERBERAÇÃO.</div>
        </div>
      )}

      {sweepState === 'done' && (
        <div className="bg-neon-green/20 p-2 flex items-center gap-2 border-b border-neon-green/30 text-[10px] text-neon-green font-black">
            <CheckCircle size={14}/> MEDIÇÃO CONCLUÍDA E TRAVADA COM SUCESSO.
        </div>
      )}

      {(sweepState === 'error_low' || sweepState === 'error_high') && (
        <div className="bg-red-600/20 p-3 flex items-center gap-3 border-b border-red-500/40 text-[10px] text-red-500 font-black leading-tight">
          <AlertCircle size={20} className="shrink-0"/>
          <div>{errorMsg}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto">
        <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden shrink-0 shadow-inner">
            <RollingGraph data={liveData} threshold={0.03} color="#0088ff" />
        </div>

        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex justify-between items-center shrink-0 gap-4">
           <div className="text-[8px] text-zinc-500 uppercase font-black flex-1 leading-tight tracking-wider">
             Caso o volume fique inadequado, faça o ajuste fino do ganho de entrada utilizando as guias RTA ou Time.
           </div>
           <button 
              onClick={() => playReferenceSignal('sweep')} 
              className="px-4 py-2 border border-zinc-800 text-zinc-400 rounded-lg bg-zinc-900 font-black text-[9px] hover:text-white active:bg-zinc-800 shrink-0" 
              disabled={sweepState === 'recording'}
           >
              EMITIR SWEEP (5s)
           </button>
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
      </div>
    </div>
  );
}
