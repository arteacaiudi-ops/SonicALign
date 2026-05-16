import React, { useState, useEffect, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import { ISO_31_BANDS } from '@/lib/app-params';
import { Mic, Activity, Download, Upload, Thermometer, Zap, Battery, Crosshair, X } from 'lucide-react';

export default function SettingsTab() {
  const { 
    calibration, isRunning, get31BandData, 
    playReferenceSignal, selectedDevice, inputDevices, setSelectedDevice,
    batterySave, setBatterySave, invertPolarity, setInvertPolarity, start, stop, peakHoldAutoGain
  } = useAudioEngine();

  const [calType, setCalType] = useState(null); 
  const [extSpl, setExtSpl] = useState(85);
  const [liveLevels, setLiveLevels] = useState(new Array(31).fill(-100));
  
  const [isAutoCalibrating, setIsAutoCalibrating] = useState(false);
  const [calibProgress, setCalibProgress] = useState(0);
  const [targetLevel, setTargetLevel] = useState(-40); // Linha amarela dinâmica (Padrão visual 50%)

  // Buffer para Smoothing RTA de 4 segundos
  const rawHistoryRef = useRef([]);

  // Loop visual: Atualiza sempre que o modal está aberto
  useEffect(() => {
    if (!calType) return;
    
    let tempStarted = false;
    const initMic = async () => {
        if (!isRunning) {
            await start(selectedDevice);
            tempStarted = true;
        }
    };
    initMic();

    const interval = setInterval(() => {
      const data = get31BandData(false); // Sempre mostra o COMPENSADO visualmente
      if (data) setLiveLevels(data);
    }, 50);

    return () => {
        clearInterval(interval);
        if (tempStarted) stop(); 
    };
  }, [calType, isRunning, get31BandData, start, stop, selectedDevice]);

  const startSplCal = async () => {
    setCalType('spl');
    const pink = await playReferenceSignal('pink');
    setTimeout(() => pink.stop(), 8000);
  };

  // --- MATEMÁTICA DE INVERSÃO (ALVO RELATIVO 4s) ---
  const runAutoCalibration = async () => {
    setIsAutoCalibrating(true);
    setCalibProgress(0);
    
    // 1. Zera todos os faders para ter leitura limpa do hardware
    calibration.setRtaComp(new Array(31).fill(0));
    const pink = await playReferenceSignal('pink');
    
    // 2. Ouve durante 4 segundos (Smoothing)
    rawHistoryRef.current = [];
    const readInt = setInterval(() => {
        const raw = get31BandData(true); // Lê o sinal BRUTO sem a compensação antiga
        if(raw) rawHistoryRef.current.push(raw);
        setCalibProgress(prev => prev + 2.5); // 4s = 40 ticks de 100ms (100% / 40 = 2.5)
    }, 100);

    setTimeout(() => {
        clearInterval(readInt);
        pink.stop();
        
        // 3. Processamento e Cálculo
        const history = rawHistoryRef.current;
        if(history.length === 0) { setIsAutoCalibrating(false); return alert("Erro: Sem leitura de áudio."); }
        
        // Média individual de cada uma das 31 bandas
        const avgBands = new Array(31).fill(0);
        history.forEach(read => {
            read.forEach((val, i) => avgBands[i] += val);
        });
        for(let i=0; i<31; i++) avgBands[i] /= history.length;

        // "A Linha Invisível": Média Global do Espectro no ambiente atual
        const globalAvg = avgBands.reduce((a,b)=>a+b,0) / 31;
        setTargetLevel(globalAvg); // Move a linha pontilhada amarela visualmente
        
        // Calcula a inversão e aplica aos Faders
        const newComp = new Array(31).fill(0);
        for(let i=0; i<31; i++){
            const diff = globalAvg - avgBands[i]; 
            newComp[i] = Math.max(-20, Math.min(20, diff));
        }
        
        calibration.setRtaComp(newComp);
        setIsAutoCalibrating(false);
        setCalibProgress(0);
    }, 4000); // 4 segundos cravados
  };

  const exportJSON = () => {
    const data = { splOffset: calibration.splOffset, rtaComp: calibration.rtaComp, version: "1.0.5" };
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
                <input type="number" value={extSpl} onChange={(e)=>setExtSpl(parseFloat(e.target.value))} className="bg-zinc-900 border border-neon-blue p-3 text-white text-center text-xl rounded-md outline-none" />
                <button onClick={() => { calibration.setSplOffset(extSpl - (liveLevels.reduce((a,b)=>a+b,0)/31 + 100)); setCalType(null); }} className="w-full p-4 bg-neon-blue text-black font-black rounded-lg">GRAVAR SPL OFFSET</button>
            </div>
        ) : (
            <button onClick={startSplCal} className="w-full p-4 border border-neon-blue text-neon-blue font-bold rounded-lg uppercase">Aferir Nível de Pressão (SPL)</button>
        )}
      </section>

      <section className="p-4 border border-zinc-800 rounded-lg bg-zinc-950">
        <h3 className="text-neon-green mb-4 flex items-center gap-2 font-black uppercase"><Activity size={14}/> Calibração RTA (Referência)</h3>
        <button onClick={() => setCalType('rta')} className="w-full p-4 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold rounded-lg uppercase">Abrir Rack de Equalização</button>
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

      {/* RACK UNIFICADO DE CALIBRAÇÃO (MANUAL + AUTO) */}
      {calType === 'rta' && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-2 animate-in slide-in-from-bottom duration-300">
            
            <div className="flex justify-between items-center p-2 border-b border-zinc-900 shrink-0 gap-2">
                <span className="text-neon-green font-black uppercase text-[10px] hidden sm:block">Calibração de Hardware</span>
                
                <div className="flex gap-2 flex-1 justify-end">
                    <button 
                        onClick={async () => {
                            setIsAutoCalibrating(true);
                            await peakHoldAutoGain(3000);
                            setIsAutoCalibrating(false);
                        }} 
                        className="px-3 py-2 bg-zinc-900 text-neon-blue font-black rounded-lg text-[9px] border border-neon-blue flex items-center gap-1 hover:bg-neon-blue/10"
                    >
                        <Crosshair size={12}/> AUTO-GAIN
                    </button>
                    
                    <button 
                        onClick={runAutoCalibration} 
                        disabled={isAutoCalibrating}
                        className={`px-3 py-2 font-black rounded-lg text-[9px] flex items-center gap-1 transition-all ${isAutoCalibrating ? 'bg-neon-green text-black' : 'bg-neon-green/20 text-neon-green border border-neon-green hover:bg-neon-green hover:text-black'}`}
                    >
                        <Activity size={12}/> {isAutoCalibrating ? `${Math.round(calibProgress)}%` : 'CALIBRAR AUTO'}
                    </button>
                    
                    <button onClick={() => { calibration.setRtaComp(new Array(31).fill(0)); setCalType(null); }} className="p-2 border border-red-900 text-red-500 rounded-lg text-[10px] hover:bg-red-900/20" title="Cancelar e Sair">
                        <X size={14}/>
                    </button>
                    
                    <button onClick={() => setCalType(null)} className="px-3 py-2 bg-zinc-800 text-white font-black rounded-lg text-[9px] hover:bg-zinc-700">
                        SALVAR
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-x-auto gap-[2px] items-center px-4 bg-zinc-950 no-scrollbar relative pt-10">
                {/* Linha Amarela Dinâmica (Alvo Relativo) */}
                <div 
                  className="absolute left-0 right-0 h-[2px] border-b-2 border-dashed border-yellow-500 z-0 opacity-70 transition-all duration-1000 ease-in-out"
                  style={{ bottom: `${Math.max(0, targetLevel + 90)}%` }}
                ></div>

                {ISO_31_BANDS.map((freq, i) => (
                    <div key={i} className="flex flex-col items-center min-w-[18px] h-[85%] relative">
                        <div className="absolute inset-0 w-full border border-white/10 rounded-full overflow-hidden bg-white/5 pointer-events-none">
                            <div 
                                className="absolute bottom-0 w-full bg-blue-600/60 shadow-[0_0_10px_rgba(37,99,235,0.4)] transition-all duration-75"
                                style={{ height: `${Math.max(0, liveLevels[i] + 90)}%` }}
                            ></div>
                        </div>

                        {/* Fader Manual (Com UX bloqueada contra cliques acidentais fora do Knob) */}
                        <div 
                            className={`absolute w-6 h-4 bg-white rounded-sm shadow-xl border-x-2 border-blue-500 z-10 flex items-center justify-center cursor-ns-resize touch-none active:scale-125 ${isAutoCalibrating ? 'transition-all duration-[2000ms] ease-out' : ''}`}
                            style={{ 
                                top: `${50 - (calibration.rtaComp[i] * 2.5)}%`, 
                                left: '-3px', 
                                transform: 'translateY(-50%)' 
                            }}
                            onPointerDown={(e) => {
                                if (isAutoCalibrating) return;
                                e.currentTarget.setPointerCapture(e.pointerId); 
                                e.currentTarget.dataset.startY = e.clientY || (e.touches && e.touches[0].clientY);
                                e.currentTarget.dataset.startVal = calibration.rtaComp[i];
                            }}
                            onPointerMove={(e) => {
                                if (!e.currentTarget.hasPointerCapture(e.pointerId) || isAutoCalibrating) return;
                                const startY = parseFloat(e.currentTarget.dataset.startY);
                                const startVal = parseFloat(e.currentTarget.dataset.startVal);
                                const currentY = e.clientY || (e.touches && e.touches[0].clientY);
                                
                                const deltaDb = (startY - currentY) * 0.3; 
                                const newVal = Math.max(-20, Math.min(20, startVal + deltaDb));
                                
                                const updated = [...calibration.rtaComp];
                                updated[i] = newVal;
                                calibration.setRtaComp(updated);
                            }}
                            onPointerUp={(e) => {
                                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                                    e.currentTarget.releasePointerCapture(e.pointerId);
                                }
                            }}
                        >
                            <span className="text-[6px] font-black text-black pointer-events-none select-none">{calibration.rtaComp[i].toFixed(0)}</span>
                        </div>
                        <span className="absolute bottom-[-25px] text-[5px] text-zinc-600 rotate-90 font-bold select-none">{freq < 1000 ? freq : (freq/1000)+'k'}</span>
                    </div>
                ))}
            </div>
            
            {isAutoCalibrating && (
                <div className="p-3 bg-neon-green text-black font-black text-center text-[10px] uppercase animate-pulse">
                    Computando 40 amostras por banda (Smoothing 4s)... {calibProgress}%
                </div>
            )}
        </div>
      )}
    </div>
  );
}
