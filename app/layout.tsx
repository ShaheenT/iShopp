import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iShopp — Share More. Save More.",
  description: "A real-time shopping savings network.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
