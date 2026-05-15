import React, { useState } from 'react';
import { AudioEngineProvider, useAudioEngine } from '@/components/audio/AudioEngine';
import { APP_VERSION } from '@/lib/app-params';
import TimeTab from '@/components/tabs/TimeTab';
import RtaTab from '@/components/tabs/RtaTab';
import GenTab from '@/components/tabs/GenTab';
import AmbienceTab from '@/components/tabs/AmbienceTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import { Waves, BarChart2, Radio, Settings, Mic2 } from 'lucide-react';

const TABS = [
  { id: 'time', label: 'TIME', icon: Waves },
  { id: 'rta', label: 'RTA', icon: BarChart2 },
  { id: 'amb', label: 'AMBIENCE', icon: Mic2 },
  { id: 'gen', label: 'GEN', icon: Radio },
  { id: 'set', label: 'SET', icon: Settings },
];

function AppShell() {
  const [activeTab, setActiveTab] = useState('time');
  const { isRunning, isStarting, error, start, stop, selectedDevice } = useAudioEngine();

  return (
    <div className="flex flex-col h-screen w-screen bg-black overflow-hidden lg:flex-row">
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-900 bg-black">
          <div>
            <span className="font-mono-tech text-sm neon-green glow-green">AUDIO-ALIGN</span>
            <span className="text-xs font-mono opacity-50 ml-2 text-gray-500">v{APP_VERSION}</span>
          </div>
          <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`px-4 py-1.5 rounded border text-xs font-mono ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-green neon-green'}`}>
            {isRunning ? '■ STOP' : '▶ START'}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          {activeTab === 'time' && <TimeTab />}
          {activeTab === 'rta' && <RtaTab />}
          {activeTab === 'amb' && <AmbienceTab />}
          {activeTab === 'gen' && <GenTab />}
          {activeTab === 'set' && <SettingsTab />}
        </div>

        {/* Nav */}
        <div className="flex border-t border-gray-900 bg-zinc-950">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 py-3 flex flex-col items-center gap-1 ${activeTab === tab.id ? 'neon-green border-t-2 border-neon-green bg-green-950/10' : 'text-gray-600 border-t-2 border-transparent'}`}>
              <tab.icon size={18} />
              <span className="text-[9px] font-bold">{tab.label}</span>
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