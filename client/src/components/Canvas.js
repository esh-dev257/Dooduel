import React, { useRef, useEffect, useCallback } from 'react';
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

function Canvas({ disabled }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const currentStroke = useRef(null);
  const colorRef = useRef('#000000');
  const sizeRef = useRef(4);
  const strokeHistory = useRef([]);

  // Refs for selected UI state (re-render triggers)
  const [selectedColor, setSelectedColor] = React.useState('#000000');
  const [selectedSize, setSelectedSize] = React.useState(4);

  const getCtx = useCallback(() => {
    return canvasRef.current?.getContext('2d');
  }, []);

  // Initialize canvas with white background
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

    isDrawing.current = true;
    currentStroke.current = {
      points: [{ x, y }],
      color: colorRef.current,
      lineWidth: sizeRef.current
    };

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = sizeRef.current;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw a dot for single clicks
    ctx.fillStyle = colorRef.current;
    ctx.beginPath();
    ctx.arc(x, y, sizeRef.current / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [disabled, getCoords, getCtx]);

  const moveStroke = useCallback((e) => {
    if (!isDrawing.current || !currentStroke.current) return;
    e.preventDefault();

    const { x, y } = getCoords(e);
    const ctx = getCtx();
    if (!ctx) return;

    const points = currentStroke.current.points;
    const last = points[points.length - 1];

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentStroke.current.color;
    ctx.lineWidth = currentStroke.current.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

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

  const handleClear = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    strokeHistory.current = [];
    socket.emit('clearCanvas');
  }, [getCtx]);

  const handleUndo = useCallback(() => {
    const ctx = getCtx();
    if (!ctx || strokeHistory.current.length === 0) return;

    strokeHistory.current.pop();

    // Redraw from history
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const stroke of strokeHistory.current) {
      if (stroke.points.length === 1) {
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Re-emit all remaining strokes
    socket.emit('clearCanvas');
    for (const stroke of strokeHistory.current) {
      socket.emit('drawStroke', stroke);
    }
  }, [getCtx]);

  const handleColorChange = useCallback((color) => {
    colorRef.current = color;
    setSelectedColor(color);
  }, []);

  const handleSizeChange = useCallback((size) => {
    sizeRef.current = size;
    setSelectedSize(size);
  }, []);

  // Attach touch listeners to prevent scrolling
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

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className={`draw-canvas ${disabled ? 'disabled' : ''}`}
        onMouseDown={startStroke}
        onMouseMove={moveStroke}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
      />
      {!disabled && (
        <div className="canvas-tools">
          <div className="color-palette">
            {COLORS.map((color) => (
              <button
                key={color}
                className={`color-swatch ${selectedColor === color ? 'active' : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
                title={color}
              />
            ))}
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

export default Canvas;
