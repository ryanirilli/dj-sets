import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import HeaderLogo from "@/components/HeaderLogo";
import { FullScreenProvider } from "@/contexts/FullScreenContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DJ Sets Audio Visualizer",
  description: "Visualize your DJ sets with 3D audio visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full dark">
      <body
        className={`${inter.variable} antialiased h-full overflow-hidden bg-black text-white`}
      >
        <FullScreenProvider>
          <HeaderLogo />
          {children}
        </FullScreenProvider>
      </body>
    </html>
  );
}
