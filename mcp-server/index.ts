import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerListVoices } from "./tools/listVoices.js";
import { registerGetVoiceSettings } from "./tools/getVoiceSettings.js";
import { registerTransformVoice } from "./tools/transformVoice.js";

/**
 * VOICEPRINT.SCR MCP server (M4).
 *
 * Wraps ElevenLabs voice operations as MCP tools over stdio. The API key is read from this
 * process's own environment only (see .env). Tools return audio *handles* into a shared temp
 * store, never raw audio. See CLAUDE.md §4, §6, §7 and ./README.md.
 */
async function main(): Promise<void> {
  const server = new McpServer({ name: "voiceprint-mcp", version: "0.1.0" });

  registerListVoices(server);
  registerGetVoiceSettings(server);
  registerTransformVoice(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = (): void => {
    void server.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // stdout is reserved for the MCP protocol on the stdio transport, so log to stderr.
  console.error("[mcp-server] ready — tools: list_voices, get_voice_settings, transform_voice");
}

main().catch((error: unknown) => {
  console.error("[mcp-server] fatal:", error);
  process.exit(1);
});
