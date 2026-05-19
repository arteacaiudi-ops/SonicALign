import React, { useState, useEffect } from 'react';
import { useAudioEngine } from '@/components/audio/AudioEngine';
import RollingGraph from '../audio/RollingGraph';
import { Play, Square, Snowflake, RotateCcw, Crosshair, Search, Zap } from 'lucide-react';

export default function TimeTab() {
  const { getCircularBufferSlice, getSampleRate, playReferenceSignal, isRunning, start, stop, selectedDevice, peakHoldAutoGain } = useAudioEngine();
  
  const [threshold, setThreshold] = useState(0.2);
  const [isAutoThreshold, setIsAutoThreshold] = useState(true);
  
  const [timeWindow, setTimeWindow] = useState(4);
  const [isPulseRunning, setIsPulseRunning] = useState(false);
  
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenData, setFrozenData] = useState(null);
  
  const [markers, setMarkers] = useState([]); 
  const [delayInfo, setDelayInfo] = useState({ ms: 0, m: 0 });
  
  const [zoomMode, setZoomMode] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [liveData, setLiveData] = useState(new Float32Array(0));

  const togglePulse = async () => {
    if (isPulseRunning) { 
        setIsPulseRunning(false); 
        await playReferenceSignal('stop');
    }
    else { 
        await playReferenceSignal('click'); 
        setIsPulseRunning(true); 
    }
  };

  useEffect(() => {
    if (!isRunning || isFrozen) return;
    const interval = setInterval(() => {
      const sr = getSampleRate();
      const raw = getCircularBufferSlice(sr * timeWindow);
      if (!raw || raw.length === 0) return;

      // 1. FILTRO DSP PASSA-ALTAS (~2000Hz) - Rejeita ruídos graves do ambiente
      const filtered = new Float32Array(raw.length);
      const dt = 1.0 / sr;
      const rc = 1.0 / (2 * Math.PI * 2000);
      const alpha = rc / (rc + dt);
      
      let lastX = 0, lastY = 0;
      for (let i = 0; i < raw.length; i++) {
        filtered[i] = alpha * (lastY + raw[i] - lastX);
        lastX = raw[i];
        lastY = filtered[i];
      }
      
      setLiveData(filtered); // Mostra o sinal visual limpo e filtrado

      // 2. THRESHOLD INTELIGENTE E DINÂMICO
      let currentThreshold = threshold;
      if (isAutoThreshold) {
        let peak = 0;
        let noiseSum = 0;
        const scanLen = sr * 1; 
        const startScan = Math.max(0, filtered.length - scanLen);
        
        for(let i = startScan; i < filtered.length; i++) {
           const absVal = Math.abs(filtered[i]);
           if (absVal > peak) peak = absVal;
           noiseSum += absVal;
        }
        
        const noiseFloor = noiseSum / scanLen;
        
        if (peak > 0.05) { 
           // Coloca o corte rigorosamente no meio entre o ruído e o pico
           currentThreshold = noiseFloor + ((peak - noiseFloor) * 0.5);
           // Atualiza a UI sem spamar re-renderizações (apenas se a mudança for > 1%)
           setThreshold(prev => Math.abs(prev - currentThreshold) > 0.01 ? currentThreshold : prev);
        }
      }

      // 3. DETEÇÃO CIRÚRGICA DE PICOS (Debounce destravado para 0.2ms)
      let found = [];
      for (let i = filtered.length - 1; i > sr * 0.1; i--) {
        if (Math.abs(filtered[i]) > currentThreshold && Math.abs(filtered[i-1]) <= currentThreshold) {
          // 0.0002s (0.2ms) permite distinguir caixas separadas por apenas ~6.8cm!
          if (found.length === 0 || (found[found.length-1] - i) > sr * 0.0002) {
             found.push(i);
          }
        }
        if (found.length >= 2) break;
      }

      if (found.length >= 2) {
        setMarkers([found[1], found[0]]); 
        const ms = ((found[0] - found[1]) / sr) * 1000;
        setDelayInfo({ ms: Math.abs(ms), m: Math.abs(ms) * 0.343 });

        // 4. CAPTURA PARA MODO LUPA (Osciloscópio)
        if (zoomMode) {
            const p1 = found[1];
            const p2 = found[0];
            const pad = Math.floor(sr * 0.005); // Margem visual de 5ms à volta dos picos
            const startIdx = Math.max(0, p1 - pad);
            const endIdx = Math.min(filtered.length, p2 + pad);
            
            setSnapshot({
                slice: filtered.slice(startIdx, endIdx),
                p1Offset: p1 - startIdx,
                p2Offset: p2 - startIdx,
                msTotal: ((endIdx - startIdx) / sr) * 1000
            });
        }
      }

    }, 50);
    return () => clearInterval(interval);
  }, [isRunning, isFrozen, threshold, timeWindow, zoomMode, isAutoThreshold, getCircularBufferSlice, getSampleRate]);

  const renderZoomView = () => {
    if (!snapshot) return <div className="flex-1 flex flex-col items-center justify-center text-[10px] text-zinc-600 uppercase font-black bg-zinc-950 p-4 text-center"><span><Search size={24} className="mb-2 mx-auto opacity-50"/>Aguardando pulsos limpos...</span></div>;

    const { slice, p1Offset, p2Offset, msTotal } = snapshot;
    const width = 1000;
    const height = 100;
    const mid = height / 2;

    const points = Array.from(slice).map((val, i) => {
        const x = (i / slice.length) * width;
        const y = mid - (val * mid);
        return `${x},${y}`;
    }).join(' ');

    const x1 = (p1Offset / slice.length) * width;
    const x2 = (p2Offset / slice.length) * width;

    return (
        <div className="flex-1 flex flex-col p-3 bg-zinc-950 relative h-full">
            <div className="text-[10px] text-neon-blue font-black mb-2 flex items-center gap-2 uppercase tracking-wider">
                <Search size={14} /> ZOOM OSCILOSCÓPIO (Alta Precisão)
            </div>
            <div className="flex-1 relative border border-zinc-800 rounded-lg overflow-hidden bg-black shadow-inner">
                <div className="absolute top-1/2 left-0 right-0 h-[1px] bg-zinc-800 opacity-50"></div>
                
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                    <polyline points={points} fill="none" stroke="#0088ff" strokeWidth="1.5" strokeLinejoin="round"/>
                    <line x1={x1} y1="0" x2={x1} y2={height} stroke="#eab308" strokeWidth="2" strokeDasharray="4" />
                    <line x1={x2} y1="0" x2={x2} y2={height} stroke="#eab308" strokeWidth="2" strokeDasharray="4" />
                </svg>

                <div className="absolute bottom-1 w-full flex justify-between px-2 pointer-events-none">
                    <span className="text-[9px] text-zinc-600 font-bold">0ms</span>
                    <span className="text-[9px] text-black font-black border border-neon-yellow bg-neon-yellow px-1 rounded absolute" style={{ left: `${(x1/width)*100}%`, transform: 'translateX(-50%)', bottom: '5px' }}>P1</span>
                    <span className="text-[9px] text-black font-black border border-neon-yellow bg-neon-yellow px-1 rounded absolute" style={{ left: `${(x2/width)*100}%`, transform: 'translateX(-50%)', bottom: '5px' }}>P2</span>
                    <span className="text-[9px] text-zinc-600 font-bold">{msTotal.toFixed(1)}ms</span>
                </div>
            </div>
            <div className="mt-3 text-center text-[10px] text-zinc-400 font-bold bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
                <span className="uppercase text-zinc-500 mr-2">Delta Físico Encontrado:</span>
                <span className="text-neon-yellow text-lg mr-2">{delayInfo.ms.toFixed(2)} ms</span>
                <span className="text-neon-blue">({delayInfo.m.toFixed(2)} m)</span>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-black font-mono overflow-hidden tabular-nums">
      <div className="bg-zinc-950 p-2 border-b border-zinc-900 flex justify-between items-center gap-1 shrink-0 shadow-lg">
        <button onClick={() => isRunning ? stop() : start(selectedDevice)} className={`w-16 h-10 rounded-md font-black text-[9px] border ${isRunning ? 'border-red-500 text-red-500' : 'border-neon-green text-neon-green'}`}>
          {isRunning ? 'STOP' : 'INICIAR ANÁLISE'}
        </button>
        
        <div className="flex flex-1 justify-around bg-black/60 py-1 rounded border border-zinc-800 mx-1">
          <div className="text-center"><span className="text-[6px] text-zinc-500 block uppercase">Delta</span><span className="text-neon-yellow text-[11px] font-black">{delayInfo.ms.toFixed(2)}ms</span></div>
          <div className="text-center border-l border-zinc-800 pl-1"><span className="text-[6px] text-zinc-500 block uppercase">Dist</span><span className="text-neon-blue text-[11px] font-black">{delayInfo.m.toFixed(2)}m</span></div>
        </div>

        <div className="flex gap-1 shrink-0">
          <button onClick={togglePulse} className={`px-2 py-1 rounded border flex flex-col items-center justify-center gap-0 text-[8px] font-black uppercase ${isPulseRunning ? 'bg-neon-yellow text-black border-neon-yellow' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
              <Zap size={10} className="mb-[1px]"/> {isPulseRunning ? 'PARAR' : 'CLICK 5ms'}
          </button>
          
          <button onClick={() => setZoomMode(!zoomMode)} className={`px-2 py-1 rounded border flex flex-col items-center justify-center gap-0 text-[8px] font-black uppercase ${zoomMode ? 'bg-neon-blue text-black border-neon-blue' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
              <Search size={10} className="mb-[1px]"/> LUPA
          </button>

          {!zoomMode && (
              <select value={timeWindow} onChange={(e)=>setTimeWindow(parseInt(e.target.value))} className="bg-zinc-900 text-[10px] text-white p-1 rounded border border-zinc-700 outline-none">
                {[2, 4, 6, 8].map(t => <option key={t} value={t}>{t}s</option>)}
              </select>
          )}
          {!zoomMode && (
              <button onClick={() => { if(!isFrozen) setFrozenData(liveData); setIsFrozen(!isFrozen); }} className={`p-2 rounded border flex flex-col items-center justify-center ${isFrozen ? 'bg-cyan-500 text-black border-cyan-500' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}><Snowflake size={14}/></button>
          )}
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-8 bg-zinc-950 flex flex-col items-center py-2 border-r border-zinc-900 shrink-0">
          <input 
             type="range" 
             min="0" max="1" step="0.01" 
             value={threshold} 
             onChange={(e)=>{setThreshold(parseFloat(e.target.value)); setIsAutoThreshold(false);}} 
             className={`flex-1 ${isAutoThreshold ? 'accent-neon-yellow' : 'accent-red-500'}`} 
             style={{ appearance: 'slider-vertical' }} 
             title="Threshold"
          />
          <button onClick={() => setIsAutoThreshold(!isAutoThreshold)} className={`mt-2 w-full py-2 text-[8px] font-black border-t border-zinc-800 ${isAutoThreshold ? 'text-neon-yellow bg-neon-yellow/10' : 'text-zinc-600 bg-zinc-900 hover:bg-zinc-800'}`}>
             AUTO
          </button>
        </div>
        
        <div className="flex-1 relative bg-black">
            {zoomMode ? renderZoomView() : (
                <RollingGraph data={isFrozen ? frozenData : liveData} threshold={threshold} markers={markers} isFrozen={isFrozen}/>
            )}
        </div>
      </div>
    </div>
  );
}
