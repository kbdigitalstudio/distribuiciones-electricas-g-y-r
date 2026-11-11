import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export default function PoliticaCalidadPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-12">
          <h1 className="text-3xl font-bold text-gyr-heading mb-6">Política de Calidad</h1>
          <div className="bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <p className="text-gyr-text leading-relaxed text-lg">
              Distribuidores Eléctricos G y R SAS se compromete con la satisfacción permanente de los
              clientes, entregando productos de excelente calidad, garantía y oportunidad en el suministro,
              apoyados en un equipo humano competente.
            </p>
            <p className="text-gyr-text leading-relaxed text-lg mt-4">
              Mejoramos continuamente nuestro sistema de gestión de calidad y la eficacia de nuestros
              procesos, cumpliendo con los requisitos del cliente, partes interesadas, legales y normativos.
            </p>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
