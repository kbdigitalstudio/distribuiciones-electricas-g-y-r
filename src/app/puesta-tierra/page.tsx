import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Varillas de Puesta a Tierra", slug: "varillas-puesta-tierra", category: "Puesta a Tierra", image: "/images/varillas de puesta a tierra.png" },
  { name: "Aislador ANSI 52", slug: "aislador-ansi-52", category: "Puesta a Tierra", image: "/images/alta-tension/aislador-ansi-52.png" },
];

export default function PuestaTierraPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Puesta a Tierra"
          heroImage="/images/Puesta a tierra.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
