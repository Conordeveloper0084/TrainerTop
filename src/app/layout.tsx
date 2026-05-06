import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
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
  ],
  authors: [{ name: "Trainertop" }],
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    url: "https://trainertop.uz",
    siteName: "Trainertop",
    title: "Trainertop — O'zbekistonning #1 fitness platformasi",
    description:
      "Ishonchli fitness trener toping, video darsliklar sotib oling.",
  },
};

import AuthProvider from "@/components/providers/AuthProvider";
import QueryProvider from "@/components/providers/QueryProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz" className={inter.variable}>
      <body className="min-h-screen bg-dark text-white antialiased">
        <QueryProvider>
          <AuthProvider>
            {children}
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
