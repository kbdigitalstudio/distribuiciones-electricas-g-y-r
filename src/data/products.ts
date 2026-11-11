/**
 * Datos de productos extraídos exclusivamente de los archivos originales del proyecto.
 * Solo se incluyen nombres de productos e imágenes verificables disponibles en el proyecto original.
 * No se inventan precios, códigos, especificaciones ni disponibilidad.
 */

export interface Product {
  slug: string;
  name: string;
  category: string;
  image: string;
  description?: string;
}

export const PRODUCTS: Product[] = [
  // Alta Tensión
  {
    slug: "tt-36kv",
    name: "TT 36 kV",
    category: "Alta Tensión",
    image: "/images/alta-tension/tt-36kv.png",
  },
  {
    slug: "tc-36kv",
    name: "TC 36 kV",
    category: "Alta Tensión",
    image: "/images/alta-tension/tc-36kv.png",
  },
  {
    slug: "transformador-potencia",
    name: "Transformador de Potencia",
    category: "Alta Tensión",
    image: "/images/alta-tension/transformador-potencia.png",
  },
  {
    slug: "reconectador-38kv",
    name: "Reconectador 38 kV",
    category: "Alta Tensión",
    image: "/images/alta-tension/reconectador-38kv.png",
  },
  {
    slug: "pararrayos-alta-tension",
    name: "Pararrayos Alta Tensión",
    category: "Alta Tensión",
    image: "/images/alta-tension/pararrayos-alta-tension.png",
  },
  {
    slug: "cable-potencia-115kv",
    name: "Cable de Potencia 115 kV",
    category: "Alta Tensión",
    image: "/images/alta-tension/cable-potencia-115kv.png",
  },
  {
    slug: "cable-acsr",
    name: "Cable ACSR",
    category: "Alta Tensión",
    image: "/images/alta-tension/cable-acsr.png",
  },
  {
    slug: "aislador-ansi-52",
    name: "Aislador ANSI 52",
    category: "Alta Tensión",
    image: "/images/alta-tension/aislador-ansi-52.png",
  },
  // Media Tensión
  {
    slug: "transformador-distribucion",
    name: "Transformador de Distribución",
    category: "Media Tensión",
    image: "/images/media-tension/transformador-distribucion.png",
  },
  {
    slug: "terminales-premoldeadas-34-5-kv",
    name: "Terminales Premoldeadas 34.5 kV",
    category: "Media Tensión",
    image: "/images/media-tension/terminales-premoldeadas-para-34-5-kv-uso-exterior-para-calibres-de-cable-entre-350-500-kcm-juego-x-3-unidades.jpg",
  },
  {
    slug: "soporte-suspension-adss",
    name: "Soporte Suspensión ADSS",
    category: "Media Tensión",
    image: "/images/media-tension/soporte-suspension-adss.jpg",
  },
  {
    slug: "seccionador-operacion",
    name: "Seccionador de Operación",
    category: "Media Tensión",
    image: "/images/media-tension/seccionador-operacion.png",
  },
  {
    slug: "crucetas-metalicas",
    name: "Crucetas Metálicas",
    category: "Media Tensión",
    image: "/images/media-tension/crucetas metálicas.png",
  },
  {
    slug: "cortacircuito-15-kv",
    name: "Cortacircuito 15 kV",
    category: "Media Tensión",
    image: "/images/media-tension/cortacircuito-15-kv.jpg",
  },
  {
    slug: "aislamiento-redes-media-tension",
    name: "Aislamiento Redes Media Tensión",
    category: "Media Tensión",
    image: "/images/media-tension/aislamiento para redes de media tension.jpg",
  },
  // Baja Tensión
  {
    slug: "tubos",
    name: "Tubos",
    category: "Baja Tensión",
    image: "/images/baja-tension/tubos.jpg",
  },
  {
    slug: "tuberia-pvc",
    name: "Tubería PVC",
    category: "Baja Tensión",
    image: "/images/baja-tension/tuberia pvc.jpg",
  },
  {
    slug: "tableros-alumbrado-nq",
    name: "Tableros Alumbrado NQ",
    category: "Baja Tensión",
    image: "/images/baja-tension/tableros_alumbrado-nq.jpg",
  },
  {
    slug: "interruptores-tomacorrientes",
    name: "Interruptores y Tomacorrientes",
    category: "Baja Tensión",
    image: "/images/baja-tension/interruptores-y-tomacorrientes.jpg",
  },
  {
    slug: "contador-electronico-bifasico",
    name: "Contador Electrónico Bifásico",
    category: "Baja Tensión",
    image: "/images/baja-tension/contador-electronico-bifasico-5-100a-lcd-cl-1-calibrado.jpg",
  },
  {
    slug: "cinta-aislante-4-xl",
    name: "Cinta Aislante 4 XL",
    category: "Baja Tensión",
    image: "/images/baja-tension/cinta-aislante-4-xl.jpg",
  },
  {
    slug: "cable-thhn-thwn-2",
    name: "Cable THHN/THWN-2",
    category: "Conductores Eléctricos",
    image: "/images/baja-tension/cable thhnthwn-2 rohs ve-ne-bl.png",
  },
  {
    slug: "breaker",
    name: "Breaker",
    category: "Baja Tensión",
    image: "/images/baja-tension/breaker.jpg",
  },
  // Conductores Eléctricos
  {
    slug: "cable-cobre-desnudo",
    name: "Cable de Cobre Desnudo",
    category: "Conductores Eléctricos",
    image: "/images/conductores electricos.png",
  },
  // Transformadores
  {
    slug: "transformador-distribucion-alt",
    name: "Transformador de Distribución",
    category: "Transformadores",
    image: "/images/Transformadores.png",
  },
  // Tubería
  {
    slug: "tuberia-emt",
    name: "Tubería EMT",
    category: "Tubería",
    image: "/images/tubería emt.png",
  },
  // Maniobra
  {
    slug: "seccionadores-potencia",
    name: "Seccionadores de Potencia",
    category: "Maniobra",
    image: "/images/seccionadores de potencia.png",
  },
  // Medidores de Energía
  {
    slug: "medidores-electronicos",
    name: "Medidores Electrónicos",
    category: "Medidores de Energía",
    image: "/images/medidores de energía.png",
  },
  // Puesta a Tierra
  {
    slug: "varillas-puesta-tierra",
    name: "Varillas de Puesta a Tierra",
    category: "Puesta a Tierra",
    image: "/images/varillas de puesta a tierra.png",
  },
  // Herrajería
  {
    slug: "crucetas-metalicas-herrajeria",
    name: "Crucetas Metálicas",
    category: "Herrajería",
    image: "/images/Herrajería.png",
  },
  // Cajas y Tableros
  {
    slug: "tableros-alumbrado-nq-cajas",
    name: "Tableros Alumbrado NQ",
    category: "Cajas y Tableros",
    image: "/images/Cajas y Tableros.png",
  },
  // Accesorios Red Ecológica
  {
    slug: "espaciadores",
    name: "Espaciadores",
    category: "Accesorios para Red Ecológica",
    image: "/images/espaciadores.png",
  },
  // Accesorios Red Trenzada
  {
    slug: "conectores-perforacion",
    name: "Conectores de Perforación",
    category: "Accesorios para Red Trenzada",
    image: "/images/conectores de perforación.png",
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}
