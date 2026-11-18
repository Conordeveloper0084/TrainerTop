import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Postlar",
  description:
    "Fitness trenerlarning postlari, mashq natijalari va maslahatlar. O'zbekistondagi trenerlarning ish natijalarini ko'ring.",
};

export default function PostsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
