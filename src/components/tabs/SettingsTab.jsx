import React, { useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { ISO_31_BANDS } from '@/lib/app-params';
import { Mic, Activity, Download, Upload, Thermometer, Zap, Battery } from 'lucide-react';

export default function SettingsTab() {
  const { 
    calibration, isRunning, get31BandData, 
    playReferenceSignal, selectedDevice, inputDevices, setSelectedDevice,
    batterySave, setBatterySave, invertPolarity, setInvertPolarity
  } = useAudioEngine();

  const [calType, setCalType] = useState(null); 
  const [extSpl, setExtSpl] = useState(85);
  const [liveLevels, setLiveLevels] = useState(new Array(31).fill(-100));

  useEffect(() => {
    if (!calType || !isRunning) return;
    const interval = setInterval(() => {
      const data = get31BandData(false); // Retorna sinal já COMPENSADO pelo `useCalibration`
      if (data) setLiveLevels(data);
    }, 50);
    return () => clearInterval(interval);
  }, [calType, isRunning, get31BandData]);

  const startSplCal = async () => {
    if(!isRunning) return alert("Ative 'Iniciar Análise' noutra aba primeiro.");
    setCalType('spl');
    const pink = await playReferenceSignal('pink');
    setTimeout(() => pink.stop(), 8000);
  };

  const startRtaAuto = async () => {
    if(!isRunning) return alert("Ative 'Iniciar Análise' noutra aba primeiro.");
    setCalType('rta_auto');
    const pink = await playReferenceSignal('pink');
    const startTime = Date.now();
    
    const calInt = setInterval(() => {
        const rawData = get31BandData(true); // Precisamos do RAW para calcular o desvio
        if (rawData) {
            const newComp = [...calibration.rtaComp];
            rawData.forEach((val, i) => {
                const diff = -30 - val; // Objetivo de nivelar tudo em -30dB (Flat)
                newComp[i] += diff * 0.05; 
                if (newComp[i] > 20) newComp[i] = 20;
                if (newComp[i] < -20) newComp[i] = -20;
            });
            calibration.setRtaComp(newComp);
        }
        if (Date.now() - startTime > 7000) {
            clearInterval(calInt);
            pink.stop();
            setCalType(null);
            alert("Calibração Automática Finalizada com Sucesso!");
        }
    }, 100);
  };

  const exportJSON = () => {
    const data = { splOffset: calibration.splOffset, rtaComp: calibration.rtaComp, version: "1.0.3v" };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'sonicalign_calib.json'; a.click();
  };

  const importJSON = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = JSON.parse(ev.target.result);
        if(data.splOffset !== undefined) calibration.setSplOffset(data.splOffset);
        if(data.rtaComp) calibration.setRtaComp(data.rtaComp);
        alert("Configurações Restauradas!");
    };
    reader.readAsText(e.target.files[0]);
  };

  return (
    <div className="flex flex-col h-full bg-black font-mono text-xs overflow-y-auto pb-20 p-4 gap-4 tabular-nums">
      
      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-black uppercase"><Mic size={14}/> Microfone de Medição</h3>
        <select value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 p-3 text-white rounded-md outline-none">
          {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic ${d.deviceId.slice(0,5)}`}</option>)}
        </select>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <button onClick={exportJSON} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold flex items-center justify-center gap-2"><Download size={14}/> EXPORTAR BACKUP</button>
        <label className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold flex items-center justify-center gap-2 cursor-pointer"><Upload size={14}/> IMPORTAR<input type="file" onChange={importJSON} className="hidden"/></label>
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-blue mb-4 flex items-center gap-2 font-black uppercase"><Thermometer size={14}/> Offset SPL</h3>
        {calType === 'spl' ? (
            <div className="flex flex-col gap-2">
                <div className="bg-black p-3 rounded border border-zinc-800 text-center">
                    <span className="text-[8px] text-zinc-500 uppercase block">Monitor App</span>
                    <span className="text-2xl font-black text-white">{calibration.getCompensatedSpl(liveLevels.reduce((a,b)=>a+b,0)/31).toFixed(1)} dB</span>
                </div>
                <input type="number" value={extSpl} onChange={(e)=>setExtSpl(parseFloat(e.target.value))} className="bg-zinc-900 border border-neon-blue p-3 text-white text-center text-xl rounded-md" />
                <button onClick={() => { calibration.setSplOffset(extSpl - (liveLevels.reduce((a,b)=>a+b,0)/31 + 100)); setCalType(null); }} className="w-full p-4 bg-neon-blue text-black font-black rounded-lg">CALIBRAR SPL</button>
            </div>
        ) : (
            <button onClick={startSplCal} className="w-full p-4 border border-neon-blue text-neon-blue font-bold rounded-lg uppercase">Aferir Nível de Pressão (SPL)</button>
        )}
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-black uppercase"><Activity size={14}/> Calibração RTA (Referência)</h3>
        <div className="flex flex-col gap-2">
            <button onClick={startRtaAuto} className="w-full p-4 border-2 border-neon-green text-neon-green font-black rounded-lg uppercase">Auto-Alinhamento (Pink Noise)</button>
            <button onClick={() => setCalType('rta_manual')} className="w-full p-4 bg-zinc-900 border border-zinc-800 text-zinc-400 font-bold rounded-lg uppercase">Ajuste Manual do Mic (EQ)</button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2">
        <button onClick={() => setBatterySave(!batterySave)} className={`p-4 rounded-lg border-2 flex justify-between items-center transition-all ${batterySave ? 'border-neon-yellow text-neon-yellow' : 'border-zinc-800 text-zinc-600'}`}>
            <span className="font-black flex items-center gap-2"><Battery size={14}/> AUTO-STOP (2m)</span>
            <span className="font-black">{batterySave ? 'ON' : 'OFF'}</span>
        </button>
        <button onClick={() => setInvertPolarity(!invertPolarity)} className={`p-4 rounded-lg border-2 flex justify-between items-center transition-all ${invertPolarity ? 'border-red-500 text-red-500' : 'border-zinc-800 text-zinc-600'}`}>
            <span className="font-black flex items-center gap-2"><Zap size={14}/> FASE DE CAPTURA</span>
            <span className="font-black">{invertPolarity ? 'INVERTIDA (-)' : 'NORMAL (+)'}</span>
        </button>
      </section>

      {/* RACK VISUAL DE 31 BANDAS PARA CALIBRAÇÃO */}
      {(calType === 'rta_auto' || calType === 'rta_manual') && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-2 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center p-3 border-b border-zinc-900 shrink-0">
                <span className="text-neon-green font-black uppercase text-[10px]">Rack Calibração de Mic</span>
                <button onClick={() => setCalType(null)} className="px-4 py-2 bg-red-600 text-white font-black rounded-lg text-[9px]">FECHAR E SALVAR</button>
            </div>

            <div className="flex-1 flex overflow-x-auto gap-[2px] items-center px-4 bg-zinc-950 no-scrollbar relative pt-10">
                {/* Linha Zero */}
                <div className="absolute left-0 right-0 h-[1px] bg-zinc-800 top-1/2 z-0 opacity-50"></div>

                {ISO_31_BANDS.map((freq, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[18px] h-[85%] relative">
                        {/* Barra Branca "Vazia" de Fundo */}
                        <div className="absolute inset-0 w-full border border-white/10 rounded-full overflow-hidden bg-white/5 pointer-events-none">
                            {/* Nível Azul de Leitura (Mostra resultado visual em tempo real após a compensação do fader) */}
                            <div 
                                className="absolute bottom-0 w-full bg-blue-600/60 shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all duration-75"
                                style={{ height: `${Math.max(0, liveLevels[i] + 90)}%` }}
                            ></div>
                        </div>

                        {/* Fader Knob */}
                        <div 
                            className="absolute w-6 h-4 bg-white rounded-sm shadow-xl border-x-2 border-blue-500 z-10 flex items-center justify-center cursor-ns-resize active:scale-125 transition-transform"
                            style={{ 
                                top: `${50 - (calibration.rtaComp[i] * 2.5)}%`, 
                                left: '-3px', 
                                transform: 'translateY(-50%)' 
                            }}
                            onPointerDown={(e) => {
                                if (calType !== 'rta_manual') return;
                                const startY = e.clientY;
                                const startVal = calibration.rtaComp[i];
                                const onPointerMove = (mv) => {
                                    const delta = (startY - mv.clientY) / 4;
                                    const newVal = Math.max(-20, Math.min(20, startVal + delta));
                                    const updated = [...calibration.rtaComp];
                                    updated[i] = newVal;
                                    calibration.setRtaComp(updated);
                                };
                                const onPointerUp = () => {
                                    window.removeEventListener('pointermove', onPointerMove);
                                    window.removeEventListener('pointerup', onPointerUp);
                                };
                                window.addEventListener('pointermove', onPointerMove);
                                window.addEventListener('pointerup', onPointerUp);
                            }}
                        >
                            <span className="text-[6px] font-black text-black pointer-events-none">{calibration.rtaComp[i].toFixed(0)}</span>
                        </div>
                        <span className="absolute bottom-[-25px] text-[5px] text-zinc-600 rotate-90 font-bold">{freq < 1000 ? freq : (freq/1000)+'k'}</span>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
}
