import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Espaciadores", slug: "espaciadores", category: "Accesorios para Red Ecológica", image: "/images/espaciadores.png" },
];

export default function AccesoriosRedEcologicaPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Accesorios para Red Ecológica"
          heroImage="/images/Accesorios para red ecologica.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
