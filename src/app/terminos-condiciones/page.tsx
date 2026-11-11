import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export default function TerminosCondicionesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-12">
          <h1 className="text-3xl font-bold text-gyr-heading mb-6">Términos y Condiciones</h1>
          <div className="bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <p className="text-gyr-text leading-relaxed text-lg">
              Estos términos rigen el uso del sitio web de Distribuidores Eléctricos G y R SAS y la
              realización de compras a través del mismo.
            </p>
            <p className="text-gyr-text leading-relaxed text-lg mt-4">
              Al utilizar nuestros servicios, aceptas los precios, tiempos de entrega y políticas de
              calidad publicados. Los precios están sujetos a cotización y disponibilidad de inventario.
            </p>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
