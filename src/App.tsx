/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    Hands: any;
    Camera: any;
    drawConnectors: any;
    HAND_CONNECTIONS: any;
    drawLandmarks: any;
  }
}

class Particle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  size: number;
  alpha: number;
  speed: number;
  state: 'forming' | 'formed' | 'dispersing';
  life: number;

  constructor(x: number, y: number, targetX: number, targetY: number, color: string, cw: number, ch: number) {
    this.x = Math.random() * cw;
    this.y = Math.random() * ch;
    this.targetX = targetX;
    this.targetY = targetY;
    this.color = color;
    this.size = 2 + Math.random() * 3.5;
    this.alpha = 0;
    this.speed = 0.04 + Math.random() * 0.06;
    this.state = 'forming';
    this.life = 1;
  }
  update() {
    if (this.state === 'forming') {
      this.x += (this.targetX - this.x) * this.speed;
      this.y += (this.targetY - this.y) * this.speed;
      this.alpha = Math.min(1, this.alpha + 0.04);
      const dist = Math.hypot(this.targetX - this.x, this.targetY - this.y);
      if (dist < 2) this.state = 'formed';
    } else if (this.state === 'formed') {
      this.x += (Math.random() - .5) * .6;
      this.y += (Math.random() - .5) * .6;
    } else if (this.state === 'dispersing') {
      this.x += (Math.random() - .5) * 8;
      this.y -= 2 + Math.random() * 4;
      this.alpha -= 0.03;
      this.size *= 0.97;
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const DIGIT_DOTS: Record<number, number[][]> = {
  1: [[2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[1,1]],
  2: [[0,0],[1,0],[2,0],[3,0],[4,0],
      [4,1],[4,2],[0,2],[1,2],[2,2],[3,2],
      [0,3],[0,4],[0,5],[0,6],
      [1,6],[2,6],[3,6],[4,6]],
  3: [[0,0],[1,0],[2,0],[3,0],[4,0],
      [4,1],[4,2],[4,3],
      [1,3],[2,3],[3,3],
      [4,4],[4,5],[4,6],
      [0,6],[1,6],[2,6],[3,6]],
  4: [[0,0],[0,1],[0,2],[0,3],
      [1,3],[2,3],[3,3],[4,3],
      [4,0],[4,1],[4,2],[4,3],[4,4],[4,5],[4,6]],
  5: [[0,0],[1,0],[2,0],[3,0],[4,0],
      [0,1],[0,2],
      [1,2],[2,2],[3,2],[4,2],
      [4,3],[4,4],[4,5],
      [0,6],[1,6],[2,6],[3,6]],
};

const COLORS: Record<number, string[]> = {
  1: ['#ff9ff3','#ffeaa7','#fd79a8'],
  2: ['#a29bfe','#74b9ff','#00cec9'],
  3: ['#55efc4','#00b894','#ffeaa7'],
  4: ['#74b9ff','#a29bfe','#55efc4'],
  5: ['#fd79a8','#fdcb6e','#e17055','#d63031'],
};

export default function App() {
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fingers, setFingers] = useState(0);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [isHandInFrame, setIsHandInFrame] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const pCanvasRef = useRef<HTMLCanvasElement>(null);
  const hCanvasRef = useRef<HTMLCanvasElement>(null);
  const matrixRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  
  const particlesRef = useRef<Particle[]>([]);
  const animFrameRef = useRef<number>(0);
  
  const currentFingersRef = useRef(0);
  const lastFingersRef = useRef(0);
  const stableCountRef = useRef(0);
  const STABLE_THRESHOLD = 8;
  const handDetectedRef = useRef(false);
  const inFrameRef = useRef(false);
  
  const setHandDetectedStatus = (val: boolean) => {
    if (handDetectedRef.current !== val) {
      handDetectedRef.current = val;
      setIsHandDetected(val);
    }
  };

  const setHandInFrameStatus = (val: boolean) => {
    if (inFrameRef.current !== val) {
      inFrameRef.current = val;
      setIsHandInFrame(val);
    }
  };
  
  // Resize handler
  useEffect(() => {
    function resize() {
      if (pCanvasRef.current && hCanvasRef.current) {
        pCanvasRef.current.width = window.innerWidth;
        pCanvasRef.current.height = window.innerHeight;
        hCanvasRef.current.width = window.innerWidth;
        hCanvasRef.current.height = window.innerHeight;
      }
    }
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Render loop for particles
  useEffect(() => {
    function renderParticles() {
      if (pCanvasRef.current) {
        const ctx = pCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, pCanvasRef.current.width, pCanvasRef.current.height);
          particlesRef.current = particlesRef.current.filter(p => p.alpha > 0 || p.state !== 'dispersing');
          particlesRef.current.forEach(p => { p.update(); p.draw(ctx); });
        }
      }
      animFrameRef.current = requestAnimationFrame(renderParticles);
    }
    renderParticles();
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const buildParticles = (num: number) => {
    particlesRef.current.forEach(p => p.state = 'dispersing');
    
    setTimeout(() => {
      particlesRef.current = particlesRef.current.filter(p => p.alpha > 0);
      
      const dots = DIGIT_DOTS[num];
      if (!dots || !pCanvasRef.current) return;
      
      const cw = pCanvasRef.current.width;
      const ch = pCanvasRef.current.height;
      const cellSize = Math.min(cw, ch) * 0.12;
      const offsetX = cw / 2 - 2.5 * cellSize;
      const offsetY = ch / 2 - 3.5 * cellSize;
      const cols = COLORS[num];
      
      const newParticles: Particle[] = [];
      dots.forEach(([col, row]) => {
        const tx = offsetX + col * cellSize + cellSize / 2;
        const ty = offsetY + row * cellSize + cellSize / 2;
        const count = 4 + Math.floor(Math.random() * 4);
        for (let k = 0; k < count; k++) {
          const color = cols[Math.floor(Math.random() * cols.length)];
          const p = new Particle(0, 0, tx + (Math.random()-0.5)*cellSize*.6, ty + (Math.random()-0.5)*cellSize*.6, color, cw, ch);
          newParticles.push(p);
        }
      });
      particlesRef.current.push(...newParticles);
    }, 300);
  };

  const fireConfetti = () => {
    const palette = ['#ff9ff3','#ffeaa7','#fd79a8','#a29bfe','#55efc4','#fdcb6e','#fff'];
    for (let i = 0; i < 80; i++) {
      setTimeout(() => {
        const c = document.createElement('div');
        c.className = 'confetti-piece';
        c.style.cssText = `
          left:${10+Math.random()*80}vw;top:-8px;
          width:${5+Math.random()*8}px;height:${5+Math.random()*8}px;
          background:${palette[Math.floor(Math.random()*palette.length)]};
          --d:${1.5+Math.random()*2}s;--delay:${Math.random()*.5}s;
          border-radius:${Math.random()>.5?'50%':'3px'};
        `;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 4000);
      }, i * 20);
    }
  };

  const onGestureConfirmed = (n: number) => {
    if (n === currentFingersRef.current) return;
    currentFingersRef.current = n;
    setFingers(n);
    
    if (n === 0) {
      particlesRef.current.forEach(p => p.state = 'dispersing');
      return;
    }
    
    if ([1,2,3,4,5].includes(n)) {
      buildParticles(n);
      if (n === 5) fireConfetti();
    }
  };

  const countFingers = (landmarks: any[]) => {
    const tips = [4, 8, 12, 16, 20];
    const bases = [2, 6, 10, 14, 18];
    let count = 0;
    
    const thumbTip = landmarks[4];
    const thumbBase = landmarks[2];
    const isRightHand = thumbTip.x < landmarks[17].x;
    
    if (isRightHand) {
      if (thumbTip.x < thumbBase.x) count++;
    } else {
      if (thumbTip.x > thumbBase.x) count++;
    }
    
    for (let i = 1; i < 5; i++) {
      if (landmarks[tips[i]].y < landmarks[bases[i]].y) count++;
    }
    return count;
  };

  const initHandDetection = () => {
    setLoading(true);
    
    if (!window.Hands || !window.Camera) {
       console.error("MediaPipe not loaded!");
       return;
    }

    const hands = new window.Hands({
      locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
    });
    
    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.8,
      minTrackingConfidence: 0.8,
    });
    
    hands.onResults((results: any) => {
      if (hCanvasRef.current) {
        const ctx = hCanvasRef.current.getContext('2d');
        if (ctx) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; // Trail fade effect
          ctx.fillRect(0, 0, hCanvasRef.current.width, hCanvasRef.current.height);
          ctx.globalCompositeOperation = 'source-over';
          
          if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            stableCountRef.current = 0;
            lastFingersRef.current = 0;
            onGestureConfirmed(0);
            setHandDetectedStatus(false);
            setHandInFrameStatus(false);
            return;
          }
          
          setHandDetectedStatus(true);
          const landmarks = results.multiHandLandmarks[0];
          
          let currentHandInFrame = false;
          if (frameRef.current && hCanvasRef.current) {
            const rect = frameRef.current.getBoundingClientRect();
            // Check palm center (landmark 9)
            // Screen x is flipped because video is flipped via CSS (-scale-x-100)
            const p9x = (1 - landmarks[9].x) * hCanvasRef.current.width;
            const p9y = landmarks[9].y * hCanvasRef.current.height;
            
            const margin = 20; // Allow a slight margin outside the visual box
            if (p9x >= rect.left - margin && p9x <= rect.right + margin && 
                p9y >= rect.top - margin && p9y <= rect.bottom + margin) {
                currentHandInFrame = true;
            }
          }
          setHandInFrameStatus(currentHandInFrame);

          if (!currentHandInFrame) {
            ctx.save();
            ctx.shadowColor = 'rgba(253, 121, 168, 0.5)';
            ctx.shadowBlur = 10;
            window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
              color: 'rgba(255, 255, 255, 0.2)', lineWidth: 4
            });
            window.drawLandmarks(ctx, landmarks, {
              color: 'rgba(253, 121, 168, 0.4)', lineWidth: 2, radius: 5
            });
            ctx.restore();
            
            stableCountRef.current = 0;
            lastFingersRef.current = 0;
            onGestureConfirmed(0);
            return;
          }
          
          ctx.save();
          ctx.shadowColor = '#00ffff';
          ctx.shadowBlur = 15;
          window.drawConnectors(ctx, landmarks, window.HAND_CONNECTIONS, {
            color: 'rgba(0, 255, 255, 0.8)', lineWidth: 5
          });
          window.drawLandmarks(ctx, landmarks, {
            color: '#ff00ff', lineWidth: 3, radius: 6
          });
          ctx.restore();
          
          const detectedFingers = countFingers(landmarks);
          
          if (detectedFingers === lastFingersRef.current) {
            stableCountRef.current++;
            if (stableCountRef.current >= STABLE_THRESHOLD) {
              onGestureConfirmed(detectedFingers);
            }
          } else {
            stableCountRef.current = 0;
            lastFingersRef.current = detectedFingers;
          }
        }
      }
    });
    
    if (videoRef.current) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => { await hands.send({ image: videoRef.current }); },
        width: 640, height: 480
      });
      
      camera.start().then(() => {
        setLoading(false);
      }).catch((err: any) => {
        setLoading(false);
        console.error(err);
      });
    }
  };

  // Matrix effect
  useEffect(() => {
    if (!started) return;
    const canvas = matrixRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789★'.split('');
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops: number[] = [];
    for (let x = 0; x < columns; x++) {
      drops[x] = 1;
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 0, 100, 0.3)';
      ctx.font = fontSize + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        const text = letters[Math.floor(Math.random() * letters.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };
    const interval = setInterval(draw, 50);
    return () => clearInterval(interval);
  }, [started]);

  const handleStart = () => {
    setStarted(true);
    setTimeout(() => {
      initHandDetection();
    }, 600);
  };

  const pillLabels: Record<number, string> = {
    0: 'No hand detected',
    1: '1️⃣ One!',
    2: '2️⃣ Two!',
    3: '3️⃣ Three!',
    4: '4️⃣ Four!',
    5: '🖐️ Five!'
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden font-sans flex items-center justify-center">
      
      {/* Matrix background */}
      {started && <canvas ref={matrixRef} className="matrix absolute inset-0 w-full h-full z-0 pointer-events-none"></canvas>}

      {/* START SCREEN */}
      {!started && (
        <div className="absolute inset-0 z-50 bg-gradient-to-br from-[#0d0118] via-[#1a0a2e] to-[#0d0118] flex flex-col items-center justify-center gap-7 p-8 text-center transition-opacity duration-[600ms]">
          <div className="start-title text-[clamp(1.8rem,7vw,2.8rem)] text-white font-black leading-tight">
            Happy Birthday<br />
            <span>Elangoo 🎂</span>
          </div>
          <div className="text-sm text-pink-200/60 leading-relaxed max-w-[280px]">
            Show your fingers to the camera<br />
            and watch the magic happen ✨
          </div>
          <button 
            onClick={handleStart}
            className="start-btn border-none rounded-full px-10 py-4 text-[15px] font-bold text-white cursor-pointer pointer-events-auto tracking-wide"
          >
            Open Camera ✨
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 z-[49] bg-black/80 flex flex-col items-center justify-center gap-4 text-pink-300/70 text-sm tracking-widest">
          <div className="spinner w-9 h-9 border-[3px] border-pink-400/20 rounded-full"></div>
          <span>Loading hand detection...</span>
        </div>
      )}

      {/* CAMERA */}
      <video ref={videoRef} playsInline autoPlay muted className="mirrored-video absolute inset-0 w-full h-full object-cover z-10 opacity-40"></video>

      {/* Canvas for particles */}
      <canvas ref={pCanvasRef} className="absolute inset-0 w-full h-full z-30 pointer-events-none"></canvas>

      {/* Canvas for hand landmarks */}
      <canvas ref={hCanvasRef} className="absolute inset-0 w-full h-full z-40 pointer-events-none -scale-x-100"></canvas>

      {/* UI */}
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-between pointer-events-none py-5 px-4 pb-8">
        
        {/* Hand Guide Frame */}
        <div ref={frameRef} className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[55%] w-[70vw] max-w-[320px] h-[55vh] max-h-[460px] border-4 border-dashed rounded-[40px] flex flex-col items-center justify-center pointer-events-none transition-all duration-700 ${fingers > 0 ? 'border-pink-400/0 scale-110 opacity-0' : (isHandDetected && !isHandInFrame ? 'border-red-400/80 scale-100 opacity-100' : 'border-pink-400/40 scale-100 opacity-100')}`}>
           <span className={`text-xs font-bold tracking-widest uppercase transition-opacity duration-300 bg-black/50 px-5 py-2 rounded-full backdrop-blur-sm mt-auto mb-8 ${fingers > 0 ? 'opacity-0' : (isHandDetected && !isHandInFrame ? 'text-red-300 opacity-100' : 'text-pink-300/80 opacity-100')}`}>
             {isHandDetected && !isHandInFrame ? 'Move Hand Into Frame' : 'Place Hand Here'}
           </span>
        </div>

        <div className="flex flex-col items-center gap-1.5 w-full mt-4 z-10">
          <div className="text-[clamp(14px,3.5vw,18px)] text-pink-200/85 tracking-[0.25em] uppercase" style={{ textShadow: '0 0 20px rgba(255,100,180,.6)' }}>
            ✦ Elangoo's Birthday ✦
          </div>
          <div className={`finger-pill rounded-full px-5 py-2 text-[13px] tracking-widest ${(fingers > 0 || (isHandDetected && !isHandInFrame)) ? 'active' : 'text-pink-100/80'} ${isHandDetected && !isHandInFrame ? '!border-red-400/60 !bg-red-500/20 !shadow-[0_0_24px_rgba(248,113,113,0.4)]' : ''}`}>
            {fingers > 0 
              ? (pillLabels[fingers] || `${fingers} fingers`) 
              : (isHandDetected && !isHandInFrame ? '⚠️ Hand outside frame' : 'Show your hand 👋')}
          </div>
        </div>

        <div className={`big-number text-[clamp(100px,40vw,220px)] font-black leading-none pointer-events-none select-none ${fingers > 0 ? 'show' : ''}`}>
          {fingers > 0 ? fingers : ''}
        </div>

        <div className="flex flex-col items-center gap-2.5 w-full mb-4">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
              <div className="text-[22px]">☝️</div>
              <div className="text-[10px] text-white/50 tracking-[0.08em]">1</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
              <div className="text-[22px]">✌️</div>
              <div className="text-[10px] text-white/50 tracking-[0.08em]">2</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
              <div className="text-[22px]">🤟</div>
              <div className="text-[10px] text-white/50 tracking-[0.08em]">3</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
              <div className="text-[22px]">🖖</div>
              <div className="text-[10px] text-white/50 tracking-[0.08em]">4</div>
            </div>
            <div className="flex flex-col items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-md">
              <div className="text-[22px]">🖐️</div>
              <div className="text-[10px] text-white/50 tracking-[0.08em]">5</div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
