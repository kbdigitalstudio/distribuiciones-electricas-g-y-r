import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export default function PoliticaCookiesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-12">
          <h1 className="text-3xl font-bold text-gyr-heading mb-6">Política de Cookies</h1>
          <div className="bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <p className="text-gyr-text leading-relaxed text-lg">
              Nuestro sitio utiliza cookies para mejorar la experiencia de navegación y para fines
              analíticos. Las cookies nos permiten recordar tus preferencias y ofrecerte contenido
              relevante.
            </p>
            <p className="text-gyr-text leading-relaxed text-lg mt-4">
              Puedes configurar tu navegador para aceptar o rechazar cookies. Algunas funcionalidades
              del sitio podrían verse afectadas si desactivas las cookies.
            </p>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
