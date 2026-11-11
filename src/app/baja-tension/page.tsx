import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Tubos", slug: "tubos", category: "Baja Tensión", image: "/images/baja-tension/tubos.jpg" },
  { name: "Tubería PVC", slug: "tuberia-pvc", category: "Baja Tensión", image: "/images/baja-tension/tuberia pvc.jpg" },
  { name: "Tableros Alumbrado NQ", slug: "tableros-alumbrado-nq", category: "Baja Tensión", image: "/images/baja-tension/tableros_alumbrado-nq.jpg" },
  { name: "Interruptores y Tomacorrientes", slug: "interruptores-tomacorrientes", category: "Baja Tensión", image: "/images/baja-tension/interruptores-y-tomacorrientes.jpg" },
  { name: "Contador Electrónico Bifásico", slug: "contador-electronico-bifasico", category: "Baja Tensión", image: "/images/baja-tension/contador-electronico-bifasico-5-100a-lcd-cl-1-calibrado.jpg" },
  { name: "Cinta Aislante 4 XL", slug: "cinta-aislante-4-xl", category: "Baja Tensión", image: "/images/baja-tension/cinta-aislante-4-xl.jpg" },
  { name: "Cable THHN/THWN-2", slug: "cable-thhn-thwn-2", category: "Baja Tensión", image: "/images/baja-tension/cable thhnthwn-2 rohs ve-ne-bl.png" },
  { name: "Breaker", slug: "breaker", category: "Baja Tensión", image: "/images/baja-tension/breaker.jpg" },
];

export default function BajaTensionPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Baja Tensión"
          heroImage="/images/baja tension.jpg"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
