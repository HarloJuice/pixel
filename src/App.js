import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

const App = () => {
  const [gridSize] = useState(16); // Сітка 16x16
  const [pixelSize] = useState(25); // Розмір пікселя в px
  const [currentColor, setCurrentColor] = useState('#000000'); // Поточний колір
  const [pixels, setPixels] = useState(Array(gridSize * gridSize).fill('#ffffff')); // Білий фон
  const [tempPixels, setTempPixels] = useState(null); // Тимчасові зміни під час малювання
  const [isMouseDown, setIsMouseDown] = useState(false); // Чи затиснута мишка
  const [isErasing, setIsErasing] = useState(false); // Чи активна гумка
  const [history, setHistory] = useState([pixels]); // Історія станів
  const [historyIndex, setHistoryIndex] = useState(0); // Поточний індекс у стеку
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawGrid = (ctx) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const displayPixels = tempPixels || pixels; // Використовуємо tempPixels, якщо є
      displayPixels.forEach((color, index) => {
        const x = (index % gridSize) * pixelSize;
        const y = Math.floor(index / gridSize) * pixelSize;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, pixelSize, pixelSize);
        ctx.strokeStyle = '#ccc';
        ctx.strokeRect(x, y, pixelSize, pixelSize);
      });
    };

    drawGrid(ctx);
  }, [pixels, tempPixels, gridSize, pixelSize]);

  const saveToHistory = useCallback((newPixels) => {
    const newHistory = history.slice(0, historyIndex + 1); // Обрізаємо вперед
    newHistory.push([...newPixels]); // Додаємо новий стан
    if (newHistory.length > 50) newHistory.shift(); // Обмежуємо стек до 50
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setPixels([...history[historyIndex - 1]]);
      setTempPixels(null); // Очищаємо тимчасові зміни
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setPixels([...history[historyIndex + 1]]);
      setTempPixels(null); // Очищаємо тимчасові зміни
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
    setTempPixels([...pixels]); // Починаємо новий сеанс малювання

    if (e.shiftKey) {
      handleFloodFill(e, color);
    } else {
      handlePaint(e, color);
    }
  };

  const handleMouseUp = () => {
    if (isMouseDown && tempPixels) {
      setPixels([...tempPixels]); // Фіксуємо зміни
      saveToHistory(tempPixels); // Додаємо до історії
      setTempPixels(null); // Очищаємо тимчасові зміни
    }
    setIsMouseDown(false);
    setIsErasing(false);
  };

  const handleMouseMove = (e) => {
    if (isMouseDown && !e.shiftKey) {
      const color = isErasing ? '#ffffff' : currentColor;
      handlePaint(e, color);
    }
  };

  const handlePaint = (e, color) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pixelX = Math.floor(x / pixelSize);
    const pixelY = Math.floor(y / pixelSize);
    const index = pixelY * gridSize + pixelX;

    if (index >= 0 && index < pixels.length) {
      const newTempPixels = [...(tempPixels || pixels)];
      newTempPixels[index] = color;
      setTempPixels(newTempPixels); // Оновлюємо тимчасові пікселі
    }
  };

  const handleFloodFill = (e, newColor) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pixelX = Math.floor(x / pixelSize);
    const pixelY = Math.floor(y / pixelSize);
    const index = pixelY * gridSize + pixelX;

    if (index < 0 || index >= pixels.length) return;

    const targetColor = pixels[index];
    if (targetColor === newColor) return;

    const newPixels = [...pixels];
    floodFill(pixelX, pixelY, targetColor, newColor, newPixels);
    setPixels(newPixels);
    saveToHistory(newPixels);
    setTempPixels(null); // Очищаємо тимчасові зміни
  };

  const floodFill = (x, y, targetColor, newColor, pixels) => {
    const index = y * gridSize + x;
    if (x < 0 || x >= gridSize || y < 0 || y >= gridSize || pixels[index] !== targetColor) {
      return;
    }

    pixels[index] = newColor;

    floodFill(x + 1, y, targetColor, newColor, pixels);
    floodFill(x - 1, y, targetColor, newColor, pixels);
    floodFill(x, y + 1, targetColor, newColor, pixels);
    floodFill(x, y - 1, targetColor, newColor, pixels);
  };

  const clearCanvas = () => {
    const newPixels = Array(gridSize * gridSize).fill('#ffffff');
    setPixels(newPixels);
    saveToHistory(newPixels);
    setTempPixels(null);
  };

  return (
    <div className="app">
      <h1>Чувак, малюй свій піксель-арт! 😎</h1>
      <div className="toolbar">
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
        <button onClick={clearCanvas}>Очистити полотно</button>
        <button onClick={undo} disabled={historyIndex === 0}>Undo (Ctrl+Z)</button>
        <button onClick={redo} disabled={historyIndex === history.length - 1}>Redo (Ctrl+Y)</button>
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
      <p>Ліва кнопка — малювати, права — стирати, Shift + клік — заливка, Ctrl+Z/Y — undo/redo!</p>
    </div>
  );
};

export default App;