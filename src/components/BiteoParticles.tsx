import React, { useEffect, useMemo, useRef } from 'react';
import './BiteoParticles.css';

type Particle = {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
};

export const BiteoParticles: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: 42 }, (_, i) => ({
      id: i,
      left: (i * 37.7 + 11) % 100,
      top: (i * 23.3 + 17) % 100,
      size: 1 + (i % 4) * 0.65,
      duration: 12 + (i % 8) * 2,
      delay: -(i % 12) * 1.5,
      opacity: 0.25 + (i % 5) * 0.1,
    })),
  []);

  useEffect(() => {
    const overlay = containerRef.current;
    const panel = overlay?.parentElement;
    if (!overlay || !panel) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');
    if (reducedMotion.matches || !finePointer.matches) return;

    const dots = Array.from(overlay.querySelectorAll<HTMLElement>('.biteo-particles__dot'));
    let frame = 0;
    let active = false;
    let currentX = -1000;
    let currentY = -1000;
    let targetX = -1000;
    let targetY = -1000;

    const render = () => {
      currentX += (targetX - currentX) * 0.17;
      currentY += (targetY - currentY) * 0.17;
      overlay.style.setProperty('--mouse-x', `${currentX}px`);
      overlay.style.setProperty('--mouse-y', `${currentY}px`);

      const { width, height } = overlay.getBoundingClientRect();
      const radius = 155;
      dots.forEach((dot, i) => {
        const px = (particles[i].left / 100) * width;
        const py = (particles[i].top / 100) * height;
        const dx = px - currentX;
        const dy = py - currentY;
        const distance = Math.hypot(dx, dy);
        const strength = Math.max(0, 1 - distance / radius);
        const offset = strength * strength * 42;
        const safeDistance = Math.max(distance, 1);
        dot.style.setProperty('--push-x', `${(dx / safeDistance) * offset}px`);
        dot.style.setProperty('--push-y', `${(dy / safeDistance) * offset}px`);
      });

      if (active || Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
        frame = requestAnimationFrame(render);
      } else {
        frame = 0;
      }
    };

    const startFrame = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const rect = overlay.getBoundingClientRect();
      targetX = event.clientX - rect.left;
      targetY = event.clientY - rect.top;
      active = true;
      overlay.classList.add('biteo-particles--active');
      startFrame();
    };

    const handleLeave = () => {
      active = false;
      overlay.classList.remove('biteo-particles--active');
      // Remove the glow and let the dots return to their original positions.
      targetX = -1000;
      targetY = -1000;
      startFrame();
    };

    panel.addEventListener('pointermove', handleMove);
    panel.addEventListener('pointerleave', handleLeave);
    return () => {
      panel.removeEventListener('pointermove', handleMove);
      panel.removeEventListener('pointerleave', handleLeave);
      cancelAnimationFrame(frame);
    };
  }, [particles]);

  return (
    <div ref={containerRef} className="biteo-particles" aria-hidden="true">
      <div className="biteo-particles__glow" />
      <div className="biteo-particles__cursor-glow" />
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="biteo-particles__dot"
          style={{
            '--particle-left': `${particle.left}%`,
            '--particle-top': `${particle.top}%`,
            '--particle-size': `${particle.size}px`,
            '--particle-duration': `${particle.duration}s`,
            '--particle-delay': `${particle.delay}s`,
            '--particle-opacity': particle.opacity,
          } as React.CSSProperties}
        >
          <span className="biteo-particles__dot-core" />
        </span>
      ))}
    </div>
  );
};
