import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

const App = () => {
  const [gridSize, setGridSize] = useState(16); // Сітка 16x16 за замовчуванням
  const [pixelSize, setPixelSize] = useState(50); // Розмір пікселя в px (800/16)
  const [currentColor, setCurrentColor] = useState('#000000'); // Поточний колір
  const [pixels, setPixels] = useState(() => {
    const saved = localStorage.getItem('pixelArt');
    return saved ? JSON.parse(saved) : Array(gridSize * gridSize).fill('#ffffff');
  }); // Білий фон або з localStorage
  const [tempPixels, setTempPixels] = useState(null); // Тимчасові зміни
  const [isMouseDown, setIsMouseDown] = useState(false); // Чи затиснута мишка
  const [isErasing, setIsErasing] = useState(false); // Чи активна гумка
  const [brushSize, setBrushSize] = useState(1); // Розмір пензля (1x1 або 2x2)
  const [history, setHistory] = useState([pixels]); // Історія станів
  const [historyIndex, setHistoryIndex] = useState(0); // Індекс у стеку
  const [fileName, setFileName] = useState('pixel-art'); // Назва файлу
  const canvasRef = useRef(null);
  const rafRef = useRef(null); // Для requestAnimationFrame

  const drawPixel = useCallback((ctx, index, color) => {
    const x = (index % gridSize) * pixelSize;
    const y = Math.floor(index / gridSize) * pixelSize;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, pixelSize, pixelSize);
    ctx.strokeStyle = '#ccc';
    ctx.strokeRect(x, y, pixelSize, pixelSize);
  }, [gridSize, pixelSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Початкове заповнення canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pixels.forEach((color, index) => {
      drawPixel(ctx, index, color);
    });

    // Збереження в localStorage при зміні pixels
    localStorage.setItem('pixelArt', JSON.stringify(pixels));
  }, [pixels, gridSize, pixelSize, drawPixel]);

  const saveToHistory = useCallback((newPixels) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...newPixels]);
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setPixels([...history[historyIndex - 1]]);
      setTempPixels(null);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setPixels([...history[historyIndex + 1]]);
      setTempPixels(null);
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleMouseDown = (e) => {
    e.preventDefault();
    const erasing = e.button === 2;
    setIsMouseDown(true);
    setIsErasing(erasing);
    const color = erasing ? '#ffffff' : currentColor;
    setTempPixels([...pixels]);

    if (e.shiftKey) {
      handleFloodFill(e, color);
    } else {
      handlePaint(e, color);
    }
  };

  const handleMouseUp = () => {
    if (isMouseDown && tempPixels) {
      setPixels([...tempPixels]);
      saveToHistory(tempPixels);
      setTempPixels(null);
    }
    setIsMouseDown(false);
    setIsErasing(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
  };

  const handleMouseMove = (e) => {
    if (isMouseDown && !e.shiftKey) {
      const color = isErasing ? '#ffffff' : currentColor;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => handlePaint(e, color));
    }
  };

  const handlePaint = (e, color) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pixelX = Math.floor(x / pixelSize);
    const pixelY = Math.floor(y / pixelSize);
    const index = pixelY * gridSize + pixelX;

    if (index < 0 || index >= pixels.length) return;

    const newTempPixels = [...(tempPixels || pixels)];
    if (brushSize === 1) {
      if (newTempPixels[index] !== color) {
        newTempPixels[index] = color;
        drawPixel(ctx, index, color);
      }
    } else if (brushSize === 2) {
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const newX = pixelX + dx;
          const newY = pixelY + dy;
          const newIndex = newY * gridSize + newX;
          if (newX >= 0 && newX < gridSize && newY >= 0 && newY < gridSize && newTempPixels[newIndex] !== color) {
            newTempPixels[newIndex] = color;
            drawPixel(ctx, newIndex, color);
          }
        }
      }
    }
    setTempPixels(newTempPixels);
  };

  const handleFloodFill = (e, newColor) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pixelX = Math.floor(x / pixelSize);
    const pixelY = Math.floor(y / pixelSize);
    const index = pixelY * gridSize + pixelX;

    if (index < 0 || index >= pixels.length) return;

    const targetColor = pixels[index];
    if (targetColor === newColor) return;

    const newPixels = [...pixels];
    floodFill(pixelX, pixelY, targetColor, newColor, newPixels, ctx);
    setPixels(newPixels);
    saveToHistory(newPixels);
    setTempPixels(null);
  };

  const floodFill = (x, y, targetColor, newColor, pixels, ctx) => {
    const index = y * gridSize + x;
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || pixels[index] !== targetColor) {
      return;
    }

    pixels[index] = newColor;
    drawPixel(ctx, index, newColor);

    floodFill(x + 1, y, targetColor, newColor, pixels, ctx);
    floodFill(x - 1, y, targetColor, newColor, pixels, ctx);
    floodFill(x, y + 1, targetColor, newColor, pixels, ctx);
    floodFill(x, y - 1, targetColor, newColor, pixels, ctx);
  };

  const clearCanvas = () => {
    const newPixels = Array(gridSize * gridSize).fill('#ffffff');
    setPixels(newPixels);
    saveToHistory(newPixels);
    setTempPixels(null);
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    const safeFileName = fileName.trim() || 'pixel-art';
    link.download = `${safeFileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const changeGridSize = (newSize) => {
    setGridSize(newSize);
    setPixelSize(800 / newSize); // Зберігаємо розмір canvas ~800x800
    const newPixels = Array(newSize * newSize).fill('#ffffff');
    setPixels(newPixels);
    setHistory([newPixels]);
    setHistoryIndex(0);
    setTempPixels(null);
    localStorage.setItem('pixelArt', JSON.stringify(newPixels));
  };

  const saveToLocalStorage = () => {
    localStorage.setItem('pixelArt', JSON.stringify(pixels));
    alert('Малюнок збережено в localStorage!');
  };

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('pixelArt');
    if (saved) {
      const savedPixels = JSON.parse(saved);
      if (savedPixels.length === gridSize * gridSize) {
        setPixels(savedPixels);
        setHistory([savedPixels]);
        setHistoryIndex(0);
        setTempPixels(null);
        alert('Малюнок завантажено з localStorage!');
      } else {
        alert('Збережений малюнок не відповідає розміру сітки!');
      }
    } else {
      alert('Немає збереженого малюнка!');
    }
  };

  return (
    <div className="app">
      <h1>Чувак, малюй свій піксель-арт! 😎</h1>
      <div className="toolbar">
        <div className="toolbar-row">
          <div className="palette">
            {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'].map((color) => (
              <button
                key={color}
                style={{ backgroundColor: color, width: '30px', height: '30px', border: '2px solid #333' }}
                onClick={() => setCurrentColor(color)}
              />
            ))}
          </div>
          <input
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
          />
          <select
            value={gridSize}
            onChange={(e) => changeGridSize(Number(e.target.value))}
            className="grid-size-select"
          >
            <option value={16}>16x16</option>
            <option value={32}>32x32</option>
            <option value={64}>64x64</option>
          </select>
          <select
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="brush-size-select"
          >
            <option value={1}>Пензель 1x1</option>
            <option value={2}>Пензель 2x2</option>
          </select>
        </div>
        <div className="toolbar-row">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Назва файлу"
            className="filename-input"
          />
          <div className="action-buttons">
            <button onClick={clearCanvas}>Очистити полотно</button>
            <button onClick={undo} disabled={historyIndex === 0}>Undo (Ctrl+Z)</button>
            <button onClick={redo} disabled={historyIndex === history.length - 1}>Redo (Ctrl+Y)</button>
            <button onClick={saveToLocalStorage}>Зберегти</button>
            <button onClick={loadFromLocalStorage}>Завантажити</button>
            <button onClick={exportCanvas} className="export-button">Експорт PNG</button>
          </div>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={gridSize * pixelSize}
        height={gridSize * pixelSize}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ border: '2px solid #333', cursor: 'crosshair' }}
      />
      <p>Ліва кнопка — малювати, права — стирати, Shift + клік — заливка, Ctrl+Z/Y — undo/redo, вибери пензель, розмір сітки і експортуй PNG!</p>
      <p>test for commit</p>
    </div>

    
  );
};

export default App;

//for commit