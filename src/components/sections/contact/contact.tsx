"use client";

import { Phone, Mail, MapPin } from "lucide-react";

const INFO_CARDS = [
  {
    icon: <Phone className="w-5 h-5" />,
    title: "Teléfono",
    value: "+57 320 448 5436",
  },
  {
    icon: <Mail className="w-5 h-5" />,
    title: "Email",
    value: "distribuidoreselectricosgyrsas@gmail.com",
  },
  {
    icon: <MapPin className="w-5 h-5" />,
    title: "Ubicación",
    value: "Calle 14 # 12-65 Local 210, Bogotá",
  },
];

export function ContactSection() {
  return (
    <section className="contact-section py-16">
      <div className="container px-4">
        <div className="contact-grid grid lg:grid-cols-2 gap-12">
          <div className="contact-info">
            <h2 className="text-3xl font-bold text-gyr-heading mb-2">
              Ponte en contacto con nosotros
            </h2>
            <p className="text-gyr-text mb-8">
              Estamos listos para asesorarte en tus proyectos eléctricos.
            </p>

            <div className="contact-info-cards flex flex-col gap-4">
              {INFO_CARDS.map((card, i) => (
                <div
                  key={i}
                  className="info-card bg-white border border-gyr-border-light rounded-2xl p-6 shadow-sm flex items-start gap-4"
                >
                  <div className="info-icon flex-shrink-0 text-gyr-primary">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-gyr-heading mb-1">{card.title}</h3>
                    <p className="text-gyr-text">{card.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="contact-form-container bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <form
              className="contact-form space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
              }}
            >
              <div className="form-row grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-2">
                    Nombre
                  </label>
                  <input
                    type="text"
                    placeholder="Tu nombre"
                    className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
                <div className="form-group">
                  <label className="block font-semibold text-gyr-heading mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="block font-semibold text-gyr-heading mb-2">
                  Asunto
                </label>
                <input
                  type="text"
                  placeholder="¿En qué podemos ayudarte?"
                  className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                />
              </div>
              <div className="form-group">
                <label className="block font-semibold text-gyr-heading mb-2">
                  Mensaje
                </label>
                <textarea
                  rows={5}
                  placeholder="Escribe tu mensaje aquí..."
                  className="w-full px-4 py-3 border-1.5 border-gyr-border rounded-lg bg-gyr-surface-light focus:outline-none focus:border-gyr-primary transition-colors duration-300"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-block w-full bg-gyr-primary text-white font-semibold py-3 rounded-xl hover:bg-gyr-primary-hover transition-colors duration-300 shadow-btn-primary hover:shadow-btn-primary-hover"
              >
                Enviar Mensaje
              </button>
            </form>
          </div>
        </div>

        <div className="map-container mt-12 rounded-4xl overflow-hidden border border-gyr-border-light shadow-sm">
          <iframe
            width="100%"
            height="450"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src="https://maps.google.com/maps?q=Calle+14+%23+12-65+Local+210%2C+Bogot%C3%A1&t=&z=15&ie=UTF8&iwloc=&output=embed"
            title="Ubicación G y R"
          />
        </div>
      </div>
    </section>
  );
}
