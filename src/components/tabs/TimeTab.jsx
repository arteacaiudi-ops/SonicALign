import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';

const TIMEBASES = [2, 4, 6, 8];
const SPEED_OF_SOUND_BASE = 331.3;

export default function TimeTab() {
  const { isRunning, getCircularBufferSlice, getSampleRate } = useAudioEngine();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const [timebase, setTimebase] = useState(4);
  const [frozen, setFrozen] = useState(false);
  const [frozenOffset, setFrozenOffset] = useState(0);
  const frozenBufferRef = useRef(null);
  const frozenRef = useRef(false);

  const [cursorA, setCursorA] = useState(null);
  const [cursorB, setCursorB] = useState(null);
  const [temperature, setTemperature] = useState(25);
  
  // Calculate speed of sound based on temperature (in m/s)
  // Speed of sound = 331.3 + 0.606 * temperature (in Celsius)
  const speedOfSound = SPEED_OF_SOUND_BASE + (0.606 * temperature);
  
  // Calculate time delay in milliseconds between cursors
  const sr = getSampleRate();
  const deltaSeconds = (cursorA !== null && cursorB !== null) ? Math.abs(cursorB - cursorA) : null;
  const deltaMs = deltaSeconds !== null ? deltaSeconds * 1000 : null;
  
  // Calculate distance in meters using temperature-adjusted speed of sound
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

    // Reduced threshold from 0.15 to 0.05 for increased sensitivity to transients
    const threshold = 0.05; 
    let first = null, second = null;
    let minGap = sr * 0.02; 
    
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > threshold) {
        if (first === null) {
          first = i / sr;
          i += Math.floor(minGap); 
        } else if (second === null) {
          second = i / sr;
          break;
        }
      }
    }
    
    if (first !== null) setCursorA(first);
    if (second !== null) setCursorB(second);
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

      ctx.strokeStyle = '#111';
      for (let i = 0; i <= timebase * 2; i++) {
        const x = (i / (timebase * 2)) * W;
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

      if (cursorA !== null) {
        const x = (cursorA / timebase) * W;
        ctx.strokeStyle = '#aaff00'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      if (cursorB !== null) {
        const x = (cursorB / timebase) * W;
        ctx.strokeStyle = '#ffee00'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning, timebase, frozen, frozenOffset, cursorA, cursorB, getCircularBufferSlice, getSampleRate]);

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
    if (cursorA === null) setCursorA(t);
    else if (cursorB === null) setCursorB(t);
    else setCursorA(t);
  };

  return (
    <div className="flex flex-col h-full bg-black font-mono">
      <div className="flex items-center gap-2 p-2 border-b border-gray-900">
        <div className="flex gap-1">
          {TIMEBASES.map(t => (
            <button key={t} onClick={() => setTimebase(t)} className={`px-2 py-1 text-[10px] border ${timebase === t ? 'border-neon-green text-neon-green' : 'border-gray-800 text-gray-600'}`}>{t}s</button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={autoMark} className="px-3 py-1 text-[10px] border border-yellow-600 text-yellow-500">AUTO</button>
        <button onClick={toggleFreeze} className={`px-3 py-1 text-[10px] border ${frozen ? 'border-red-500 text-red-500' : 'border-gray-700 text-gray-500'}`}>{frozen ? 'LIVE' : 'FREEZE'}</button>
      </div>

      <div className="flex-1 relative" onMouseDown={handleInteraction} onTouchStart={handleInteraction}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      <div className="p-4 bg-gray-950 border-t border-gray-900 flex justify-around">
        <div className="text-center">
            <p className="text-[10px] text-gray-600 tracking-widest">Δ DELAY</p>
            <p className="text-2xl font-bold text-[#ffee00]">{deltaMs ? deltaMs.toFixed(2) : '--'} ms</p>
            <p className="text-[10px] text-gray-500">{deltaM ? deltaM.toFixed(2) + ' m' : ''}</p>
        </div>
      </div>
    </div>
  );
}
