import Navbar from '@/components/Navbar';
import HeroSection from '@/components/sections/HeroSection';
import MarqueeTicker from '@/components/sections/MarqueeTicker';
import BuildSection from '@/components/sections/BuildSection';
import FullMenuSection from '@/components/sections/FullMenuSection';
import LocationsSection from '@/components/sections/LocationsSection';
import ReviewsSection from '@/components/sections/ReviewsSection';
import AppSection from '@/components/sections/AppSection';
import Footer from '@/components/Footer';
import CartDrawer from '@/components/CartDrawer';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#1C120C]">
      <Navbar />
      <HeroSection />
      <MarqueeTicker />
      <BuildSection />
      <FullMenuSection />
      <LocationsSection />
      <ReviewsSection />
      <AppSection />
      <Footer />
      <CartDrawer />
    </main>
  );
}
