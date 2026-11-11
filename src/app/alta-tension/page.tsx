import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "TT 36 kV", slug: "tt-36kv", category: "Alta Tensión", image: "/images/alta-tension/tt-36kv.png" },
  { name: "TC 36 kV", slug: "tc-36kv", category: "Alta Tensión", image: "/images/alta-tension/tc-36kv.png" },
  { name: "Transformador de Potencia", slug: "transformador-potencia", category: "Alta Tensión", image: "/images/alta-tension/transformador-potencia.png" },
  { name: "Reconectador 38 kV", slug: "reconectador-38kv", category: "Alta Tensión", image: "/images/alta-tension/reconectador-38kv.png" },
  { name: "Pararrayos Alta Tensión", slug: "pararrayos-alta-tension", category: "Alta Tensión", image: "/images/alta-tension/pararrayos-alta-tension.png" },
  { name: "Cable de Potencia 115 kV", slug: "cable-potencia-115kv", category: "Alta Tensión", image: "/images/alta-tension/cable-potencia-115kv.png" },
  { name: "Cable ACSR", slug: "cable-acsr", category: "Alta Tensión", image: "/images/alta-tension/cable-acsr.png" },
  { name: "Aislador ANSI 52", slug: "aislador-ansi-52", category: "Alta Tensión", image: "/images/alta-tension/aislador-ansi-52.png" },
];

export default function AltaTensionPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Alta Tensión"
          heroImage="/images/alta-tension/alta-tension.jpg"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
