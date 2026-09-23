import { ExploreApp } from "@/components/ExploreApp";
import { loadJourneyData } from "@/lib/data";

/** The site opens on the globe itself, with the title and the two choices over it. */
export default async function Home() {
  return <ExploreApp data={await loadJourneyData()} landing />;
}
