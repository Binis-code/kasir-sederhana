import { useState, useCallback, type ReactNode } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

// ---------- Button ----------
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost" | "destructive" | "success";
  size?: "sm" | "md" | "lg" | "icon";
};

export function Button({ className, variant = "default", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        variant === "default" && "bg-brand-600 text-white hover:bg-brand-700",
        variant === "success" && "bg-green-600 text-white hover:bg-green-700",
        variant === "outline" && "border border-warm-300 bg-white text-gray-800 hover:bg-warm-100",
        variant === "ghost" && "text-gray-700 hover:bg-warm-100",
        variant === "destructive" && "bg-red-600 text-white hover:bg-red-700",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        size === "icon" && "h-10 w-10",
        className
      )}
      {...props}
    />
  );
}

// ---------- Input ----------
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> };

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn("h-10 w-full rounded-lg border border-warm-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-brand-500", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn("w-full rounded-lg border border-warm-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500", className)}
      {...props}
    />
  );
}

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return <label htmlFor={htmlFor} className={cn("mb-1 block text-xs font-medium text-gray-600", className)}>{children}</label>;
}

export function NativeSelect({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn("h-10 w-full rounded-lg border border-warm-300 bg-white px-3 text-sm focus:border-brand-500", className)}
      {...props}
    >
      {children}
    </select>
  );
}

// ---------- Card ----------
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-warm-200 bg-white shadow-sm", className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-warm-100 px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

// ---------- Badge ----------
export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "green" | "red" | "amber" | "blue"; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
      tone === "neutral" && "bg-warm-100 text-gray-700",
      tone === "green" && "bg-brand-50 text-brand-700",
      tone === "red" && "bg-red-50 text-red-700",
      tone === "amber" && "bg-amber-50 text-amber-700",
      tone === "blue" && "bg-blue-50 text-blue-700",
      className
    )}>
      {children}
    </span>
  );
}

// ---------- States ----------
export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      {icon ? <div className="text-warm-300">{icon}</div> : null}
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description ? <p className="max-w-xs text-xs text-gray-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function ErrorText({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

// ---------- Modal ----------
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={cn("relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Tutup">✕</Button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Toast ----------
type ToastItem = { id: number; title: string; kind: "ok" | "err" };
let pushToastFn: ((t: Omit<ToastItem, "id">) => void) | null = null;

export function toast(title: string, kind: "ok" | "err" = "ok") {
  pushToastFn?.({ title, kind });
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { ...t, id }]);
    setTimeout(() => setItems(prev => prev.filter(x => x.id !== id)), 3500);
  }, []);
  pushToastFn = push;
  return (
    <div className="pointer-events-none fixed bottom-20 left-1/2 z-[70] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 sm:bottom-auto sm:right-4 sm:left-auto sm:translate-x-0 sm:top-16 sm:items-end">
      {items.map(t => (
        <div key={t.id} className={cn(
          "pointer-events-auto rounded-lg px-4 py-2.5 text-sm shadow-lg",
          t.kind === "ok" ? "bg-brand-700 text-white" : "bg-red-600 text-white"
        )}>
          {t.title}
        </div>
      ))}
    </div>
  );
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(date);
}
