import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Interruptores y Tomacorrientes", slug: "interruptores-tomacorrientes", category: "Interruptores y Tomacorrientes", image: "/images/baja-tension/interruptores-y-tomacorrientes.jpg" },
];

export default function InterruptoresTomacorrientesPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Interruptores y Tomacorrientes"
          heroImage="/images/Interruptores, tomas y enchufes.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
