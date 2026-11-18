import type { Metadata } from "next";
import { ConfirmHost } from "@/components/workouts/confirm";

export const metadata: Metadata = {
  title: "Kundalik",
  description: "Mashg'ulot kundaligi: programmalar, padxodlar, yutuqlar va progress statistikasi.",
  robots: { index: false, follow: false },
};

export default function WorkoutsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<ConfirmHost /></>;
}
