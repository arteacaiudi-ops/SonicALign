import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square, Timer } from 'lucide-react';

export default function TimeTab() {
  const { isRunning, getCircularBufferSlice, getSampleRate, playReferenceSignal } = useAudioEngine();
  const [threshold, setThreshold] = useState(0.15);
  const [isPulseRunning, setIsPulseRunning] = useState(false);
  const [delayInfo, setDelayInfo] = useState({ ms: 0, meters: 0 });
  const canvasRef = useRef(null);
  const pulseRef = useRef(null);

  const togglePulse = () => {
    if (isPulseRunning) { pulseRef.current?.stop(); setIsPulseRunning(false); }
    else { pulseRef.current = playReferenceSignal('pulse', 1); setIsPulseRunning(true); }
  };

  useEffect(() => {
    let frame;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const sr = getSampleRate();
      const samples = getCircularBufferSlice(sr * 1.5); 
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      
      // Linha do Threshold
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.4)';
      const ty = H/2 - (threshold * H/2);
      ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();

      if (samples) {
        let picos = [];
        ctx.beginPath();
        ctx.strokeStyle = '#00ff00';
        const step = samples.length / W;
        
        for (let x = 0; x < W; x++) {
          const sIdx = Math.floor(x * step);
          const sample = samples[sIdx];
          const y = H/2 - (sample * H/2);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          
          // Detecção de picos para cálculo (Agnóstico de fase)
          if (Math.abs(sample) > threshold && (picos.length === 0 || sIdx - picos[picos.length-1] > sr * 0.1)) {
            picos.push(sIdx);
          }
        }
        ctx.stroke();

        // Cálculo de Delay entre os dois últimos picos
        if (picos.length >= 2) {
          const diffSamples = picos[picos.length-1] - picos[picos.length-2];
          const ms = (diffSamples / sr) * 1000;
          const meters = ms * 0.343;
          setDelayInfo({ ms, meters });
          
          // Marcação visual dos picos
          ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
          picos.forEach(p => ctx.fillRect((p / samples.length) * W, 0, 2, H));
        }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getCircularBufferSlice, getSampleRate, threshold]);

  return (
    <div className="flex flex-col h-full bg-black font-mono">
      <div className="bg-zinc-950 p-3 border-b border-zinc-900 flex justify-between items-center">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[8px] text-zinc-500 uppercase">Tempo Delta</span>
            <span className="text-neon-yellow font-black">{delayInfo.ms.toFixed(2)} ms</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] text-zinc-500 uppercase">Distância</span>
            <span className="text-neon-blue font-black">{delayInfo.meters.toFixed(2)} m</span>
          </div>
        </div>
        <button onClick={togglePulse} className={`px-4 py-2 border rounded flex items-center gap-2 text-[10px] font-bold ${isPulseRunning ? 'border-red-500 text-red-500' : 'border-neon-blue text-neon-blue'}`}>
          {isPulseRunning ? <Square size={12}/> : <Play size={12}/>} PULSO 1s
        </button>
      </div>

      <div className="flex-1 flex">
        <div className="w-12 bg-zinc-950 flex flex-col items-center py-4 border-r border-zinc-900">
           <input type="range" min="0" max="0.8" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-full accent-red-500" style={{ appearance: 'slider-vertical' }} />
           <span className="text-[8px] text-red-500 rotate-90 mt-4 font-bold">THRESH</span>
        </div>
        <canvas ref={canvasRef} className="flex-1 bg-zinc-950/50" />
      </div>
    </div>
  );
}
