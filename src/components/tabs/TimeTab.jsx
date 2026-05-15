import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Snowflake, RotateCcw, ChevronDown } from 'lucide-react';

export default function TimeTab() {
  const { getCircularBufferSlice, getSampleRate, playReferenceSignal } = useAudioEngine();
  const [threshold, setThreshold] = useState(0.15);
  const [timeWindow, setTimeWindow] = useState(2); // 2s, 4s, 6s, 8s
  const [isPulseRunning, setIsPulseRunning] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenData, setFrozenData] = useState(null);
  const [manualMarkers, setMarkers] = useState([]); // Amostras manuais
  const [delayInfo, setDelayInfo] = useState({ ms: 0, m: 0 });
  
  const canvasRef = useRef(null);
  const pulseRef = useRef(null);

  const togglePulse = async () => {
    if (isPulseRunning) {
      pulseRef.current?.stop();
      setIsPulseRunning(false);
    } else {
      pulseRef.current = await playReferenceSignal('pulse', 1);
      setIsPulseRunning(true);
    }
  };

  const toggleFreeze = () => {
    if (!isFrozen) {
      const sr = getSampleRate();
      setFrozenData(getCircularBufferSlice(sr * timeWindow));
    }
    setIsFrozen(!isFrozen);
  };

  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const sr = getSampleRate();
    const samplesCount = sr * timeWindow;
    const sampleIdx = Math.floor((x / rect.width) * samplesCount);
    
    setMarkers(prev => {
      const next = [...prev, sampleIdx].slice(-2); // Mantém apenas os 2 últimos
      if (next.length === 2) {
        const diff = Math.abs(next[1] - next[0]);
        const ms = (diff / sr) * 1000;
        setDelayInfo({ ms, m: ms * 0.343 });
      }
      return next;
    });
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
      
      // Grid e Threshold
      ctx.strokeStyle = '#1a1a1a';
      for(let i=1; i<4; i++) {
        ctx.beginPath(); ctx.moveTo(0, H*i/4); ctx.lineTo(W, H*i/4); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      const ty = H/2 - (threshold * H/2);
      ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();

      if (samples) {
        ctx.beginPath(); ctx.strokeStyle = isFrozen ? '#00ffff' : '#00ff00';
        const step = samples.length / W;
        for (let x = 0; x < W; x++) {
          const y = H/2 - (samples[Math.floor(x * step)] * H/2);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Desenhar Marcadores
        manualMarkers.forEach((m, i) => {
          const x = (m / samples.length) * W;
          ctx.fillStyle = i === 0 ? '#ff00ff' : '#ffff00';
          ctx.fillRect(x - 1, 0, 2, H);
        });
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getCircularBufferSlice, getSampleRate, threshold, timeWindow, isFrozen, frozenData, manualMarkers]);

  return (
    <div className="flex flex-col h-full bg-black font-mono">
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center gap-2 overflow-x-auto">
        <div className="flex gap-3 shrink-0">
          <div className="flex flex-col"><span className="text-[7px] text-zinc-500 uppercase">Delta</span><span className="text-neon-yellow text-xs font-black">{delayInfo.ms.toFixed(2)}ms</span></div>
          <div className="flex flex-col"><span className="text-[7px] text-zinc-500 uppercase">Dist</span><span className="text-neon-blue text-xs font-black">{delayInfo.m.toFixed(2)}m</span></div>
        </div>

        <div className="flex gap-1">
          <select value={timeWindow} onChange={(e)=>setTimeWindow(parseInt(e.target.value))} className="bg-zinc-900 text-[10px] text-white p-1 rounded border border-zinc-700">
            {[2, 4, 6, 8].map(t => <option key={t} value={t}>{t}s</option>)}
          </select>
          <button onClick={toggleFreeze} className={`p-2 rounded border ${isFrozen ? 'bg-cyan-500 text-black border-cyan-500' : 'text-zinc-400 border-zinc-800'}`}><Snowflake size={14}/></button>
          <button onClick={()=>setMarkers([])} className="p-2 rounded border border-zinc-800 text-zinc-400"><RotateCcw size={14}/></button>
          <button onClick={togglePulse} className={`px-2 py-1 rounded border text-[9px] font-bold ${isPulseRunning ? 'bg-red-500 text-white' : 'text-neon-blue border-neon-blue'}`}>{isPulseRunning ? 'STOP' : 'PULSE'}</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-10 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900">
          <input type="range" min="0" max="1" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
        </div>
        <canvas ref={canvasRef} onClick={handleCanvasClick} className="flex-1 bg-zinc-950/20 cursor-crosshair" />
      </div>
    </div>
  );
}
