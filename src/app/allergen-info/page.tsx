import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Allergen Info',
  description:
    'Allergen guidance for BLAZE & BUN. We cook in shared kitchens — egg, milk, wheat, soy, and nuts may be present.',
  alternates: { canonical: '/allergen-info' },
};

export default function AllergenInfoPage() {
  return (
    <InfoPage kicker="Know Before You Bite" title="Allergen Info">
      <p>
        We want you to eat with confidence. Here&apos;s what to know before you order — and when in
        doubt, our crew will always walk the kitchen with you.
      </p>
      <h2 className="font-display text-xl text-[#F5EFE4]">Common allergens on our menu</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong className="text-[#F5EFE4]">Gluten &amp; wheat:</strong> buns, tortillas, tenders
          and fries may share fryers with breaded items.
        </li>
        <li>
          <strong className="text-[#F5EFE4]">Dairy &amp; egg:</strong> cheeses, sauces, mayo, and
          milkshakes.
        </li>
        <li>
          <strong className="text-[#F5EFE4]">Soy:</strong> burger sauce bases and some marinades.
        </li>
        <li>
          <strong className="text-[#F5EFE4]">Nuts:</strong> some desserts and seasonal specials
          contain nuts.
        </li>
      </ul>
      <h2 className="font-display text-xl text-[#F5EFE4]">A note on shared kitchens</h2>
      <p>
        All our branches cook in shared kitchens and fryers, so traces of gluten, dairy, egg, soy,
        and nuts can be present in any item — including items marked vegetarian. We can
        confidently point you to the safest choices, but we cannot guarantee an allergen-free
        environment.
      </p>
      <p>
        Need more detail? Ask for the full ingredient matrix at the counter or email{' '}
        <span className="font-mono text-[#F2B33D]">allergens@blazeandbun.com</span>.
      </p>
    </InfoPage>
  );
}