export interface TimelineItem {
  id: string;
  date: Date;
}

export function sortInteractionsNewestFirst<T extends TimelineItem>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
}
