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
  /** Per index: where the country starts and how wide it is, as fractions of the texture. Drives the unlock sweep. */
  extents: { start: number; span: number }[];
}

type Countries = Topology<{ countries: GeometryCollection }>;

// Equirectangular: longitude and latitude map linearly onto the texture.
const toX = (lng: number, width: number) => ((lng + 180) / 360) * width;
const toY = (lat: number, height: number) => ((90 - lat) / 180) * height;
const toPixel = (value: number, size: number) => Math.min(size - 1, Math.max(0, Math.floor(value)));

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
          if (j === 0) context.moveTo(toX(lng, width), toY(lat, height));
          else context.lineTo(toX(lng, width), toY(lat, height));
        });
      }
    }
    context.fillStyle = `rgb(${index}, 0, 0)`;
    context.fill("evenodd");
  });

  // Canvas anti-aliases edges into partial alpha, whose colours aren't real indices.
  // Clear those. (Pixels blended along shared borders stay opaque and can be off by
  // a neighbour; at this resolution that's a sub-pixel speck.) Measure extents on the way.
  const image = context.getImageData(0, 0, width, height);
  const { data } = image;
  const minX = new Uint16Array(256).fill(width);
  const maxX = new Uint16Array(256);
  for (let p = 0; p < data.length; p += 4) {
    if (data[p + 3] !== 255) {
      data.fill(0, p, p + 4);
      continue;
    }
    const index = data[p];
    const x = (p >> 2) % width;
    if (x < minX[index]) minX[index] = x;
    if (x > maxX[index]) maxX[index] = x;
  }
  context.putImageData(image, 0, 0);

  const extents = Array.from({ length: 256 }, (_, i) =>
    maxX[i] >= minX[i] ? { start: minX[i] / width, span: (maxX[i] - minX[i] + 1) / width } : { start: 0, span: 1 },
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  return { texture, pixels: data, width, height, indexByNumericId, numericIdByIndex, extents };
}

export function countryIndexAt(mask: CountryMask, lat: number, lng: number): number {
  const x = toPixel(toX(lng, mask.width), mask.width);
  const y = toPixel(toY(lat, mask.height), mask.height);
  return mask.pixels[(y * mask.width + x) * 4];
}
