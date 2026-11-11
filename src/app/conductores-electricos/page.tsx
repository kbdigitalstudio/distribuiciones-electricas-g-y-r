import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Cable THHN/THWN-2", slug: "cable-thhn-thwn-2", category: "Conductores Eléctricos", image: "/images/baja-tension/cable thhnthwn-2 rohs ve-ne-bl.png" },
  { name: "Cable de Cobre Desnudo", slug: "cable-cobre-desnudo", category: "Conductores Eléctricos", image: "/images/conductores electricos.png" },
  { name: "Cable ACSR", slug: "cable-acsr", category: "Conductores Eléctricos", image: "/images/alta-tension/cable-acsr.png" },
];

export default function ConductoresElectricosPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Conductores Eléctricos"
          heroImage="/images/Conductores Electricos.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
