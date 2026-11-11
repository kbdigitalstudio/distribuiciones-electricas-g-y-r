export interface User {
  id?: number;
  nombre: string;
  email: string;
  password?: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  departamento?: string;
  isAuthenticated?: boolean;
  profileComplete?: boolean;
  registeredAt?: string;
}

export interface CartItem {
  id: number;
  name: string;
  image: string;
  addedBy?: string;
}

export interface Order {
  orderId: string;
  customer: User;
  items: CartItem[];
  totalItems: number;
  bank: string;
  personType: "natural" | "juridica";
  createdAt: string;
}

export const BANCOS_PSE = [
  "Selecciona tu banco",
  "Bancolombia",
  "Banco de Bogotá",
  "Davivienda",
  "BBVA Colombia",
  "Banco de Occidente",
  "Banco Popular",
  "Banco Caja Social",
  "Banco AV Villas",
  "Banco Agrario",
  "Banco Falabella",
  "Banco Pichincha",
  "Banco Cooperativo Coopcentral",
  "Banco Serfinanza",
  "Bancoomeva",
  "Banco Finandina",
  "Banco GNB Sudameris",
  "Banco Santander",
  "Scotiabank Colpatria",
  "Citibank",
  "Itaú",
];
