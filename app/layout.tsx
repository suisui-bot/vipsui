import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIPSUI | Curated Luxury Catalog",
  description: "A calm, premium way to browse watches, bags, shoes, jewelry, fashion and accessories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f5f5f7] text-[#1d1d1f]">
        {children}
      </body>
    </html>
  );
}
