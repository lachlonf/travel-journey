import { notFound } from "next/navigation";
import { StoryApp } from "@/components/StoryApp";
import { loadJourneyData } from "@/lib/data";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stop?: string | string[] }>;
}) {
  const [{ id }, { stop }, data] = await Promise.all([params, searchParams, loadJourneyData()]);
  if (!data.trips.some((trip) => trip.id === id)) notFound();

  return <StoryApp data={data} tripId={id} startPlaceId={typeof stop === "string" ? stop : undefined} />;
}
