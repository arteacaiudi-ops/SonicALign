import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';

const SAMPLE_RATE = 48000;
const TIMEBASES = [2, 4, 6, 8]; // seconds
const SPEED_OF_SOUND_BASE = 331.3;

export default function TimeTab() {
  const { isRunning, getTimeDomainData, getCircularBufferSlice, getSampleRate } = useAudioEngine();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const [timebase, setTimebase] = useState(4);
  const [frozen, setFrozen] = useState(false);
  const frozenRef = useRef(false);
  const [frozenOffset, setFrozenOffset] = useState(0); // samples offset into frozen buffer
  const frozenBufferRef = useRef(null);

  // Cursors in seconds relative to display window
  const [cursorA, setCursorA] = useState(null); // seconds from left
  const [cursorB, setCursorB] = useState(null);
  const draggingRef = useRef(null); // 'A' | 'B' | null
  const [temperature, setTemperature] = useState(20);
  const speedOfSound = SPEED_OF_SOUND_BASE + 0.606 * temperature;

  // Delta display
  const deltaMs = cursorA !== null && cursorB !== null ? Math.abs(cursorB - cursorA) * 1000 : null;
  const deltaM = deltaMs !== null ? (deltaMs / 1000) * speedOfSound : null;

  useEffect(() => {
    frozenRef.current = frozen;
  }, [frozen]);

  const freezeBuffer = useCallback(() => {
    const sr = getSampleRate ? getSampleRate() : SAMPLE_RATE;
    const count = sr * 8;
    const slice = getCircularBufferSlice ? getCircularBufferSlice(count) : null;
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

  // Auto-marker: detect first and second transients above threshold
  const autoMark = useCallback(() => {
    const sr = getSampleRate ? getSampleRate() : SAMPLE_RATE;
    const windowSamples = timebase * sr;
    let samples;
    if (frozenRef.current && frozenBufferRef.current) {
      samples = frozenBufferRef.current.slice(0, windowSamples);
    } else {
      samples = getCircularBufferSlice ? getCircularBufferSlice(windowSamples) : null;
    }
    if (!samples) return;
    const threshold = 0.15;
    let firstPeak = null, secondPeak = null;
    let inPeak = false;
    let minGap = sr * 0.05; // 50ms gap between peaks
    let lastPeakIdx = -minGap;
    for (let i = 0; i < samples.length; i++) {
      if (Math.abs(samples[i]) > threshold) {
        if (!inPeak && (i - lastPeakIdx) > minGap) {
          inPeak = true;
          if (firstPeak === null) {
            firstPeak = i / sr;
          } else if (secondPeak === null) {
            secondPeak = i / sr;
            break;
          }
          lastPeakIdx = i;
        }
      } else {
        inPeak = false;
      }
    }
    if (firstPeak !== null) setCursorA(firstPeak);
    if (secondPeak !== null) setCursorB(secondPeak);
  }, [getCircularBufferSlice, getSampleRate, timebase]);

  // Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const sr = getSampleRate ? getSampleRate() : SAMPLE_RATE;
      const windowSamples = timebase * sr;

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      // Vertical grid lines (time divisions)
      const vDivs = timebase * 2;
      for (let i = 0; i <= vDivs; i++) {
        const x = (i / vDivs) * W;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        // Label
        const t = (i / vDivs) * timebase;
        ctx.fillStyle = '#333';
        ctx.font = '10px Share Tech Mono, monospace';
        ctx.fillText(t.toFixed(1) + 's', x + 2, H - 4);
      }
      // Horizontal center
      ctx.strokeStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      // Amplitude lines at ±0.5
      ['#111', '#111'].forEach((c, i) => {
        const y = i === 0 ? H * 0.25 : H * 0.75;
        ctx.strokeStyle = '#111';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Waveform
      let samples;
      if (frozenRef.current && frozenBufferRef.current) {
        const offset = frozenOffset * sr | 0;
        samples = frozenBufferRef.current.slice(offset, offset + windowSamples);
      } else if (isRunning) {
        samples = getCircularBufferSlice ? getCircularBufferSlice(windowSamples) : null;
      }

      if (samples && samples.length > 0) {
        ctx.beginPath();
        ctx.strokeStyle = '#aaff00';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#aaff00';
        ctx.shadowBlur = 4;
        const step = samples.length / W;
        for (let x = 0; x < W; x++) {
          const sIdx = Math.floor(x * step);
          const v = samples[sIdx] || 0;
          const y = H / 2 - v * (H / 2) * 0.9;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (!isRunning) {
        ctx.fillStyle = '#222';
        ctx.font = '14px Share Tech Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PRESS START TO BEGIN', W / 2, H / 2);
        ctx.textAlign = 'left';
      }

      // Cursor A (green)
      if (cursorA !== null) {
        const x = (cursorA / timebase) * W;
        ctx.strokeStyle = '#aaff00';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#aaff00';
        ctx.font = 'bold 11px Share Tech Mono, monospace';
        ctx.fillText('A', x + 4, 14);
      }

      // Cursor B (yellow)
      if (cursorB !== null) {
        const x = (cursorB / timebase) * W;
        ctx.strokeStyle = '#ffee00';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#ffee00';
        ctx.font = 'bold 11px Share Tech Mono, monospace';
        ctx.fillText('B', x + 4, 28);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning, timebase, frozen, frozenOffset, cursorA, cursorB, getCircularBufferSlice, getSampleRate]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      canvas.style.width = canvas.offsetWidth + 'px';
      canvas.style.height = canvas.offsetHeight + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Touch/mouse cursor dragging
  const getXFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) / rect.width;
  };

  const onPointerDown = (e) => {
    const ratio = getXFromEvent(e);
    const tSec = ratio * timebase;
    // Check proximity to existing cursors (within 0.04 of timebase)
    const thresh = 0.04 * timebase;
    if (cursorA !== null && Math.abs(cursorA - tSec) < thresh) {
      draggingRef.current = 'A';
    } else if (cursorB !== null && Math.abs(cursorB - tSec) < thresh) {
      draggingRef.current = 'B';
    } else {
      // Place next cursor
      if (cursorA === null) { setCursorA(tSec); draggingRef.current = 'A'; }
      else if (cursorB === null) { setCursorB(tSec); draggingRef.current = 'B'; }
      else { setCursorA(tSec); draggingRef.current = 'A'; }
    }
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    const ratio = getXFromEvent(e);
    const tSec = Math.max(0, Math.min(timebase, ratio * timebase));
    if (draggingRef.current === 'A') setCursorA(tSec);
    else setCursorB(tSec);
  };

  const onPointerUp = () => { draggingRef.current = null; };

  return (
    <div className="flex flex-col h-full" style={{ background: '#000' }}>
      {/* Controls bar */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0 flex-wrap" style={{ borderBottom: '1px solid #1a1a1a' }}>
        {/* Timebase */}
        <div className="flex items-center gap-1">
          {TIMEBASES.map(t => (
            <button
              key={t}
              onClick={() => setTimebase(t)}
              className={`font-mono-tech text-xs px-2 py-1 rounded border ${
                timebase === t
                  ? 'border-neon-green neon-green bg-green-900/20'
                  : 'border-gray-700 text-gray-500'
              }`}
            >
              {t}s
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Auto-mark */}
        <button
          onClick={autoMark}
          className="font-mono-tech text-xs px-3 py-1.5 rounded border border-yellow-600 text-yellow-500 hover:bg-yellow-900/20"
        >
          AUTO
        </button>

        {/* Clear cursors */}
        <button
          onClick={() => { setCursorA(null); setCursorB(null); }}
          className="font-mono-tech text-xs px-2 py-1.5 rounded border border-gray-700 text-gray-500"
        >
          CLR
        </button>

        {/* Freeze */}
        <button
          onClick={toggleFreeze}
          className={`font-mono-tech text-xs px-3 py-1.5 rounded border ${
            frozen
              ? 'border-red-500 text-red-400 bg-red-900/20'
              : 'border-gray-700 text-gray-500'
          }`}
        >
          {frozen ? '▶ LIVE' : '❚❚ FREEZE'}
        </button>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 relative overflow-hidden"
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
        style={{ cursor: 'crosshair' }}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Frozen scrub slider */}
      {frozen && (
        <div className="px-3 py-1 flex-shrink-0" style={{ borderTop: '1px solid #1a1a1a' }}>
          <input
            type="range"
            min={0}
            max={8 - timebase}
            step={0.1}
            value={frozenOffset}
            onChange={e => setFrozenOffset(parseFloat(e.target.value))}
            className="w-full accent-yellow-400"
          />
        </div>
      )}

      {/* Delta display */}
      <div className="flex items-center justify-around px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #1a1a1a', background: '#060606' }}>
        <div className="text-center">
          <div className="font-mono-tech text-xs text-gray-600 mb-0.5">CURSOR A</div>
          <div className="font-mono-tech text-sm neon-green">{cursorA !== null ? cursorA.toFixed(4) + ' s' : '---'}</div>
        </div>
        <div className="text-center">
          <div className="font-mono-tech text-xs text-gray-600 mb-0.5">Δ DELAY</div>
          <div className={`font-mono-tech text-2xl font-bold ${deltaMs !== null ? 'neon-yellow glow-yellow' : 'text-gray-700'}`}>
            {deltaMs !== null ? deltaMs.toFixed(2) + ' ms' : '--.-  ms'}
          </div>
          <div className="font-mono-tech text-xs text-gray-500">
            {deltaM !== null ? '≈ ' + deltaM.toFixed(2) + ' m' : ''}
          </div>
        </div>
        <div className="text-center">
          <div className="font-mono-tech text-xs text-gray-600 mb-0.5">CURSOR B</div>
          <div className="font-mono-tech text-sm neon-yellow">{cursorB !== null ? cursorB.toFixed(4) + ' s' : '---'}</div>
        </div>
      </div>

      {/* Instructions */}
      <div className="px-3 py-1 flex-shrink-0">
        <p className="font-mono-tech text-xs text-gray-700 text-center">TAP canvas to place cursor A → B • Drag to adjust</p>
      </div>
    </div>
  );
}