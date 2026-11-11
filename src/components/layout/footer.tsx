"use strict";

import Link from "next/link";

const SOCIAL_LINKS = [
  { name: "Facebook", href: "https://facebook.com", icon: "/images/facebook.png" },
  { name: "Instagram", href: "https://instagram.com", icon: "/images/instagram.png" },
  { name: "LinkedIn", href: "https://linkedin.com", icon: "/images/linkedin.png" },
];

export function Footer() {
  return (
    <footer id="colophon" className="site-footer bg-gyr-footer-bg text-gyr-footer-text pt-20 pb-8">
      <div className="container px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div className="footer-column footer-about">
            <div className="footer-logo mb-4">
              <h3 className="text-xl font-bold">Distribuidores Eléctricos G y R</h3>
            </div>
            <p className="footer-description text-gray-400 text-sm leading-relaxed mb-6">
              Expertos en soluciones eléctricas para proyectos industriales,
              comerciales y residenciales.
            </p>
            <div className="social-links flex gap-4">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link hover:text-gyr-primary transition-colors duration-300"
                >
                  <img
                    src={social.icon}
                    alt={social.name}
                    className="w-6 h-6"
                  />
                </a>
              ))}
            </div>
          </div>
          <div className="footer-column footer-links">
            <h4 className="text-sm font-bold uppercase mb-4">Acerca de nosotros</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/nosotros" className="text-gray-400 hover:text-gyr-primary transition-colors duration-200 text-sm">
                  Nosotros
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-gray-400 hover:text-gyr-primary transition-colors duration-200 text-sm">
                  Contáctenos
                </Link>
              </li>
              <li>
                <Link href="/catalogo" className="text-gray-400 hover:text-gyr-primary transition-colors duration-200 text-sm">
                  Catálogo de productos
                </Link>
              </li>
            </ul>
          </div>
          <div className="footer-column footer-links">
            <h4 className="text-sm font-bold uppercase mb-4">Nuestras políticas</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/politica-calidad" className="text-gray-400 hover:text-gyr-primary transition-colors duration-200 text-sm">
                  Política de calidad
                </Link>
              </li>
              <li>
                <Link href="/politica-privacidad" className="text-gray-400 hover:text-gyr-primary transition-colors duration-200 text-sm">
                  Política de privacidad
                </Link>
              </li>
              <li>
                <Link href="/terminos-condiciones" className="text-gray-400 hover:text-gyr-primary transition-colors duration-200 text-sm">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link href="/politica-cookies" className="text-gray-400 hover:text-gyr-primary transition-colors duration-200 text-sm">
                  Política de cookies
                </Link>
              </li>
            </ul>
          </div>
          <div className="footer-column footer-contact">
            <h4 className="text-sm font-bold uppercase mb-4">Sedes</h4>
            <p className="text-gray-400 text-sm leading-relaxed">
              Calle 14 # 12-65 Local 210, Bogotá
            </p>
          </div>
        </div>
        <div className="footer-bottom border-t border-white/[.2] pt-6">
          <div className="container px-4">
            <p className="text-center text-gray-500 text-sm">
              &copy; 2025 - 2026 Distribuidores Eléctricos G y R. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
