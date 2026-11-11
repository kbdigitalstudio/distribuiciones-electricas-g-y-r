"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { WhatsAppFloating } from "@/components/ui/whatsapp-floating";
import { BANCOS_PSE } from "@/types/user";
import type { User, CartItem } from "@/types/user";

function isAuthenticated(user: User | null): boolean {
  return Boolean(user && user.isAuthenticated === true);
}

function isProfileComplete(user: User | null): boolean {
  return Boolean(
    user &&
      user.nombre &&
      user.telefono &&
      user.direccion &&
      user.ciudad
  );
}

export default function CheckoutPage() {
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBank, setSelectedBank] = useState("Selecciona tu banco");
  const [personType, setPersonType] = useState<"natural" | "juridica">("natural");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    const storedCart = localStorage.getItem("cart");
    if (storedCart) {
      setCart(JSON.parse(storedCart));
    }
  }, []);

  // Verificaciones de acceso
  if (!isAuthenticated(user)) {
    return (
      <div className="flex flex-col min-h-screen bg-gyr-bg">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gyr-heading mb-4">Acceso Restringido</h2>
            <p className="text-gyr-text mb-6">Por favor inicia sesión para continuar con tu compra.</p>
            <button
              onClick={() => (window.location.href = "/")}
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

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-gyr-bg">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gyr-heading mb-4">Acceso Restringido</h2>
            <p className="text-gyr-text mb-6">No se pudo cargar la sesión de usuario.</p>
            <button
              onClick={() => (window.location.href = "/")}
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

  if (!isProfileComplete(user)) {
    return (
      <div className="flex flex-col min-h-screen bg-gyr-bg">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gyr-heading mb-4">Perfil Incompleto</h2>
            <p className="text-gyr-text mb-6">
              Por favor completa tu perfil antes de finalizar la compra.
            </p>
            <button
              onClick={() => (window.location.href = "/perfil")}
              className="bg-gyr-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-gyr-primary-hover transition-colors duration-300"
            >
              Ir a Mi Perfil
            </button>
          </div>
        </main>
        <Footer />
        <WhatsAppFloating />
      </div>
    );
  }

  const handleBankChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBank(e.target.value);
  };

  const handlePersonType = (value: "natural" | "juridica") => {
    setPersonType(value);
  };

  const handleProceedPayment = () => {
    if (selectedBank === "Selecciona tu banco") {
      setMessage("Por favor selecciona tu banco");
      return;
    }

    const order = {
      orderId: "ORD-" + Date.now(),
      customer: user,
      items: cart,
      totalItems: cart.length,
      bank: selectedBank,
      personType: personType,
      createdAt: new Date().toISOString(),
    };

    // Guardar orden en LocalStorage (simulación - requiere backend real)
    const ordersRaw = localStorage.getItem("orders");
    let orders: any[] = [];
    if (ordersRaw) {
      try {
        orders = JSON.parse(ordersRaw);
      } catch {
        orders = [];
      }
    }
    orders.push(order);
    localStorage.setItem("orders", JSON.stringify(orders));

    // Simulación de redirección a PSE - requiere pasarela real
    window.alert(
      `Redirigiendo a ${selectedBank}...\n\nEn producción, aquí se conectaría con la pasarela de pago PSE real.\n\nDatos de la orden:\n- ID: ${order.orderId}\n- Banco: ${selectedBank}\n- Tipo: ${personType === "natural" ? "Persona Natural" : "Persona Jurídica"}\n- Productos: ${cart.length}`
    );

    localStorage.removeItem("cart");
    window.location.href = "/?order=" + order.orderId;
  };

  if (cart.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-gyr-bg">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-20">
          <div className="empty-cart text-center px-4">
            <h2 className="text-2xl font-bold text-gyr-heading mb-4">Tu carrito está vacío</h2>
            <p className="text-gyr-text mb-6">Agrega productos para continuar con tu compra</p>
            <button
              onClick={() => (window.location.href = "/catalogo")}
              className="bg-gyr-primary text-white font-semibold px-6 py-3 rounded-full hover:bg-gyr-primary-hover transition-colors duration-300"
            >
              Ver Catálogo
            </button>
          </div>
        </main>
        <Footer />
        <WhatsAppFloating />
      </div>
    );
  }

  const subtotal = cart.length; // placeholder - precios no definidos en original

  return (
    <div className="flex flex-col min-h-screen bg-gyr-bg">
      <Header />
      <main className="flex-1">
        <div className="checkout-container max-w-5xl mx-auto py-12 px-4">
          <div className="checkout-header text-center mb-10">
            <h1 className="text-3xl font-bold text-gyr-primary mb-2">Finalizar Compra</h1>
            <p className="text-gyr-text">Revisa tu pedido y selecciona tu método de pago</p>
          </div>

          <div className="checkout-grid grid lg:grid-cols-2 gap-8">
            {/* Resumen del pedido */}
            <div className="checkout-section bg-white border border-gyr-border-light rounded-2xl p-8 shadow-sm">
              <h2 className="section-title text-xl font-bold text-gyr-heading mb-6 flex items-center gap-2">
                <span className="text-2xl">🛒</span> Resumen del Pedido
              </h2>
              <div className="order-items space-y-4">
                {cart.map((item, i) => (
                  <div key={i} className="order-item flex gap-4 p-4 border-b border-gyr-border-light last:border-b-0">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg bg-gyr-surface-light"
                      decoding="async"
                    />
                    <div className="order-item-info flex-1">
                      <h4 className="font-bold text-gyr-heading">{item.name}</h4>
                      <p className="text-gyr-text text-sm">1 unidad</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="order-summary mt-6 pt-6 border-t border-gyr-border-light">
                <div className="summary-row flex justify-between mb-2">
                  <span className="text-gyr-text">Subtotal:</span>
                  <span className="font-semibold text-gyr-heading">{subtotal} productos</span>
                </div>
                <div className="summary-row flex justify-between mb-2">
                  <span className="text-gyr-text">Envío:</span>
                  <span className="text-gyr-text">A cotizar</span>
                </div>
                <div className="summary-row total flex justify-between mt-4 pt-4 border-t border-gyr-border-light">
                  <span className="font-bold text-gyr-heading">Total:</span>
                  <span className="font-bold text-gyr-primary">A cotizar</span>
                </div>
              </div>
            </div>

            {/* Información y pago */}
            <div className="space-y-6">
              {/* Datos del cliente */}
              <div className="checkout-section bg-white border border-gyr-border-light rounded-2xl p-8 shadow-sm">
                <h2 className="section-title text-xl font-bold text-gyr-heading mb-6 flex items-center gap-2">
                  <span className="text-2xl">👤</span> Información de Envío
                </h2>
                <div className="customer-info bg-gradient-to-r from-667eea to-764ba2 text-white p-6 rounded-lg mb-6">
                  <h3 className="font-bold mb-4">Datos del Cliente</h3>
                  <div className="space-y-2 text-sm">
                    <div className="info-row flex justify-between">
                      <span className="info-label font-semibold">Nombre:</span>
                      <span>{user.nombre}</span>
                    </div>
                    <div className="info-row flex justify-between">
                      <span className="info-label font-semibold">Email:</span>
                      <span>{user.email}</span>
                    </div>
                    <div className="info-row flex justify-between">
                      <span className="info-label font-semibold">Teléfono:</span>
                      <span>{user.telefono}</span>
                    </div>
                    <div className="info-row flex justify-between">
                      <span className="info-label font-semibold">Dirección:</span>
                      <span>{user.direccion}</span>
                    </div>
                    <div className="info-row flex justify-between">
                      <span className="info-label font-semibold">Ciudad:</span>
                      <span>{user.ciudad}</span>
                    </div>
                    {user.departamento && (
                      <div className="info-row flex justify-between">
                        <span className="info-label font-semibold">Departamento:</span>
                        <span>{user.departamento}</span>
                      </div>
                    )}
                  </div>
                  <a
                    href="/perfil"
                    className="edit-profile-btn mt-4 inline-block bg-white text-gyr-primary font-semibold px-4 py-2 rounded-lg hover:bg-gyr-border-light transition-colors duration-300 text-sm"
                  >
                    ✏️ Editar Información
                  </a>
                </div>
              </div>

              {/* Método de pago PSE */}
              <div className="checkout-section bg-white border border-gyr-border-light rounded-2xl p-8 shadow-sm">
                <h2 className="section-title text-xl font-bold text-gyr-heading mb-6 flex items-center gap-2">
                  <span className="text-2xl">💳</span> Método de Pago
                </h2>

                <div className="pse-logo text-center mb-6">
                  <div className="bg-green-600 inline-block px-6 py-3 rounded-lg">
                    <span className="text-white font-bold text-xl">PSE</span>
                  </div>
                  <p className="text-gyr-text text-sm mt-2">Pago Seguro en Línea</p>
                </div>

                <div className="payment-methods space-y-4">
                  <div className="bank-selector">
                    <label className="block font-semibold text-gyr-heading mb-2">
                      Selecciona tu Banco
                    </label>
                    <select
                      id="bank-select"
                      value={selectedBank}
                      onChange={handleBankChange}
                      required
                      className="w-full px-4 py-3 border-2 border-gyr-border rounded-lg bg-white focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                    >
                      {BANCOS_PSE.map((banco) => (
                        <option
                          key={banco}
                          value={banco}
                          disabled={banco === "Selecciona tu banco"}
                          selected={selectedBank === banco}
                        >
                          {banco}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="person-type">
                    <label className="block font-semibold text-gyr-heading mb-3">
                      Tipo de Persona
                    </label>
                    <div className="radio-group flex gap-4">
                      <div className="radio-option flex-1 relative">
                        <input
                          type="radio"
                          id="natural"
                          name="person-type"
                          value="natural"
                          checked={personType === "natural"}
                          onChange={() => handlePersonType("natural")}
                          className="sr-only"
                        />
                        <label
                          htmlFor="natural"
                          className="radio-label block p-4 border-2 border-gyr-border rounded-lg text-center cursor-pointer font-semibold transition-all duration-300 text-gyr-heading hover:border-gyr-primary"
                          data-checked={personType === "natural"}
                        >
                          👤 Persona Natural
                        </label>
                      </div>
                      <div className="radio-option flex-1 relative">
                        <input
                          type="radio"
                          id="juridica"
                          name="person-type"
                          value="juridica"
                          checked={personType === "juridica"}
                          onChange={() => handlePersonType("juridica")}
                          className="sr-only"
                        />
                        <label
                          htmlFor="juridica"
                          className="radio-label block p-4 border-2 border-gyr-border rounded-lg text-center cursor-pointer font-semibold transition-all duration-300 text-gyr-heading hover:border-gyr-primary"
                          data-checked={personType === "juridica"}
                        >
                          🏢 Persona Jurídica
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleProceedPayment}
                    className="btn-pay w-full py-4 bg-gradient-to-r from-green-600 to-emerald-400 text-white font-bold text-lg rounded-lg hover:shadow-[0_8px_20px_rgba(34,197,94,0.3)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selectedBank === "Selecciona tu banco"}
                  >
                    <span>🔒</span>
                    <span>Proceder al Pago</span>
                  </button>

                  <div className="security-badge flex items-center justify-center gap-2 mt-4 text-gyr-text text-sm">
                    <span className="security-icon text-green-600">🔐</span>
                    <span>Transacción 100% segura y encriptada</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <WhatsAppFloating />
    </div>
  );
}
