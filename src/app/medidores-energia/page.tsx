import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Contador Electrónico Bifásico", slug: "contador-electronico-bifasico", category: "Medidores de Energía", image: "/images/baja-tension/contador-electronico-bifasico-5-100a-lcd-cl-1-calibrado.jpg" },
  { name: "Medidores Electrónicos", slug: "medidores-electronicos", category: "Medidores de Energía", image: "/images/medidores de energía.png" },
];

export default function MedidoresEnergiaPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Medidores de Energía"
          heroImage="/images/Medidores de energía.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
