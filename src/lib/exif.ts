import exifr from "exifr";

export interface PhotoMetadata {
  lat: number | null;
  lng: number | null;
  /** YYYY-MM-DD as shown on the camera's clock. */
  takenAt: string | null;
}

const isDate = (v: unknown): v is Date => v instanceof Date && !Number.isNaN(v.getTime());
const pad = (n: number) => String(n).padStart(2, "0");
const isCoord = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;

/** Turns exifr's output into the fields the admin form pre-fills. */
export function normalizeExif(raw: unknown): PhotoMetadata {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const { latitude: lat, longitude: lng } = r;
  // 0,0 is what many apps write when they have no fix.
  const hasGps = isCoord(lat, 90) && isCoord(lng, 180) && !(lat === 0 && lng === 0);
  // EXIF dates have no timezone; exifr reads them as local time, so local getters give back the camera's date.
  const date = [r.DateTimeOriginal, r.CreateDate].find(isDate);

  return {
    lat: hasGps ? lat : null,
    lng: hasGps ? lng : null,
    takenAt: date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : null,
  };
}

export async function readPhotoMetadata(file: Blob): Promise<PhotoMetadata> {
  try {
    return normalizeExif(await exifr.parse(file));
  } catch {
    return normalizeExif(null);
  }
}
