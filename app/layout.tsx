import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Newsreader } from "next/font/google";
import { heroSrc, site } from "@/lib/site";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const plex = IBM_Plex_Mono({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: `${site.name} — ${site.descriptor}, ${site.town}, ${site.state}`,
  description: `Terraces, retaining walls, planting and outdoor lighting on ${site.region}. Drawn in winter, lived in by summer.`,
};

export const viewport: Viewport = {
  themeColor: "#1f2a2b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${inter.variable} ${plex.variable}`}>
      <head>
        {/* the hero photo, fetched early; the same URL and CORS mode the hero loads it with */}
        <link rel="preload" as="image" href={heroSrc(2400)} media="(min-width: 768px)" crossOrigin="anonymous" fetchPriority="high" />
        <link rel="preload" as="image" href={heroSrc(1600)} media="(max-width: 767.98px)" crossOrigin="anonymous" fetchPriority="high" />
        <link rel="preconnect" href="https://images.pexels.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
