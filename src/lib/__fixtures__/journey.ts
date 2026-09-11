import type { JourneyData, Place } from "../types";

const place = (p: Partial<Place> & Pick<Place, "id" | "name" | "lat" | "lng" | "countryCode">): Place => ({
  kind: "city",
  parentId: null,
  tripId: null,
  visitedOn: [],
  storyBlocks: [],
  ...p,
});

export const fixture: JourneyData = {
  trips: [
    { id: "t-sa", name: "South America 2025", story: "", startDate: "2025-06-01", endDate: "2025-07-10" },
  ],
  places: [
    place({ id: "cusco", name: "Cusco", lat: -13.53195, lng: -71.96746, countryCode: "PE", tripId: "t-sa", visitedOn: ["2025-06-20"] }),
    place({
      id: "huaraz",
      name: "Huaraz",
      lat: -9.52614,
      lng: -77.52869,
      countryCode: "PE",
      tripId: "t-sa",
      visitedOn: ["2025-06-05"],
      storyBlocks: [
        { type: "text", text: "Arrived in the rain." },
        { type: "photo", photoId: "p2" },
        { type: "text", text: "The lake was worth it." },
        { type: "photo", photoId: "deleted" },
      ],
    }),
    place({
      id: "laguna513",
      kind: "poi",
      name: "Laguna 513",
      lat: -9.2112,
      lng: -77.5466,
      countryCode: "PE",
      parentId: "huaraz",
      tripId: "t-sa",
      visitedOn: ["2025-06-07"],
    }),
    place({ id: "lapaz", name: "La Paz", lat: -16.5, lng: -68.15, countryCode: "BO", tripId: "t-sa", visitedOn: ["2025-07-02"] }),
    place({ id: "sydney", name: "Sydney", lat: -33.8688, lng: 151.2093, countryCode: "AU", visitedOn: ["2019-12-24", "2023-01-02"] }),
    place({ id: "orphan", kind: "poi", name: "Lost spot", lat: -10, lng: -76, countryCode: "PE", parentId: "missing" }),
  ],
  photos: [
    // p1 is in no block, so it's appended to Huaraz's story.
    { id: "p1", placeId: "huaraz", url: "/a.jpg", caption: "", takenAt: null, lat: null, lng: null },
    { id: "p2", placeId: "huaraz", url: "/b.jpg", caption: "", takenAt: null, lat: null, lng: null },
  ],
};
