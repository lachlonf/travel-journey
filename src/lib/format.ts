const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

export function formatRange(from: string | null, to: string | null): string | null {
  if (from && to && from !== to) return `${formatDate(from)} – ${formatDate(to)}`;
  const only = from ?? to;
  return only ? formatDate(only) : null;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
