import { ExploreApp } from "@/components/ExploreApp";
import { loadJourneyData } from "@/lib/data";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ place?: string | string[] }> }) {
  const [{ place }, data] = await Promise.all([searchParams, loadJourneyData()]);
  return <ExploreApp data={data} initialPlaceId={typeof place === "string" ? place : undefined} />;
}
