import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.trainertop.uz"),
  title: {
    default: "Trainertop — O'zbekistonning #1 fitness platformasi",
    template: "%s | Trainertop",
  },
  description:
    "Ishonchli fitness trener toping, video darsliklar sotib oling, professional mashq rejasi oling. O'zbekistonning eng katta fitness platformasi.",
  keywords: [
    "fitness",
    "trener",
    "trainer",
    "Toshkent",
    "O'zbekiston",
    "bodybuilding",
    "yoga",
    "mashq",
    "darslik",
    "sport",
    "trainertop",
    "fitness trener Toshkent",
    "shaxsiy trener",
  ],
  authors: [{ name: "Trainertop" }],
  alternates: {
    canonical: "https://www.trainertop.uz",
  },
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    url: "https://www.trainertop.uz",
    siteName: "Trainertop",
    title: "Trainertop — O'zbekistonning #1 fitness platformasi",
    description:
      "Ishonchli fitness trener toping, video darsliklar sotib oling.",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "Trainertop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trainertop — O'zbekistonning #1 fitness platformasi",
    description: "Ishonchli fitness trener toping, video darsliklar sotib oling.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "TrainerTop",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

// viewport-fit=cover — iOS'da env(safe-area-inset-*) qiymatlari 0 bo'lmasligi uchun shart
// (aks holda notch/home-indicator ostidagi bo'sh joy bilan sahifa mazmuni mos kelmaydi).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

import AuthProvider from "@/components/providers/AuthProvider";
import QueryProvider from "@/components/providers/QueryProvider";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallSheet } from "@/components/pwa/InstallSheet";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" className={inter.variable}>
      <body className="min-h-screen bg-dark text-white antialiased">
        <ServiceWorkerRegister />
        <QueryProvider>
          <AuthProvider>
            {children}
            <InstallSheet />
          </AuthProvider>
        </QueryProvider>
        <Toaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "#1E1E1E",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff",
            },
          }}
        />
      </body>
    </html>
  );
}
