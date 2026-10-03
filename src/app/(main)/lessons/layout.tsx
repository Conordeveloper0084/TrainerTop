import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video darsliklar",
  description:
    "Professional fitness video darsliklar. Bodybuilding, yoga, ozish, mushak yig'ish bo'yicha to'liq video kurslar. Trenerlardan va TrainerTop platformasidan premium darsliklar.",
};

export default function LessonsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
