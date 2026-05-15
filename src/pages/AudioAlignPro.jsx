import React, { useState } from 'react';
import { AudioEngineProvider, useAudioEngine } from '@/components/audio/AudioEngine';
import { APP_VERSION } from '@/lib/app-params';
import TimeTab from '@/components/tabs/TimeTab';
import RtaTab from '@/components/tabs/RtaTab';
import GenTab from '@/components/tabs/GenTab';
import SettingsTab from '@/components/tabs/SettingsTab';
import { Waves, BarChart2, Radio, Settings } from 'lucide-react';

const TABS = [
  { id: 'time', label: 'TIME', icon: Waves },
  { id: 'rta', label: 'RTA', icon: BarChart2 },
  { id: 'gen', label: 'GEN', icon: Radio },
  { id: 'set', label: 'SET', icon: Settings },
];

function AppShell() {
  const [activeTab, setActiveTab] = useState('time');
  const { isRunning, isStarting, error, start, stop, selectedDevice } = useAudioEngine();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#000' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <div>
          <span className="font-mono-tech text-sm neon-green glow-green tracking-widest">AUDIO-ALIGN</span>
          <span className="font-mono-tech text-sm text-gray-600 ml-1">PRO</span>
          <span className="text-xs font-mono opacity-50 ml-2">v{APP_VERSION}</span>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-red-400 font-mono-tech">{error}</span>
          )}
          <button
            onClick={() => isRunning ? stop() : start(selectedDevice)}
            disabled={isStarting}
            className={`font-mono-tech text-xs px-3 py-1.5 rounded border transition-all ${
              isRunning
                ? 'border-red-500 text-red-400 hover:bg-red-900/20'
                : 'border-neon-green neon-green hover:bg-green-900/20'
            } ${isStarting ? 'opacity-50' : ''}`}
          >
            {isStarting ? 'INIT...' : isRunning ? '■ STOP' : '▶ START'}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden relative">
        <div className={activeTab === 'time' ? 'block h-full' : 'hidden'}>
          <TimeTab />
        </div>
        <div className={activeTab === 'rta' ? 'block h-full' : 'hidden'}>
          <RtaTab />
        </div>
        <div className={activeTab === 'gen' ? 'block h-full' : 'hidden'}>
          <GenTab />
        </div>
        <div className={activeTab === 'set' ? 'block h-full' : 'hidden'}>
          <SettingsTab />
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex-shrink-0 flex" style={{ borderTop: '1px solid #1a1a1a', background: '#050505' }}>
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all"
              style={{
                color: active ? 'var(--neon-green)' : '#444',
                borderTop: active ? '2px solid var(--neon-green)' : '2px solid transparent',
                background: active ? 'rgba(170,255,0,0.04)' : 'transparent',
              }}
            >
              <Icon size={20} strokeWidth={active ? 2 : 1.5} />
              <span className="font-mono-tech text-xs tracking-widest">{label}</span>
            </button>
          );
        })}
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
