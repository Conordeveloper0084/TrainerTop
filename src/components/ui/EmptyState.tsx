import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-16", className)}>
      <div className="w-16 h-16 rounded-full bg-dark-surface flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <p className="text-white/40 text-sm mb-1">{title}</p>
      {description && (
        <p className="text-white/20 text-xs mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
