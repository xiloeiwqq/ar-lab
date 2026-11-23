// The build replaces this placeholder with the unchanged files from dist.
const assets = new Map(/* ASSET_ENTRIES */);

function requestedRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value ?? '');
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return { start, end };
}

export default {
  fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const { pathname } = new URL(request.url);
    const asset = assets.get(pathname === '/' ? '/index.html' : pathname);
    if (!asset) return new Response('Not found', { status: 404 });

    const [type, contents, size] = asset;
    const headers = new Headers({
      'Content-Type': type,
      'Content-Length': size,
      'Cache-Control': 'no-cache',
    });
    if (type === 'model/vnd.usdz+zip') headers.set('Accept-Ranges', 'bytes');
    if (request.method === 'HEAD') return new Response(null, { headers });

    const binary = atob(contents);
    const bytes = new Uint8Array(size);
    for (let index = 0; index < size; index++) bytes[index] = binary.charCodeAt(index);
    if (type === 'model/vnd.usdz+zip') {
      const range = requestedRange(request.headers.get('Range'), size);
      if (range) {
        const { start, end } = range;
        if (start >= size || start > end) {
          headers.set('Content-Range', `bytes */${size}`);
          headers.delete('Content-Length');
          return new Response(null, { status: 416, headers });
        }
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
        headers.set('Content-Length', end - start + 1);
        return new Response(bytes.subarray(start, end + 1), { status: 206, headers });
      }
    }
    return new Response(bytes, { headers });
  },
};
