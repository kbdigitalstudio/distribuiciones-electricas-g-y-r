"use client";

import { User as UserIcon } from "lucide-react";

interface UserAccessProps {
  onOpen?: () => void;
}

export function UserAccess({ onOpen }: UserAccessProps) {
  return (
    <div
      onClick={onOpen}
      className="relative p-2 text-gyr-heading hover:text-gyr-primary transition-colors duration-300 cursor-pointer"
      aria-label="Abrir sesión"
    >
      <UserIcon className="w-5 h-5" />
    </div>
  );
}
