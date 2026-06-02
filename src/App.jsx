import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Trash2, X, Check } from 'lucide-react';
import { TYPES, ELEMENTS } from './engine/elements';
import { PhysicsEngine } from './engine/physics';
import './index.css';

const CANVAS_WIDTH = 150;
const CANVAS_HEIGHT = 150;

function App() {
  const canvasRef = useRef(null);
  const canvasContainerRef = useRef(null);
  const [engine] = useState(() => new PhysicsEngine(CANVAS_WIDTH, CANVAS_HEIGHT));
  const [currentElement, setCurrentElement] = useState(TYPES.SAND);
  const [brushSize, setBrushSize] = useState(3);
  const [isPlaying, setIsPlaying] = useState(true);
  const [modalElement, setModalElement] = useState(null);
  const [eclipseInfo, setEclipseInfo] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const hasShownEclipseModal = useRef(false);
  const animationRef = useRef(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageData = ctx.createImageData(CANVAS_WIDTH, CANVAS_HEIGHT);

    const loop = () => {
      if (isDrawing.current && lastPointer.current.x !== -1) {
        let x0 = prevPointer.current.x;
        let y0 = prevPointer.current.y;
        let x1 = lastPointer.current.x;
        let y1 = lastPointer.current.y;
        
        // 브레슨햄 직선 알고리즘으로 빈틈없이 채우기
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;
        
        while (true) {
          draw(x0, y0);
          if (x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x0 += sx; }
          if (e2 < dx) { err += dx; y0 += sy; }
        }
        
        prevPointer.current = { x: lastPointer.current.x, y: lastPointer.current.y };
      }
      if (isPlaying) {
        engine.update();
        if (engine.lightningPhase === 1) {
          canvasContainerRef.current?.classList.add('lightning-dark');
        } else if (engine.lightningPhase === 2 || engine.lightningPhase === 0) {
          canvasContainerRef.current?.classList.remove('lightning-dark');
        }

        let isEclipse = engine.isEclipse;
        
        if (isEclipse) {
          canvasContainerRef.current?.classList.add('eclipse-dark');
          if (!hasShownEclipseModal.current) {
             setEclipseInfo(true);
             hasShownEclipseModal.current = true;
          }
        } else {
          canvasContainerRef.current?.classList.remove('eclipse-dark');
        }
        
        if (engine.sunTimer === 0 && engine.moonTimer === 0) {
           hasShownEclipseModal.current = false;
        }

        if (engine.toastMessage) {
           setToastMessage(engine.toastMessage);
           engine.toastMessage = null;
           setTimeout(() => setToastMessage(null), 4000);
        }
      }
      engine.render(ctx, imageData);
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationRef.current);
  }, [engine, isPlaying, brushSize, currentElement]);

  const draw = (x, y, forceSingle = false) => {
    if (currentElement === TYPES.ANT) {
      for(let i=0; i<20; i++) {
        const randX = x + Math.floor((Math.random() - 0.5) * 15);
        const randY = y + Math.floor((Math.random() - 0.5) * 15);
        engine.set(randX, randY, TYPES.ANT);
      }
      return;
    }
    
    const isSingle = [TYPES.FIREWORK, ...[TYPES.PLANT, TYPES.TREE, TYPES.ANT]].includes(currentElement) || forceSingle;
    
    // 지우개를 제외한 브러시 크기 절반으로 축소
    let effectiveBrushSize = currentElement === TYPES.EMPTY ? brushSize : Math.max(1, Math.floor(brushSize / 2));
    // 사용자가 추가 축소를 원한 경우를 대비해 1/2를 한 번 더 적용할 수 있도록 로직 점검
    // (이미 이전 작업에서 1/2가 되어있었으므로, 현재 의도에 맞게 적용)

    if (currentElement === TYPES.SEED) {
      for(let i=0; i<3; i++) {
        // 씨앗이 흩뿌려지는 범위도 effectiveBrushSize에 맞게 축소
        const randX = x + Math.floor((Math.random() - 0.5) * (effectiveBrushSize * 2));
        const randY = y + Math.floor((Math.random() - 0.5) * (effectiveBrushSize * 2));
        engine.set(randX, randY, TYPES.SEED);
      }
      return;
    }

    if (currentElement === TYPES.FIREWORK || isSingle) {
      engine.set(x, y, currentElement);
      return;
    }

    for (let dy = -effectiveBrushSize; dy <= effectiveBrushSize; dy++) {
      for (let dx = -effectiveBrushSize; dx <= effectiveBrushSize; dx++) {
        if (dx * dx + dy * dy <= effectiveBrushSize * effectiveBrushSize) {
           const type = ELEMENTS[currentElement].type;
           if ((type === 'powder' || type === 'liquid' || type === 'gas') && Math.random() < 0.2) continue;
           engine.set(x + dx, y + dy, currentElement);
        }
      }
    }
  };

  const lastPointer = useRef({ x: -1, y: -1 });
  const prevPointer = useRef({ x: -1, y: -1 });

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: Math.floor((clientX - rect.left) * scaleX),
      y: Math.floor((clientY - rect.top) * scaleY)
    };
  };

  const handlePointerDown = (e) => {
    const isSingleClickElement = [TYPES.SEED, TYPES.PLANT, TYPES.TREE, TYPES.ANT].includes(currentElement);
    const coords = getCanvasCoords(e);
    
    if (isSingleClickElement) {
      if (coords) draw(coords.x, coords.y, true);
      // Do not set isDrawing to true to prevent continuous drawing
      return;
    }

    isDrawing.current = true;
    if (coords) {
      lastPointer.current = coords;
      prevPointer.current = coords;
    }
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return;
    const coords = getCanvasCoords(e);
    if (coords) lastPointer.current = coords;
  };

  const handlePointerUp = () => {
    isDrawing.current = false;
    lastPointer.current = { x: -1, y: -1 };
  };

  const clearCanvas = () => {
    engine.clear();
  };

  const handleSelectElement = (id) => {
    if (id === TYPES.SUN) {
      if (engine.sunTimer > 0 || engine.sunCooldown > 0) {
        setToastMessage("☀️ 해는 60초에 한 번 뜨고 있어요! ☀️");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
    }
    if (id === TYPES.MOON) {
      if (engine.moonTimer > 0 || engine.moonCooldown > 0) {
        setToastMessage("🌙 달은 60초에 한 번 뜨고 있어요! 🌙");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
    }
    if (id === TYPES.WIND) {
      if (engine.windTimer > 0 || engine.windCooldown > 0) {
        setToastMessage("💨 가을바람은 60초에 한 번 불어요! 💨");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
    }

    const el = ELEMENTS[id];
    if (el.warningText) {
      setModalElement(el);
    } else {
      setCurrentElement(id);
    }
  };

  const confirmModal = () => {
    if (modalElement) {
      if (modalElement.id === TYPES.SUN) {
        engine.sunTimer = 1200;
        engine.sunCooldown = 3600;
      } else if (modalElement.id === TYPES.MOON) {
        engine.moonTimer = 1200;
        engine.moonCooldown = 3600;
      } else if (modalElement.id === TYPES.WIND) {
        engine.windTimer = 600; // 10 seconds of wind
        engine.windCooldown = 3600;
      } else {
        setCurrentElement(modalElement.id);
      }
      setModalElement(null);
    }
  };

  const cancelModal = () => {
    setModalElement(null);
  };

  return (
    <div className="app-container">
      {/* Top Bar */}
      <header className="header">
        <h1>🏖️ 모래놀이터_JA★</h1>
        <div className="controls">
          <button onClick={() => setIsPlaying(!isPlaying)} className="icon-btn">
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button onClick={clearCanvas} className="icon-btn text-red-400">
            <Trash2 size={24} color="#ff6b6b" />
          </button>
        </div>
      </header>

      {/* Canvas Area */}
      <div className="canvas-container" ref={canvasContainerRef}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onTouchStart={(e) => { e.preventDefault(); handlePointerDown(e); }}
          onTouchMove={(e) => { e.preventDefault(); handlePointerMove(e); }}
          onTouchEnd={handlePointerUp}
          className="sandbox-canvas"
        />
      </div>

      {/* Brush Size */}
      <div className="brush-slider-container">
        <span className="text-sm">브러시 크기</span>
        <input 
          type="range" 
          min="1" 
          max="15" 
          value={brushSize} 
          onChange={(e) => setBrushSize(parseInt(e.target.value))}
          className="brush-slider"
        />
      </div>

      {/* Element Selector */}
      <div className="element-selector">
        {Object.values(ELEMENTS).filter(el => !el.hidden).map((el) => {
          const isSelected = currentElement === el.id;
          return (
            <button
              key={el.id}
              className={`element-btn ${isSelected ? 'selected' : ''}`}
              style={{ 
                '--el-color': `rgb(${el.color[0]}, ${el.color[1]}, ${el.color[2]})` 
              }}
              onClick={() => handleSelectElement(el.id)}
            >
              <div className="color-swatch"></div>
              <span>{el.name}</span>
            </button>
          );
        })}
      </div>

      {/* Warning Modal */}
      {modalElement && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>⚠️ {modalElement.warningTitle}</h2>
            </div>
            <p className="modal-text">{modalElement.warningText}</p>
            {modalElement.id === TYPES.SUN && <p className="text-sm mt-2 text-yellow-300">현재 온도: 35도 (사막화 진행 중...)</p>}
            {modalElement.id === TYPES.MOON && <p className="text-sm mt-2 text-blue-300">현재 온도: -2도 (극지방화 진행 중...)</p>}
            <div className="modal-actions mt-4">
              <button className="btn-cancel" onClick={cancelModal}>
                <X size={24} /> 안할래요 (X)
              </button>
              <button className="btn-confirm" onClick={confirmModal}>
                <Check size={24} /> 해볼래요! (O)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Eclipse/General Toast */}
      {eclipseInfo && (
        <div className="eclipse-toast">
          <h3>🌞 일식(Solar Eclipse) 발생! 🌚</h3>
          <p>달이 태양과 지구 사이에 위치하여 태양빛을 가리는 현상입니다!</p>
          <button onClick={() => setEclipseInfo(false)}>닫기</button>
        </div>
      )}

      {toastMessage && (
        <div className="eclipse-toast">
          <h3>{toastMessage}</h3>
        </div>
      )}
    </div>
  );
}

export default App;
