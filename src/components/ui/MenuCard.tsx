'use client';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import type { MenuItem } from '@/data/menu';
import { useCartStore, useLocationStore } from '@/store';
import { usePrice } from '@/lib/currency';
import { useBranchIsOpen } from '@/lib/useBranchAvailability';
import { sfx } from '@/lib/sounds';

interface MenuCardProps {
  item: MenuItem;
  onCustomize: (item: MenuItem) => void;
  index?: number;
  featured?: boolean;
}

const categoryGradient: Record<string, string> = {
  burgers: 'from-[#E8542A]/40',
  chicken: 'from-[#F2B33D]/40',
  wraps: 'from-[#66B84B]/40',
  sides: 'from-[#C98D3F]/40',
  salads: 'from-[#4E9B3E]/40',
  combos: 'from-[#7B2D8B]/40',
  beverages: 'from-[#3D5A80]/40',
  desserts: 'from-[#E76F51]/40',
  pizza: 'from-[#E8542A]/40',
  dips: 'from-[#F2B33D]/40',
};

export default function MenuCard({ item, onCustomize, index = 0, featured = false }: MenuCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const branchOpen = useBranchIsOpen(selectedLocation);
  const { fmt } = usePrice();

  const badgeColor =
    item.badge === 'Best Seller'
      ? 'bg-[#E8542A]'
      : item.badge === 'New'
        ? 'bg-[#3D8B40]'
        : item.badge === "Chef's Pick"
          ? 'bg-[#7B2D8B]'
          : item.badge === 'Fire Choice'
            ? 'bg-[#C1121F]'
            : 'bg-[#F2B33D]';

  const soldOut = Boolean(item.isOutOfStock);

  return (
    <motion.article
      layout
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-40px' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: (index % 12) * 0.05 }}
      className="glass-card-dark group cursor-pointer rounded-2xl overflow-hidden flex flex-col inner-catchlight transition-shadow duration-300 ease-out hover:shadow-[0_30px_60px_-18px_rgba(232,84,42,0.35),0_12px_28px_-14px_rgba(0,0,0,0.6)]"
      onClick={() => { if (!soldOut) onCustomize(item); }}
    >
      <div className={`relative overflow-hidden ${featured ? 'aspect-[16/10]' : 'aspect-[4/3]'}`}>
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            priority={featured}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className={`object-cover transition-[filter,opacity] duration-500 group-hover:brightness-[1.06] ${soldOut ? 'grayscale opacity-60' : ''}`}
          />
        ) : (
          <div className="w-full h-full bg-[#2E2820] flex flex-col items-center justify-center gap-2 px-4 text-center">
            <span className="text-3xl opacity-50">📷</span>
            <span className="font-display text-[#F5EFE4]/80 text-sm leading-tight">{item.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#F2B33D]/70">
              add real photo here
            </span>
          </div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/50 ${categoryGradient[item.category]} to-transparent`} />
        <div className="absolute top-3 left-3 flex gap-2">
          {soldOut && (
            <span className="bg-[#1C120C]/90 text-[#E8542A] text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-[#E8542A]/40 backdrop-blur">
              SOLD OUT
            </span>
          )}
          {item.badge && (
            <span className={`${badgeColor} text-white text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full backdrop-blur`}>
              {item.badge}
            </span>
          )}
          {item.isSpicy && (
            <span className="bg-[#1C120C]/80 text-[#F2B33D] text-[10px] font-mono px-2.5 py-1 rounded-full backdrop-blur">
              🌶️ {item.spiceLevel === 3 ? 'INFERNO' : 'SPICY'}
            </span>
          )}
        </div>
        {item.isVeg && (
          <span className="absolute top-3 right-3 bg-[#3D8B40]/90 text-white text-[10px] font-mono px-2.5 py-1 rounded-full">
            VEG
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className={`font-display leading-tight text-[#F5EFE4] text-shadow-soft ${featured ? 'text-xl' : 'text-lg'} ${soldOut ? 'line-through text-[#8A7F72]' : ''}`}>{item.name}</h3>
          <span className={`font-mono whitespace-nowrap text-shadow-soft ${soldOut ? 'text-[#8A7F72]' : 'text-[#F2B33D]'}`}>
            {fmt(item.price)}
          </span>
        </div>
        <p className="text-sm text-[#F5EFE4]/60 flex-1 line-clamp-3">{item.description}</p>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#8A7F72]">
            {item.calories} cal · {item.category}
          </span>
          {soldOut ? (
            <span
              className="text-[10px] font-mono uppercase tracking-wider text-[#E8542A] border border-[#E8542A]/40 rounded-full px-2 py-1"
              title="This item is currently out of stock at the selected location"
            >
              Sold Out
            </span>
          ) : branchOpen ? (
            <button
              type="button"
              aria-label={`Add ${item.name} to cart`}
              onClick={(e) => {
                e.stopPropagation();
                addItem({
                  menuItemId: item.id,
                  name: item.name,
                  price: item.price,
                  image: item.image,
                  quantity: 1,
                  customizations: {},
                });
                sfx.add();
                openCart();
              }}
              className="flex items-center justify-center w-7 h-7 rounded-full bg-[#E8542A] text-[#F5EFE4] hover:bg-[#FF6A3D] active:bg-[#C9421F] active:scale-95 transition-all inner-catchlight shadow-[0_4px_10px_-3px_rgba(232,84,42,0.6)]"
            >
              <ShoppingCart size={14} strokeWidth={2.5} />
            </button>
          ) : (
            <span
              className="text-[10px] font-mono uppercase tracking-wider text-[#8A7F72] border border-white/10 rounded-full px-2 py-1"
              title="Ordering opens when the branch opens"
            >
              Closed
            </span>
          )}
        </div>
      </div>
    </motion.article>
  );
}
