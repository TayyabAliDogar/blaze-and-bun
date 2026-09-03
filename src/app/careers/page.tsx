import type { Metadata } from 'next';
import InfoPage from '@/components/InfoPage';

export const metadata: Metadata = {
  title: 'Careers',
  description:
    'Join the BLAZE & BUN crew — it takes a full team to build a flame-lit kitchen, front-of-house, and everything in between.',
  alternates: { canonical: '/careers' },
};

export default function CareersPage() {
  return (
    <InfoPage kicker="Join the Crew" title="Careers at BLAZE & BUN">
      <p>
        We build every order over open flame — and that takes real people. Crew members who care
        about speed, craft, and camaraderie.
      </p>
      <h2 className="font-display text-xl text-[#F5EFE4]">Roles we hire for</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Line cooks & flame station leads</li>
        <li>Front-of-house and takeout specialists</li>
        <li>Delivery riders & drivers</li>
        <li>Shift managers in training</li>
      </ul>
      <h2 className="font-display text-xl text-[#F5EFE4]">Perks of the crew</h2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Team meals on every shift</li>
        <li>Growth path from crew to management</li>
        <li>Flexible scheduling across our branches</li>
      </ul>
      <p>
        Openings are posted branch by branch. Right now the fastest way to apply is to stop by your
        local BLAZE &amp; BUN and ask for the shift lead — or drop a line to{' '}
        <span className="font-mono text-[#F2B33D]">crew@blazeandbun.com</span>.
      </p>
    </InfoPage>
  );
}