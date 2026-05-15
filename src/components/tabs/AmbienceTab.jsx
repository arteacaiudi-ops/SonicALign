import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, LayoutGrid, TrendingDown, SlidersHorizontal, Activity } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [activeView, setActiveView] = useState('summary');
  const [threshold, setThreshold] = useState(0.25);
  const [metrics, setMetrics] = useState({ rt60: null, c50: null });
  
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
    const samples = getCircularBufferSlice(sr * 8); // Analisar janela de 8s
    if (!samples) return;

    // Encontrar pulso mais recente (Direita) que cruza threshold
    let pulseIdx = -1;
    for (let i = samples.length - 1; i > sr; i--) {
      if (Math.abs(samples[i]) > threshold && Math.abs(samples[i-1]) < threshold) {
        pulseIdx = i;
        break;
      }
    }
    
    if (pulseIdx === -1) return;

    // Cálculos de energia
    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    for (let i = pulseIdx; i < pulseIdx + fiftyMs && i < samples.length; i++) early += samples[i] ** 2;
    for (let i = pulseIdx + fiftyMs; i < pulseIdx + (sr * 2) && i < samples.length; i++) late += samples[i] ** 2;
    
    if (early > 0) {
        const c50 = 10 * Math.log10(early / (late || 0.0001));
        const rt60 = 0.4 + (late / (early || 1)) * 15; 
        setMetrics({ c50, rt60: Math.min(rt60, 6.0) });
    }
  }, [getCircularBufferSlice, getSampleRate, isRunning, threshold]);

  useEffect(() => {
    if (isTestRunning && isRunning) {
      const t = setInterval(processAcoustics, 2000);
      return () => clearInterval(t);
    }
  }, [isTestRunning, isRunning, processAcoustics]);

  // Monitor Global 8s Sincronizado
  useEffect(() => {
    let frame;
    const draw = () => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d', { alpha: false });
        const sr = getSampleRate();
        const samples = getCircularBufferSlice(sr * 8);
        const W = canvasRef.current.width = canvasRef.current.offsetWidth;
        const H = canvasRef.current.height = canvasRef.current.offsetHeight;
        
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, W, H);
        
        if (isRunning && samples) {
          ctx.strokeStyle = '#0088ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const step = samples.length / W;
          for(let x=0; x<W; x++) {
              const val = samples[Math.floor(x*step)];
              const y = H/2 - (val * H/2);
              if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
          }
          ctx.stroke();

          // Threshold Line
          ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
          const ty = H/2 - (threshold * H/2);
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
          ctx.setLineDash([]);
        }
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

      <div className="flex-1 flex overflow-hidden">
        {/* Slider Threshold Ambience */}
        <div className="w-10 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900 shrink-0">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
          <span className="text-[7px] text-red-500 rotate-90 mt-6 font-black uppercase">Thresh</span>
        </div>

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          {/* MONITOR 8s SEMPRE VISÍVEL */}
          <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-xl relative overflow-hidden shrink-0 shadow-inner">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-0.5 rounded border border-zinc-800">
                <Activity size={10} className="text-neon-blue animate-pulse"/>
                <span className="text-[8px] text-white font-black uppercase tracking-widest">Capture Monitor (8s)</span>
              </div>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl flex justify-between items-center shadow-lg shrink-0">
             <div className="flex flex-col">
                <span className={`text-[9px] font-black tracking-[0.2em] uppercase ${isRunning ? 'text-neon-green animate-pulse' : 'text-zinc-700'}`}>
                  {isRunning ? 'ANALISANDO AMBIENTE' : 'MICROFONE OFF'}
                </span>
             </div>
             <button onClick={toggleTest} className={`px-6 py-3 rounded-lg font-black text-[10px] flex items-center gap-2 transition-all border ${isTestRunning ? 'bg-red-500/20 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue shadow-[0_0_15px_rgba(0,136,255,0.1)]'}`}>
                {isTestRunning ? <Square size={14}/> : <Play size={14}/>} EMITIR PULSO (4s)
             </button>
          </div>

          <div className="flex-1 tabular-nums">
            {activeView === 'summary' && (
              <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-2">
                 <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                    <p className="text-[9px] text-zinc-500 mb-2 uppercase font-black text-left border-b border-zinc-800 pb-2 flex justify-between">Reverb Time (RT60) <span className="text-neon-blue">SALA</span></p>
                    <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
                 </div>
                 <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                    <p className="text-[9px] text-zinc-500 mb-2 uppercase font-black text-left border-b border-zinc-800 pb-2 flex justify-between">Clarity (C50) <span className="text-neon-yellow">VOZ</span></p>
                    <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
