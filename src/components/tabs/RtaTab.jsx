import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { TARGET_CURVES } from '@/lib/app-params';
import { Play, Square, Crosshair, BarChart2 } from 'lucide-react';

export default function RtaTab() {
  const { isRunning, getFrequencyData, playReferenceSignal, setInputGain, inputGain } = useAudioEngine();
  const [selectedCurve, setSelectedCurve] = useState('FLAT');
  const [isPinkRunning, setIsPinkRunning] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const canvasRef = useRef(null);
  const pinkRef = useRef(null);

  const togglePink = () => {
    if (isPinkRunning) { pinkRef.current?.stop(); setIsPinkRunning(false); }
    else { pinkRef.current = playReferenceSignal('pink'); setIsPinkRunning(true); }
  };

  const normalize = () => {
    const data = getFrequencyData();
    if (!data) return;
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const diff = -35 - avg;
    setInputGain(Math.max(0.1, Math.min(10, inputGain * Math.pow(10, diff / 20))));
    
    // Feedback Visual
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 2000);
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
      
      const curve = TARGET_CURVES[selectedCurve];
      ctx.beginPath(); ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
      ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      curve.points.forEach((p, i) => {
        const x = (Math.log10(p[0]) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20)) * W;
        const y = H/2 - (p[1] * 8);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke(); ctx.setLineDash([]);

      if (data && isRunning) {
        ctx.beginPath(); ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1.5;
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
  }, [getFrequencyData, selectedCurve, isRunning]);

  return (
    <div className="flex flex-col h-full bg-black p-2 font-mono relative">
      {showFeedback && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-neon-blue text-black px-4 py-2 rounded-full text-[10px] font-black z-50 animate-bounce">
          GANHO AJUSTADO À CURVA
        </div>
      )}
      <div className="flex justify-between items-center mb-2 px-3 py-2 bg-zinc-950 border border-zinc-900 rounded-lg">
        <select value={selectedCurve} onChange={(e) => setSelectedCurve(e.target.value)} className="bg-black text-neon-green text-[10px] font-bold p-1 border border-zinc-800 rounded uppercase outline-none">
          {Object.keys(TARGET_CURVES).map(k => <option key={k} value={k}>{TARGET_CURVES[k].label}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={normalize} className="p-2 border border-neon-blue text-neon-blue rounded-md"><Crosshair size={14}/></button>
          <button onClick={togglePink} className={`p-2 border rounded-md ${isPinkRunning ? 'border-red-500 text-red-500 bg-red-900/10' : 'border-neon-green text-neon-green'}`}>
            {isPinkRunning ? <Square size={14}/> : <Play size={14}/>}
          </button>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full flex-1 bg-zinc-950/50 rounded-lg shadow-inner" />
    </div>
  );
}
