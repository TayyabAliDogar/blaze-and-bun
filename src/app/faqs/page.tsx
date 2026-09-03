import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'FAQs',
  description:
    'Quick answers about BLAZE & BUN ordering, delivery, allergens, customization, and more.',
  alternates: { canonical: '/faqs' },
};

const FAQS = [
  {
    q: 'How fast is delivery?',
    a: 'ASAP orders typically land in 25–35 minutes. You can also schedule a delivery window up to 4 hours out and we time the cook so it arrives around then.',
  },
  {
    q: 'Can I customize my order?',
    a: 'Yes — every menu card opens a customizer with size, heat level, bun, and add-ons, plus a notes field for anything else.',
  },
  {
    q: 'Do you have vegetarian options?',
    a: 'Yep. Filter the menu by Vegetarian to see everything marked veg, from salad bowls to dips and drinks.',
  },
  {
    q: 'Which payment methods do you accept?',
    a: 'Card payments and cash on delivery at every branch. Apple Pay and Google Pay are coming soon.',
  },
  {
    q: 'Where are you located?',
    a: 'You can find our branches in Soho (NYC), Brooklyn (NYC), the Arts District (LA), and Shoreditch (London). Head to the Locations section to switch branches.',
  },
];

export default function FaqsPage() {
  return (
    <InfoPage kicker="Help Center" title="FAQs">
      {FAQS.map((f) => (
        <section key={f.q}>
          <h2 className="font-display text-xl text-[#F5EFE4] mb-2">{f.q}</h2>
          <p>{f.a}</p>
        </section>
      ))}
    </InfoPage>
  );
}