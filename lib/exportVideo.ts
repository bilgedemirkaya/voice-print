import { downloadBlob } from "./download";

/** Record a canvas (the live visualization) to a downloadable webm clip — a shareable "voiceprint". */
export async function exportSceneVideo(
  canvas: HTMLCanvasElement,
  options: { audioStream?: MediaStream | null; durationMs?: number } = {},
): Promise<void> {
  const { audioStream, durationMs = 6000 } = options;
  if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") return;

  // Combine the live canvas frames with the audio tap so the clip carries sound.
  const stream = canvas.captureStream(30);
  if (audioStream) {
    for (const track of audioStream.getAudioTracks()) stream.addTrack(track);
  }

  const candidates = audioStream
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm"];
  const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "video/webm";

  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  await new Promise<void>((resolve) => {
    recorder.onstop = () => {
      downloadBlob(new Blob(chunks, { type: mimeType }), "voiceprint.webm");
      resolve();
    };
    recorder.start();
    setTimeout(() => recorder.stop(), durationMs);
  });
}
