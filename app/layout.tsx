import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VIPSUI | Luxury Watch House",
  description: "An elegant black and gold luxury watch storefront featuring curated watch collections and product details.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-black text-stone-100">
        {children}
      </body>
    </html>
  );
}
