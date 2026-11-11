"use client";

import Link from "next/link";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Link href="/" className={`flex items-center gap-3 ${className ?? ""}`}>
      <img
        src="/images/logo.png"
        alt="Distribuidores Eléctricos G y R"
        className="h-12 w-auto"
        width={120}
        height={40}
        decoding="async"
      />
      <span className="font-bold text-lg tracking-tight text-gyr-heading">
        Distribuidores Eléctricos G y R
      </span>
    </Link>
  );
}
