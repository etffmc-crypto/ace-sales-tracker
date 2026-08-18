import type { ReactNode } from "react";

/**
 * Presentational wrapper for a drafted email (subject + body) with an
 * action row underneath. Purely visual — callers own all behavior.
 */
export function EmailDraftPreview({
  subject,
  body,
  to,
  actions,
  footer,
}: {
  subject: string;
  body: string;
  to?: string | null;
  actions: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="space-y-1 border-b border-gray-100 bg-gray-50/70 px-4 py-3 text-sm">
        {to && (
          <p className="flex items-baseline text-gray-500">
            <span className="inline-block w-16 shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-400">
              To
            </span>
            <span className="text-gray-700">{to}</span>
          </p>
        )}
        <p className="flex items-baseline text-gray-900">
          <span className="inline-block w-16 shrink-0 text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Subject
          </span>
          <span className="font-medium">{subject}</span>
        </p>
      </div>
      <p className="whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed text-gray-800">
        {body}
      </p>
      <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50/40 px-4 py-2.5">
        {actions}
      </div>
      {footer}
    </div>
  );
}
