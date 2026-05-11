import React, { useRef, useEffect, useCallback, useState } from 'react';
import socket from '../socket';

const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 560;

const COLORS = [
  '#000000', '#FFFFFF', '#E83030',
  '#FF8C00', '#FFD700', '#00C060',
  '#44AAFF', '#9B59B6', '#FF66CC',
  '#8B4513', '#808080', '#C0C0C0',
];

const SIZES = [2, 4, 8, 14, 24];
const DOT_SIZES = [4, 6, 10, 14, 20];

function drawSmoothStroke(ctx, stroke, scaleX = 1, scaleY = 1) {
  const { points, color, lineWidth, type } = stroke;
  if (!points || points.length === 0) return;

  const prevComposite = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = type === 'erase' ? 'destination-out' : 'source-over';
  const scaledLW = lineWidth * Math.min(scaleX, scaleY);

  if (points.length === 1) {
    ctx.fillStyle = type === 'erase' ? 'rgba(0,0,0,1)' : color;
    ctx.beginPath();
    ctx.arc(points[0].x * scaleX, points[0].y * scaleY, scaledLW / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = prevComposite;
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
  if (points.length === 2) {
    ctx.lineTo(points[1].x * scaleX, points[1].y * scaleY);
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x * scaleX + points[i + 1].x * scaleX) / 2;
      const midY = (points[i].y * scaleY + points[i + 1].y * scaleY) / 2;
      ctx.quadraticCurveTo(points[i].x * scaleX, points[i].y * scaleY, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * scaleX, last.y * scaleY);
  }
  ctx.strokeStyle = type === 'erase' ? 'rgba(0,0,0,1)' : color;
  ctx.lineWidth   = scaledLW;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.stroke();
  ctx.globalCompositeOperation = prevComposite;
}

function floodFill(ctx, startX, startY, fillColor, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data      = imageData.data;
  const sx = Math.round(startX), sy = Math.round(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 1; tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.fillStyle = fillColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const fc = tempCtx.getImageData(0, 0, 1, 1).data;

  const startIdx = (sy * width + sx) * 4;
  const [targetR, targetG, targetB, targetA] = [data[startIdx], data[startIdx+1], data[startIdx+2], data[startIdx+3]];
  if (targetR === fc[0] && targetG === fc[1] && targetB === fc[2] && targetA === fc[3]) return;

  const tolerance = 30;
  const matches = (idx) =>
    Math.abs(data[idx]   - targetR) <= tolerance &&
    Math.abs(data[idx+1] - targetG) <= tolerance &&
    Math.abs(data[idx+2] - targetB) <= tolerance &&
    Math.abs(data[idx+3] - targetA) <= tolerance;

  const visited = new Uint8Array(width * height);
  const queue   = [sx + sy * width];
  visited[sx + sy * width] = 1;

  while (queue.length > 0) {
    const pos = queue.pop();
    const px = pos % width, py = (pos - px) / width;
    const idx = pos * 4;
    data[idx] = fc[0]; data[idx+1] = fc[1]; data[idx+2] = fc[2]; data[idx+3] = fc[3];
    const neighbors = [];
    if (px > 0)          neighbors.push(pos - 1);
    if (px < width - 1)  neighbors.push(pos + 1);
    if (py > 0)          neighbors.push(pos - width);
    if (py < height - 1) neighbors.push(pos + width);
    for (const npos of neighbors) {
      if (!visited[npos] && matches(npos * 4)) { visited[npos] = 1; queue.push(npos); }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

function replayFill(ctx, action, scaleX = 1, scaleY = 1, w = CANVAS_WIDTH, h = CANVAS_HEIGHT) {
  floodFill(ctx, action.x * scaleX, action.y * scaleY, action.color, Math.round(w), Math.round(h));
}

function Canvas({ disabled }) {
  const canvasRef     = useRef(null);
  const isDrawing     = useRef(false);
  const currentStroke = useRef(null);
  const colorRef      = useRef('#000000');
  const sizeRef       = useRef(4);
  const strokeHistory = useRef([]);

  const [selectedColor, setSelectedColor] = useState('#000000');
  const [selectedSize,  setSelectedSize]  = useState(4);
  const [activeTool,    setActiveTool]    = useState('pen');

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d'), []);

  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [getCtx]);

  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect   = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    if (e.touches) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const startStroke = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = getCtx();
    if (!ctx) return;

    if (activeTool === 'fill') {
      floodFill(ctx, x, y, colorRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
      strokeHistory.current.push({ type: 'fill', x, y, color: colorRef.current });
      socket.emit('fillAction', { x, y, color: colorRef.current });
      return;
    }

    isDrawing.current = true;
    const type = activeTool === 'eraser' ? 'erase' : 'pen';
    currentStroke.current = { points: [{ x, y }], color: colorRef.current, lineWidth: sizeRef.current, type };

    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = type === 'erase' ? 'destination-out' : 'source-over';
    if (type !== 'erase') ctx.fillStyle = colorRef.current;
    ctx.beginPath();
    ctx.arc(x, y, sizeRef.current / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = prevComp;
  }, [disabled, getCoords, getCtx, activeTool]);

  const moveStroke = useCallback((e) => {
    if (!isDrawing.current || !currentStroke.current) return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = getCtx();
    if (!ctx) return;
    const stroke = currentStroke.current;
    const points = stroke.points;
    const last   = points[points.length - 1];

    const prevComp = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = stroke.type === 'erase' ? 'destination-out' : 'source-over';
    ctx.beginPath();
    if (points.length >= 2) {
      const prev = points[points.length - 2];
      const midX1 = (prev.x + last.x) / 2, midY1 = (prev.y + last.y) / 2;
      const midX2 = (last.x + x) / 2,      midY2 = (last.y + y) / 2;
      ctx.moveTo(midX1, midY1);
      ctx.quadraticCurveTo(last.x, last.y, midX2, midY2);
    } else {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
    }
    ctx.strokeStyle = stroke.type === 'erase' ? 'rgba(0,0,0,1)' : stroke.color;
    ctx.lineWidth   = stroke.lineWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.globalCompositeOperation = prevComp;
    points.push({ x, y });
  }, [getCoords, getCtx]);

  const endStroke = useCallback(() => {
    if (!isDrawing.current || !currentStroke.current) return;
    isDrawing.current = false;
    const stroke = currentStroke.current;
    currentStroke.current = null;
    if (stroke.points.length > 0) {
      strokeHistory.current.push(stroke);
      socket.emit('drawStroke', stroke);
    }
  }, []);

  const redrawAll = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (const entry of strokeHistory.current) {
      if (entry.type === 'fill') replayFill(ctx, entry);
      else drawSmoothStroke(ctx, entry);
    }
  }, [getCtx]);

  const handleClear = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    strokeHistory.current = [];
    socket.emit('clearCanvas');
  }, [getCtx]);

  const handleUndo = useCallback(() => {
    if (strokeHistory.current.length === 0) return;
    strokeHistory.current.pop();
    redrawAll();
    socket.emit('clearCanvas');
    for (const entry of strokeHistory.current) {
      if (entry.type === 'fill') socket.emit('fillAction', { x: entry.x, y: entry.y, color: entry.color });
      else socket.emit('drawStroke', entry);
    }
  }, [redrawAll]);

  const handleColorChange = useCallback((color) => {
    colorRef.current = color;
    setSelectedColor(color);
    if (activeTool === 'eraser') setActiveTool('pen');
  }, [activeTool]);

  const handleCustomColor = useCallback((e) => {
    colorRef.current = e.target.value;
    setSelectedColor(e.target.value);
    if (activeTool === 'eraser') setActiveTool('pen');
  }, [activeTool]);

  const handleSizeChange = useCallback((size) => {
    sizeRef.current = size;
    setSelectedSize(size);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const opts = { passive: false };
    canvas.addEventListener('touchstart',  startStroke, opts);
    canvas.addEventListener('touchmove',   moveStroke,  opts);
    canvas.addEventListener('touchend',    endStroke,   opts);
    canvas.addEventListener('touchcancel', endStroke,   opts);
    return () => {
      canvas.removeEventListener('touchstart',  startStroke, opts);
      canvas.removeEventListener('touchmove',   moveStroke,  opts);
      canvas.removeEventListener('touchend',    endStroke,   opts);
      canvas.removeEventListener('touchcancel', endStroke,   opts);
    };
  }, [startStroke, moveStroke, endStroke]);

  const cursorStyle = activeTool === 'fill' ? 'cursor-crosshair' : activeTool === 'eraser' ? 'cursor-cell' : 'cursor-crosshair';

  return (
    <div className="flex flex-col w-full h-full">

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-6 min-h-0">
        <div className="border-4 border-pixel-border" style={{ boxShadow: '6px 6px 0 #000', lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className={`block ${cursorStyle} ${disabled ? 'opacity-70 pointer-events-none' : ''}`}
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 280px)', width: 'auto', aspectRatio: '800/560' }}
            onMouseDown={startStroke}
            onMouseMove={moveStroke}
            onMouseUp={endStroke}
            onMouseLeave={endStroke}
          />
        </div>
      </div>

      {/* Horizontal toolbar — below canvas */}
      {!disabled && (
        <>
          {/* ── DESKTOP: single row, unchanged ── */}
          <div className="hidden lg:flex flex-row items-center gap-3 px-4 py-2 bg-pixel-panel border-t-4 border-pixel-border flex-wrap flex-shrink-0">

            <div className="flex flex-row gap-2">
              {[
                { id: 'pen',    label: '‎PEN‎ '   },
                { id: 'eraser', label: 'ERASE' },
                { id: 'fill',   label: 'FILL'  },
              ].map(tool => (
                <button
                  key={tool.id}
                  className={`font-pixel text-[8px] px-3 py-2 border-4 shadow-pixel-sm
                    transition-transform duration-75
                    active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                    ${activeTool === tool.id
                      ? 'bg-pixel-gold border-pixel-gold text-pixel-black'
                      : 'bg-pixel-bgdark border-pixel-border text-white hover:border-pixel-gold'}`}
                  onClick={() => setActiveTool(tool.id)}
                >
                  {tool.label}
                </button>
              ))}
            </div>

            <div className="w-0.5 h-8 bg-pixel-borderAlt flex-shrink-0" />

            <div className="flex flex-row gap-2">
              <button
                className="font-pixel text-[8px] px-3 py-2 border-4 border-pixel-border bg-pixel-bgdark text-white shadow-pixel-sm hover:border-pixel-gold active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform duration-75"
                onClick={handleUndo}
              >
                ↩ UNDO
              </button>
              <button
                className="font-pixel text-[8px] px-3 py-2 border-4 border-pixel-border bg-pixel-red text-white shadow-pixel-sm hover:border-pixel-gold active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-transform duration-75"
                onClick={handleClear}
              >
                ✕ CLEAR
              </button>
            </div>

            <div className="w-0.5 h-8 bg-pixel-borderAlt flex-shrink-0" />

            <div className="flex flex-row gap-1 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-7 h-7 border-4 cursor-pointer transition-transform duration-75 hover:scale-110 shadow-pixel-sm
                    ${selectedColor === color && activeTool !== 'eraser'
                      ? 'border-pixel-gold scale-110 shadow-pixel-gold'
                      : 'border-pixel-border'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  aria-label={color}
                />
              ))}
              <label className="w-7 h-7 border-4 border-pixel-border shadow-pixel-sm cursor-pointer flex items-center justify-center bg-pixel-bgdark hover:border-pixel-gold transition-colors duration-75 relative">
                <span className="font-pixel text-[8px] text-white pointer-events-none">+</span>
                <input type="color" className="absolute opacity-0 w-full h-full cursor-pointer" value={selectedColor} onChange={handleCustomColor} />
              </label>
            </div>

            <div className="flex flex-row items-center gap-1">
              <div className="w-0.5 h-8 bg-pixel-borderAlt flex-shrink-0 mr-2" />
              {SIZES.map((size, i) => (
                <button
                  key={size}
                  className={`w-9 h-9 border-4 flex items-center justify-center cursor-pointer shadow-pixel-sm
                    transition-transform duration-75
                    active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                    ${selectedSize === size
                      ? 'border-pixel-gold bg-pixel-bgdark'
                      : 'border-pixel-border bg-pixel-panel hover:border-pixel-gold'}`}
                  onClick={() => handleSizeChange(size)}
                >
                  <div className="bg-white" style={{ width: DOT_SIZES[i], height: DOT_SIZES[i] }} />
                </button>
              ))}
            </div>
          </div>

          {/* ── MOBILE: 3-row compact layout ── */}
          <div className="lg:hidden flex flex-col bg-pixel-panel border-t-4 border-pixel-border flex-shrink-0 px-2 pt-1.5 pb-3 gap-1.5">

            {/* Row 1: tool buttons + undo/clear */}
            <div className="flex flex-row items-center gap-1">
              {[
                { id: 'pen',    label: 'PEN'   },
                { id: 'eraser', label: 'ERASE' },
                { id: 'fill',   label: 'FILL'  },
              ].map(tool => (
                <button
                  key={tool.id}
                  className={`font-pixel text-[7px] px-1.5 py-0.5 border-2 shadow-pixel-sm
                    active:translate-x-[1px] active:translate-y-[1px] active:shadow-none
                    ${activeTool === tool.id
                      ? 'bg-pixel-gold border-pixel-gold text-pixel-black'
                      : 'bg-pixel-bgdark border-pixel-border text-white'}`}
                  onClick={() => setActiveTool(tool.id)}
                >
                  {tool.label}
                </button>
              ))}
              <div className="w-px h-5 bg-pixel-borderAlt mx-1 flex-shrink-0" />
              <button
                className="font-pixel text-[7px] px-1.5 py-0.5 border-2 border-pixel-border bg-pixel-bgdark text-white shadow-pixel-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                onClick={handleUndo}
              >
                ↩ UNDO
              </button>
              <button
                className="font-pixel text-[7px] px-1.5 py-0.5 border-2 border-pixel-border bg-pixel-red text-white shadow-pixel-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                onClick={handleClear}
              >
                ✕ CLEAR
              </button>
            </div>

            {/* Row 2: color swatches */}
            <div className="flex flex-row flex-wrap gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-5 h-5 border-2 cursor-pointer
                    ${selectedColor === color && activeTool !== 'eraser'
                      ? 'border-pixel-gold shadow-pixel-gold'
                      : 'border-pixel-border'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleColorChange(color)}
                  aria-label={color}
                />
              ))}
              <label className="w-5 h-5 border-2 border-pixel-border cursor-pointer flex items-center justify-center bg-pixel-bgdark relative">
                <span className="font-pixel text-[6px] text-white pointer-events-none">+</span>
                <input type="color" className="absolute opacity-0 w-full h-full cursor-pointer" value={selectedColor} onChange={handleCustomColor} />
              </label>
            </div>

            {/* Row 3: size buttons — all 5 in one line */}
            <div className="flex flex-row items-center gap-1">
              {SIZES.map((size, i) => (
                <button
                  key={size}
                  className={`w-7 h-7 border-2 flex items-center justify-center cursor-pointer
                    active:translate-x-[1px] active:translate-y-[1px]
                    ${selectedSize === size
                      ? 'border-pixel-gold bg-pixel-bgdark'
                      : 'border-pixel-border bg-pixel-panel'}`}
                  onClick={() => handleSizeChange(size)}
                >
                  <div className="bg-white" style={{ width: DOT_SIZES[i] - 2, height: DOT_SIZES[i] - 2 }} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

Canvas.drawSmoothStroke = drawSmoothStroke;
Canvas.replayFill       = replayFill;
Canvas.CANVAS_WIDTH     = CANVAS_WIDTH;
Canvas.CANVAS_HEIGHT    = CANVAS_HEIGHT;

export default Canvas;
