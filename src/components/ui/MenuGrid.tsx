'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MENU_ITEMS,
  CATEGORIES,
  FEATURED_ITEMS,
  SUB_CATEGORIES,
  getMenuSections,
} from '@/data/menu';
import type { MenuItem } from '@/data/menu';
import { useBranchMenu } from '@/lib/useBranchMenu';
import MenuCard from './MenuCard';
import CustomizerModal from '../CustomizerModal';
import StickyCategoryNav from './StickyCategoryNav';
import { sfx } from '@/lib/sounds';

const DIET_FILTERS = [
  { id: 'all', label: 'All', icon: '🔥' },
  { id: 'veg', label: 'Vegetarian', icon: '🥬' },
  { id: 'spicy', label: 'Spicy', icon: '🌶️' },
];

const SORT_OPTIONS = [
  { value: 'popular', label: '🔥 Popular first' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'name', label: 'Name A–Z' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['value'];

interface MenuGridProps {
  layout?: 'center' | 'left';
  showFeatured?: boolean;
  headingLevel?: 2 | 3;
  searchPlaceholder?: string;
}

export default function MenuGrid({
  layout = 'center',
  showFeatured = false,
  headingLevel = 3,
  searchPlaceholder = 'Search the blaze… (e.g. smash, Nashville, shake)',
}: MenuGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeDiet, setActiveDiet] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('popular');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [observed, setObserved] = useState('all');
  const { menu: branchMenu } = useBranchMenu();

  const dbPrice = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of branchMenu?.categories ?? []) {
      for (const item of cat.items) map[item.id] = item.price;
    }
    return map;
  }, [branchMenu]);

  const dbOutOfStock = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const cat of branchMenu?.categories ?? []) {
      for (const item of cat.items) if (item.isOutOfStock) map[item.id] = true;
    }
    return map;
  }, [branchMenu]);

  const dbImage = useMemo(() => {
    const map: Record<string, string> = {};
    for (const cat of branchMenu?.categories ?? []) {
      for (const item of cat.items) if (item.imageUrl) map[item.id] = item.imageUrl;
    }
    return map;
  }, [branchMenu]);

  /** Catalog merchandising metadata stays static; prices/stock resolve from the DB. */
  const priceAware = useCallback(
    (items: MenuItem[]): MenuItem[] =>
      items.map((i) => ({
        ...i,
        price: dbPrice[i.id] ?? i.price,
        image: dbImage[i.id] ?? i.image,
        isOutOfStock: dbOutOfStock[i.id] ?? false,
      })),
    [dbPrice, dbImage, dbOutOfStock]
  );

  const featuredItems = useMemo(() => priceAware(FEATURED_ITEMS), [priceAware]);

  const grouping = activeCategory === 'all';
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  const triggerLoading = () => {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 380);
  };

  const baseItems = useMemo(() => {
    let items = priceAware([...MENU_ITEMS]);
    if (activeDiet === 'veg') items = items.filter((i) => i.isVeg);
    if (activeDiet === 'spicy') items = items.filter((i) => i.isSpicy);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => (b.popular ? 1 : 0) - (a.popular ? 1 : 0));
    return items;
  }, [activeDiet, search, priceAware]);

  const featuredActive = Boolean(
    showFeatured && grouping && !search.trim() && activeDiet === 'all'
  );

  const groupedSections = useMemo(() => {
    if (!featuredActive) return getMenuSections(baseItems);
    const featured = new Set(FEATURED_ITEMS.map((i) => i.id));
    return getMenuSections(baseItems.filter((i) => !featured.has(i.id)));
  }, [baseItems, featuredActive]);

  const filteredItems = useMemo(() => {
    let items = baseItems;
    if (activeCategory !== 'all') items = items.filter((i) => i.category === activeCategory);
    switch (sortBy) {
      case 'price-asc':
        items.sort((a, b) => a.price - b.price);
        break;
      case 'price-desc':
        items.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        items.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }
    return items;
  }, [baseItems, activeCategory, sortBy]);

  useEffect(() => {
    if (!grouping || loading) return;
    const els = groupedSections
      .map(([id]) => document.getElementById(`cat-${id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const inView = entries.filter((e) => e.isIntersecting);
        if (inView.length === 0) return;
        let best = inView[0];
        for (const e of inView) {
          if (e.boundingClientRect.top < best.boundingClientRect.top) best = e;
        }
        const id = (best.target as HTMLElement).getAttribute('data-cat');
        if (id) setObserved(id);
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: 0 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [grouping, loading, groupedSections]);

  const handleSubNavSelect = (id: string) => {
    if (grouping) {
      const el = document.getElementById(`cat-${id}`);
      if (el) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
      setObserved(id);
    } else {
      setActiveCategory(id);
      triggerLoading();
    }
  };

  const uniqueCount = grouping ? baseItems.length : filteredItems.length;
  const showFeaturedRow = featuredActive;

  const catName = (catId: string) => {
    const cat = CATEGORIES.find((c) => c.id === catId);
    return catId === 'all' ? 'Everything' : cat?.name || catId;
  };

  const controlsCls = layout === 'center' ? 'max-w-3xl mx-auto' : '';
  const pillsCls = layout === 'center' ? 'justify-center' : 'justify-start';

  return (
    <>
      {/* Search + sort */}
      <div className={`flex flex-col md:flex-row gap-3 mb-8 ${controlsCls}`}>
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8A7F72]">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search menu"
            className="w-full pl-11 pr-4 py-3 rounded-2xl glass-pill text-sm text-[#F5EFE4] placeholder:text-white/30 focus:outline-none focus:border-[#E8542A] border border-white/10"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          aria-label="Sort menu"
          className="px-4 py-3 rounded-2xl glass-pill text-sm text-[#F5EFE4] border border-white/10 focus:outline-none focus:border-[#E8542A] bg-[#1C120C]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Category pills */}
      <div className={`flex flex-wrap gap-2 mb-4 ${pillsCls}`}>
        {CATEGORIES.map((cat) => {
          const active = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                triggerLoading();
                sfx.pop();
              }}
              className={`relative px-4 py-2 rounded-full font-mono text-xs uppercase tracking-wider border transition-colors duration-200 ${
                active ? 'border-transparent' : 'border-white/15 text-[#F5EFE4]/70 hover:text-[#F5EFE4] hover:border-white/40'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="cat-pill"
                  className="absolute inset-0 rounded-full bg-[#E8542A] shadow-[0_8px_18px_-6px_rgba(232,84,42,0.6)]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`relative z-10 top-catchlight ${active ? 'text-[#F5EFE4]' : ''}`}>
                <span className="mr-1.5">{cat.icon}</span>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Diet filter */}
      <div className={`flex gap-2 mb-10 ${pillsCls}`}>
        {DIET_FILTERS.map((d) => {
          const active = activeDiet === d.id;
          return (
            <button
              key={d.id}
              onClick={() => {
                setActiveDiet(d.id);
                sfx.click();
              }}
              className={`relative px-3 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition-colors duration-200 ${
                active ? 'text-[#1C120C]' : 'text-[#8A7F72] hover:text-[#F5EFE4]'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="diet-pill"
                  className="absolute inset-0 rounded-full bg-[#F2B33D]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {d.icon} {d.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sticky category sub-nav */}
      {!loading && grouping && SUB_CATEGORIES.length > 0 && (
        <StickyCategoryNav
          categories={SUB_CATEGORIES}
          activeId={observed !== 'all' ? observed : ''}
          onSelect={handleSubNavSelect}
        />
      )}

      {/* Live result counter (screen-reader only) */}
      <div className="sr-only" role="status" aria-live="polite">
        Showing {uniqueCount} of {MENU_ITEMS.length} items
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card-dark rounded-2xl overflow-hidden flex flex-col">
              <div className="aspect-[4/3] bg-[#2E2820] skeleton-shimmer" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-2/3 rounded-full bg-[#2E2820] skeleton-shimmer" />
                <div className="h-3 w-full rounded-full bg-[#2E2820] skeleton-shimmer" />
                <div className="h-3 w-4/5 rounded-full bg-[#2E2820] skeleton-shimmer" />
                <div className="pt-3 border-t border-white/10 flex justify-between">
                  <div className="h-3 w-1/3 rounded-full bg-[#2E2820] skeleton-shimmer" />
                  <div className="w-7 h-7 rounded-full bg-[#2E2820] skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : grouping ? (
        <div className="mt-10 space-y-4">
          {showFeaturedRow && (
            <section aria-labelledby="featured-heading">
              <div className="mb-1">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#F2B33D] mb-2">
                  🔥 Fan favorites
                </p>
                <Heading
                  id="featured-heading"
                  className="font-display text-2xl md:text-3xl text-[#F5EFE4]"
                >
                  Best sellers &amp; chef&apos;s picks
                </Heading>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
                {featuredItems.map((item, i) => (
                  <MenuCard key={item.id} item={item} featured index={i} onCustomize={setSelectedItem} />
                ))}
              </div>
            </section>
          )}

          {groupedSections.length > 0 ? (
            groupedSections.map(([catId, list]) => (
              <section
                key={catId}
                id={`cat-${catId}`}
                data-cat={catId}
                className="scroll-mt-36 md:scroll-mt-40 pt-16"
                aria-labelledby={`cat-heading-${catId}`}
              >
                <Heading
                  id={`cat-heading-${catId}`}
                  className="font-display text-2xl md:text-3xl text-[#F5EFE4] flex items-center gap-3 mb-6 border-b border-white/10 pb-4"
                >
                  <span>{CATEGORIES.find((c) => c.id === catId)?.icon || '🍽️'}</span> {catName(catId)}
                  <span className="font-mono text-sm text-[#8A7F72] font-normal">({list.length})</span>
                </Heading>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {list.map((item, i) => (
                    <MenuCard key={item.id} item={item} index={i} onCustomize={setSelectedItem} />
                  ))}
                </div>
              </section>
            ))
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="font-display text-2xl text-[#F5EFE4] mb-2">No matches on the grill</h3>
              <p className="text-[#8A7F72]">Try a different search or filter.</p>
            </div>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          {filteredItems.length > 0 ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mt-10">
              {filteredItems.map((item, i) => (
                <MenuCard key={item.id} item={item} index={i} onCustomize={setSelectedItem} />
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🍽️</div>
              <h3 className="font-display text-2xl text-[#F5EFE4] mb-2">No matches on the grill</h3>
              <p className="text-[#8A7F72]">Try a different search or filter.</p>
            </div>
          )}
        </AnimatePresence>
      )}

      <p className="text-center font-mono text-xs uppercase tracking-widest text-[#8A7F72] mt-10">
        Showing {uniqueCount} of {MENU_ITEMS.length} fire items
      </p>

      <CustomizerModal item={selectedItem} onClose={() => setSelectedItem(null)} />
    </>
  );
}