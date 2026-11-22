import { useEffect, useRef } from 'react';
import type { WeatherMood } from './domain';

type Props = {
  mood: WeatherMood;
  active?: boolean;
};

interface Raindrop {
  x: number;
  y: number;
  length: number;
  speedY: number;
  speedX: number;
  opacity: number;
  thickness: number;
}

interface Splash {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
}

interface AutumnLeaf {
  x: number;
  y: number;
  size: number;
  speedY: number;
  swaySpeed: number;
  swayOffset: number;
  swayRadius: number;
  rotation: number;
  rotationSpeed: number;
  flipAngle: number;
  flipSpeed: number;
  color: string;
  stemColor: string;
  leafType: 0 | 1 | 2;
}

interface SunnyMote {
  x: number;
  y: number;
  radius: number;
  baseRadius: number;
  speedY: number;
  speedX: number;
  pulseSpeed: number;
  pulseOffset: number;
  opacity: number;
  color: string;
}

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speedY: number;
  speedX: number;
  driftOffset: number;
  driftSpeed: number;
  opacity: number;
}

interface BreezeRibbon {
  x: number;
  y: number;
  length: number;
  speedX: number;
  speedY: number;
  amplitude: number;
  frequency: number;
  phase: number;
  opacity: number;
}

const FALL_COLORS = [
  { fill: 'rgba(239, 68, 68, 0.85)', stem: 'rgba(185, 28, 28, 0.95)' },    // Crimson Red
  { fill: 'rgba(249, 115, 22, 0.85)', stem: 'rgba(194, 65, 12, 0.95)' },   // Orange
  { fill: 'rgba(245, 158, 11, 0.85)', stem: 'rgba(180, 83, 9, 0.95)' },    // Golden Amber
  { fill: 'rgba(217, 119, 6, 0.82)',  stem: 'rgba(161, 98, 7, 0.95)' },    // Deep Rust
  { fill: 'rgba(190, 24, 93, 0.82)',  stem: 'rgba(131, 24, 67, 0.95)' },   // Burgundy
  { fill: 'rgba(132, 204, 22, 0.78)', stem: 'rgba(77, 124, 15, 0.95)' },   // Late-Autumn Olive
];

