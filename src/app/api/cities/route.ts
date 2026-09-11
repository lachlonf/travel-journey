import { isAdmin } from "@/lib/auth";
import { searchCities, type City } from "@/lib/cities";
import { loadCities } from "@/lib/cities-data";
import { isValidLatLng, nearestCity } from "@/lib/geo";
import { countryName } from "@/lib/journey";

export interface CityResult extends City {
  countryName: string;
}

const withCountry = (city: City): CityResult => ({ ...city, countryName: countryName(city.countryCode) });

/** `?q=cus` searches by name; `?lat=&lng=` finds the nearest city. */
export async function GET(request: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const cities = await loadCities();
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  if (params.get("lat") && params.get("lng") && isValidLatLng(lat, lng)) {
    const nearest = nearestCity({ lat, lng }, cities);
    return Response.json({ nearest: nearest && withCountry(nearest) });
  }
  return Response.json({ results: searchCities(cities, params.get("q") ?? "").map(withCountry) });
}
