// Uploads from engine pages (render, still, sheet) to the local server.
//
// Two things keep large uploads such as a long soundtrack WAV working:
//
// - The body is always sent as a Blob. When a page sends an ArrayBuffer, Chrome
//   copies the whole body into the DevTools Network.requestWillBeSent event,
//   and Playwright reads that event as one string (about four characters per
//   byte). A 16-bit stereo 48 kHz soundtrack is about 192 KB per second, so
//   around ten minutes of audio passed Node's maximum string length and the
//   render stopped with ERR_STRING_TOO_LONG before the first frame. Blob bodies
//   are not copied into the event.
// - The body goes up in pieces of at most UPLOAD_CHUNK_BYTES, each with its
//   byte offset, so no single request or server-side buffer grows with the
//   length of the video. The server assembles the pieces of one upload (its
//   random id) in order and moves the file into place when the last piece
//   arrives (see /__upload in server.js).
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;

export async function upload(path, body, { chunkBytes = UPLOAD_CHUNK_BYTES } = {}) {
  if (!(chunkBytes > 0)) throw new Error(`upload ${path}: chunkBytes must be positive`);
  const blob = body instanceof Blob ? body : new Blob([body]);
  const id = crypto.randomUUID().replaceAll('-', '');
  const base = `/__upload?path=${encodeURIComponent(path)}&upload=${id}`;
  let offset = 0;
  do {
    const part = blob.slice(offset, offset + chunkBytes);
    const last = offset + part.size >= blob.size;
    const res = await fetch(`${base}&offset=${offset}${last ? '&last=1' : ''}`, { method: 'PUT', body: part });
    if (!res.ok) throw new Error(`upload ${path} failed at byte ${offset}: ${await res.text()}`);
    offset += part.size;
  } while (offset < blob.size);
}
