import React, { useState } from 'react';
import { Download, Play, Square, AlertCircle } from 'lucide-react';

export default function DevTab({ onStartLog, onStopLog, isLogging }) {
  return (
    <div className="p-4 bg-black text-white font-mono text-xs">
      <h2 className="text-neon-yellow font-black mb-4">DEV TOOLS / TELEMETRIA</h2>
      <div className="flex flex-col gap-4">
        {!isLogging ? (
          <button onClick={onStartLog} className="p-4 bg-neon-blue/20 border border-neon-blue text-neon-blue font-black rounded-lg">
            GRAVAR TELEMETRIA DA PRÓXIMA LEITURA
          </button>
        ) : (
          <div className="p-4 bg-red-500/20 border border-red-500 text-red-500 font-black rounded-lg animate-pulse">
            EM MODO DE GRAVAÇÃO (AGUARDANDO GATILHO)
          </div>
        )}
      </div>
    </div>
  );
}
