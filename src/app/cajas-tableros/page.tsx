import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Tableros Alumbrado NQ", slug: "tableros-alumbrado-nq", category: "Cajas y Tableros", image: "/images/baja-tension/tableros_alumbrado-nq.jpg" },
];

export default function CajasTablerosPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Cajas y Tableros"
          heroImage="/images/cajas y tableros.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
