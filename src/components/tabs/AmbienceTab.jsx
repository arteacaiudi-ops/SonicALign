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

  const toggleTest = async () => {
    if (isTestRunning) { signalRef.current?.stop(); setIsTestRunning(false); }
    else { signalRef.current = await playReferenceSignal('pulse', 4); setIsTestRunning(true); }
  };

  const processAcoustics = useCallback(() => {
    if (!isRunning) return;
    const sr = getSampleRate();
    const samples = getCircularBufferSlice(sr * 8); 
    if (!samples) return;

    let pulseIdx = -1;
    // Varredura para achar o pulso mais à direita
    for (let i = samples.length - 1; i > sr; i--) {
      if (Math.abs(samples[i]) > threshold && Math.abs(samples[i-1]) < threshold) {
        pulseIdx = i;
        break;
      }
    }
    
    if (pulseIdx === -1) return;

    const fiftyMs = Math.floor(sr * 0.05);
    let early = 0, late = 0;
    for (let i = pulseIdx; i < pulseIdx + fiftyMs && i < samples.length; i++) early += samples[i] ** 2;
    for (let i = pulseIdx + fiftyMs; i < pulseIdx + (sr * 2) && i < samples.length; i++) late += samples[i] ** 2;
    
    if (early > 0) {
        const c50 = 10 * Math.log10(early / (late || 0.0001));
        const rt60 = 0.5 + (late / (early || 1)) * 12; 
        setMetrics({ c50, rt60: Math.min(rt60, 5.0) });
    }
  }, [getCircularBufferSlice, getSampleRate, isRunning, threshold]);

  useEffect(() => {
    if (isTestRunning && isRunning) {
      const t = setInterval(processAcoustics, 2000);
      return () => clearInterval(t);
    }
  }, [isTestRunning, isRunning, processAcoustics]);

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
          ctx.beginPath();
          const step = samples.length / W;
          for(let x=0; x<W; x++) {
              const y = H/2 - (samples[Math.floor(x*step)] * H/2);
              if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
          }
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
          ctx.beginPath(); ctx.moveTo(0, H/2 - (threshold * H/2)); ctx.lineTo(W, H/2 - (threshold * H/2)); ctx.stroke();
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
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className="w-24 px-2 py-2 my-1 rounded border font-black text-[10px] bg-neon-blue/10 border-neon-blue text-neon-blue">
          {isRunning ? 'STOP MIC' : 'ANALISAR'}
        </button>
        {Object.entries({ summary: 'Resumo', etc: 'Decaimento', eq: 'Correção EQ' }).map(([id, label]) => (
          <button key={id} onClick={() => setActiveView(id)} className={`px-4 py-3 text-[10px] font-bold uppercase border-b-2 transition-all ${activeView === id ? 'text-neon-blue border-neon-blue' : 'text-zinc-600 border-transparent'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-10 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900 shrink-0">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>

        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto tabular-nums">
          <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-xl relative overflow-hidden shrink-0">
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/60 px-2 py-0.5 rounded border border-zinc-800">
                <Activity size={10} className="text-neon-blue animate-pulse"/>
                <span className="text-[8px] text-white font-black uppercase">Monitor 8s</span>
              </div>
          </div>

          <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl flex justify-between items-center shrink-0">
             <span className={`text-[9px] font-black uppercase ${isRunning ? 'text-neon-green animate-pulse' : 'text-zinc-700'}`}>
                {isRunning ? 'ANALISANDO AMBIENTE' : 'MICROFONE OFF'}
             </span>
             <button onClick={toggleTest} className="px-4 py-3 rounded-lg font-black text-[10px] border border-neon-blue text-neon-blue">
                {isTestRunning ? <Square size={14} className="inline mr-2"/> : <Play size={14} className="inline mr-2"/>} EMITIR PULSO
             </button>
          </div>

          {activeView === 'summary' && (
            <div className="grid grid-cols-1 gap-4">
               <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-black text-left border-b border-zinc-800 pb-2 flex justify-between">Reverb Time (RT60)</p>
                  <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
               </div>
               <div className="bg-zinc-900/40 p-6 rounded-2xl border border-zinc-800/50 text-center">
                  <p className="text-[9px] text-zinc-500 mb-2 uppercase font-black text-left border-b border-zinc-800 pb-2 flex justify-between">Clarity (C50)</p>
                  <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
