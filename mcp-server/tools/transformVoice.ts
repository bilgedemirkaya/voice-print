import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { speechToSpeech } from "../lib/elevenlabs.js";
import { contentTypeForHandle, readAudio, writeAudio } from "../lib/store.js";
import { transformVoiceInput } from "../lib/schemas.js";

export function registerTransformVoice(server: McpServer): void {
  server.registerTool(
    "transform_voice",
    {
      title: "Transform voice",
      description:
        "Convert recorded audio (referenced by handle) to a target ElevenLabs voice. " +
        "Returns a handle to the converted audio plus metadata — never the raw audio.",
      inputSchema: transformVoiceInput,
      outputSchema: {
        resultHandle: z.string(),
        durationMs: z.number(),
        voiceId: z.string(),
      },
    },
    async ({ audioHandle, targetVoiceId, settings, apiKey }) => {
      const source = await readAudio(audioHandle);
      const result = await speechToSpeech({
        voiceId: targetVoiceId,
        audio: source,
        audioContentType: contentTypeForHandle(audioHandle),
        settings,
        apiKey,
      });
      const resultHandle = await writeAudio(result.audio, "mp3");
      const output = {
        resultHandle,
        durationMs: result.durationMsApprox,
        voiceId: targetVoiceId,
      };
      return {
        content: [{ type: "text", text: `Converted → ${resultHandle} (~${output.durationMs} ms).` }],
        structuredContent: output,
      };
    },
  );
}
