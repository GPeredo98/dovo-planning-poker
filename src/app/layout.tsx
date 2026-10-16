import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PreferencesProvider } from "@/components/preferences-provider";
import "./globals.css";
import "./ios.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dovo Planning Poker",
  description: "Estimate work together in real time. Create or join a Planning Poker room without an account.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" dir="ltr" data-theme="light" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body>
        <div className="app-root">
          <PreferencesProvider>{children}</PreferencesProvider>
        </div>
      </body>
    </html>
  );
}
