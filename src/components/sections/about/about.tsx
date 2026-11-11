"use strict";

export function AboutSection() {
  return (
    <section className="about-content py-16">
      <div className="container px-4">
        <div className="about-text-full mb-16">
          <h2 className="text-3xl font-bold text-gyr-heading mb-4">¿Quiénes Somos?</h2>
          <p className="text-gyr-text leading-relaxed mb-6 text-lg">
            Distribuidores Eléctricos G y R SAS, es una empresa del sector eléctrico que dedica sus
            operaciones a la comercialización, distribución de materiales y equipos eléctricos, además
            de prestar asesoría a nivel eléctrico para proyectos de vivienda, empresariales e industriales.
          </p>
          <p className="text-gyr-text leading-relaxed">
            Comprometida con el desarrollo del talento humano y espíritu familiar, enfocada al
            cumplimiento de los requisitos del cliente, partes interesadas, legales y normativos,
            mejorando continuamente el sistema de gestión de calidad y la eficacia de sus procesos.
          </p>
        </div>

        <div className="mission-vision-grid grid md:grid-cols-2 gap-6">
          <div className="mission-card bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-gyr-primary mb-4">Misión</h3>
            <p className="text-gyr-text leading-relaxed">
              Somos una empresa especializada en la comercialización de materiales eléctricos de baja,
              media y alta tensión a nivel nacional, comprometida con la satisfacción permanente de los
              clientes, con productos de excelente calidad, garantía y oportunidad en el suministro,
              apoyado en un equipo humano competente que permita a la organización alcanzar sus
              objetivos de rentabilidad y crecimiento empresarial.
            </p>
          </div>
          <div className="vision-card bg-white border border-gyr-border-light rounded-4xl p-8 shadow-sm">
            <h3 className="text-2xl font-bold text-gyr-primary mb-4">Visión</h3>
            <p className="text-gyr-text leading-relaxed">
              Para este nuevo año 2026 mantendrá la tendencia de crecimiento empresarial a nivel
              nacional, buscando la consolidación dentro de los principales proveedores de materiales
              eléctricos mediante el suministro de soluciones completas en los diferentes sectores,
              apoyados en su talento humano y en el desarrollo sostenible
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
