import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVoiceSettings } from "../lib/elevenlabs.js";
import { getVoiceSettingsInput, voiceSettingsShape } from "../lib/schemas.js";

export function registerGetVoiceSettings(server: McpServer): void {
  server.registerTool(
    "get_voice_settings",
    {
      title: "Get voice settings",
      description: "Fetch a voice's stability/similarity/style settings to seed the sliders.",
      inputSchema: getVoiceSettingsInput,
      outputSchema: voiceSettingsShape,
    },
    async ({ voiceId }) => {
      const settings = await getVoiceSettings(voiceId);
      return {
        content: [{ type: "text", text: `Settings for voice ${voiceId}.` }],
        structuredContent: settings,
      };
    },
  );
}
