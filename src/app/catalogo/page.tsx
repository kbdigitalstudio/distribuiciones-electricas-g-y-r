import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export default function CatalogoPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="pdf-container w-full flex justify-center items-center pt-10 pb-16">
          <div className="pdf-viewer-card w-full max-w-4xl bg-white border border-gyr-border-light rounded-[30px] shadow-xl p-4">
            <iframe
              src="/assets/catalogo-productos.pdf"
              title="Catálogo de Productos"
              className="w-full h-[80vh] border-none rounded-2xl"
            />
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
