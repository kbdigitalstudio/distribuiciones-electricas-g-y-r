"use client";

import { useState } from "react";

export function WhatsAppFloating() {
  const [popupOpen, setPopupOpen] = useState(false);
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    const phone = "573204485436";
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    setMessage("");
    setPopupOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative">
        <button
          onClick={() => setPopupOpen((prev) => !prev)}
          className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-300"
          aria-label="Abrir WhatsApp"
        >
          <img src="/images/whatsapp.png" alt="WhatsApp" className="w-20 h-20 rounded-full" />
        </button>
        {popupOpen && (
          <div className="absolute bottom-[90px] right-0 w-72 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-gyr-primary text-white p-4 flex items-center gap-3">
              <img src="/images/whatsapp.png" alt="WhatsApp" className="w-6 h-6" />
              <h4 className="font-semibold">Chatea con nosotros</h4>
            </div>
            <div className="p-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe tu mensaje aquí..."
                rows={3}
                className="w-full p-2 border border-gyr-border rounded-lg text-sm focus:outline-none focus:border-gyr-primary resize-none"
              />
              <button
                onClick={handleSend}
                className="mt-3 w-full bg-gyr-primary text-white font-semibold py-2 rounded-lg hover:bg-gyr-primary-hover transition-colors duration-300"
              >
                Enviar mensaje
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
