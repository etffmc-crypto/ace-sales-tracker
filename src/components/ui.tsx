import type { ReactNode } from "react";

/** Turns enum-style values like PROPERTY_MGMT into "Property mgmt". */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const words = value.toLowerCase().split("_");
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export const STAGE_LABELS: Record<string, string> = {
  PROSPECT: "Prospect",
  CONTACTED: "Contacted",
  QUOTED: "Quoted",
  ACTIVE_CUSTOMER: "Active customer",
  INACTIVE: "Inactive",
};

export const TYPE_LABELS: Record<string, string> = {
  CONTRACTOR: "Contractor",
  RESTAURANT: "Restaurant",
  PROPERTY_MGMT: "Property management",
  MUNICIPAL: "Municipal",
  OTHER: "Other",
};

export function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] ?? humanize(stage);
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? humanize(type);
}

const STAGE_STYLES: Record<string, string> = {
  PROSPECT: "border-gray-200 bg-gray-50 text-gray-700",
  CONTACTED: "border-sky-200 bg-sky-50 text-sky-700",
  QUOTED: "border-amber-200 bg-amber-50 text-amber-700",
  ACTIVE_CUSTOMER: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIVE: "border-gray-200 bg-white text-gray-400",
};

const STAGE_DOTS: Record<string, string> = {
  PROSPECT: "bg-gray-400",
  CONTACTED: "bg-sky-500",
  QUOTED: "bg-amber-500",
  ACTIVE_CUSTOMER: "bg-emerald-500",
  INACTIVE: "bg-gray-300",
};

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span
      className={`badge ${STAGE_STYLES[stage] ?? "border-gray-200 bg-gray-50 text-gray-700"}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${STAGE_DOTS[stage] ?? "bg-gray-400"}`}
      />
      {stageLabel(stage)}
    </span>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "danger" | "warning" | "success" | "info";
}) {
  const tones = {
    neutral: "border-gray-200 bg-gray-50 text-gray-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  description,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
          <div>
            {title && <h2 className="section-title">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
      />
    </svg>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <p className="alert-error">{children}</p>;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/* Small inline icons (no extra dependency) */
export const Icons = {
  search: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  building: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 17V4.5A1.5 1.5 0 0 1 5.5 3h6A1.5 1.5 0 0 1 13 4.5V17M13 8h1.5A1.5 1.5 0 0 1 16 9.5V17M3 17h14M7 6.5h3M7 9.5h3M7 12.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <rect x="3" y="4.5" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 8.5h14M7 3v3M13 3v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  sparkles: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M9 3.5 10.4 7.6 14.5 9l-4.1 1.4L9 14.5 7.6 10.4 3.5 9l4.1-1.4L9 3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M15.5 12.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" fill="currentColor" />
    </svg>
  ),
  map: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M10 17s-5-4.6-5-8.5a5 5 0 0 1 10 0C15 12.4 10 17 10 17z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="8.5" r="1.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="m5 10.5 3 3 7-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m4 6.5 6 4.5 6-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="7" y="7" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M6.5 3.5h2l1.2 3.2-1.6 1.1a8 8 0 0 0 4.1 4.1l1.1-1.6 3.2 1.2v2a1.5 1.5 0 0 1-1.6 1.5A12.5 12.5 0 0 1 5 5.1a1.5 1.5 0 0 1 1.5-1.6z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  arrowRight: (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8M12.5 13.5 16 10l-3.5-3.5M16 10H8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
