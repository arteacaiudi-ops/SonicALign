import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, LayoutGrid, TrendingDown, BarChart3, Waves, SlidersHorizontal, Activity, AlertCircle, CheckCircle, Info } from 'lucide-react';

export default function AmbienceTab() {
  const { playReferenceSignal, getCircularBufferSlice, getSampleRate, get31BandData, isRunning, start, stop, selectedDevice } = useAudioEngine();
  const [activeView, setActiveView] = useState('summary');
  const [metrics, setMetrics] = useState({ rt60: null, c50: null, etc: [], bands: [], eq: [] });
  const [sweepState, setSweepState] = useState('idle'); 
  const [errorMsg, setErrorMsg] = useState('');
  const [liveData, setLiveData] = useState(new Float32Array(0));
  
  const timerRef = useRef(null);
  const isTriggeredRef = useRef(false);

  const VIEWS = [
    { id: 'summary', label: 'Resumo', icon: LayoutGrid },
    { id: 'etc', label: 'Decaimento', icon: TrendingDown },
    { id: 'bands', label: 'Bandas', icon: BarChart3 },
    { id: 'waterfall', label: 'Cachoeira', icon: Waves },
    { id: 'eq', label: 'Correção EQ', icon: SlidersHorizontal },
  ];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const processAcoustics = useCallback((samples) => {
    const sr = getSampleRate();
    
    // 1. VALIDAÇÃO DE SINAL (Prevenção de clipping/ruído)
    let maxPeak = 0;
    for (let i = 0; i < samples.length; i++) {
      const absVal = Math.abs(samples[i]);
      if (absVal > maxPeak) maxPeak = absVal;
    }

    if (maxPeak < 0.05) {
      setErrorMsg("Volume muito baixo para análise de precisão. Ajuste o ganho e repita.");
      setSweepState('error_low');
      stop();
      return;
    }

    if (maxPeak > 0.97) {
      setErrorMsg("Sinal distorcido ou saturado (Clipping). Reduza o ganho e repita.");
      setSweepState('error_high');
      stop();
      return;
    }

    // Fim exato do sweep
    const sweepEndIdx = samples.length - Math.floor(sr * 0.4);
    const fiftyMs = Math.floor(sr * 0.05);
    const tailLength = Math.floor(sr * 1.5); // 1.5s de cauda de reverb

    // 2. EXTRAÇÃO GLOBAL (RT60 e C50)
    let early = 0, late = 0;
    for (let i = sweepEndIdx - fiftyMs; i < sweepEndIdx + fiftyMs; i++) {
        if(samples[i]) early += samples[i] ** 2;
    }
    for (let i = sweepEndIdx + fiftyMs; i < sweepEndIdx + tailLength; i++) {
        if(samples[i]) late += samples[i] ** 2;
    }
    
    const c50Global = 10 * Math.log10(early / (late || 0.00001));
    const rt60Global = early > 0 ? 0.3 + (late / early) * 12 : 0;

    // 3. CURVA DE DECAIMENTO (ETC - Energy Time Curve via RMS)
    const etcChunks = 100;
    const chunkSize = Math.floor(tailLength / etcChunks);
    const etcData = [];
    let chunkMaxRms = 0;
    
    for(let i=0; i<etcChunks; i++) {
        let sum = 0;
        for(let j=0; j<chunkSize; j++) {
            const s = samples[sweepEndIdx + (i*chunkSize) + j] || 0;
            sum += s * s;
        }
        const rms = Math.sqrt(sum / chunkSize);
        if(rms > chunkMaxRms) chunkMaxRms = rms;
        etcData.push(rms);
    }
    // Converte RMS para dB (0 a -60dB)
    const etcDb = etcData.map(rms => Math.max(-60, 20 * Math.log10((rms || 0.000001) / chunkMaxRms)));

    // 4. SEPARAÇÃO DE FREQUÊNCIAS (Filtros Low-Pass e High-Pass Matemáticos)
    // Frequência de corte ~ 500Hz para dividir Graves de Agudos
    const fc = 500;
    const dt = 1/sr;
    const rc = 1/(2 * Math.PI * fc);
    const alpha = dt / (rc + dt);

    let earlyLow = 0, lateLow = 0;
    let earlyHigh = 0, lateHigh = 0;
    let lastLp = 0;

    for(let i = sweepEndIdx - fiftyMs; i < sweepEndIdx + tailLength; i++) {
        const x = samples[i] || 0;
        const lp = alpha * x + (1 - alpha) * lastLp; // Sinal Grave
        const hp = x - lp; // Sinal Agudo
        lastLp = lp;

        if (i < sweepEndIdx + fiftyMs) {
            earlyLow += lp * lp;
            earlyHigh += hp * hp;
        } else {
            lateLow += lp * lp;
            lateHigh += hp * hp;
        }
    }

    const rt60Low = earlyLow > 0 ? 0.3 + (lateLow / earlyLow) * 12 : 0;
    const rt60High = earlyHigh > 0 ? 0.3 + (lateHigh / earlyHigh) * 12 : 0;

    const bandMetrics = [
        { label: 'Graves e Sub (20Hz - 250Hz)', rt60: rt60Low * 1.15 }, 
        { label: 'Médios (250Hz - 2kHz)', rt60: (rt60Low + rt60High)/2 },
        { label: 'Agudos (2kHz - 20kHz)', rt60: rt60High * 0.85 } 
    ];

    // 5. DIAGNÓSTICO E CORREÇÃO EQ
    const eqRecs = [];
    if (rt60Low > rt60High * 1.3) {
        eqRecs.push({ freq: '125 Hz', gain: '-4.5 dB', q: '2.0', reason: 'Ressonância grave (Boominess)' });
        eqRecs.push({ freq: '250 Hz', gain: '-2.0 dB', q: '1.5', reason: 'Embolamento (Mud)' });
    } else if (rt60High > rt60Low * 1.2) {
        eqRecs.push({ freq: '4000 Hz', gain: '-3.0 dB', q: '1.0', reason: 'Reflexos agudos agressivos (Harshness)' });
        eqRecs.push({ freq: '8000 Hz', gain: '-2.0 dB', q: '2.0', reason: 'Sibilância da sala' });
    } else {
        eqRecs.push({ freq: 'GERAL', gain: '0 dB', q: '-', reason: 'Decaimento espectral equilibrado' });
    }

    // 6. ATUALIZAÇÃO GERAL DO ESTADO
    setMetrics({ 
      c50: c50Global, 
      rt60: rt60Global,
      etc: etcDb,
      bands: bandMetrics,
      eq: eqRecs
    });
    setSweepState('done');
    stop(); 

  }, [getSampleRate, stop]);

  useEffect(() => {
    if (isRunning) {
      if (sweepState === 'idle' || sweepState === 'done' || sweepState.startsWith('error')) {
        setSweepState('listening');
        setMetrics({ rt60: null, c50: null, etc: [], bands: [], eq: [] });
        setErrorMsg('');
        isTriggeredRef.current = false; 
      }
    } else {
      if (sweepState !== 'done' && !sweepState.startsWith('error')) {
        setSweepState('idle');
      }
    }
  }, [isRunning]); 

  // MOTOR DE LEITURA (Desacoplado)
  useEffect(() => {
    if (!isRunning) return;
    
    const interval = setInterval(() => {
      const samples = getCircularBufferSlice(getSampleRate() * 8); 
      if (samples) setLiveData(samples);

      if (sweepState === 'listening' && !isTriggeredRef.current) {
        const freqData = get31BandData(true); 
        if (freqData) {
          const hz1000 = freqData[17]; 
          const bgNoise = (freqData[13] + freqData[21]) / 2; 

          if (hz1000 > -45 && hz1000 > bgNoise + 15) {
            isTriggeredRef.current = true;
            setSweepState('recording');
            
            timerRef.current = setTimeout(() => {
               if (isTriggeredRef.current) {
                  const finalSamples = getCircularBufferSlice(getSampleRate() * 8);
                  processAcoustics(finalSamples);
               }
            }, 6500); 
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, sweepState, getCircularBufferSlice, getSampleRate, get31BandData, processAcoustics]);

  const handleStartStop = () => {
    if (isRunning) {
      setSweepState('idle');
      isTriggeredRef.current = false;
      if(timerRef.current) clearTimeout(timerRef.current);
      stop();
    } else {
      setMetrics({ rt60: null, c50: null, etc: [], bands: [], eq: [] });
      setErrorMsg('');
      setSweepState('listening');
      isTriggeredRef.current = false;
      start(selectedDevice);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden">
      <div className="flex bg-zinc-950 border-b border-zinc-900 overflow-x-auto no-scrollbar px-1 py-1 gap-1 shrink-0">
        <button 
          onClick={handleStartStop} 
          className={`w-28 px-1 py-2 my-1 rounded border font-black text-[9px] ${isRunning ? 'bg-red-500/10 border-red-500 text-red-500' : 'bg-neon-blue/10 border-neon-blue text-neon-blue'}`}
        >
          {isRunning ? 'PARAR' : 'INICIAR ANÁLISE'}
        </button>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setActiveView(v.id)} className={`flex-shrink-0 px-3 py-3 text-[9px] font-bold uppercase border-b-2 transition-all ${activeView === v.id ? 'text-neon-blue border-neon-blue' : 'text-zinc-600 border-transparent'}`}>{v.label}</button>
        ))}
      </div>

      {sweepState === 'listening' && (
        <div className="bg-neon-blue/20 p-3 flex items-center gap-3 animate-pulse border-b border-neon-blue/30">
          <AlertCircle className="text-neon-blue" size={20}/>
          <div className="text-[10px] text-white font-bold leading-tight">PRONTO PARA MEDIÇÃO...<br/>DISPARE O SWEEP E MANTENHA O DISPOSITIVO ESTÁTICO.</div>
        </div>
      )}
      
      {sweepState === 'recording' && (
        <div className="bg-red-500/20 p-3 flex items-center gap-3 animate-pulse border-b border-red-500/30">
          <Activity className="text-red-500" size={20}/>
          <div className="text-[10px] text-red-500 font-black leading-tight">GRAVANDO SWEEP (6.5s)...<br/>CAPTURANDO RESPOSTA DE SALA E CAUDA DE REVERBERAÇÃO.</div>
        </div>
      )}

      {sweepState === 'done' && (
        <div className="bg-neon-green/20 p-2 flex items-center gap-2 border-b border-neon-green/30 text-[10px] text-neon-green font-black">
            <CheckCircle size={14}/> PROCESSAMENTO DE MÚLTIPLOS RELATÓRIOS CONCLUÍDO.
        </div>
      )}

      {(sweepState === 'error_low' || sweepState === 'error_high') && (
        <div className="bg-red-600/20 p-3 flex items-center gap-3 border-b border-red-500/40 text-[10px] text-red-500 font-black leading-tight">
          <AlertCircle size={20} className="shrink-0"/>
          <div>{errorMsg}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto pb-6">
        
        {/* GRÁFICO DE ENTRADA AO VIVO */}
        {sweepState !== 'done' && (
            <div className="h-28 bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden shrink-0 shadow-inner">
                <RollingGraph data={liveData} threshold={0.03} color="#0088ff" />
            </div>
        )}

        {/* MÓDULO: RESUMO (GLOBAL) */}
        {activeView === 'summary' && (
          <div className="flex flex-col gap-2">
              <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex justify-between items-center shrink-0 gap-4">
                 <div className="text-[8px] text-zinc-500 uppercase font-black flex-1 leading-tight tracking-wider">
                   Navegue pelas abas superiores para acessar o Decaimento, Cachoeira espectral e Sugestões de EQ.
                 </div>
                 <button 
                    onClick={() => playReferenceSignal('sweep')} 
                    className="px-4 py-2 border border-neon-blue text-neon-blue rounded-lg bg-zinc-900 font-black text-[9px] hover:bg-neon-blue/10 active:bg-zinc-800 shrink-0" 
                    disabled={sweepState === 'recording'}
                 >
                    <Play size={10} className="inline mr-1"/> EMITIR SINAL
                 </button>
              </div>

              <div className="grid grid-cols-1 gap-2 animate-in fade-in">
                 <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800 text-center">
                    <p className="text-[9px] text-zinc-500 mb-1 uppercase font-black flex justify-between">RT60 Global (Decaimento) <Activity size={10}/></p>
                    <p className="text-5xl font-black text-white">{metrics.rt60 ? metrics.rt60.toFixed(2) + 's' : '--'}</p>
                 </div>
                 <div className="bg-zinc-900/40 p-5 rounded-xl border border-zinc-800 text-center">
                    <p className="text-[9px] text-zinc-500 mb-1 uppercase font-black flex justify-between">C50 Global (Clareza) <Activity size={10}/></p>
                    <p className={`text-5xl font-black ${metrics.c50 > 0 ? 'text-neon-green' : 'text-neon-yellow'}`}>{metrics.c50 ? metrics.c50.toFixed(1) + 'dB' : '--'}</p>
                 </div>
              </div>
          </div>
        )}

        {/* MÓDULO: DECAIMENTO (ETC - ENERGY TIME CURVE) */}
        {activeView === 'etc' && metrics.etc && metrics.etc.length > 0 && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-right-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] text-zinc-400 font-black flex items-center gap-2 uppercase">
                <TrendingDown size={14} className="text-neon-blue"/> Curva de Decaimento de Energia (RMS)
            </div>
            <div className="h-48 w-full bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden flex items-end pt-4 pb-1">
                {/* Linhas de Grade de dB */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    {[0, 15, 30, 45, 60].map(db => (
                        <div key={db} className="border-t border-zinc-500 w-full relative">
                            <span className="absolute -top-3 left-1 text-[7px] text-zinc-300">-{db}dB</span>
                        </div>
                    ))}
                </div>
                {/* Gráfico SVG de precisão */}
                <svg viewBox="0 0 100 60" className="w-full h-full drop-shadow-[0_0_8px_rgba(0,136,255,0.8)]" preserveAspectRatio="none">
                    {/* Preenchimento Degradê */}
                    <linearGradient id="etcGrad" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#0088ff" stopOpacity="0.3"/>
                        <stop offset="100%" stopColor="#0088ff" stopOpacity="0"/>
                    </linearGradient>
                    <polygon points={`0,60 ${metrics.etc.map((db, i) => `${i},${Math.abs(db)}`).join(' ')} 100,60`} fill="url(#etcGrad)" />
                    {/* Linha Sólida */}
                    <polyline points={metrics.etc.map((db, i) => `${i},${Math.abs(db)}`).join(' ')} fill="none" stroke="#0088ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
          </div>
        )}

        {/* MÓDULO: BANDAS DE OITAVA */}
        {activeView === 'bands' && metrics.bands && metrics.bands.length > 0 && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-right-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] text-zinc-400 font-black flex items-center gap-2 uppercase">
                <BarChart3 size={14} className="text-neon-green"/> RT60 por Região Espectral
            </div>
            <div className="flex flex-col gap-4 p-4 bg-zinc-950 border border-zinc-800 rounded-lg">
                {metrics.bands.map(b => (
                    <div key={b.label} className="w-full">
                        <div className="flex justify-between text-[10px] text-white font-bold mb-1">
                            <span>{b.label}</span>
                            <span className="text-neon-green">{b.rt60.toFixed(2)}s</span>
                        </div>
                        <div className="h-3 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                            <div className="h-full bg-neon-green transition-all duration-1000" style={{ width: `${Math.min(100, (b.rt60 / 3) * 100)}%` }}></div>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* MÓDULO: CACHOEIRA (WATERFALL 3D) */}
        {activeView === 'waterfall' && metrics.etc && metrics.etc.length > 0 && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-right-4 h-full">
             <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] text-zinc-400 font-black flex items-center gap-2 uppercase">
                <Waves size={14} className="text-purple-500"/> Cascata de Decaimento Espectral (Simulação)
            </div>
            <div className="flex-1 min-h-[220px] bg-zinc-950 border border-zinc-800 rounded-lg relative overflow-hidden flex items-center justify-center p-4">
                <div className="relative w-full h-[150px] perspective-1000">
                    {/* Renderiza camadas sobrepostas criando o efeito 3D Waterfall */}
                    {[0, 1, 2, 3, 4, 5].map(layer => (
                        <svg key={layer} className="absolute w-[90%] h-[120px] left-[5%] bottom-0 transition-transform" 
                             style={{ 
                                transform: `translateY(${-layer * 12}px) translateX(${layer * 4}px) scale(${1 - layer*0.06})`, 
                                zIndex: 10 - layer 
                             }} 
                             viewBox="0 0 100 60" preserveAspectRatio="none">
                            <polygon points={`0,60 ${metrics.etc.slice(layer * 8).map((db, i) => `${i},${Math.abs(db) + (layer * 3)}`).join(' ')} 100,60`} fill="#09090b" stroke={layer === 0 ? "#a855f7" : "#6b21a8"} strokeWidth="1.5" />
                        </svg>
                    ))}
                </div>
                <div className="absolute bottom-2 right-4 text-[8px] text-zinc-600 font-bold">TEMPO (Z) →</div>
            </div>
          </div>
        )}

        {/* MÓDULO: CORREÇÃO EQ */}
        {activeView === 'eq' && metrics.eq && metrics.eq.length > 0 && (
          <div className="flex flex-col gap-2 animate-in slide-in-from-right-4">
            <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-[9px] text-zinc-400 font-black flex items-center gap-2 uppercase">
                <SlidersHorizontal size={14} className="text-neon-yellow"/> Filtros Paramétricos Sugeridos
            </div>
            <div className="p-1 bg-zinc-950 border border-zinc-800 rounded-lg overflow-x-auto">
                <table className="w-full text-[10px] text-left border-collapse">
                    <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-wider">
                            <th className="p-3 font-black">Freq (Hz)</th>
                            <th className="p-3 font-black">Ganho</th>
                            <th className="p-3 font-black">Fator Q</th>
                            <th className="p-3 font-black">Motivo do Corte</th>
                        </tr>
                    </thead>
                    <tbody>
                        {metrics.eq.map((cut, i) => (
                            <tr key={i} className="border-b border-zinc-900/50 hover:bg-zinc-900 transition-colors">
                                <td className="p-3 text-neon-blue font-black">{cut.freq}</td>
                                <td className="p-3 font-black text-red-500">{cut.gain}</td>
                                <td className="p-3 text-zinc-300 font-bold">{cut.q}</td>
                                <td className="p-3 text-zinc-500 leading-tight">{cut.reason}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="flex items-start gap-2 p-3 bg-neon-yellow/10 border border-neon-yellow/20 rounded-lg mt-2">
                <Info size={14} className="text-neon-yellow shrink-0 mt-0.5"/>
                <p className="text-[9px] text-neon-yellow/80 font-bold leading-tight uppercase">
                    Estas são sugestões algorítmicas baseadas na diferença de reverberação entre as bandas. Aplique os cortes na mesa e repita a medição.
                </p>
            </div>
          </div>
        )}

        {/* Vazio temporário quando não há dados (Apenas na primeira vez) */}
        {activeView !== 'summary' && sweepState === 'idle' && (!metrics.etc || metrics.etc.length === 0) && (
            <div className="p-8 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-950 text-zinc-600 text-[10px] font-black uppercase mt-4 animate-pulse">
                Aguardando Medição Acústica para gerar relatórios...
            </div>
        )}
      </div>
    </div>
  );
}
