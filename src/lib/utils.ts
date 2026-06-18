/**
 * Hash a string to a 32-bit unsigned integer using the FNV-1a algorithm.
 * Useful for producing a deterministic numeric seed from text.
 *
 * @param value - The input string to hash.
 * @returns A 32-bit unsigned integer hash suitable as a seed.
 * @example
 * // deterministic seed for a player id
 * const seed = hashStringToSeed('player1');
 * // => 32-bit unsigned integer (e.g. 1234567890)
 */
export function hashStringToSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

/**
 * Compute a 32-bit unsigned seed from a file by hashing its contents with
 * SHA-256 and returning the first four bytes as an unsigned integer.
 *
 * @param file - The `File` whose contents will be hashed.
 * @returns A promise that resolves to a 32-bit unsigned integer seed.
 * @example
 * // input from an <input type="file"> element
 * const seed = await hashFileToSeed(input.files[0]);
 */
export async function hashFileToSeed(file: File) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  const bytes = new Uint8Array(digest);

  return (
    ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0
  );
}

/**
 * Format a time duration in seconds to a string of the form `M:SS.t`.
 * Non-finite values return `0:00.0`.
 *
 * @param seconds - Time in seconds (may include fractional seconds).
 * @returns A formatted time string like `1:05.3`.
 * @example
 * formatTime(65.34); // "1:05.3"
 */
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00.0";

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenth = Math.floor((seconds % 1) * 10);

  return `${mins}:${String(secs).padStart(2, "0")}.${tenth}`;
}

/**
 * Clamp a number to the inclusive range [`min`, `max`].
 *
 * @param value - The number to clamp.
 * @param min - Lower bound of the range.
 * @param max - Upper bound of the range.
 * @returns The clamped value.
 * @example
 * clamp(10, 0, 5); // 5
 * clamp(-2, 0, 5); // 0
 */
export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
