import type { Metadata } from 'next';
import { CATEGORIES, SECTION_ORDER } from '@/data/menu';

export const metadata: Metadata = {
  title: 'Full Menu',
  description:
    'Browse every BLAZE & BUN item — smash burgers, Nashville tenders, pizza, wraps, sides, dips and shakes. Filter by diet, sort by price, and customize anything.',
  alternates: { canonical: '/menu' },
  openGraph: {
    type: 'website',
    url: 'https://blazeandbun.com/menu',
    title: 'Full Menu | BLAZE & BUN',
    description: 'Every single item, in the open. Customize, stack, and make it yours.',
    siteName: 'BLAZE & BUN',
  },
};

const menuSections = SECTION_ORDER.map((id) => {
  const cat = CATEGORIES.find((c) => c.id === id);
  return {
    '@type': 'MenuSection',
    name: cat?.name ?? id,
  };
});

const menuSchema = {
  '@context': 'https://schema.org',
  '@type': 'Menu',
  name: 'BLAZE & BUN Full Menu',
  hasMenuSection: menuSections,
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(menuSchema) }}
      />
      {children}
    </>
  );
}