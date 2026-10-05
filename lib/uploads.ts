import "server-only";

const allowedTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
]);
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "mp4", "mov", "webm"]);

export function isAllowedMedia(file: File) {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  return allowedTypes.has(file.type.toLowerCase()) && allowedExtensions.has(extension);
}
