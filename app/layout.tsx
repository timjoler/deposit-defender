import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Deposit Defender UK",
  description: "Draft robust UK tenancy deposit dispute letters using Deposit Defender.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-950 antialiased">
        {children}
      </body>
    </html>
  );
}
