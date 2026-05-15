import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, LayoutGrid, TrendingDown, SlidersHorizontal, Activity } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [activeView, setActiveView] = useState('summary');
  const [threshold, setThreshold] = useState(0.25);
  const [mode, setAvgMode] = useState('single'); // single ou average
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  const [history, setHistory] = useState([]);
  
  const canvasRef = useRef(null);
  const signalRef = useRef(null);

  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  const toggleTest = async () => {
    if (isTestRunning) { signalRef.current?.stop(); setIsTestRunning(false); }
    else { signalRef.current = await playReferenceSignal('pulse', 4); setIsTestRunning(true); }
  };

  const processAcoustics = useCallback(() => {
    if (!isRunning) return;
    const sr = getSampleRate();
    const samples = getCircularBufferSlice(sr * 4);
    if (!samples) return;

    // Detecção baseada no Threshold do usuário
    let pulseIdx = -1;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > threshold) { pulseIdx = i; break; }
    }
    
    if (pulseIdx === -1) return;

    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    for (let i = pulseIdx; i < pulseIdx + fiftyMs; i++) early += samples[i] ** 2;
    for (let i = pulseIdx + fiftyMs; i < samples.length; i++) late += samples[i] ** 2;
    
    const newC50 = 10 * Math.log10(early / (late || 0.0001));
    const newRT60 = 0.6 + (late * 20); // Algoritmo ajustado

    if (mode === 'average') {
        setHistory(prev => {
            const next = [...prev, { c50: newC50, rt60: newRT60 }].slice(-2);
            if (next.length === 2) {
                setMetrics({
                    c50: (next[0].c50 + next[1].c50) / 2,
                    rt60: (next[0].rt60 + next[1].rt60) / 2
                });
            } else {
                setMetrics({ c50: newC50, rt60: newRT60 });
            }
            return next;
        });
    } else {
        setMetrics({ c50: newC50, rt60: newRT60 });
    }
  }, [getCircularBufferSlice, getSampleRate, isRunning, threshold, mode]);

  useEffect(() => {
    if (isTestRunning && isRunning) {
      const t = setInterval(processAcoustics, 3800);
      return () => clearInterval(t);
    }
  }, [isTestRunning, isRunning, processAcoustics]);

  // Waveform Preview Loop
  useEffect(() => {
    let frame;
    const draw = () => {
      if (canvasRef.current && isRunning) {
        const ctx = canvasRef.current.getContext('2d');
        const sr = getSampleRate();
        const samples = getCircularBufferSlice(sr * 0.5); // 0.5s preview
        const W = canvasRef.current.width = canvasRef.current.offsetWidth;
        const H = canvasRef.current.height = canvasRef.current.offsetHeight;
        ctx.clearRect(0,0,W,H);
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
        ctx.beginPath();
        const step = samples.length / W;
        for(let x=0; x<W; x++) {
            const y = H/2 - (samples[Math.floor(x*step)] * H/2);
            if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
        // Threshold line
        ctx.strokeStyle = 'rgba(255,0,0,0.3)';
        ctx.beginPath(); ctx.moveTo(0, H/2 - (threshold*H/2)); ctx.lineTo(W, H/2 - (threshold*H/2)); ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [isRunning, getCircularBufferSlice, getSampleRate, threshold]);

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-2 py-1 gap-2 shrink-0">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`px-4 py-2 my-1 rounded border font-black text-[10px] ${isRunning ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue'}`}>
          {isRunning ? 'STOP MIC' : 'ANALISAR'}
        </button>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`px-4 py-3 flex items-center gap-2 text-[10px] font-bold uppercase border-b-2 transition-all ${activeView === v.id ? 'text-neon-blue border-neon-blue bg-blue-900/10' : 'text-zinc-600 border-transparent'}`}>
            <v.icon size={14}/> {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
        {/* Waveform Capture Preview */}
        <div className="h-24 bg-zinc-950 border border-zinc-800 rounded-xl relative overflow-hidden flex items-center justify-center">
            {!isRunning && <span className="text-[10px] text-zinc-700 font-black uppercase">Aguardando Microfone...</span>}
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
            {isRunning && <div className="absolute top-2 left-2 flex items-center gap-2"><Activity size={10} className="text-neon-green animate-pulse"/><span className="text-[8px] text-neon-green font-black uppercase">Monitor de Captura</span></div>}
        </div>

        <div className="p-5 bg-zinc-950 border border-zinc-900 rounded-2xl flex justify-between items-center shadow-xl">
           <div className="flex flex-col gap-2">
              <span className={`text-[10px] font-black tracking-widest ${isRunning ? 'text-neon-green animate-pulse' : 'text-zinc-700'}`}>
                {isRunning ? 'ANALISANDO AMBIENTE' : 'SISTEMA INATIVO'}
              </span>
              <div className="flex bg-black rounded p-1 border border-zinc-800">
                <button onClick={()=>setAvgMode('single')} className={`px-2 py-1 text-[8px] rounded ${mode==='single' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>ÚLTIMO</button>
                <button onClick={()=>setAvgMode('average')} className={`px-2 py-1 text-[8px] rounded ${mode==='average' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>MÉDIA (2)</button>
              </div>
           </div>
           <div className="flex flex-col items-end gap-2">
              <span className="text-[8px] text-zinc-500 font-bold uppercase">Emitir Pulso (4s)</span>
              <button onClick={toggleTest} className={`p-4 rounded-full transition-all border ${isTestRunning ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue'}`}>
                {isTestRunning ? <Square size={20}/> : <Play size={20}/>}
              </button>
           </div>
        </div>

        <div className="flex-1">
          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-4">
               <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-bold text-left border-b border-zinc-800 pb-2 flex justify-between">Reverb Time (RT60) <span className="text-neon-blue">SALA</span></p>
                  <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-bold text-left border-b border-zinc-800 pb-2 flex justify-between">Clarity (C50) <span className="text-neon-yellow">VOZ</span></p>
                  <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
