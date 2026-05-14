import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';

const SAMPLE_RATE = 48000;
const TIMEBASES = [2, 4, 6, 8];
const SPEED_OF_SOUND_BASE = 331.3;

export default function TimeTab() {
  const { isRunning, getCircularBufferSlice, getSampleRate } = useAudioEngine();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const [timebase, setTimebase] = useState(4);
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);
  const [frozenOffset, setFrozenOffset] = useState(0);
  const frozenBufferRef = useRef(null);

  const [cursorA, setCursorA] = useState(null);
  const [cursorB, setCursorB] = useState(null);
  const draggingRef = useRef(null);
  const [temperature, setTemperature] = useState(25); // Padrão Brasil
  const speedOfSound = SPEED_OF_SOUND_BASE + 0.606 * temperature;

  const deltaMs = cursorA !== null && cursorB !== null ? Math.abs(cursorB - cursorA) * 1000 : null;
  const deltaM = deltaMs !== null ? (deltaMs / 1000) * speedOfSound : null;

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  const freezeBuffer = useCallback(() => {
    const sr = getSampleRate();
    const count = sr * 8;
    const slice = getCircularBufferSlice(count);
    if (slice) frozenBufferRef.current = slice;
    setFrozenOffset(0);
  }, [getCircularBufferSlice, getSampleRate]);

  const toggleFreeze = () => {
    if (!frozen) {
      freezeBuffer();
      setFrozen(true);
    } else {
      setFrozen(false);
      frozenBufferRef.current = null;
    }
  };

  const autoMark = useCallback(() => {
    const sr = getSampleRate();
    const windowSamples = timebase * sr;
    let samples;
    
    if (frozenRef.current && frozenBufferRef.current) {
      const offsetSamples = Math.floor(frozenOffset * sr);
      samples = frozenBufferRef.current.slice(offsetSamples, offsetSamples + windowSamples);
    } else {
      samples = getCircularBufferSlice(windowSamples);
    }
    
    if (!samples) return;

    // Threshold reduzido para 0.05 para maior sensibilidade no S22
    const threshold = 0.05; 
    let firstPeak = null, secondPeak = null;
    let minGap = sr * 0.02; // 20ms de gap mínimo entre pulsos
    
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > threshold) {
        if (firstPeak === null) {
          firstPeak = i / sr;
          i += minGap; 
        } else if (secondPeak === null) {
          secondPeak = i / sr;
          break;
        }
      }
    }
    
    if (firstPeak !== null) setCursorA(firstPeak);
    if (secondPeak !== null) setCursorB(secondPeak);
  }, [getCircularBufferSlice, getSampleRate, timebase, frozenOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const sr = getSampleRate();
      const windowSamples = timebase * sr;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Grid de tempo
      ctx.strokeStyle = '#111';
      const vDivs = timebase * 2;
      for (let i = 0; i <= vDivs; i++) {
        const x = (i / vDivs) * W;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      let samples;
      if (frozenRef.current && frozenBufferRef.current) {
        const offset = Math.floor(frozenOffset * sr);
        samples = frozenBufferRef.current.slice(offset, offset + windowSamples);
      } else if (isRunning) {
        samples = getCircularBufferSlice(windowSamples);
      }

      if (samples && samples.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#aaff00';
        ctx.lineWidth = 1.5;
        const step = Math.max(1, Math.floor(samples.length / W));
        for (let x = 0; x < W; x++) {
          const v = samples[Math.floor(x * step)] || 0;
          const y = H / 2 - v * (H / 2) * 0.9;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Desenhar Cursores
      if (cursorA !== null) {
        const x = (cursorA / timebase) * W;
        ctx.strokeStyle = '#aaff00'; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#aaff00'; ctx.fillText('A', x + 5, 15);
      }
      if (cursorB !== null) {
        const x = (cursorB / timebase) * W;
        ctx.strokeStyle = '#ffee00'; ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = '#ffee00'; ctx.fillText('B', x + 5, 30);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning, timebase, frozen, frozenOffset, cursorA, cursorB, getCircularBufferSlice, getSampleRate]);

  // Lógica de Redimensionamento e Touch (Simplificada para o S22)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const handleInteraction = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const t = (x / rect.width) * timebase;
    if (cursorA === null || Math.abs(t - cursorA) > Math.abs(t - (cursorB || 999))) {
        setCursorB(t);
    } else {
        setCursorA(t);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex items-center gap-2 p-2 border-b border-gray-900">
        <div className="flex gap-1">
          {TIMEBASES.map(t => (
            <button key={t} onClick={() => setTimebase(t)} className={`px-2 py-1 text-xs border ${timebase === t ? 'border-neon-green text-neon-green' : 'border-gray-800 text-gray-600'}`}>{t}s</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={autoMark} className="px-3 py-1 text-xs border border-yellow-600 text-yellow-500">AUTO</button>
        <button onClick={toggleFreeze} className={`px-3 py-1 text-xs border ${frozen ? 'border-red-500 text-red-500' : 'border-gray-700 text-gray-500'}`}>{frozen ? 'LIVE' : 'FREEZE'}</button>
      </div>

      <div className="flex-1 relative" onMouseDown={handleInteraction} onTouchStart={handleInteraction}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div className="p-4 bg-gray-950 border-t border-gray-900 flex justify-around">
        <div className="text-center">
            <p className="text-[10px] text-gray-600">Δ DELAY</p>
            <p className="text-2xl font-bold text-neon-yellow">{deltaMs ? deltaMs.toFixed(2) : '--'} ms</p>
            <p className="text-xs text-gray-500">{deltaM ? deltaM.toFixed(2) + ' m' : ''}</p>
        </div>
      </div>
    </div>
  );
}
