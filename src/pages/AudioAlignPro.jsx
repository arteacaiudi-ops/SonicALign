import React, { useState } from 'react';
import { AudioEngineProvider, useAudioEngine } from '@/components/audio/AudioEngine';
import { APP_VERSION } from '@/lib/app-params';
import TimeTab from '@/components/tabs/TimeTab';
import RtaTab from '@/components/tabs/RtaTab';
import GenTab from '@/components/tabs/GenTab';
import AmbienceTab from '@/components/tabs/AmbienceTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import { Waves, BarChart2, Radio, Settings, Mic2, Plus, Minus } from 'lucide-react';

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
        {/* Header Ergonômico v1.0.3a */}
        <div className="flex flex-col border-b border-zinc-900 bg-zinc-950 p-2 gap-2">
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col">
              <span className="font-black text-[10px] neon-green italic">SONICALIGN PRO</span>
              <span className="text-[8px] text-zinc-600 font-mono tracking-tighter">ENGINE v{APP_VERSION}</span>
            </div>
            <button 
              onClick={() => isRunning ? stop() : start()} 
              className={`px-6 py-2 rounded border-2 font-black text-xs transition-all ${isRunning ? 'border-red-500 text-red-500 bg-red-900/10' : 'border-neon-green text-neon-green shadow-[0_0_10px_rgba(0,255,0,0.2)]'}`}
            >
              {isRunning ? '■ PARAR' : '▶ ANALISAR'}
            </button>
          </div>

          {/* Slider de Ganho Grande para Celular */}
          <div className="flex items-center gap-3 bg-black/40 p-2 rounded-lg border border-zinc-900/50">
            <button onClick={() => setInputGain(Math.max(0.1, inputGain - 0.1))} className="p-2 text-zinc-500"><Minus size={16}/></button>
            <div className="flex-1 flex flex-col gap-1">
              <input 
                type="range" min="0.1" max="10" step="0.1" 
                value={inputGain} 
                onChange={(e) => setInputGain(parseFloat(e.target.value))}
                className="w-full h-4 bg-zinc-800 rounded-full accent-neon-green"
              />
              <div className="flex justify-between text-[8px] text-zinc-600 font-bold uppercase">
                <span>Ganho de Entrada</span>
                <span className="text-neon-green">{inputGain.toFixed(1)}x</span>
              </div>
            </div>
            <button onClick={() => setInputGain(Math.min(10, inputGain + 0.1))} className="p-2 text-zinc-500"><Plus size={16}/></button>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'time' && <TimeTab />}
          {activeTab === 'rta' && <RtaTab />}
          {activeTab === 'amb' && <AmbienceTab />}
          {activeTab === 'gen' && <GenTab />}
          {activeTab === 'set' && <SettingsTab />}
        </div>

        <div className="flex border-t border-zinc-900 bg-black">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'text-neon-green bg-zinc-900/50' : 'text-zinc-600'}`}>
              <tab.icon size={22} />
              <span className="text-[8px] font-black">{tab.label}</span>
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
