import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trenerlar",
  description:
    "O'zbekistonning eng yaxshi fitness trenerlari. Bodybuilding, yoga, powerlifting, dieta bo'yicha professional trener toping.",
};

export default function TrainersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
