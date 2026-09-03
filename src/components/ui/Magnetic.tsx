'use client';
import { useRef, type ReactNode, type MouseEvent } from 'react';
import { useMotionValue, useSpring, useTransform, motion } from 'framer-motion';

interface MagneticProps {
  children: ReactNode;
  strength?: number;
  className?: string;
}

export default function Magnetic({ children, strength = 0.4, className }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 150, damping: 15, mass: 0.1 });
  const springY = useSpring(y, { stiffness: 150, damping: 15, mass: 0.1 });

  const sx = useTransform(springX, (v) => v * strength);
  const sy = useTransform(springY, (v) => v * strength);

  const handleMouseMove = (e: MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(e.clientX - (rect.left + rect.width / 2));
    y.set(e.clientY - (rect.top + rect.height / 2));
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: sx, y: sy }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
