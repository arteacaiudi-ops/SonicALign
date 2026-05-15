import React, { useState } from 'react';
import { AudioEngineProvider, useAudioEngine } from '@/components/audio/AudioEngine';
import { APP_VERSION } from '@/lib/app-params';
import TimeTab from '@/components/tabs/TimeTab';
import RtaTab from '@/components/tabs/RtaTab';
import GenTab from '@/components/tabs/GenTab';
import AmbienceTab from '@/components/tabs/AmbienceTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import { Waves, BarChart2, Radio, Settings, Mic2, Slider } from 'lucide-react';

function AppShell() {
  const [activeTab, setActiveTab] = useState('time');
  const { isRunning, start, stop, inputGain, setInputGain } = useAudioEngine();

  const TABS = [
    { id: 'time', label: 'TIME', icon: Waves },
    { id: 'rta', label: 'RTA', icon: BarChart2 },
    { id: 'amb', label: 'AMBIENCE', icon: Mic2 },
    { id: 'gen', label: 'GEN', icon: Radio },
    { id: 'set', label: 'SET', icon: Settings },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden lg:flex-row">
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header com Ajuste de Ganho */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-zinc-950">
          <div className="flex flex-col">
            <span className="font-bold text-xs neon-green">AUDIO-ALIGN PRO</span>
            <span className="text-[8px] text-zinc-600 font-mono">v{APP_VERSION}</span>
          </div>

          <div className="flex items-center gap-4 flex-1 justify-center max-w-xs mx-4">
            <span className="text-[9px] text-zinc-500 font-bold">GAIN</span>
            <input 
              type="range" min="0.1" max="5" step="0.1" 
              value={inputGain} 
              onChange={(e) => setInputGain(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg accent-neon-green"
            />
            <span className="text-[9px] text-neon-green font-mono w-6">{inputGain.toFixed(1)}</span>
          </div>

          <button 
            onClick={() => isRunning ? stop() : start()} 
            className={`px-4 py-2 rounded-md text-[10px] font-bold transition-all border ${isRunning ? 'border-red-500 text-red-500 bg-red-500/10' : 'border-neon-green text-neon-green hover:bg-green-500/10'}`}
          >
            {isRunning ? '■ PARAR' : '▶ ANALISAR'}
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'time' && <TimeTab />}
          {activeTab === 'rta' && <RtaTab />}
          {activeTab === 'amb' && <AmbienceTab />}
          {activeTab === 'gen' && <GenTab />}
          {activeTab === 'set' && <SettingsTab />}
        </div>

        {/* Nav */}
        <div className="flex border-t border-zinc-900 bg-black pb-safe">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'text-neon-green bg-zinc-900/50' : 'text-zinc-600'}`}>
              <tab.icon size={20} />
              <span className="text-[8px] font-black tracking-tighter">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AudioAlignPro() {
  return (
    <AudioEngineProvider>
      <AppShell />
    </AudioEngineProvider>
  );
}
