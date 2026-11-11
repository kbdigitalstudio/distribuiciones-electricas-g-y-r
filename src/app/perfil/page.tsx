"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";
import type { User } from "@/types/user";

const DEPARTAMENTOS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas",
  "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba", "Cundinamarca",
  "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Nariño",
  "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia",
  "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada",
];

function isAuthenticated(user: User | null): boolean {
  return Boolean(user && user.isAuthenticated === true);
}

export default function PerfilPage() {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    telefono: "",
    ciudad: "",
    direccion: "",
    departamento: "",
  });
  const [status, setStatus] = useState<{ text: string; subtitle: string; icon: string; complete: boolean }>({
    text: "Perfil Incompleto",
    subtitle: "Por favor completa todos los campos requeridos",
    icon: "⚠️",
    complete: false,
  });
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const parsed: User = JSON.parse(stored);
      setUser(parsed);
      setFormData({
        nombre: parsed.nombre || "",
        email: parsed.email || "",
        telefono: parsed.telefono || "",
        ciudad: parsed.ciudad || "",
        direccion: parsed.direccion || "",
        departamento: parsed.departamento || "",
      });
    }
    updateStatus();
  }, []);

  const updateStatus = () => {
    const complete =
      Boolean(formData.nombre) &&
      Boolean(formData.telefono) &&
      Boolean(formData.ciudad) &&
      Boolean(formData.direccion);
    setStatus({
      text: complete ? "Perfil Completo" : "Perfil Incompleto",
      subtitle: complete
        ? "¡Todo listo para realizar compras!"
        : "Por favor completa todos los campos requeridos",
      icon: complete ? "✅" : "⚠️",
      complete,
    });
  };

  const handleChange = (key: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));
    updateStatus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.telefono || !formData.ciudad || !formData.direccion) {
      setMessage("Por favor completa todos los campos requeridos (marcados con *)");
      return;
    }

    const currentUser = { ...user, ...formData, profileComplete: true } as User;
    localStorage.setItem("user", JSON.stringify(currentUser));

    // Actualizar base de usuarios
    const usersRaw = localStorage.getItem("users");
    if (usersRaw) {
      try {
        const users: Record<string, User> = JSON.parse(usersRaw);
        if (users[currentUser.email]) {
          users[currentUser.email] = currentUser;
          localStorage.setItem("users", JSON.stringify(users));
        }
      } catch {
        // ignorar si no se puede parsear
      }
    }

    setUser(currentUser);
    setMessage("¡Perfil actualizado exitosamente!");

    const cartRaw = localStorage.getItem("cart");
    if (cartRaw) {
      try {
        const cart = JSON.parse(cartRaw);
        if (Array.isArray(cart) && cart.length > 0) {
          if (window.confirm("¿Deseas continuar con tu compra?")) {
            window.location.href = "/checkout";
          } else {
            window.location.href = "/";
          }
          return;
        }
      } catch {
        // ignorar
      }
    }
    window.location.href = "/";
  };

  if (!isAuthenticated(user)) {
    return (
      <div className="flex flex-col min-h-screen bg-gyr-bg">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gyr-heading mb-4">Acceso Restringido</h2>
            <p className="text-gyr-text mb-6">Por favor inicia sesión para acceder a tu perfil.</p>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="bg-gyr-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-gyr-primary-hover transition-colors duration-300"
            >
              Ir al Inicio
            </button>
          </div>
        </main>
        <Footer />
        <WhatsAppFloating />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="profile-container max-w-4xl mx-auto py-12 px-4">
          <div className="profile-header text-center mb-10">
            <h1 className="text-3xl font-bold text-gyr-primary mb-2">Mi Perfil</h1>
            <p className="text-gyr-text">Completa tu información para poder realizar compras</p>
          </div>

          <div className="profile-card bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <div className={`profile-status p-4 rounded-lg mb-6 flex items-center justify-between text-white ${
              status.complete
                ? "bg-gradient-to-r from-4facfe to-00f2fe"
                : "bg-gradient-to-r from-f093fb to-f5576c"
            }`}>
              <div>
                <div className="status-text font-semibold">{status.text}</div>
                <small className="opacity-90">{status.subtitle}</small>
              </div>
              <div className="status-icon text-2xl">{status.icon}</div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="form-row grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1 required-field">
                    Nombre Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="nombre"
                    placeholder="Juan Pérez"
                    value={formData.nombre}
                    onChange={handleChange("nombre")}
                    required
                    className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1 required-field">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gray-100 focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="form-row grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1 required-field">
                    Teléfono <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="telefono"
                    placeholder="3001234567"
                    value={formData.telefono}
                    onChange={handleChange("telefono")}
                    required
                    className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-1 required-field">
                    Ciudad <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="ciudad"
                    placeholder="Bogotá"
                    value={formData.ciudad}
                    onChange={handleChange("ciudad")}
                    required
                    className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
              </div>

              <div className="form-group-full">
                <label className="block font-semibold text-gyr-heading mb-1 required-field">
                  Dirección Completa <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  id="direccion"
                  placeholder="Calle 14 #12-65 Apto 210"
                  value={formData.direccion}
                  onChange={handleChange("direccion")}
                  required
                  className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                />
              </div>

              <div className="form-group-full">
                <label className="block font-semibold text-gyr-heading mb-1">
                  Departamento
                </label>
                <select
                  id="departamento"
                  value={formData.departamento}
                  onChange={handleChange("departamento")}
                  className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                >
                  <option value="">Selecciona un departamento</option>
                  {DEPARTAMENTOS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full btn-save bg-gradient-to-r from-gyr-primary to-gyr-primary-hover text-white font-bold py-4 rounded-lg hover:shadow-auth-btn transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>💾</span>
                <span>Guardar Información</span>
              </button>
            </form>

            {message && (
              <div className="mt-6 p-4 bg-green-100 border border-green-200 rounded-lg text-green-800 text-sm">
                {message}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
