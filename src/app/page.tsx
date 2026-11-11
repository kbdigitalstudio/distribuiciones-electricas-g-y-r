import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Hero } from "@/components/sections/hero";
import { CategoriesSection, CATEGORIES_DATA } from "@/components/sections/categories";
import { ProductCard } from "@/components/ui/product-card";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

const FEATURED_PRODUCTS = [
  {
    name: "Transformador de Distribución",
    image: "/images/media-tension/transformador-distribucion.png",
    category: "Media Tensión",
    slug: "transformador-distribucion",
  },
  {
    name: "Interruptor Termomagnético",
    image: "/images/baja-tension/breaker.jpg",
    category: "Baja Tensión",
    slug: "breaker",
  },
  {
    name: "Cable THHN/THWN-2",
    image: "/images/baja-tension/cable thhnthwn-2 rohs ve-ne-bl.png",
    category: "Conductores eléctricos",
    slug: "cable-thhn-thwn-2",
  },
  {
    name: "Varillas de Puesta a Tierra",
    image: "/images/alta-tension/aislador-ansi-52.png",
    category: "Puesta a tierra",
    slug: "varillas-puesta-tierra",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <Hero
          title="Soluciones <span className='text-gyr-primary'>Eléctricas</span> de Alta Calidad"
          subtitle="Distribución de materiales eléctricos para todo tipo de proyectos."
          imageUrl="/images/paisaje-bogota.png"
        />
        <CategoriesSection
          title="Nuestras líneas de productos"
          categories={CATEGORIES_DATA}
        />
        <section className="py-16">
          <div className="container px-4">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-gyr-heading mb-2">
                Productos Destacados
              </h2>
              <p className="text-gyr-text">Selección de nuestros productos más solicitados</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {FEATURED_PRODUCTS.map((product) => (
                <ProductCard
                  key={product.slug}
                  name={product.name}
                  image={product.image}
                  category={product.category}
                  slug={product.slug}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
