import React, { useState, useRef, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';

const SAMPLE_RATE = 48000;
const FFT_SIZE = 4096;
const ONE_THIRD_OCTAVE_CENTERS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
  200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
  2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];

function freqToFFTBin(freq, sampleRate, fftSize) {
  return Math.round((freq * fftSize) / sampleRate);
}

export default function SettingsTab() {
  const {
    isRunning, start, stop,
    inputDevices, selectedDevice, setSelectedDevice,
    micCalibration, setMicCalibration,
    getFrequencyData,
  } = useAudioEngine();

  const [temperature, setTemperature] = useState(20);
  const speedOfSound = (331.3 + 0.606 * temperature).toFixed(1);

  // Cal state
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calProgress, setCalProgress] = useState(0);
  const calRef = useRef(null);
  const calAccumRef = useRef([]);
  const calCountRef = useRef(0);
  const CAL_FRAMES = 200; // ~3s at 60fps

  const startCalibration = () => {
    if (!isRunning) { alert('Start audio engine first'); return; }
    calAccumRef.current = ONE_THIRD_OCTAVE_CENTERS.map(() => []);
    calCountRef.current = 0;
    setCalProgress(0);
    setIsCalibrating(true);
  };

  useEffect(() => {
    if (!isCalibrating) return;

    const tick = () => {
      const freqData = getFrequencyData ? getFrequencyData() : null;
      if (!freqData) return;

      for (let i = 0; i < ONE_THIRD_OCTAVE_CENTERS.length; i++) {
        const freq = ONE_THIRD_OCTAVE_CENTERS[i];
        const loBin = freqToFFTBin(freq / Math.pow(2, 1 / 6), SAMPLE_RATE, FFT_SIZE);
        const hiBin = freqToFFTBin(freq * Math.pow(2, 1 / 6), SAMPLE_RATE, FFT_SIZE);
        let sum = 0, count = 0;
        for (let b = Math.max(0, loBin); b <= Math.min(freqData.length - 1, hiBin); b++) {
          sum += freqData[b]; count++;
        }
        const db = count > 0 ? sum / count : -90;
        calAccumRef.current[i].push(db);
      }

      calCountRef.current++;
      setCalProgress(calCountRef.current / CAL_FRAMES);

      if (calCountRef.current >= CAL_FRAMES) {
        // Compute average per band
        const measured = calAccumRef.current.map(arr => arr.reduce((a, b) => a + b, 0) / arr.length);
        // Flat reference: -20dB across all bands (assume ideal pink noise ref)
        const REF_DB = -20;
        const offsets = measured.map(db => REF_DB - db);
        setMicCalibration(offsets);
        setIsCalibrating(false);
      } else {
        calRef.current = requestAnimationFrame(tick);
      }
    };

    calRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(calRef.current);
  }, [isCalibrating, getFrequencyData, setMicCalibration]);

  const clearCalibration = () => setMicCalibration(null);

  return (
    <div className="flex flex-col h-full overflow-y-auto" style={{ background: '#000' }}>
      <div className="p-4 space-y-4">

        {/* Temperature / Speed of sound */}
        <div className="panel p-4">
          <div className="font-mono-tech text-xs text-gray-600 mb-3 tracking-widest">ACOUSTICS</div>
          <div className="flex items-center gap-3 mb-2">
            <label className="font-mono-tech text-sm text-gray-400 w-32">TEMPERATURE</label>
            <input
              type="number"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value) || 20)}
              className="font-mono-tech text-sm w-20 text-center rounded border border-gray-700 bg-gray-950 neon-green py-1.5"
              min={-20}
              max={50}
            />
            <span className="font-mono-tech text-sm text-gray-600">°C</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-mono-tech text-xs text-gray-600">SPEED OF SOUND:</span>
            <span className="font-mono-tech text-sm neon-yellow glow-yellow">{speedOfSound} m/s</span>
          </div>
          <div className="font-mono-tech text-xs text-gray-700 mt-1">v = 331.3 + 0.606 × T</div>
        </div>

        {/* Input selector */}
        <div className="panel p-4">
          <div className="font-mono-tech text-xs text-gray-600 mb-3 tracking-widest">INPUT SOURCE</div>
          {inputDevices.length === 0 ? (
            <p className="font-mono-tech text-xs text-gray-600">Start engine to detect devices</p>
          ) : (
            <div className="space-y-2">
              {inputDevices.map(dev => (
                <button
                  key={dev.deviceId}
                  onClick={() => {
                    setSelectedDevice(dev.deviceId);
                    if (isRunning) { stop(); setTimeout(() => start(dev.deviceId), 200); }
                  }}
                  className={`w-full text-left font-mono-tech text-xs px-3 py-2.5 rounded border transition-all ${
                    selectedDevice === dev.deviceId || (selectedDevice === 'default' && dev.deviceId === 'default')
                      ? 'border-neon-green neon-green bg-green-900/10'
                      : 'border-gray-800 text-gray-500'
                  }`}
                >
                  {dev.label || `Input ${dev.deviceId.slice(0, 8)}...`}
                </button>
              ))}
            </div>
          )}
          <p className="font-mono-tech text-xs text-gray-700 mt-2">
            * USB audio interfaces detected automatically
          </p>
        </div>

        {/* Mic Calibration */}
        <div className="panel p-4">
          <div className="font-mono-tech text-xs text-gray-600 mb-3 tracking-widest">MIC CALIBRATION</div>
          <p className="font-mono-tech text-xs text-gray-500 mb-3 leading-relaxed">
            Play Pink Noise from a flat reference speaker (e.g. KRK Rokit 6) at your typical listening position.
            The app will measure the mic's frequency response and generate a compensation profile.
          </p>

          {isCalibrating ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono-tech text-xs text-yellow-400 animate-pulse">MEASURING...</span>
                <span className="font-mono-tech text-xs text-gray-500">{Math.round(calProgress * 100)}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-900 overflow-hidden">
                <div
                  className="h-full bg-neon-green rounded-full transition-all"
                  style={{ width: `${calProgress * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={startCalibration}
                disabled={!isRunning}
                className={`flex-1 font-mono-tech text-sm py-2.5 rounded border ${
                  isRunning
                    ? 'border-neon-green neon-green hover:bg-green-900/20'
                    : 'border-gray-800 text-gray-700 cursor-not-allowed'
                }`}
              >
                {micCalibration ? '↺ RECALIBRATE' : 'START CAL'}
              </button>
              {micCalibration && (
                <button
                  onClick={clearCalibration}
                  className="font-mono-tech text-sm py-2.5 px-4 rounded border border-red-800 text-red-500 hover:bg-red-900/20"
                >
                  CLEAR
                </button>
              )}
            </div>
          )}

          {micCalibration && !isCalibrating && (
            <div className="mt-3 p-2 rounded bg-green-950/30 border border-green-900/40">
              <p className="font-mono-tech text-xs neon-green">✓ Calibration profile active ({micCalibration.length} bands)</p>
              <p className="font-mono-tech text-xs text-gray-600 mt-1">
                Max offset: ±{Math.max(...micCalibration.map(Math.abs)).toFixed(1)} dB
              </p>
            </div>
          )}
        </div>

        {/* About */}
        <div className="panel p-4">
          <div className="font-mono-tech text-xs text-gray-600 mb-2 tracking-widest">SYSTEM INFO</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="font-mono-tech text-xs text-gray-600">VERSION</span>
              <span className="font-mono-tech text-xs text-gray-400">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono-tech text-xs text-gray-600">ENGINE</span>
              <span className="font-mono-tech text-xs neon-green">Web Audio API</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono-tech text-xs text-gray-600">SAMPLE RATE</span>
              <span className="font-mono-tech text-xs text-gray-400">48000 Hz</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono-tech text-xs text-gray-600">FFT SIZE</span>
              <span className="font-mono-tech text-xs text-gray-400">4096</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono-tech text-xs text-gray-600">BUFFER</span>
              <span className="font-mono-tech text-xs text-gray-400">8s circular</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}