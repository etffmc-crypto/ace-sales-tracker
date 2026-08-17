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
