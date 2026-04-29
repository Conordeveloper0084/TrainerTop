import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-dark flex flex-col">
      <div className="p-6">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <img src="/app-icon.png" alt="TrainerTop" className="h-9 w-9 rounded-xl" />
          <span className="text-lg font-bold tracking-tight">
            trainer<span className="text-lime">top</span>
          </span>
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
