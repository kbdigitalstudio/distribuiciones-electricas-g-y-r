"use strict";

interface CategoryItem {
  name: string;
  href: string;
  image: string;
}

interface CategoriesSectionProps {
  title?: string;
  categories: CategoryItem[];
}

export function CategoriesSection({ title, categories }: CategoriesSectionProps) {
  return (
    <section className="py-16">
      <div className="container px-4">
        {title && (
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gyr-heading mb-2">
              {title}
            </h2>
          </div>
        )}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {categories.map((cat) => (
            <a
              key={cat.name}
              href={cat.href}
              className="group relative block h-64 rounded-2xl overflow-hidden border border-gyr-border-light bg-white shadow-sm transition-card duration-400 hover:-translate-y-4 hover:shadow-lg"
            >
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover transition-img duration-600 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/[.9] to-transparent p-8 pt-20 flex flex-col items-center justify-end text-center">
                <h3 className="text-xl font-bold text-white drop-shadow-md">
                  {cat.name}
                </h3>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export const CATEGORIES_DATA: CategoryItem[] = [
  {
    name: "Conductores eléctricos",
    href: "/conductores-electricos",
    image: "/images/conductores-electricos.png",
  },
  {
    name: "Tubería",
    href: "/tuberia",
    image: "/images/tuberia.png",
  },
  {
    name: "Aislamiento y protección",
    href: "/aislamiento-proteccion",
    image: "/images/aislamiento-proteccion.png",
  },
  {
    name: "Transformadores",
    href: "/transformadores",
    image: "/images/transformadores.png",
  },
  {
    name: "Puesta a tierra",
    href: "/puesta-tierra",
    image: "/images/puesta-tierra.png",
  },
  {
    name: "Herrajería",
    href: "/herrajeria",
    image: "/images/herrajeria.png",
  },
  {
    name: "Cajas y tableros",
    href: "/cajas-tableros",
    image: "/images/cajas-tableros.png",
  },
  {
    name: "Maniobra",
    href: "/maniobra",
    image: "/images/maniobra.png",
  },
  {
    name: "Medidores de energía",
    href: "/medidores-energia",
    image: "/images/medidores-energia.png",
  },
  {
    name: "Accesorios para red trenzada",
    href: "/accesorios-red-trenzada",
    image: "/images/accesorios-red-trenzada.png",
  },
  {
    name: "Accesorios para red ecológica",
    href: "/accesorios-red-ecologica",
    image: "/images/accesorios-red-ecologica.png",
  },
  {
    name: "Interruptores y tomacorrientes",
    href: "/interruptores-tomacorrientes",
    image: "/images/interruptores-tomacorrientes.png",
  },
];
