import type { Metadata } from "next";
import { Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/ui/providers";
import { Toasts } from "@/components/ui/toasts";

const sora = Sora({
  variable: "--font-sora",
  weight: ["400", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Distribuidores Eléctricos G y R S.A.S",
  description:
    "Distribución de materiales eléctricos de alta, media y baja tensión para todo tipo de proyectos en Colombia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sora.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gyr-bg text-gyr-text">
        <Providers>
          {children}
          <Toasts />
        </Providers>
      </body>
    </html>
  );
}
