import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export default function PoliticaPrivacidadPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-12">
          <h1 className="text-3xl font-bold text-gyr-heading mb-6">Política de Privacidad</h1>
          <div className="bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <p className="text-gyr-text leading-relaxed text-lg">
              En Distribuidores Eléctricos G y R SAS protegemos la información personal de nuestros
              clientes y usuarios. Los datos recopilados se utilizan únicamente para fines de atención,
              cotización y procesamiento de pedidos.
            </p>
            <p className="text-gyr-text leading-relaxed text-lg mt-4">
              No compartimos información personal con terceros sin consentimiento previo, salvo lo
              requerido por la normativa vigente en Colombia.
            </p>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
