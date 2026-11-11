import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { CategoryPage } from "@/components/sections/category-page";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const PRODUCTS = [
  { name: "Tubería PVC", slug: "tuberia-pvc", category: "Tubería", image: "/images/baja-tension/tuberia pvc.jpg" },
  { name: "Tubería EMT", slug: "tuberia-emt", category: "Tubería", image: "/images/tubería emt.png" },
  { name: "Tubos", slug: "tubos", category: "Tubería", image: "/images/baja-tension/tubos.jpg" },
];

export default function TuberiaPage() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <CategoryPage
          categoryName="Tubería"
          heroImage="/images/Tubería.png"
          products={PRODUCTS}
        />
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
