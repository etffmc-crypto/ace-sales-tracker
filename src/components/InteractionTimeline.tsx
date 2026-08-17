import { sortInteractionsNewestFirst } from "@/lib/interactions";
import type { AccountDetail } from "@/types/account";

export function InteractionTimeline({
  interactions,
}: {
  interactions: AccountDetail["interactions"];
}) {
  const sorted = sortInteractionsNewestFirst(
    interactions.map((i) => ({ ...i, date: new Date(i.date) })),
  );

  if (sorted.length === 0) {
    return <p className="text-gray-600">No interactions logged yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {sorted.map((i) => (
        <li key={i.id} className="border-b pb-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{i.type}</span>
            <span>{i.date.toLocaleDateString(undefined, { timeZone: "UTC" })}</span>
          </div>
          {i.notes && <p>{i.notes}</p>}
          {i.nextAction && (
            <p className="text-sm text-blue-700">
              Next: {i.nextAction}
              {i.nextActionDate &&
                ` (by ${new Date(i.nextActionDate).toLocaleDateString(undefined, { timeZone: "UTC" })})`}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
