import React, { useEffect, useRef } from 'react';

export default function RollingGraph({ 
  data, 
  threshold, 
  color = '#00ff00', 
  markers = [], 
  isFrozen = false 
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;

    // Fundo fixo para performance
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);

    // Grid de fundo
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    for(let i=1; i<10; i++) {
      ctx.beginPath(); ctx.moveTo(W*i/10, 0); ctx.lineTo(W*i/10, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H*i/10); ctx.lineTo(W, H*i/10); ctx.stroke();
    }

    // Linha de Threshold (Vermelha)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    const ty = H/2 - (threshold * H/2);
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.moveTo(0, ty); ctx.lineTo(W, ty); ctx.stroke();
    ctx.setLineDash([]);

    // Desenho do transiente em modo Sólido (Envelope)
    ctx.beginPath();
    ctx.strokeStyle = isFrozen ? '#00ffff' : color;
    ctx.lineWidth = 1.5;

    const samplesPerPixel = data.length / W;
    for (let x = 0; x < W; x++) {
      const startIdx = Math.floor(x * samplesPerPixel);
      let max = 0;
      let min = 0;
      // Pega o pico da fatia para evitar que o transiente suma em zooms grandes
      for (let i = 0; i < samplesPerPixel; i++) {
        const val = data[startIdx + i] || 0;
        if (val > max) max = val;
        if (val < min) min = val;
      }
      ctx.moveTo(x, H/2 - (min * H/2));
      ctx.lineTo(x, H/2 - (max * H/2));
    }
    ctx.stroke();

    // Marcadores de Pico Automáticos
    markers.forEach((mIdx, i) => {
      const x = (mIdx / data.length) * W;
      ctx.fillStyle = i === 0 ? '#ff00ff' : '#ffff00';
      ctx.fillRect(x - 1, 0, 3, H);
    });

  }, [data, threshold, color, markers, isFrozen]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}
