import React, { useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { TARGET_CURVES } from '@/lib/app-params';
import { Play, Square, Crosshair, BarChart2 } from 'lucide-react';

export default function RtaTab() {
  const { isRunning, getFrequencyData, playReferenceSignal, start, stop, selectedDevice, autoGainNormalize } = useAudioEngine();
  const [selectedCurve, setSelectedCurve] = useState('FLAT');
  const [isPinkRunning, setIsPinkRunning] = useState(false);
  const canvasRef = React.useRef(null);

  const togglePink = async () => {
    if (isPinkRunning) { setIsPinkRunning(false); }
    else { await playReferenceSignal('pink'); setIsPinkRunning(true); }
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
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex justify-between items-center bg-zinc-950 p-2 border-b border-zinc-900 gap-1 shrink-0">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`w-16 h-10 rounded-md font-black text-[9px] border ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}>
          {isRunning ? 'STOP' : 'START'}
        </button>
        <select value={selectedCurve} onChange={(e) => setSelectedCurve(e.target.value)} className="bg-black text-neon-green text-[10px] font-bold p-1 border border-zinc-800 rounded uppercase flex-1 mx-2">
          {Object.keys(TARGET_CURVES).map(k => <option key={k} value={k}>{TARGET_CURVES[k].label}</option>)}
        </select>
        <div className="flex gap-1">
          <button onClick={() => autoGainNormalize(-30)} className="p-2 border border-neon-blue text-neon-blue rounded-md"><Crosshair size={14}/></button>
          <button onClick={togglePink} className={`p-2 border rounded-md ${isPinkRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}><Play size={14}/></button>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full flex-1 bg-zinc-950/50" />
    </div>
  );
}
