import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { ActivityButton } from "@/components/layout/ActivityButton";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema de Resultados Electorales",
  description: "Registro y seguimiento de resultados por mesa de votación",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1F4E79" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
        <Toaster position="top-right" richColors closeButton />
        <ActivityButton />
      </body>
    </html>
  );
}
