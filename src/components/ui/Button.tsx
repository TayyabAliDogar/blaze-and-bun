'use client';
import { type ReactNode, type MouseEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Magnetic from './Magnetic';

interface ButtonProps {
  children: ReactNode;
  onClick?: (e: MouseEvent<Element>) => void;
  href?: string;
  variant?: 'primary' | 'outline' | 'ghost' | 'cream';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
  magnetic?: boolean;
  disabled?: boolean;
}

export default function Button({
  children,
  onClick,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ariaLabel,
  magnetic = true,
  disabled,
}: ButtonProps) {
  const base =
    'relative inline-flex items-center justify-center gap-2 rounded-full font-mono font-medium uppercase tracking-[0.14em] transition-all duration-200 ease-out select-none whitespace-nowrap';
  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-sm',
  };
  const variants = {
    primary:
      'bg-[#E8542A] text-[#F5EFE4] hover:bg-[#FF6A3D] active:bg-[#C9421F] shadow-[0_10px_30px_-8px_rgba(232,84,42,0.45)] hover:shadow-[0_14px_38px_-10px_rgba(232,84,42,0.65),0_0_0_1px_rgba(255,106,61,0.3)] inner-catchlight',
    outline:
      'border-2 border-[#1C120C] text-[#1C120C] hover:bg-[#1C120C] hover:text-[#F5EFE4] hover:shadow-[0_12px_24px_-10px_rgba(28,18,12,0.4)] active:bg-[#241B14] bg-transparent',
    ghost:
      'bg-transparent text-[#F5EFE4] hover:bg-white/90 hover:text-[#1C120C] active:bg-white/70',
    cream:
      'bg-[#F5EFE4] text-[#1C120C] hover:bg-white shadow-[0_10px_30px_-8px_rgba(245,239,228,0.3)] hover:shadow-[0_14px_38px_-10px_rgba(245,239,228,0.55),0_0_0_1px_rgba(255,255,255,0.25)] active:bg-[#EADFCB] inner-catchlight',
  };
  const shared = `${base} ${sizes[size]} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

  const content = href ? (
    <Link
      href={href}
      onClick={disabled ? undefined : onClick}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className={shared}
    >
      <motion.span whileTap={{ scale: disabled ? 1 : 0.95 }} className="inline-flex items-center gap-2">
        {children}
      </motion.span>
    </Link>
  ) : (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={shared}
    >
      <motion.span whileTap={{ scale: disabled ? 1 : 0.95 }} className="inline-flex items-center gap-2">
        {children}
      </motion.span>
    </button>
  );

  if (magnetic) {
    return <Magnetic>{content}</Magnetic>;
  }
  return content;
}