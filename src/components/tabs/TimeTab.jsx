import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Play, Square } from 'lucide-react';

export default function TimeTab() {
  const { isRunning, getCircularBufferSlice, getSampleRate, playReferenceSignal } = useAudioEngine();
  const [threshold, setThreshold] = useState(0.05);
  const [isPulseRunning, setIsPulseRunning] = useState(false);
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
      const samples = getCircularBufferSlice(sr * 2); 
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      
      // Linha do Threshold
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      const ty = H/2 - (threshold * H/2);
      ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();

      if (samples) {
        ctx.beginPath(); ctx.strokeStyle = '#00ff00';
        const step = samples.length / W;
        for (let x = 0; x < W; x++) {
          const sample = samples[Math.floor(x * step)];
          const y = H/2 - (sample * H/2);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getCircularBufferSlice, getSampleRate, threshold]);

  return (
    <div className="flex h-full bg-black font-mono">
      <div className="flex flex-col items-center p-2 border-r border-zinc-900 gap-4 bg-zinc-950">
        <input type="range" min="0" max="0.5" step="0.01" value={threshold} onChange={(e)=>setThreshold(parseFloat(e.target.value))} className="h-48 accent-red-500" style={{ appearance: 'slider-vertical' }} />
        <button onClick={togglePulse} className={`p-2 border rounded ${isPulseRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}>
          {isPulseRunning ? <Square size={16}/> : <Play size={16}/>}
        </button>
      </div>
      <canvas ref={canvasRef} className="flex-1 bg-zinc-950" />
    </div>
  );
}
