import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Transformador de Potencia", slug: "transformador-potencia", category: "Transformadores", image: "/images/alta-tension/transformador-potencia.png" },
  { name: "Transformador de Distribución", slug: "transformador-distribucion", category: "Transformadores", image: "/images/media-tension/transformador-distribucion.png" },
  { name: "TT 36 kV", slug: "tt-36kv", category: "Transformadores", image: "/images/alta-tension/tt-36kv.png" },
  { name: "TC 36 kV", slug: "tc-36kv", category: "Transformadores", image: "/images/alta-tension/tc-36kv.png" },
];

export default function TransformadoresPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Transformadores"
          heroImage="/images/Transformadores.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
