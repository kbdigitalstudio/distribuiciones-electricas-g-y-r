import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ProductDetail } from "@/components/sections/product-detail";
import { getProductBySlug, PRODUCTS } from "@/data/products";
import { notFound } from "next/navigation";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";

export async function generateStaticParams() {
  return PRODUCTS.map((p) => ({ slug: p.slug }));
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="container px-4 py-12">
          <ProductDetail product={product} />
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
