import React, { useRef, useEffect, useCallback, useState } from 'react';
import socket from '../socket';
import './Canvas.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 560;

const COLORS = [
  '#000000', '#ffffff', '#ff0000', '#ff6600', '#ffcc00',
  '#33cc33', '#0099ff', '#6633ff', '#ff33cc', '#996633',
  '#666666', '#cccccc'
];

const SIZES = [2, 4, 8, 14, 24];

// Smooth bezier rendering for a stroke
function drawSmoothStroke(ctx, stroke, scaleX = 1, scaleY = 1) {
  const { points, color, lineWidth, type } = stroke;
  if (!points || points.length === 0) return;

  const prevComposite = ctx.globalCompositeOperation;
  if (type === 'erase') {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
  }

  const scaledLW = lineWidth * Math.min(scaleX, scaleY);

  if (points.length === 1) {
    if (type === 'erase') {
      ctx.beginPath();
      ctx.arc(points[0].x * scaleX, points[0].y * scaleY, scaledLW / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(points[0].x * scaleX, points[0].y * scaleY, scaledLW / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = prevComposite;
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x * scaleX, points[0].y * scaleY);

  if (points.length === 2) {
    ctx.lineTo(points[1].x * scaleX, points[1].y * scaleY);
  } else {
    // Quadratic bezier through midpoints for smoothness
    for (let i = 1; i < points.length - 1; i++) {
      const midX = (points[i].x * scaleX + points[i + 1].x * scaleX) / 2;
      const midY = (points[i].y * scaleY + points[i + 1].y * scaleY) / 2;
      ctx.quadraticCurveTo(points[i].x * scaleX, points[i].y * scaleY, midX, midY);
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * scaleX, last.y * scaleY);
  }

  ctx.strokeStyle = type === 'erase' ? 'rgba(0,0,0,1)' : color;
  ctx.lineWidth = scaledLW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.globalCompositeOperation = prevComposite;
}

// Flood fill algorithm (BFS)
function floodFill(ctx, startX, startY, fillColor, width, height) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const sx = Math.round(startX);
  const sy = Math.round(startY);
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

  // Parse fill color
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.fillStyle = fillColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const fc = tempCtx.getImageData(0, 0, 1, 1).data;

  const startIdx = (sy * width + sx) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];

  // Don't fill if already same color
  if (targetR === fc[0] && targetG === fc[1] && targetB === fc[2] && targetA === fc[3]) return;

  const tolerance = 30;
  function matches(idx) {
    return (
      Math.abs(data[idx] - targetR) <= tolerance &&
      Math.abs(data[idx + 1] - targetG) <= tolerance &&
      Math.abs(data[idx + 2] - targetB) <= tolerance &&
      Math.abs(data[idx + 3] - targetA) <= tolerance
    );
  }

  const visited = new Uint8Array(width * height);
  const queue = [sx + sy * width];
  visited[sx + sy * width] = 1;

  while (queue.length > 0) {
    const pos = queue.pop();
    const px = pos % width;
    const py = (pos - px) / width;
    const idx = pos * 4;

    data[idx] = fc[0];
    data[idx + 1] = fc[1];
    data[idx + 2] = fc[2];
    data[idx + 3] = fc[3];

    const neighbors = [];
    if (px > 0) neighbors.push(pos - 1);
    if (px < width - 1) neighbors.push(pos + 1);
    if (py > 0) neighbors.push(pos - width);
    if (py < height - 1) neighbors.push(pos + width);

    for (const npos of neighbors) {
      if (!visited[npos] && matches(npos * 4)) {
        visited[npos] = 1;
        queue.push(npos);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// Replay a fill action on canvas
function replayFill(ctx, action, scaleX = 1, scaleY = 1, w = CANVAS_WIDTH, h = CANVAS_HEIGHT) {
  const x = action.x * scaleX;
  const y = action.y * scaleY;
  floodFill(ctx, x, y, action.color, Math.round(w), Math.round(h));
}

function Canvas({ disabled }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);
  const colorRef = useRef('#000000');
  const sizeRef = useRef(4);
  const strokeHistory = useRef([]);

  const [selectedColor, setSelectedColor] = useState('#000000');
  const [selectedSize, setSelectedSize] = useState(4);
  const [activeTool, setActiveTool] = useState('pen');

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d'), []);

  // Initialize canvas
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }, [getCtx]);

  const getCoords = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);


  const startStroke = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();

    const { x, y } = getCoords(e);
    const ctx = getCtx();
    if (!ctx) return;

    // Handle fill tool
    if (activeTool === 'fill') {
      floodFill(ctx, x, y, colorRef.current, CANVAS_WIDTH, CANVAS_HEIGHT);
      strokeHistory.current.push({ type: 'fill', x, y, color: colorRef.current });
      socket.emit('fillAction', { x, y, color: colorRef.current });
      return;
    }

    isDrawing.current = true;
    const type = activeTool === 'eraser' ? 'erase' : 'pen';
    currentStroke.current = {
      points: [{ x, y }],
      color: colorRef.current,
      lineWidth: sizeRef.current,
      type
    };
    // Draw initial dot
    const prevComp = ctx.globalCompositeOperation;
    if (type === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, sizeRef.current / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = colorRef.current;
      ctx.beginPath();
      ctx.arc(x, y, sizeRef.current / 2, 0, Math.PI * 2);
      ctx.fill();
    }
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
    const last = points[points.length - 1];

    const prevComp = ctx.globalCompositeOperation;
    if (stroke.type === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }

    // Draw smooth segment
    ctx.beginPath();
    if (points.length >= 2) {
      const prev = points[points.length - 2];
      const midX1 = (prev.x + last.x) / 2;
      const midY1 = (prev.y + last.y) / 2;
      const midX2 = (last.x + x) / 2;
      const midY2 = (last.y + y) / 2;
      ctx.moveTo(midX1, midY1);
      ctx.quadraticCurveTo(last.x, last.y, midX2, midY2);
    } else {
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
    }

    ctx.strokeStyle = stroke.type === 'erase' ? 'rgba(0,0,0,1)' : stroke.color;
    ctx.lineWidth = stroke.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
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

  // Redraw from stroke history
  const redrawAll = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const entry of strokeHistory.current) {
      if (entry.type === 'fill') {
        replayFill(ctx, entry);
      } else {
        drawSmoothStroke(ctx, entry);
      }
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
      if (entry.type === 'fill') {
        socket.emit('fillAction', { x: entry.x, y: entry.y, color: entry.color });
      } else {
        socket.emit('drawStroke', entry);
      }
    }
  }, [redrawAll]);

  const handleColorChange = useCallback((color) => {
    colorRef.current = color;
    setSelectedColor(color);
    if (activeTool === 'eraser') setActiveTool('pen');
  }, [activeTool]);

  const handleCustomColor = useCallback((e) => {
    const color = e.target.value;
    colorRef.current = color;
    setSelectedColor(color);
    if (activeTool === 'eraser') setActiveTool('pen');
  }, [activeTool]);

  const handleSizeChange = useCallback((size) => {
    sizeRef.current = size;
    setSelectedSize(size);
  }, []);

  const handleToolChange = useCallback((tool) => {
    setActiveTool(tool);
  }, []);


  // Attach touch listeners
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

  const cursorClass = activeTool === 'eraser' ? 'eraser-cursor'
    : activeTool === 'fill' ? 'fill-cursor' : '';

  return (
    <div className="canvas-container">
      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`draw-canvas ${disabled ? 'disabled' : ''} ${cursorClass}`}
          onMouseDown={startStroke}
          onMouseMove={moveStroke}
          onMouseUp={endStroke}
          onMouseLeave={endStroke}
        />
      </div>
      {!disabled && (
        <div className="canvas-tools">
          <div className="tool-group">
            <button
              className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`}
              onClick={() => handleToolChange('pen')}
              title="Pen"
            >
              Pen
            </button>
            <button
              className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
              onClick={() => handleToolChange('eraser')}
              title="Eraser"
            >
              Eraser
            </button>
            <button
              className={`tool-btn ${activeTool === 'fill' ? 'active' : ''}`}
              onClick={() => handleToolChange('fill')}
              title="Fill"
            >
              Fill
            </button>
          </div>

          <div className="color-palette">
            {COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${selectedColor === color && activeTool !== 'eraser' ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
                title={color}
              />
            ))}
            <input
              type="color"
              className="color-picker-input"
              value={selectedColor}
              onChange={handleCustomColor}
              title="Custom color"
            />
          </div>

          <div className="size-picker">
            {SIZES.map((size) => (
              <button
                key={size}
                className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                onClick={() => handleSizeChange(size)}
                title={`${size}px`}
              >
                <span
                  className="size-dot"
                  style={{
                    width: Math.min(size, 20),
                    height: Math.min(size, 20)
                  }}
                />
              </button>
            ))}
          </div>

          <div className="canvas-actions">
            <button className="tool-btn" onClick={handleUndo}>Undo</button>
            <button className="tool-btn danger" onClick={handleClear}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export utilities for Voting and GameSummary replay
Canvas.drawSmoothStroke = drawSmoothStroke;
Canvas.replayFill = replayFill;
Canvas.CANVAS_WIDTH = CANVAS_WIDTH;
Canvas.CANVAS_HEIGHT = CANVAS_HEIGHT;

export default Canvas;
