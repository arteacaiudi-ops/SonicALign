import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { TARGET_CURVES } from '@/lib/app-params';
import { Play, Square, Crosshair } from 'lucide-react';

export default function RtaTab() {
  const { isRunning, getFrequencyData, playReferenceSignal, setInputGain, inputGain } = useAudioEngine();
  const [selectedCurve, setSelectedCurve] = useState('LIVE');
  const [isPinkRunning, setIsPinkRunning] = useState(false);
  const canvasRef = useRef(null);
  const pinkRef = useRef(null);

  const togglePink = () => {
    if (isPinkRunning) { pinkRef.current?.stop(); setIsPinkRunning(false); }
    else { pinkRef.current = playReferenceSignal('pink'); setIsPinkRunning(true); }
  };

  useEffect(() => {
    let frame;
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const data = getFrequencyData();
      const W = canvas.width = canvas.offsetWidth;
      const H = canvas.height = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);
      
      // Desenha Curva Alvo
      const curve = TARGET_CURVES[selectedCurve];
      ctx.beginPath(); ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
      ctx.setLineDash([5, 5]);
      curve.points.forEach((p, i) => {
        const x = (Math.log10(p[0]) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * W;
        const y = H/2 - (p[1] * 5);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.setLineDash([]);

      // Desenha RTA
      if (data) {
        ctx.beginPath(); ctx.strokeStyle = '#00ff00';
        for (let i = 0; i < data.length; i++) {
          const x = (i / data.length) * W;
          const y = H - ((data[i] + 100) * (H / 100));
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [getFrequencyData, selectedCurve]);

  return (
    <div className="flex flex-col h-full bg-black p-2 font-mono">
      <div className="flex justify-between items-center mb-2 px-2 bg-zinc-950 p-2 border border-zinc-900">
        <select value={selectedCurve} onChange={(e)=>setSelectedCurve(e.target.value)} className="bg-black text-neon-green text-[10px] p-1 border border-zinc-800 rounded">
          {Object.keys(TARGET_CURVES).map(k => <option key={k} value={k}>{TARGET_CURVES[k].label}</option>)}
        </select>
        <button onClick={togglePink} className={`p-2 border rounded ${isPinkRunning ? 'border-red-500 text-red-500 bg-red-900/10' : 'border-neon-green text-neon-green'}`}>
          {isPinkRunning ? <Square size={14}/> : <Play size={14}/>}
        </button>
      </div>
      <canvas ref={canvasRef} className="w-full flex-1 bg-zinc-950 rounded" />
    </div>
  );
}
