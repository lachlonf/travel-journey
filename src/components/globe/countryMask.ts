import type { Feature, MultiPolygon, Polygon } from "geojson";
import * as THREE from "three";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

/**
 * Every country painted into an equirectangular texture, its colour's red channel
 * holding a 1-based index. The shader uses it to look up unlock progress; the CPU
 * copy answers "which country did I click".
 */
export interface CountryMask {
  texture: THREE.CanvasTexture;
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  indexByNumericId: Map<string, number>;
  numericIdByIndex: (string | undefined)[];
}

type Countries = Topology<{ countries: GeometryCollection }>;

export async function buildCountryMask(detail: "110m" | "50m", width: number): Promise<CountryMask> {
  const response = await fetch(`/geo/countries-${detail}.json`);
  if (!response.ok) throw new Error(`Country shapes failed to load (${response.status})`);
  const topology = (await response.json()) as Countries;
  const countries = feature(topology, topology.objects.countries).features as Feature<Polygon | MultiPolygon | null>[];

  const height = width / 2;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;

  const indexByNumericId = new Map<string, number>();
  const numericIdByIndex: (string | undefined)[] = [undefined];

  countries.slice(0, 255).forEach((country, i) => {
    const index = i + 1;
    const numericId = country.id === undefined ? undefined : String(country.id);
    numericIdByIndex[index] = numericId;
    if (numericId) indexByNumericId.set(numericId, index);
    if (!country.geometry) return;

    const polygons = country.geometry.type === "Polygon" ? [country.geometry.coordinates] : country.geometry.coordinates;
    context.beginPath();
    for (const rings of polygons) {
      for (const ring of rings) {
        ring.forEach(([lng, lat], j) => {
          const x = ((lng + 180) / 360) * width;
          const y = ((90 - lat) / 180) * height;
          if (j === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
      }
    }
    context.fillStyle = `rgb(${index}, 0, 0)`;
    context.fill("evenodd");
  });

  // Canvas anti-aliases edges into partial alpha, whose colours aren't real indices.
  // Clear those. (Pixels blended along shared borders stay opaque and can be off by
  // a neighbour; at this resolution that's a sub-pixel speck.)
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] !== 255) data.fill(0, p, p + 4);
  }
  context.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  return { texture, pixels: data, width, height, indexByNumericId, numericIdByIndex };
}

export function countryIndexAt(mask: CountryMask, lat: number, lng: number): number {
  const x = Math.min(mask.width - 1, Math.max(0, Math.floor(((lng + 180) / 360) * mask.width)));
  const y = Math.min(mask.height - 1, Math.max(0, Math.floor(((90 - lat) / 180) * mask.height)));
  return mask.pixels[(y * mask.width + x) * 4];
}
