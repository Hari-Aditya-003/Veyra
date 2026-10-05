import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snap HUB — Every event, one easy share",
  description: "Share event photos and videos through one private QR gallery — no guest app needed.",
  applicationName: "Snap HUB",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Snap HUB", statusBarStyle: "default" },
  icons: {
    icon: "/snap-hub-logo.png",
    shortcut: "/snap-hub-logo.png",
    apple: "/snap-hub-logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff3d98",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
