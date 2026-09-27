import React, { useEffect, useRef } from 'react';
import { Sparkles, Trophy } from 'lucide-react';

interface GoldenFireworksProps {
  isOpen: boolean;
  bookTitle?: string;
  onClose: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  type: 'star' | 'circle' | 'spark';
  rotation: number;
  rotSpeed: number;
  gravity: number;
  flickerSpeed: number;
  flickerOffset: number;
}

interface Rocket {
  x: number;
  y: number;
  targetY: number;
  vx: number;
  vy: number;
  color: string;
  exploded: boolean;
}

export const GoldenFireworks: React.FC<GoldenFireworksProps> = ({
  isOpen,
  bookTitle,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    const goldPalette = [
      '#FFFFFF', // Pure white
      '#F4F4F5', // Light zinc
      '#E4E4E7', // Silver light
      '#D4D4D8', // Metallic silver
      '#A1A1AA', // Zinc metallic
      '#71717A', // Dark metallic
      '#E5E7EB', // Slate shimmer
      '#F3F4F6', // Platinum
      '#FFFFFF', // Light sparkle
    ];

    const particles: Particle[] = [];
    const rockets: Rocket[] = [];

    const createExplosion = (x: number, y: number, count = 70) => {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = Math.random() * 6.5 + 2.5;
        const color = goldPalette[Math.floor(Math.random() * goldPalette.length)];
        const isStar = Math.random() > 0.45;
        const isSpark = !isStar && Math.random() > 0.5;

        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed * (Math.random() * 0.8 + 0.6),
          vy: Math.sin(angle) * speed * (Math.random() * 0.8 + 0.6),
          color,
          size: isStar ? Math.random() * 4.5 + 2.5 : isSpark ? Math.random() * 2 + 1 : Math.random() * 3 + 2,
          alpha: 1,
          decay: Math.random() * 0.012 + 0.011,
          type: isStar ? 'star' : isSpark ? 'spark' : 'circle',
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.15,
          gravity: 0.09,
          flickerSpeed: Math.random() * 10 + 5,
          flickerOffset: Math.random() * Math.PI * 2,
        });
      }

      // Add a shockwave ring of tiny glitter sparkles
      for (let j = 0; j < 25; j++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 9 + 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: '#FFF8DC',
          size: Math.random() * 2 + 1,
          alpha: 1,
          decay: Math.random() * 0.025 + 0.02,
          type: 'spark',
          rotation: 0,
          rotSpeed: 0,
          gravity: 0.06,
          flickerSpeed: 15,
          flickerOffset: Math.random() * Math.PI,
        });
      }
    };

    const launchRocket = (startX?: number, targetY?: number) => {
      const sx = startX ?? Math.random() * (width * 0.7) + width * 0.15;
      const ty = targetY ?? Math.random() * (height * 0.4) + height * 0.12;
      rockets.push({
        x: sx,
        y: height,
        targetY: ty,
        vx: (Math.random() - 0.5) * 2,
        vy: -(Math.random() * 4 + 11),
        color: goldPalette[Math.floor(Math.random() * goldPalette.length)],
        exploded: false,
      });
    };

    // Initial burst immediately
    createExplosion(width * 0.5, height * 0.28, 90);
    createExplosion(width * 0.25, height * 0.38, 70);
    createExplosion(width * 0.75, height * 0.35, 70);

    // Staggered rockets
    const timeouts: NodeJS.Timeout[] = [
      setTimeout(() => launchRocket(width * 0.35, height * 0.2), 300),
      setTimeout(() => launchRocket(width * 0.65, height * 0.22), 550),
      setTimeout(() => launchRocket(width * 0.5, height * 0.18), 850),
      setTimeout(() => createExplosion(width * 0.2, height * 0.25, 65), 1200),
      setTimeout(() => createExplosion(width * 0.8, height * 0.27, 65), 1500),
      setTimeout(() => createExplosion(width * 0.5, height * 0.32, 80), 1900),
    ];

    const drawStar = (
      context: CanvasRenderingContext2D,
      cx: number,
      cy: number,
      spikes: number,
      outerRadius: number,
      innerRadius: number
    ) => {
      let rot = (Math.PI / 2) * 3;
      let x = cx;
      let y = cy;
      const step = Math.PI / spikes;

      context.beginPath();
      context.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        context.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        context.lineTo(x, y);
        rot += step;
      }
      context.lineTo(cx, cy - outerRadius);
      context.closePath();
    };

    let startTime = performance.now();

    const loop = (timestamp: number) => {
      ctx.clearRect(0, 0, width, height);

      const elapsed = timestamp - startTime;

      // Update and draw rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx;
        r.y += r.vy;

        // Spark trail behind rocket
        particles.push({
          x: r.x + (Math.random() - 0.5) * 4,
          y: r.y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: Math.random() * 2 + 1,
          color: '#FFE873',
          size: Math.random() * 2.5 + 1,
          alpha: 0.9,
          decay: 0.05,
          type: 'spark',
          rotation: 0,
          rotSpeed: 0,
          gravity: 0.05,
          flickerSpeed: 8,
          flickerOffset: 0,
        });

        // Rocket head glow
        ctx.save();
        ctx.shadowColor = '#FFDF00';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (r.y <= r.targetY || r.vy >= -1) {
          createExplosion(r.x, r.y, 75);
          rockets.splice(i, 1);
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.alpha -= p.decay;
        p.rotation += p.rotSpeed;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const flicker = (Math.sin(timestamp * 0.02 * p.flickerSpeed + p.flickerOffset) + 1) / 2;
        const currentAlpha = Math.max(0, Math.min(1, p.alpha * (0.6 + flicker * 0.4)));

        ctx.save();
        ctx.globalAlpha = currentAlpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 8;

        if (p.type === 'star') {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          drawStar(ctx, 0, 0, 4, p.size * 1.8, p.size * 0.45);
          ctx.fill();
        } else if (p.type === 'spark') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    // Auto dismiss after 4.5 seconds
    const autoCloseTimer = setTimeout(() => {
      onClose();
    }, 4500);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      timeouts.forEach(clearTimeout);
      clearTimeout(autoCloseTimer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col items-center justify-start pt-16 sm:pt-20 px-4 cursor-pointer overflow-hidden animate-in fade-in duration-300"
    >
      {/* Background canvas for fireworks */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />

      {/* Monochrome Celebration Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 bg-white border-2 border-zinc-300 rounded-3xl p-5 sm:p-6 shadow-[0_10px_35px_rgba(0,0,0,0.25)] text-center max-w-sm w-full mx-auto animate-in zoom-in-90 slide-from-top-6 duration-400"
      >
        <div className="w-14 h-14 rounded-2xl bg-zinc-900 text-white flex items-center justify-center mx-auto mb-3 shadow-md ring-4 ring-zinc-200 animate-bounce">
          <Trophy className="w-8 h-8 drop-shadow-xs" />
        </div>

        <div className="flex items-center justify-center gap-1.5 text-zinc-900 font-black text-xs uppercase tracking-widest mb-1">
          <Sparkles className="w-4 h-4 animate-spin" />
          <span>¡Lectura Completada!</span>
          <Sparkles className="w-4 h-4 animate-spin" />
        </div>

        <h3 className="text-lg font-black text-zinc-900 line-clamp-2 mb-1">
          {bookTitle || '¡Felicitaciones!'}
        </h3>
        <p className="text-xs text-zinc-500 font-semibold mb-4">
          Has sumado un nuevo logro a tu registro de lectura.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs shadow-md active:scale-98 transition-all uppercase tracking-wide"
        >
          ¡Excelente!
        </button>
      </div>
    </div>
  );
};