export default function WeatherBackground({ mood, active = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let isRunning = true;

    const updateSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateSize();

    const handleResize = () => {
      updateSize();
    };
    window.addEventListener('resize', handleResize);

    // Initialize particles based on selected mood
    const w = canvas.width;
    const h = canvas.height;

    // 1. Raindrop setup (Calm, slow, peaceful gentle rain)
    const raindrops: Raindrop[] = [];
    const splashes: Splash[] = [];
    if (mood === 'rain') {
      const dropCount = Math.min(65, Math.max(30, Math.floor(w / 28)));
      for (let i = 0; i < dropCount; i++) {
        raindrops.push({
          x: Math.random() * (w + 120) - 60,
          y: Math.random() * h,
          length: 12 + Math.random() * 14,
          speedY: 4.5 + Math.random() * 3.5,
          speedX: -0.6 - Math.random() * 0.8,
          opacity: 0.28 + Math.random() * 0.35,
          thickness: 0.8 + Math.random() * 0.6,
        });
      }
    }

    // 2. Autumn Leaf setup
    const leaves: AutumnLeaf[] = [];
    if (mood === 'autumn') {
      const leafCount = Math.min(42, Math.max(22, Math.floor(w / 32)));
      for (let i = 0; i < leafCount; i++) {
        const pal = FALL_COLORS[Math.floor(Math.random() * FALL_COLORS.length)];
        leaves.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 14 + Math.random() * 14,
          speedY: 1.2 + Math.random() * 1.5,
          swaySpeed: 0.018 + Math.random() * 0.02,
          swayOffset: Math.random() * Math.PI * 2,
          swayRadius: 28 + Math.random() * 35,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.03,
          flipAngle: Math.random() * Math.PI,
          flipSpeed: 0.02 + Math.random() * 0.03,
          color: pal.fill,
          stemColor: pal.stem,
          leafType: Math.floor(Math.random() * 3) as 0 | 1 | 2,
        });
      }
    }

    // 3. Sunny Dust Motes
    const motes: SunnyMote[] = [];
    if (mood === 'sunny') {
      const moteCount = Math.min(48, Math.max(25, Math.floor(w / 30)));
      for (let i = 0; i < moteCount; i++) {
        const r = 3 + Math.random() * 5.5;
        motes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: r,
          baseRadius: r,
          speedY: -0.25 - Math.random() * 0.4,
          speedX: (Math.random() - 0.5) * 0.45,
          pulseSpeed: 0.02 + Math.random() * 0.03,
          pulseOffset: Math.random() * Math.PI * 2,
          opacity: 0.35 + Math.random() * 0.45,
          color: Math.random() > 0.4 ? 'rgba(253, 224, 71, ' : 'rgba(251, 191, 36, ',
        });
      }
    }

    // 4. Snowflake setup
    const snowflakes: Snowflake[] = [];
    if (mood === 'snow') {
      const flakeCount = Math.min(95, Math.max(50, Math.floor(w / 16)));
      for (let i = 0; i < flakeCount; i++) {
        snowflakes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: 1.8 + Math.random() * 3.8,
          speedY: 1.1 + Math.random() * 1.6,
          speedX: (Math.random() - 0.5) * 0.6,
          driftOffset: Math.random() * Math.PI * 2,
          driftSpeed: 0.015 + Math.random() * 0.025,
          opacity: 0.45 + Math.random() * 0.5,
        });
      }
    }

    // 5. Breezy Ribbons
    const ribbons: BreezeRibbon[] = [];
    if (mood === 'breezy') {
      const ribbonCount = Math.min(30, Math.max(14, Math.floor(w / 40)));
      for (let i = 0; i < ribbonCount; i++) {
        ribbons.push({
          x: Math.random() * w,
          y: Math.random() * h,
          length: 50 + Math.random() * 80,
          speedX: 2.2 + Math.random() * 2.8,
          speedY: (Math.random() - 0.5) * 0.4,
          amplitude: 4 + Math.random() * 6,
          frequency: 0.03 + Math.random() * 0.02,
          phase: Math.random() * Math.PI * 2,
          opacity: 0.25 + Math.random() * 0.35,
        });
      }
    }

    // Leaf rendering helper
    function drawLeaf(leaf: AutumnLeaf) {
      if (!ctx) return;
      ctx.save();
      const sway = Math.sin(leaf.swayOffset) * leaf.swayRadius;
      ctx.translate(leaf.x + sway, leaf.y);
      ctx.rotate(leaf.rotation);

      const flipScale = Math.cos(leaf.flipAngle);
      ctx.scale(flipScale, 1);

      ctx.fillStyle = leaf.color;
      ctx.beginPath();

      const s = leaf.size;
      if (leaf.leafType === 0) {
        // Maple-style pointed lobe
        ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s * 0.7, -s * 0.6, s * 0.9, 0, 0, s);
        ctx.bezierCurveTo(-s * 0.9, 0, -s * 0.7, -s * 0.6, 0, -s);
      } else if (leaf.leafType === 1) {
        // Oval / Beech leaf
        ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s * 0.5, -s * 0.5, s * 0.5, s * 0.5, 0, s);
        ctx.bezierCurveTo(-s * 0.5, s * 0.5, -s * 0.5, -s * 0.5, 0, -s);
      } else {
        // Oak-style undulating lobe
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(s * 0.6, -s * 0.4, s * 0.3, 0);
        ctx.quadraticCurveTo(s * 0.7, s * 0.4, 0, s);
        ctx.quadraticCurveTo(-s * 0.7, s * 0.4, -s * 0.3, 0);
        ctx.quadraticCurveTo(-s * 0.6, -s * 0.4, 0, -s);
      }
      ctx.fill();

      // Stem & main vein line
      ctx.strokeStyle = leaf.stemColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.75);
      ctx.lineTo(0, s * 1.15);
      ctx.stroke();

      ctx.restore();
    }

    let frame = 0;

    const render = () => {
      if (!isRunning) return;
      frame++;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // If mood is 'none', keep clean canvas and continue frame wait
      if (mood === 'none') {
        animId = requestAnimationFrame(render);
        return;
      }

      // 1. RAIN ANIMATION (Calm, slow, peaceful gentle rain)
      if (mood === 'rain') {
        for (const drop of raindrops) {
          ctx.beginPath();
          ctx.lineWidth = drop.thickness;
          ctx.strokeStyle = `rgba(186, 230, 253, ${drop.opacity})`;
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x + drop.speedX * (drop.length / Math.max(1, drop.speedY)), drop.y + drop.length);
          ctx.stroke();

          drop.x += drop.speedX;
          drop.y += drop.speedY;

          // Hit ground splash
          if (drop.y > height - 12) {
            if (Math.random() < 0.25) {
              splashes.push({
                x: drop.x,
                y: height - 6 + Math.random() * 4,
                radius: 0.8,
                maxRadius: 2.5 + Math.random() * 3.0,
                opacity: 0.35,
              });
            }
            drop.y = -20;
            drop.x = Math.random() * (width + 120) - 60;
          }
        }

        // Render ripples / splashes
        for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i];
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, sp.radius * 1.8, sp.radius * 0.6, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(186, 230, 253, ${sp.opacity})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          sp.radius += 0.2;
          sp.opacity -= 0.015;
          if (sp.opacity <= 0 || sp.radius >= sp.maxRadius) {
            splashes.splice(i, 1);
          }
        }
      }

      // 2. AUTUMN / FALL LEAF ANIMATION
      else if (mood === 'autumn') {
        for (const leaf of leaves) {
          drawLeaf(leaf);

          leaf.y += leaf.speedY;
          leaf.swayOffset += leaf.swaySpeed;
          leaf.rotation += leaf.rotationSpeed;
          leaf.flipAngle += leaf.flipSpeed;

          if (leaf.y > height + 40) {
            leaf.y = -35;
            leaf.x = Math.random() * width;
          }
        }
      }

      // 3. SUNNY & WARM RADIANT SUNBEAMS
      else if (mood === 'sunny') {
        // Soft sweeping angled sunbeam from top left
        const beamPulse = 0.06 + Math.sin(frame * 0.01) * 0.02;
        const grad = ctx.createLinearGradient(0, 0, width * 0.8, height);
        grad.addColorStop(0, `rgba(253, 224, 71, ${beamPulse + 0.04})`);
        grad.addColorStop(0.45, `rgba(251, 191, 36, ${beamPulse * 0.6})`);
        grad.addColorStop(1, 'rgba(253, 224, 71, 0)');

        ctx.save();
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width * 0.55, 0);
        ctx.lineTo(width * 0.15, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Ambient dancing golden motes
        for (const mote of motes) {
          mote.pulseOffset += mote.pulseSpeed;
          const currentRadius = mote.baseRadius + Math.sin(mote.pulseOffset) * 1.5;
          const alpha = Math.max(0.1, mote.opacity + Math.sin(mote.pulseOffset) * 0.15);

          const radGrad = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, currentRadius * 2);
          radGrad.addColorStop(0, `${mote.color}${alpha})`);
          radGrad.addColorStop(1, `${mote.color}0)`);

          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(mote.x, mote.y, currentRadius * 2, 0, Math.PI * 2);
          ctx.fill();

          mote.y += mote.speedY;
          mote.x += mote.speedX;

          if (mote.y < -20) {
            mote.y = height + 10;
            mote.x = Math.random() * width;
          }
          if (mote.x < -20) mote.x = width + 10;
          if (mote.x > width + 20) mote.x = -10;
        }
      }

      // 4. PEACEFUL DRIFTING SNOW
      else if (mood === 'snow') {
        for (const flake of snowflakes) {
          flake.driftOffset += flake.driftSpeed;
          const driftX = Math.sin(flake.driftOffset) * 0.9;

          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(248, 250, 252, ${flake.opacity})`;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;

          flake.y += flake.speedY;
          flake.x += flake.speedX + driftX;

          if (flake.y > height + 10) {
            flake.y = -10;
            flake.x = Math.random() * width;
          }
        }
      }

      // 5. CRISP & BREEZY WIND RIBBONS
      else if (mood === 'breezy') {
        for (const r of ribbons) {
          r.phase += r.frequency;
          const waveY = Math.sin(r.phase) * r.amplitude;

          ctx.beginPath();
          ctx.moveTo(r.x, r.y + waveY);
          ctx.quadraticCurveTo(
            r.x + r.length * 0.5,
            r.y + waveY - r.amplitude * 1.5,
            r.x + r.length,
            r.y + waveY
          );
          ctx.strokeStyle = `rgba(56, 189, 248, ${r.opacity})`;
          ctx.lineWidth = 1.3;
          ctx.stroke();

          r.x += r.speedX;
          r.y += r.speedY;

          if (r.x > width + 80) {
            r.x = -r.length - 20;
            r.y = Math.random() * height;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [mood]);

  return (
    <canvas
      ref={canvasRef}
      className={`weather-ambient-canvas weather-${mood}`}
      aria-hidden="true"
    />
  );
}
