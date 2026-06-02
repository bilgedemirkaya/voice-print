import { contentTypeForHandle, readAudio } from "@/lib/store/audioFiles";

// Streams converted (or source) audio from the shared store by handle. See CLAUDE.md §4.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> },
): Promise<Response> {
  const { handle } = await params;
  try {
    const data = await readAudio(handle);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": contentTypeForHandle(handle),
        "Content-Length": String(data.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
