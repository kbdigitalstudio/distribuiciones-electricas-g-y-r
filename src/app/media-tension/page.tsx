import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Transformador de Distribución", slug: "transformador-distribucion", category: "Media Tensión", image: "/images/media-tension/transformador-distribucion.png" },
  { name: "Terminales Premoldeadas 34.5 kV", slug: "terminales-premoldeadas-34-5-kv", category: "Media Tensión", image: "/images/media-tension/terminales-premoldeadas-para-34-5-kv-uso-exterior-para-calibres-de-cable-entre-350-500-kcm-juego-x-3-unidades.jpg" },
  { name: "Soporte Suspensión ADSS", slug: "soporte-suspension-adss", category: "Media Tensión", image: "/images/media-tension/soporte-suspension-adss.jpg" },
  { name: "Seccionador de Operación", slug: "seccionador-operacion", category: "Media Tensión", image: "/images/media-tension/seccionador-operacion.png" },
  { name: "Crucetas Metálicas", slug: "crucetas-metalicas", category: "Media Tensión", image: "/images/media-tension/crucetas metálicas.png" },
  { name: "Cortacircuito 15 kV", slug: "cortacircuito-15-kv", category: "Media Tensión", image: "/images/media-tension/cortacircuito-15-kv.jpg" },
  { name: "Aislamiento Redes Media Tensión", slug: "aislamiento-redes-media-tension", category: "Media Tensión", image: "/images/media-tension/aislamiento para redes de media tension.jpg" },
];

export default function MediaTensionPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Media Tensión"
          heroImage="/images/media tension.jpg"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
