"use strict";

interface HeroProps {
  title?: string;
  subtitle?: string;
  imageUrl?: string;
}

export function Hero({ title, subtitle, imageUrl }: HeroProps) {
  return (
    <section className="hero relative pt-24 pb-12 text-center overflow-hidden">
      <div className="absolute inset-0 bg-black/[.5] z-0" />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Hero background"
          className="absolute inset-0 w-full h-full object-cover z-[-1]"
          decoding="async"
        />
      ) : null}
      <div className="container relative z-10 px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          {title ? (
            <span dangerouslySetInnerHTML={{ __html: title }} />
          ) : (
            <>
              Soluciones <span className="text-gyr-primary">Eléctricas</span> de Alta Calidad
            </>
          )}
        </h1>
        <p className="text-lg text-white/90 max-w-2xl mx-auto">
          {subtitle || "Distribución de materiales eléctricos para todo tipo de proyectos."}
        </p>
      </div>
    </section>
  );
}

export function HeroSmall({ title, imageUrl }: { title: string; imageUrl?: string }) {
  return (
    <section className="hero-small relative py-16 md:py-24 text-center overflow-hidden mb-12">
      <div className="absolute inset-0 bg-black/[.6] z-0" />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Hero background"
          className="absolute inset-0 w-full h-full object-cover z-[-1]"
          decoding="async"
        />
      ) : null}
      <div className="container relative z-10 px-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white">
          {title}
        </h1>
      </div>
    </section>
  );
}
