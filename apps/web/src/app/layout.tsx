import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Empresas Antonio",
  description: "Plataforma de ventas — MVP",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
