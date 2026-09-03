import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import Providers from "@/components/Providers";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const SITE_BASE = "https://blazeandbun.com";

const restaurantSchema = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  name: "BLAZE & BUN",
  url: SITE_BASE,
  telephone: "+1-212-555-0143",
  priceRange: "$$",
  servesCuisine: ["Burgers", "Fried Chicken", "Pizza", "Milkshakes"],
  address: {
    "@type": "PostalAddress",
    streetAddress: "120 Greene Street",
    addressLocality: "New York",
    addressRegion: "NY",
    postalCode: "10012",
    addressCountry: "US",
  },
  openingHours: ["Mo-Su 11:00-23:00"],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_BASE),
  title: {
    default: "BLAZE & BUN | Fire-Grilled. Fast. Unforgettable.",
    template: "%s | BLAZE & BUN",
  },
  description:
    "Premium fire-grilled smash burgers, crisp Nashville tenders, artisanal wraps, and handcrafted milkshakes. Flame-kissed quality at full volume.",
  applicationName: "BLAZE & BUN",
  category: "food",
  keywords: [
    "smash burgers",
    "fried chicken",
    "fast food",
    "blaze and bun",
    "craft burgers",
    "gourmet fast food",
    "flame grilled",
  ],
  authors: [{ name: "BLAZE & BUN" }],
  creator: "BLAZE & BUN",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_BASE,
    siteName: "BLAZE & BUN",
    title: "BLAZE & BUN | Fire-Grilled. Fast. Unforgettable.",
    description:
      "Premium fire-grilled smash burgers, crispy chicken, and unforgettable flavors.",
  },
  twitter: {
    card: "summary",
    title: "BLAZE & BUN | Fire-Grilled. Fast. Unforgettable.",
    description: "Premium fire-grilled smash burgers, crispy chicken, and unforgettable flavors.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1C120C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${ibmPlexMono.variable} ${inter.variable} antialiased bg-[#1C120C] text-[#F7F0E4]`}
    >
      <body className="min-h-screen flex flex-col selection:bg-[#E8542A] selection:text-[#F5EFE4] bg-[#1C120C]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(restaurantSchema) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
