import React, { useRef, useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';

const SAMPLE_RATE = 48000;
const WAV_DURATION = 30; // seconds

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

function generatePinkNoise(numSamples) {
  const samples = new Float32Array(numSamples);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < numSamples; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    samples[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) / 8;
    b6 = white * 0.115926;
  }
  return samples;
}

function generatePolarityPulse(numSamples, sampleRate) {
  const samples = new Float32Array(numSamples);
  const pulseWidthSamples = Math.round(sampleRate * 0.001); // 1ms
  const periodSamples = sampleRate; // 1000ms
  for (let i = 0; i < numSamples; i++) {
    const posInPeriod = i % periodSamples;
    samples[i] = posInPeriod < pulseWidthSamples ? 0.9 : 0;
  }
  return samples;
}

export default function GenTab() {
  const { audioCtxRef, isRunning } = useAudioEngine();
  const [activeSignal, setActiveSignal] = useState(null); // 'pink' | 'pulse' | null
  const [isExporting, setIsExporting] = useState(null);
  const sourceNodeRef = useRef(null);
  const gainNodeRef = useRef(null);
  const [volume, setVolume] = useState(0.7);
  const volumeRef = useRef(0.7);

  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const stopSignal = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    setActiveSignal(null);
  };

  const playSignal = (type) => {
    if (activeSignal === type) { stopSignal(); return; }
    stopSignal();

    const ctx = audioCtxRef.current;
    if (!ctx) {
      alert('Please START audio engine first');
      return;
    }

    const sr = ctx.sampleRate;
    let samples;
    if (type === 'pink') {
      samples = generatePinkNoise(sr * 10);
    } else {
      samples = generatePolarityPulse(sr * 10, sr);
    }

    const buffer = ctx.createBuffer(1, samples.length, sr);
    buffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = volumeRef.current;
    gainNodeRef.current = gain;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    sourceNodeRef.current = source;
    setActiveSignal(type);
  };

  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volume;
  }, [volume]);

  // Stop on unmount or engine stop
  useEffect(() => {
    if (!isRunning) stopSignal();
  }, [isRunning]);

  useEffect(() => () => stopSignal(), []);

  const exportWAV = async (type) => {
    setIsExporting(type);
    await new Promise(r => setTimeout(r, 50));

    const sr = SAMPLE_RATE;
    const numSamples = sr * WAV_DURATION;
    let samples;
    if (type === 'pink') {
      samples = generatePinkNoise(numSamples);
    } else {
      samples = generatePolarityPulse(numSamples, sr);
    }

    const wavBuffer = encodeWAV(samples, sr);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const filename = type === 'pink' ? 'pink-noise-30s.wav' : 'polarity-pulse-30s.wav';

    // Try native share
    if (navigator.share) {
      const file = new File([blob], filename, { type: 'audio/wav' });
      try {
        await navigator.share({ files: [file], title: filename });
      } catch {
        // Fallback download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
      }
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }

    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setIsExporting(null);
  };

  return (
    <div className="flex flex-col h-full p-4 gap-4" style={{ background: '#000' }}>
      <div>
        <p className="font-mono-tech text-xs text-gray-600 mb-3 tracking-widest">SIGNAL GENERATOR</p>

        {/* Pink Noise */}
        <div className="panel p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-mono-tech text-sm neon-green">PINK NOISE</div>
              <div className="font-mono-tech text-xs text-gray-600">Flat spectrum reference (-3dB/oct)</div>
            </div>
            <button
              onClick={() => playSignal('pink')}
              className={`font-mono-tech text-sm px-4 py-2 rounded border transition-all ${
                activeSignal === 'pink'
                  ? 'border-red-500 text-red-400 bg-red-900/20'
                  : 'border-neon-green neon-green hover:bg-green-900/20'
              }`}
            >
              {activeSignal === 'pink' ? '■ STOP' : '▶ PLAY'}
            </button>
          </div>
          <button
            onClick={() => exportWAV('pink')}
            disabled={isExporting === 'pink'}
            className="w-full font-mono-tech text-xs py-2 rounded border border-gray-700 text-gray-400 hover:border-gray-500 flex items-center justify-center gap-2"
          >
            {isExporting === 'pink' ? '⏳ GENERATING...' : '↓ EXPORT 30s WAV'}
          </button>
        </div>

        {/* Polarity Pulse */}
        <div className="panel p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-mono-tech text-sm neon-yellow">POLARITY PULSE</div>
              <div className="font-mono-tech text-xs text-gray-600">1ms positive pulse @ 1 Hz</div>
            </div>
            <button
              onClick={() => playSignal('pulse')}
              className={`font-mono-tech text-sm px-4 py-2 rounded border transition-all ${
                activeSignal === 'pulse'
                  ? 'border-red-500 text-red-400 bg-red-900/20'
                  : 'border-yellow-500 text-yellow-400 hover:bg-yellow-900/20'
              }`}
            >
              {activeSignal === 'pulse' ? '■ STOP' : '▶ PLAY'}
            </button>
          </div>
          <button
            onClick={() => exportWAV('pulse')}
            disabled={isExporting === 'pulse'}
            className="w-full font-mono-tech text-xs py-2 rounded border border-gray-700 text-gray-400 hover:border-gray-500 flex items-center justify-center gap-2"
          >
            {isExporting === 'pulse' ? '⏳ GENERATING...' : '↓ EXPORT 30s WAV'}
          </button>
        </div>

        {/* Volume */}
        {activeSignal && (
          <div className="panel p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono-tech text-xs text-gray-500">OUTPUT VOLUME</span>
              <span className="font-mono-tech text-xs neon-green">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={e => setVolume(parseFloat(e.target.value))}
              className="w-full accent-green-400"
            />
          </div>
        )}
      </div>

      {/* Status */}
      <div className="mt-auto panel p-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${activeSignal ? 'bg-red-500 animate-pulse' : 'bg-gray-700'}`} />
          <span className="font-mono-tech text-xs text-gray-500">
            {activeSignal ? `TRANSMITTING: ${activeSignal.toUpperCase()}` : 'NO SIGNAL OUTPUT'}
          </span>
        </div>
        {!isRunning && (
          <p className="font-mono-tech text-xs text-yellow-600 mt-2">⚠ Start audio engine to use playback</p>
        )}
      </div>
    </div>
  );
}