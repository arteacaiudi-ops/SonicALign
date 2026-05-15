import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Snowflake, RotateCcw, Activity } from 'lucide-react';

export default function TimeTab() {
  const { getCircularBufferSlice, getSampleRate, playReferenceSignal, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [threshold, setThreshold] = useState(0.15);
  const [timeWindow, setTimeWindow] = useState(2);
  const [isPulseRunning, setIsPulseRunning] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenData, setFrozenData] = useState(null);
  const [markers, setMarkers] = useState([]); // [idx1, idx2]
  const [delayInfo, setDelayInfo] = useState({ ms: 0, m: 0 });
  
  const canvasRef = useRef(null);
  const pulseRef = useRef(null);

  const togglePulse = async () => {
    if (isPulseRunning) { pulseRef.current?.stop(); setIsPulseRunning(false); }
    else { pulseRef.current = await playReferenceSignal('pulse', 1); setIsPulseRunning(true); }
  };

  useEffect(() => {
    let frame;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const sr = getSampleRate();
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      
      const samples = isFrozen ? frozenData : getCircularBufferSlice(sr * timeWindow);
      ctx.clearRect(0, 0, W, H);
      
      // Grid e Linha de Threshold
      ctx.strokeStyle = '#111';
      for(let i=1; i<10; i++){ ctx.beginPath(); ctx.moveTo(W*i/10, 0); ctx.lineTo(W*i/10, H); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
      const ty = H/2 - (threshold * H/2);
      ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();

      if (samples) {
        ctx.beginPath();
        ctx.strokeStyle = isFrozen ? '#00ffff' : '#00ff00';
        ctx.lineWidth = 2;
        const step = samples.length / W;
        let picosDetectados = [];

        for (let x = 0; x < W; x++) {
          const sIdx = Math.floor(x * step);
          const sample = samples[sIdx];
          const y = H/2 - (sample * H/2);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          
          // Detecção Automática de Pico (Apenas se não estiver congelado e mic rodando)
          if (!isFrozen && Math.abs(sample) > threshold && picosDetectados.length < 2) {
            if (picosDetectados.length === 0 || (sIdx - picosDetectados[0]) > sr * 0.05) {
              picosDetectados.push(sIdx);
            }
          }
        }
        ctx.stroke();

        // Atualizar marcadores se detectar pulsos novos
        if (!isFrozen && picosDetectados.length === 2) {
          const ms = ((picosDetectados[1] - picosDetectados[0]) / sr) * 1000;
          setMarkers(picosDetectados);
          setDelayInfo({ ms, m: ms * 0.343 });
        }

        // Desenhar Marcadores
        markers.forEach((mIdx, i) => {
          const x = (mIdx / samples.length) * W;
          ctx.fillStyle = i === 0 ? '#ff00ff' : '#ffff00';
          ctx.fillRect(x - 1, 0, 3, H);
        });
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getCircularBufferSlice, getSampleRate, threshold, timeWindow, isFrozen, frozenData, markers, isRunning]);

  return (
    <div className="flex flex-col h-full bg-black font-mono">
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center gap-3 overflow-x-auto">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`px-4 py-2 rounded-md font-black text-[10px] border shrink-0 ${isRunning ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-neon-green/10 border-neon-green text-neon-green'}`}>
          {isRunning ? 'PARAR MIC' : 'ANALISAR'}
        </button>
        
        <div className="flex gap-4 shrink-0">
          <div className="flex flex-col"><span className="text-[7px] text-zinc-500">DELTA</span><span className="text-neon-yellow text-xs font-black">{delayInfo.ms.toFixed(2)}ms</span></div>
          <div className="flex flex-col"><span className="text-[7px] text-zinc-500">DIST</span><span className="text-neon-blue text-xs font-black">{delayInfo.m.toFixed(2)}m</span></div>
        </div>

        <div className="flex gap-1 shrink-0 ml-auto">
          <select value={timeWindow} onChange={(e)=>setTimeWindow(parseInt(e.target.value))} className="bg-zinc-900 text-[10px] text-white p-1 rounded border border-zinc-800">
            {[2, 4, 6, 8].map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
          <button onClick={() => { if(!isFrozen) setFrozenData(getCircularBufferSlice(getSampleRate() * timeWindow)); setIsFrozen(!isFrozen); }} className={`p-2 rounded border ${isFrozen ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-zinc-800 text-zinc-400'}`}><Snowflake size={14}/></button>
          <button onClick={()=>setMarkers([])} className="p-2 rounded border border-zinc-800 text-zinc-400"><RotateCcw size={14}/></button>
          <button onClick={togglePulse} className={`px-3 py-1 rounded border text-[9px] font-black ${isPulseRunning ? 'bg-red-500 text-white' : 'text-neon-blue border-neon-blue'}`}>{isPulseRunning ? 'STOP' : 'PULSE'}</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-10 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>
        <canvas ref={canvasRef} className="flex-1 bg-zinc-950/20" />
      </div>
    </div>
  );
}
