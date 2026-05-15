import React, { useState } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { Thermometer, Zap, Mic, Battery, Activity, Check, Download, Upload, Monitor } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, rtaCalibration, setRtaCalibration,
    invertPolarity, setInvertPolarity, inputDevices, selectedDevice, setSelectedDevice,
    batterySave, setBatterySave, playReferenceSignal, getFrequencyData, isRunning
  } = useAudioEngine();

  const [calibrating, setCalibrating] = useState(false);
  const [currentLvl, setCurrentLvl] = useState(0);

  const exportJSON = () => {
    const data = { splOffset, rtaCalibration, version: "1.0.3p", date: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'SonicAlign_Backup.json'; a.click();
  };

  const importJSON = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = JSON.parse(ev.target.result);
      if(data.splOffset) setSplOffset(data.splOffset);
      if(data.rtaCalibration) setRtaCalibration(data.rtaCalibration);
      alert("Configurações importadas!");
    };
    reader.readAsText(e.target.files[0]);
  };

  const startRtaCal = async () => {
    if(!isRunning) return alert("Ative o mic no RTA primeiro!");
    alert("Toque Ruído Rosa no monitor KRK agora.");
    setTimeout(() => {
        const data = getFrequencyData();
        setRtaCalibration(Array.from(data));
        alert("Curva de compensação capturada!");
    }, 5000);
  };

  return (
    <div className="flex flex-col h-full bg-black p-4 gap-4 font-mono text-xs overflow-y-auto pb-10 tabular-nums">
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-bold uppercase"><Mic size={14}/> Entrada</h3>
        <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded-md mb-2 outline-none">
          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
        </select>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950 flex gap-2">
        <button onClick={exportJSON} className="flex-1 p-3 bg-zinc-900 border border-zinc-700 rounded-md flex items-center justify-center gap-2 text-white font-bold"><Download size={14}/> EXPORTAR</button>
        <label className="flex-1 p-3 bg-zinc-900 border border-zinc-700 rounded-md flex items-center justify-center gap-2 text-white font-bold cursor-pointer"><Upload size={14}/> IMPORTAR <input type="file" onChange={importJSON} className="hidden"/></label>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-bold uppercase"><Monitor size={14}/> Calibração RTA (KRK)</h3>
        <button onClick={startRtaCal} className="w-full p-4 border border-neon-blue text-neon-blue bg-blue-900/10 rounded-lg font-black">AFERIR POR MONITOR</button>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-yellow mb-4 flex items-center gap-2 font-bold uppercase"><Battery size={14}/> Economia de Energia</h3>
        <button onClick={() => setBatterySave(!batterySave)} className={`w-full p-4 rounded-lg border-2 flex items-center justify-between ${batterySave ? 'border-neon-yellow text-neon-yellow bg-neon-yellow/5' : 'border-zinc-800 text-zinc-600'}`}>
          <span className="font-bold uppercase">Auto-Stop (2 min)</span><span className="font-black">{batterySave ? 'ON' : 'OFF'}</span>
        </button>
      </section>
    </div>
  );
}
