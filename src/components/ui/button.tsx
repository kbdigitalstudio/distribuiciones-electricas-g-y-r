"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
}

const BUTTON_VARIANTS = {
  primary:
    "bg-gyr-primary hover:bg-gyr-primary-hover text-white font-semibold px-6 py-3 rounded-full transition-all duration-300 shadow-btn-primary hover:shadow-btn-primary-hover",
  outline:
    "border-2 border-gyr-border-light text-gyr-heading hover:bg-gyr-border-light hover:text-gyr-primary font-semibold px-6 py-3 rounded-full transition-all duration-300",
  ghost:
    "text-gyr-text hover:text-gyr-primary font-semibold px-6 py-3 rounded-full transition-all duration-300",
};

const BUTTON_SIZES = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-base",
  lg: "px-8 py-4 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={[
          BUTTON_VARIANTS[variant],
          BUTTON_SIZES[size],
          className,
        ].filter(Boolean).join(" ")}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
