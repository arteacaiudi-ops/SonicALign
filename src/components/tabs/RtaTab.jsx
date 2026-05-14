import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';

// ISO 1/3-octave center frequencies (20Hz - 20kHz)
const ONE_THIRD_OCTAVE_CENTERS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];

const AVERAGING_MODES = ['FAST', 'SLOW', 'PEAK'];
const SAMPLE_RATE = 48000;
const FFT_SIZE = 4096;

function freqToFFTBin(freq, sampleRate, fftSize) {
  return Math.round((freq * fftSize) / sampleRate);
}

// House curve: +6dB at bass, rolls off highs
function houseCurveDb(freq) {
  if (freq < 100) return 6;
  if (freq < 1000) return 6 - 6 * (Math.log10(freq) - Math.log10(100)) / (Math.log10(1000) - Math.log10(100));
  if (freq < 10000) return 0;
  return -6 * (Math.log10(freq) - Math.log10(10000)) / (Math.log10(20000) - Math.log10(10000));
}

export default function RtaTab() {
  const { isRunning, getFrequencyData, micCalibration } = useAudioEngine();
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const [averaging, setAveraging] = useState('FAST');
  const [showHouseCurve, setShowHouseCurve] = useState(false);
  const [snapshotL, setSnapshotL] = useState(null); // frozen dB array per band
  const smoothedRef = useRef(new Array(ONE_THIRD_OCTAVE_CENTERS.length).fill(-90));
  const peakRef = useRef(new Array(ONE_THIRD_OCTAVE_CENTERS.length).fill(-90));

  const averagingAlpha = averaging === 'FAST' ? 0.5 : 0.05;

  const getBandDb = useCallback((freqData, freq) => {
    if (!freqData) return -90;
    const loBin = freqToFFTBin(freq / Math.pow(2, 1 / 6), SAMPLE_RATE, FFT_SIZE);
    const hiBin = freqToFFTBin(freq * Math.pow(2, 1 / 6), SAMPLE_RATE, FFT_SIZE);
    let sum = 0, count = 0;
    for (let b = Math.max(0, loBin); b <= Math.min(freqData.length - 1, hiBin); b++) {
      sum += freqData[b];
      count++;
    }
    return count > 0 ? sum / count : -90;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (canvas.width !== W * devicePixelRatio || canvas.height !== H * devicePixelRatio) {
        canvas.width = W * devicePixelRatio;
        canvas.height = H * devicePixelRatio;
        const c = canvas.getContext('2d');
        c.scale(devicePixelRatio, devicePixelRatio);
      }
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      const freqData = getFrequencyData ? getFrequencyData() : null;
      const bands = ONE_THIRD_OCTAVE_CENTERS;
      const N = bands.length;
      const barW = Math.floor((W - 20) / N) - 1;
      const padLeft = 32;
      const padBottom = 28;
      const graphH = H - padBottom - 10;
      const MIN_DB = -80, MAX_DB = 0;
      const dbRange = MAX_DB - MIN_DB;

      // dB grid lines
      for (let db = MIN_DB; db <= MAX_DB; db += 10) {
        const y = graphH - ((db - MIN_DB) / dbRange) * graphH + 10;
        ctx.strokeStyle = db === 0 ? '#2a2a2a' : '#151515';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.font = '9px Share Tech Mono, monospace';
        ctx.fillText(db + 'dB', 0, y + 3);
      }

      const liveDb = [];
      for (let i = 0; i < N; i++) {
        let rawDb = getBandDb(freqData, bands[i]);
        // Apply mic calibration
        if (micCalibration && micCalibration[i] !== undefined) rawDb += micCalibration[i];
        if (!isRunning) rawDb = -90;

        // Smooth
        if (averaging === 'PEAK') {
          if (rawDb > peakRef.current[i]) peakRef.current[i] = rawDb;
          else peakRef.current[i] += (rawDb - peakRef.current[i]) * 0.001;
          smoothedRef.current[i] = peakRef.current[i];
        } else {
          smoothedRef.current[i] += (rawDb - smoothedRef.current[i]) * averagingAlpha;
        }
        liveDb.push(smoothedRef.current[i]);
      }

      // Draw snapshot L (blue)
      if (snapshotL) {
        for (let i = 0; i < N; i++) {
          const db = Math.max(MIN_DB, Math.min(MAX_DB, snapshotL[i]));
          const barH = ((db - MIN_DB) / dbRange) * graphH;
          const x = padLeft + i * (barW + 1);
          const y = graphH + 10 - barH;
          ctx.fillStyle = 'rgba(0, 200, 255, 0.4)';
          ctx.fillRect(x, y, barW, barH);
        }
        // Snapshot line
        ctx.beginPath();
        ctx.strokeStyle = '#00c8ff';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < N; i++) {
          const db = Math.max(MIN_DB, Math.min(MAX_DB, snapshotL[i]));
          const barH = ((db - MIN_DB) / dbRange) * graphH;
          const x = padLeft + i * (barW + 1) + barW / 2;
          const y = graphH + 10 - barH;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw live bars (green / yellow warning)
      for (let i = 0; i < N; i++) {
        const db = Math.max(MIN_DB, Math.min(MAX_DB, liveDb[i]));
        const barH = ((db - MIN_DB) / dbRange) * graphH;
        const x = padLeft + i * (barW + 1);
        const y = graphH + 10 - barH;
        const hot = db > -6;
        ctx.fillStyle = hot ? 'rgba(255,50,50,0.85)' : 'rgba(170,255,0,0.75)';
        ctx.fillRect(x, y, barW, barH);
        // Peak dot
        if (averaging === 'PEAK') {
          ctx.fillStyle = '#fff';
          ctx.fillRect(x, y, barW, 2);
        }
      }

      // Frequency labels
      ctx.fillStyle = '#444';
      ctx.font = '8px Share Tech Mono, monospace';
      const labelFreqs = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      for (let i = 0; i < N; i++) {
        if (labelFreqs.includes(Math.round(bands[i]))) {
          const x = padLeft + i * (barW + 1);
          const label = bands[i] >= 1000 ? (bands[i] / 1000).toFixed(bands[i] >= 10000 ? 0 : 1) + 'k' : bands[i].toString();
          ctx.fillText(label, x, H - 6);
        }
      }

      // House curve overlay
      if (showHouseCurve) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,140,0,0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        for (let i = 0; i < N; i++) {
          const db = Math.max(MIN_DB, Math.min(MAX_DB, houseCurveDb(bands[i])));
          const barH = ((db - MIN_DB) / dbRange) * graphH;
          const x = padLeft + i * (barW + 1) + barW / 2;
          const y = graphH + 10 - barH;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isRunning, averaging, showHouseCurve, snapshotL, getBandDb, getFrequencyData, micCalibration]);

  const takeSnapshot = () => {
    setSnapshotL([...smoothedRef.current]);
  };
  const clearSnapshot = () => setSnapshotL(null);

  return (
    <div className="flex flex-col h-full" style={{ background: '#000' }}>
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0 flex-wrap" style={{ borderBottom: '1px solid #1a1a1a' }}>
        {AVERAGING_MODES.map(m => (
          <button
            key={m}
            onClick={() => setAveraging(m)}
            className={`font-mono-tech text-xs px-2.5 py-1.5 rounded border ${
              averaging === m ? 'border-neon-green neon-green bg-green-900/20' : 'border-gray-700 text-gray-500'
            }`}
          >
            {m}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setShowHouseCurve(h => !h)}
          className={`font-mono-tech text-xs px-2.5 py-1.5 rounded border ${
            showHouseCurve ? 'border-orange-500 text-orange-400 bg-orange-900/20' : 'border-gray-700 text-gray-500'
          }`}
        >
          HOUSE
        </button>
        {snapshotL ? (
          <button onClick={clearSnapshot} className="font-mono-tech text-xs px-2.5 py-1.5 rounded border border-blue-500 text-blue-400 bg-blue-900/20">
            CLR SNAP
          </button>
        ) : (
          <button onClick={takeSnapshot} className="font-mono-tech text-xs px-2.5 py-1.5 rounded border border-blue-600 text-blue-500">
            SNAP L
          </button>
        )}
      </div>

      {/* Legend */}
      {snapshotL && (
        <div className="flex gap-4 px-3 py-1 flex-shrink-0">
          <span className="font-mono-tech text-xs" style={{ color: '#00c8ff' }}>── SNAPSHOT</span>
          <span className="font-mono-tech text-xs neon-green">── LIVE</span>
          {showHouseCurve && <span className="font-mono-tech text-xs text-orange-400">- - HOUSE CURVE</span>}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Status bar */}
      <div className="px-3 py-2 flex-shrink-0 flex items-center justify-between" style={{ borderTop: '1px solid #1a1a1a' }}>
        <span className="font-mono-tech text-xs text-gray-600">1/3 OCT ISO • 31 BANDS</span>
        <span className={`font-mono-tech text-xs ${isRunning ? 'neon-green' : 'text-gray-600'}`}>
          {isRunning ? '● LIVE' : '○ STOPPED'}
        </span>
      </div>
    </div>
  );
}