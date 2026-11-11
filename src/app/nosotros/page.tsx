import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSmall } from "@/components/sections/hero";
import { AboutSection } from "@/components/sections/about/about";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export default function NosotrosPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <HeroSmall
          title="Nosotros"
          imageUrl="/images/paisaje-bogota.png"
        />
        <AboutSection />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
