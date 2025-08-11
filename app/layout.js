import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner"
import { SettingsProvider } from "@/lib/SettingsContext";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Lamina",
  description:
    "Lamina is your second brain — an AI note-taking app that reads PDFs, articles, and videos, generates layered notes, links ideas, and builds intuitive mind maps from your sources.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SettingsProvider>
        <Toaster />
        {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
