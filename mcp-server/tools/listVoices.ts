import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { listVoices } from "../lib/elevenlabs.js";
import { voiceSchema } from "../lib/schemas.js";

export function registerListVoices(server: McpServer): void {
  server.registerTool(
    "list_voices",
    {
      title: "List voices",
      description: "List available ElevenLabs voices to populate the filter picker.",
      outputSchema: { voices: z.array(voiceSchema) },
    },
    async () => {
      const voices = await listVoices();
      return {
        content: [{ type: "text", text: `Found ${voices.length} voices.` }],
        structuredContent: { voices },
      };
    },
  );
}
