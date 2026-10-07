type StoredMedia = R2ObjectBody;

export function mediaResponse(
  object: StoredMedia,
  request: Request,
  options: { contentType: string; filename: string; download?: boolean; cacheControl: string },
) {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": options.cacheControl,
    "Content-Type": options.contentType,
    ETag: object.httpEtag,
  });

  if (object.range) {
    const offset = "offset" in object.range ? object.range.offset : Math.max(0, object.size - object.range.suffix);
    const length = "length" in object.range ? object.range.length : object.range.suffix;
    headers.set("Content-Length", String(length));
    headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
  } else {
    headers.set("Content-Length", String(object.size));
  }

  if (options.download) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(options.filename)}`);
  }

  return new Response(request.method === "HEAD" ? null : object.body, {
    status: object.range ? 206 : 200,
    headers,
  });
}
