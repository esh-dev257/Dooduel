import React, { useRef, useEffect, useCallback, useState } from 'react';
import socket from '../socket';

const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 560;

const COLORS = [
  '#000000', '#ffffff', '#ff0000', '#ff6600', '#ffcc00',
  '#33cc33', '#0099ff', '#6633ff', '#ff33cc', '#996633',
  '#666666', '#cccccc'
];

const SIZES = [2, 4, 8, 14, 24];

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
    Math.abs(data[idx] - targetR) <= tolerance &&
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
    if (px > 0) neighbors.push(pos - 1);
    if (px < width - 1) neighbors.push(pos + 1);
    if (py > 0) neighbors.push(pos - width);
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

    isDrawing.current  = true;
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
    canvas.addEventListener('touchstart', startStroke, opts);
    canvas.addEventListener('touchmove', moveStroke, opts);
    canvas.addEventListener('touchend', endStroke, opts);
    canvas.addEventListener('touchcancel', endStroke, opts);
    return () => {
      canvas.removeEventListener('touchstart', startStroke, opts);
      canvas.removeEventListener('touchmove', moveStroke, opts);
      canvas.removeEventListener('touchend', endStroke, opts);
      canvas.removeEventListener('touchcancel', endStroke, opts);
    };
  }, [startStroke, moveStroke, endStroke]);

  const cursorStyle = activeTool === 'eraser' ? 'cursor-cell' : activeTool === 'fill' ? 'cursor-crosshair' : 'cursor-crosshair';

  const toolBtn = (tool, label) => (
    <button
      className={`pixel-btn-secondary w-full font-pixel text-[8px] py-1 px-1 transition-colors duration-75
        ${activeTool === tool ? 'border-pixel-gold bg-pixel-gold text-pixel-black' : 'hover:border-pixel-cyan'}`}
      onClick={() => setActiveTool(tool)}
    >
      {label}
    </button>
  );

  const dotSize = [4, 6, 10, 14, 20];

  return (
    <div className="flex flex-col sm:flex-row w-full h-full">
      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-2">
        <div className="border-4 border-pixel-border" style={{ boxShadow: '4px 4px 0 #000', lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className={`block max-w-full ${cursorStyle} ${disabled ? 'opacity-70 pointer-events-none' : ''}`}
            style={{ maxHeight: 'calc(100vh - 200px)', width: 'auto' }}
            onMouseDown={startStroke}
            onMouseMove={moveStroke}
            onMouseUp={endStroke}
            onMouseLeave={endStroke}
          />
        </div>
      </div>

      {/* Toolbar */}
      {!disabled && (
        <div className="w-full sm:w-[120px] flex-shrink-0 bg-pixel-panel border-t-4 sm:border-t-0 sm:border-l-4 border-pixel-border flex flex-col gap-2 p-2">
          {/* Tools */}
          <div className="flex sm:flex-col gap-1">
            {toolBtn('pen',    '✏ PEN')}
            {toolBtn('eraser', '◻ ERASE')}
            {toolBtn('fill',   '▣ FILL')}
          </div>

          <div className="border-t-2 border-pixel-panelBorder" />

          {/* Undo / Clear */}
          <div className="flex sm:flex-col gap-1">
            <button className="pixel-btn-secondary w-full font-pixel text-[8px] py-1" onClick={handleUndo}>
              ↩ UNDO
            </button>
            <button className="pixel-btn-danger w-full font-pixel text-[8px] py-1" onClick={handleClear}>
              ✕ CLEAR
            </button>
          </div>

          <div className="border-t-2 border-pixel-panelBorder" />

          {/* Color palette */}
          <div className="grid grid-cols-7 sm:grid-cols-3 gap-1">
            {COLORS.map((color) => (
              <button
                key={color}
                className={`w-full aspect-square border-4 cursor-pointer transition-transform duration-75
                  ${selectedColor === color && activeTool !== 'eraser'
                    ? 'border-pixel-gold scale-110'
                    : 'border-pixel-border hover:border-pixel-white hover:-translate-y-0.5'}`}
                style={{
                  backgroundColor: color,
                  boxShadow: selectedColor === color && activeTool !== 'eraser' ? '4px 4px 0 #B8860B' : '2px 2px 0 #000',
                }}
                onClick={() => handleColorChange(color)}
                title={color}
              />
            ))}
            {/* Custom color */}
            <div className="relative w-full aspect-square border-4 border-pixel-border cursor-pointer"
              style={{ backgroundColor: selectedColor, boxShadow: '2px 2px 0 #000' }}>
              <input
                type="color"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                value={selectedColor}
                onChange={handleCustomColor}
                title="Custom color"
              />
              <span className="absolute inset-0 flex items-center justify-center text-[6px] font-pixel text-white pointer-events-none"
                style={{ textShadow: '1px 1px 0 #000' }}>+</span>
            </div>
          </div>

          <div className="border-t-2 border-pixel-panelBorder" />

          {/* Size picker */}
          <div className="flex sm:flex-col gap-1">
            {SIZES.map((size, i) => (
              <button
                key={size}
                className={`w-full border-4 flex items-center justify-center py-1 cursor-pointer transition-colors duration-75
                  ${selectedSize === size
                    ? 'border-pixel-gold bg-pixel-bgdark'
                    : 'border-pixel-border bg-pixel-bgdark hover:border-pixel-gold'}`}
                style={{ minHeight: '28px' }}
                onClick={() => handleSizeChange(size)}
                title={`${size}px`}
              >
                <span
                  className="bg-pixel-white block"
                  style={{ width: dotSize[i], height: dotSize[i], borderRadius: 0 }}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

Canvas.drawSmoothStroke = drawSmoothStroke;
Canvas.replayFill       = replayFill;
Canvas.CANVAS_WIDTH     = CANVAS_WIDTH;
Canvas.CANVAS_HEIGHT    = CANVAS_HEIGHT;

export default Canvas;
