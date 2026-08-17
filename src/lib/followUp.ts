export interface FollowUpItem {
  id: string;
  nextActionDate: Date | null;
}

export function sortByNeedsFollowUp<T extends FollowUpItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.nextActionDate && b.nextActionDate) {
      return a.nextActionDate.getTime() - b.nextActionDate.getTime();
    }
    if (a.nextActionDate) return -1;
    if (b.nextActionDate) return 1;
    return 0;
  });
}

export interface PendingInteraction {
  accountId: string;
  nextActionDate: Date;
}

/**
 * Picks the earliest (soonest) pending next-action date per account, across
 * all of that account's interactions — not just its most recent one. A
 * newer interaction with no next-action date must not hide an older,
 * still-outstanding follow-up commitment.
 */
export function earliestPendingDateByAccount(
  interactions: PendingInteraction[],
): Map<string, Date> {
  const result = new Map<string, Date>();
  for (const interaction of interactions) {
    const current = result.get(interaction.accountId);
    if (!current || interaction.nextActionDate.getTime() < current.getTime()) {
      result.set(interaction.accountId, interaction.nextActionDate);
    }
  }
  return result;
}
