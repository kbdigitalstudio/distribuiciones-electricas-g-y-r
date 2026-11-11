import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Seccionador de Operación", slug: "seccionador-operacion", category: "Maniobra", image: "/images/media-tension/seccionador-operacion.png" },
  { name: "Seccionadores de Potencia", slug: "seccionadores-potencia", category: "Maniobra", image: "/images/seccionadores de potencia.png" },
];

export default function ManiobraPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Maniobra"
          heroImage="/images/Breakers.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
