/**
 * What a file's first bytes say it is, as against what its name and the browser said. A content
 * type arrives from the browser, which reads it off the file's extension, so a text file renamed
 * `photo.jpg` is declared `image/jpeg` all the way to storage. These signatures are the one point
 * that looks at the bytes themselves.
 */

/**
 * Enough leading bytes for every signature below: the longest reads the brand at 8..12. A caller
 * that has to fetch the bytes need fetch only this many; one already holding the file passes it
 * whole, since every check below reads by offset and a file too short simply fails it.
 */
export const IMAGE_SIGNATURE_BYTES = 16;

const startsWith = (bytes: Uint8Array, offset: number, expected: number[]) =>
  bytes.length >= offset + expected.length && expected.every((byte, i) => bytes[offset + i] === byte);

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** An ISO base media container (`....ftyp<brand>`), which both AVIF and HEIC are, of one of these brands. */
const isoBrand = (bytes: Uint8Array, brands: string[]) =>
  startsWith(bytes, 4, ascii("ftyp")) && brands.some((brand) => startsWith(bytes, 8, ascii(brand)));

/**
 * One check per allowed type, keyed by the type declared. A format not in the allowlist has no
 * check and so never matches, which keeps this in step with the types uploads are accepted for.
 */
const SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (b) => startsWith(b, 0, [0xff, 0xd8, 0xff]),
  "image/png": (b) => startsWith(b, 0, [0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a]),
  // A RIFF container, which also holds WAV and AVI, so the form at 8..12 is what makes it WebP.
  "image/webp": (b) => startsWith(b, 0, ascii("RIFF")) && startsWith(b, 8, ascii("WEBP")),
  "image/avif": (b) => isoBrand(b, ["avif", "avis"]),
  // Apple stamps HEIC photos with several brands; `mif1`/`msf1` are the generic ones it also uses.
  "image/heic": (b) => isoBrand(b, ["heic", "heix", "hevc", "hevx", "mif1", "msf1"]),
};

/** Whether a file beginning with these bytes really is the type it was declared as. */
export const bytesLookLike = (contentType: string, head: Uint8Array): boolean => SIGNATURES[contentType]?.(head) ?? false;
