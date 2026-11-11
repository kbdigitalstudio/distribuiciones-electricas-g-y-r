import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSmall } from "@/components/sections/hero";
import { ContactSection } from "@/components/sections/contact/contact";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export default function ContactoPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <HeroSmall
          title="Contacto"
          imageUrl="/images/paisaje-bogota.png"
        />
        <ContactSection />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
