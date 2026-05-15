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
  const { inputGain, setInputGain } = useAudioEngine();

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
        <div className="flex flex-col border-b border-zinc-900 bg-zinc-950 p-3 gap-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-black text-xs neon-green italic tracking-tighter uppercase">SonicAlign Pro</span>
              <span className="text-[8px] text-zinc-600 font-mono tracking-[0.2em]">ENGINE v{APP_VERSION}</span>
            </div>
            <div className="flex items-center gap-2 bg-black px-3 py-1 rounded-full border border-zinc-800">
               <span className="text-[8px] text-zinc-500 font-bold uppercase">Tab Mode:</span>
               <span className="text-[9px] text-neon-blue font-black uppercase tracking-widest">{activeTab}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/60 p-3 rounded-xl border border-zinc-800">
            <button onClick={() => setInputGain(Math.max(0.1, inputGain - 0.1))} className="p-3 bg-zinc-900 rounded-lg text-zinc-400 active:bg-neon-green"><Minus size={20}/></button>
            <div className="flex-1 flex flex-col px-2">
              <input type="range" min="0.1" max="10" step="0.1" value={inputGain} onChange={(e) => setInputGain(parseFloat(e.target.value))} className="w-full h-6 bg-zinc-800 rounded-full accent-neon-green appearance-none" />
              <div className="flex justify-between mt-1"><span className="text-[9px] text-zinc-500 font-bold">GANHO</span><span className="text-[10px] text-neon-green font-black">{inputGain.toFixed(1)}x</span></div>
            </div>
            <button onClick={() => setInputGain(Math.min(10, inputGain + 0.1))} className="p-3 bg-zinc-900 rounded-lg text-zinc-400 active:bg-neon-green"><Plus size={20}/></button>
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
  return (<AudioEngineProvider><AppShell /></AudioEngineProvider>);
}
