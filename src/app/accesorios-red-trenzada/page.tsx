import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Conectores de Perforación", slug: "conectores-perforacion", category: "Accesorios para Red Trenzada", image: "/images/conectores de perforación.png" },
];

export default function AccesoriosRedTrenzadaPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Accesorios para Red Trenzada"
          heroImage="/images/Accesorios para red trenzada.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
