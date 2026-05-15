import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { ISO_31_BANDS } from '@/lib/app-params';
import { Settings2, Mic, Activity, CheckCircle, Download, Upload, Thermometer, Zap, Battery, Sliders } from 'lucide-react';

export default function SettingsTab() {
  const { 
    splOffset, setSplOffset, rtaComp, setRtaComp, isRunning, get31BandData, 
    playReferenceSignal, selectedDevice, start, stop, inputDevices, setSelectedDevice,
    batterySave, setBatterySave, invertPolarity, setInvertPolarity
  } = useAudioEngine();

  const [calType, setCalType] = useState(null); // 'spl', 'rta_auto', 'rta_manual'
  const [extSpl, setExtSpl] = useState(85);
  const [currentLevels, setCurrentLevels] = useState(new Array(31).fill(-100));

  // Loop de monitoramento para o EQ durante calibração
  useEffect(() => {
    if (!calType || !isRunning) return;
    const interval = setInterval(() => {
      const data = get31BandData();
      if (data) setCurrentLevels(data);
    }, 50);
    return () => clearInterval(interval);
  }, [calType, isRunning, get31BandData]);

  const startSplCal = async () => {
    if(!isRunning) return alert("Ative 'Iniciar Análise' no RTA antes.");
    setCalType('spl');
    const pink = await playReferenceSignal('pink');
    setTimeout(() => pink.stop(), 5000);
  };

  const startRtaAuto = async () => {
    if(!isRunning) return alert("Ative 'Iniciar Análise' no RTA antes.");
    setCalType('rta_auto');
    const pink = await playReferenceSignal('pink');
    
    // Simulação de alinhamento em tempo real (5 segundos)
    const startTime = Date.now();
    const calInt = setInterval(() => {
        const data = get31BandData();
        if (data) {
            const newComp = [...rtaComp];
            data.forEach((val, i) => {
                const diff = -30 - val; // Alvo -30dB
                newComp[i] += diff * 0.1; // Ajuste suave gradual
                if (newComp[i] > 20) newComp[i] = 20;
                if (newComp[i] < -20) newComp[i] = -20;
            });
            setRtaComp(newComp);
        }
        if (Date.now() - startTime > 6000) {
            clearInterval(calInt);
            pink.stop();
            setCalType(null);
            alert("Calibração RTA Finalizada!");
        }
    }, 100);
  };

  const exportJSON = () => {
    const data = { splOffset, rtaComp, version: "1.0.3q" };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sonicalign_calib.json'; a.click();
  };

  const importJSON = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        if(data.splOffset) setSplOffset(data.splOffset);
        if(data.rtaComp) setRtaComp(data.rtaComp);
        alert("Configurações Carregadas!");
    };
    reader.readAsText(e.target.files[0]);
  };

  return (
    <div className="flex flex-col h-full bg-black font-mono text-xs overflow-y-auto pb-20 p-4 gap-4">
      
      {/* 1. SELEÇÃO DE MICROFONE */}
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-black uppercase"><Mic size={14}/> Entrada de Áudio</h3>
        <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded-md mb-2 outline-none">
          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
        </select>
      </section>

      {/* 2. BACKUP JSON */}
      <section className="grid grid-cols-2 gap-2">
        <button onClick={exportJSON} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold flex items-center justify-center gap-2"><Download size={14}/> EXPORTAR</button>
        <label className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold flex items-center justify-center gap-2 cursor-pointer"><Upload size={14}/> IMPORTAR<input type="file" onChange={importJSON} className="hidden"/></label>
      </section>

      {/* 3. CALIBRAÇÃO SPL */}
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-black uppercase"><Thermometer size={14}/> Calibração SPL</h3>
        {calType === 'spl' ? (
            <div className="flex flex-col gap-2">
                <div className="bg-black p-3 rounded border border-zinc-800 text-center">
                    <span className="text-[8px] text-zinc-500 uppercase block">Leitura App</span>
                    <span className="text-2xl font-black text-white">{(currentLevels.reduce((a,b)=>a+b,0)/31 + 100).toFixed(1)} dB</span>
                </div>
                <input type="number" value={extSpl} onChange={(e)=>setExtSpl(parseFloat(e.target.value))} className="bg-zinc-900 border border-neon-blue p-3 text-white text-center text-xl rounded-md" />
                <button onClick={() => { setSplOffset(extSpl - (currentLevels.reduce((a,b)=>a+b,0)/31 + 100)); setCalType(null); }} className="w-full p-4 bg-neon-blue text-black font-black rounded-lg">APLICAR OFFSET</button>
            </div>
        ) : (
            <button onClick={startSplCal} className="w-full p-4 border border-neon-blue text-neon-blue font-bold rounded-lg uppercase">Iniciar Aferição SPL</button>
        )}
      </section>

      {/* 4. CALIBRAÇÃO RTA */}
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-black uppercase"><Activity size={14}/> Calibração RTA (Monitor KRK)</h3>
        <div className="flex flex-col gap-2">
            <button onClick={startRtaAuto} className="w-full p-4 border-2 border-neon-green text-neon-green font-black rounded-lg uppercase">Auto-Alinhamento (Pink Noise)</button>
            <button onClick={() => setCalType('rta_manual')} className="w-full p-4 bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold rounded-lg uppercase">Ajuste Manual 31 Bandas</button>
        </div>
      </section>

      {/* 5. SISTEMA E FASE */}
      <section className="grid grid-cols-1 gap-2">
        <button onClick={() => setBatterySave(!batterySave)} className={`p-4 rounded-lg border-2 flex justify-between items-center ${batterySave ? 'border-neon-yellow text-neon-yellow' : 'border-zinc-800 text-zinc-600'}`}>
            <span className="font-black flex items-center gap-2"><Battery size={14}/> AUTO-STOP (2 MIN)</span>
            <span className="font-black">{batterySave ? 'ON' : 'OFF'}</span>
        </button>
        <button onClick={() => setInvertPolarity(!invertPolarity)} className={`p-4 rounded-lg border-2 flex justify-between items-center ${invertPolarity ? 'border-red-500 text-red-500' : 'border-zinc-800 text-zinc-600'}`}>
            <span className="font-black flex items-center gap-2"><Zap size={14}/> INVERTER FASE</span>
            <span className="font-black">{invertPolarity ? 'SIM' : 'NÃO'}</span>
        </button>
      </section>

      {/* MODAL DO EQUALIZADOR (AUTO OU MANUAL) */}
      {(calType === 'rta_auto' || calType === 'rta_manual') && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-2 animate-in slide-in-from-bottom">
            <div className="flex justify-between items-center p-3 border-b border-zinc-900">
                <span className="text-neon-green font-black uppercase tracking-tighter">
                    {calType === 'rta_auto' ? 'CALIBRANDO RTA EM TEMPO REAL...' : 'AJUSTE MANUAL DO MICROFONE'}
                </span>
                <button onClick={() => setCalType(null)} className="p-2 bg-red-500 text-black font-black rounded text-[10px]">FECHAR</button>
            </div>

            <div className="flex-1 flex overflow-x-auto gap-[2px] items-center px-4 bg-zinc-950 no-scrollbar relative">
                {/* Linha de Zero dB */}
                <div className="absolute left-0 right-0 h-[1px] bg-zinc-800 top-1/2 z-0"></div>

                {ISO_31_BANDS.map((freq, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[20px] h-[80%] relative">
                        {/* Barra Branca / Azul (Intensidade) */}
                        <div className="absolute inset-0 w-full border border-white/20 rounded-full overflow-hidden bg-white/5 pointer-events-none">
                            <div 
                                className="absolute bottom-0 w-full bg-blue-500 transition-all duration-75"
                                style={{ height: `${Math.max(0, currentLevels[i] + 100)}%` }}
                            ></div>
                        </div>

                        {/* Knob do Fader (Ajuste Gain) */}
                        <div 
                            className="absolute w-6 h-6 bg-zinc-100 rounded shadow-lg border border-zinc-400 z-10 flex items-center justify-center cursor-ns-resize active:scale-110 active:bg-neon-green transition-transform"
                            style={{ 
                                top: `${50 - (rtaComp[i] * 2.5)}%`, 
                                left: '-2px', 
                                transform: 'translateY(-50%)' 
                            }}
                            onPointerDown={(e) => {
                                if (calType !== 'rta_manual') return;
                                const startY = e.clientY;
                                const startVal = rtaComp[i];
                                const onPointerMove = (moveEvent) => {
                                    const delta = (startY - moveEvent.clientY) / 5;
                                    const newVal = Math.max(-20, Math.min(20, startVal + delta));
                                    const newComp = [...rtaComp];
                                    newComp[i] = newVal;
                                    setRtaComp(newComp);
                                };
                                const onPointerUp = () => {
                                    window.removeEventListener('pointermove', onPointerMove);
                                    window.removeEventListener('pointerup', onPointerUp);
                                };
                                window.addEventListener('pointermove', onPointerMove);
                                window.addEventListener('pointerup', onPointerUp);
                            }}
                        >
                            <span className="text-[6px] font-black text-black">{rtaComp[i].toFixed(0)}</span>
                        </div>
                        
                        <span className="absolute bottom-[-30px] text-[5px] text-zinc-500 rotate-90">{freq}</span>
                    </div>
                ))}
            </div>
            
            {calType === 'rta_auto' && (
                <div className="p-4 text-center text-[10px] text-zinc-500 italic">
                    O sistema está movendo os knobs para compensar os picos e vales do microfone...
                </div>
            )}
        </div>
      )}
    </div>
  );
}
