import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "latin-ext"], // latin-ext: Türkçe ğ, ı, ş, İ
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TPRDS — TEKNOFEST Proje Raporları Değerlendirme Sistemi",
  description:
    "TEKNOFEST proje raporları için yapay zekâ destekli hakem karar destek sistemi.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className={`${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
