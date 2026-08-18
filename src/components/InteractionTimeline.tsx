import { sortInteractionsNewestFirst } from "@/lib/interactions";
import type { AccountDetail } from "@/types/account";
import { EmptyState, Icons, formatDate } from "@/components/ui";

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  VISIT: { label: "Visit", className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  CALL: { label: "Call", className: "bg-sky-50 text-sky-700 ring-sky-100" },
  EMAIL: { label: "Email", className: "bg-violet-50 text-violet-700 ring-violet-100" },
};

export function InteractionTimeline({
  interactions,
}: {
  interactions: AccountDetail["interactions"];
}) {
  const sorted = sortInteractionsNewestFirst(
    interactions.map((i) => ({ ...i, date: new Date(i.date) })),
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={Icons.calendar}
        title="No interactions logged yet"
        description="Visits, calls and emails you log will build a history here."
      />
    );
  }

  return (
    <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-gray-200">
      {sorted.map((i) => {
        const style = TYPE_STYLES[i.type] ?? {
          label: i.type,
          className: "bg-gray-50 text-gray-700 ring-gray-100",
        };
        return (
          <li key={i.id} className="relative flex gap-4">
            <span
              className={`relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-white ${style.className}`}
              aria-hidden="true"
            >
              {style.label.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-sm font-medium text-gray-900">{style.label}</p>
                <time className="text-xs tabular-nums text-gray-500">{formatDate(i.date)}</time>
              </div>
              {i.notes && (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {i.notes}
                </p>
              )}
              {i.nextAction && (
                <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  <span className="font-medium">Next:</span> {i.nextAction}
                  {i.nextActionDate && (
                    <span className="text-amber-700/80">· by {formatDate(i.nextActionDate)}</span>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
