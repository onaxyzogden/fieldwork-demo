/**
 * Photos, sized for the only place this prototype can put them.
 *
 * Everything the demo knows lives in one localStorage key, and a browser gives
 * that key around 5 MB. A phone photo read straight through FileReader arrives
 * as a base64 data URL about a third larger than the file, so three of them
 * fill the budget — and the write that overflows it fails silently, taking
 * every later write with it until something frees space. Shrinking on the way
 * in is what keeps that from being reachable at all: a 1.4 MB camera photo
 * lands at roughly 150 KB here, which is the difference between "three photos"
 * and "more photos than a walkthrough will ever have".
 *
 * The size cap is deliberately generous now. It used to be 1.5 MB, which
 * rejected ordinary phone photos for being ordinary phone photos; the point of
 * the cap now is only to refuse a file too large to decode comfortably.
 */

/** Longest edge, in pixels, of a stored photo. Evidence, not print artwork. */
const MAX_EDGE = 1600;
/** JPEG quality. Above this the bytes climb faster than the detail does. */
const QUALITY = 0.82;
/** Refused before decoding: not a storage budget, just a sane ceiling. */
export const MAX_FILE_BYTES = 25_000_000;

/* Covers both ways storablePhoto returns null — too large, and not readable
   as an image — because the person choosing the file cannot tell which rule
   they hit from a message that only names one of them. */
export const unreadableMessage =
  "That file could not be read as an image. Try a different one, under 25 MB.";

/**
 * A data URL small enough to store, or null when the file cannot be read as an
 * image. Never throws: an unreadable file is a thing the caller reports, not a
 * crash in an onChange handler.
 */
export async function storablePhoto(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) return null;
  if (file.size > MAX_FILE_BYTES) return null;
  const dataUrl = await readAsDataUrl(file);
  if (!dataUrl) return null;
  const shrunk = await downscale(dataUrl);
  // A file already smaller than the re-encode is left alone, so a small PNG
  // screenshot does not get re-compressed into a larger JPEG.
  if (!shrunk) return dataUrl;
  return shrunk.length < dataUrl.length ? shrunk : dataUrl;
}

/** Several files at once, dropping the ones that could not be read. */
export async function storablePhotos(files: File[]): Promise<{
  photos: string[];
  rejected: number;
}> {
  const results = await Promise.all(files.map((f) => storablePhoto(f)));
  const photos = results.filter((r): r is string => r !== null);
  return { photos, rejected: results.length - photos.length };
}

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function downscale(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve(null);
    img.onload = () => {
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, w, h);
      try {
        resolve(canvas.toDataURL("image/jpeg", QUALITY));
      } catch {
        resolve(null);
      }
    };
    img.src = dataUrl;
  });
}
