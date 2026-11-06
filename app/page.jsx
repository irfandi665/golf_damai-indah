import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import FeatureSection from '@/components/FeatureSection';
import HomeInformationSections from '@/components/HomeInformationSections';

export const metadata = {
  title: 'Damai Indah Golf | Tee-Time Reservations',
  description: 'Explore Damai Indah Golf and reserve online; payment is made at the club. Jelajahi Damai Indah Golf dan buat reservasi online.',
};

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <FeatureSection />
        <HomeInformationSections />
      </main>
    </>
  );
}