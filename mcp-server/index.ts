import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * VOICESCREEN.SCR MCP server — stub (M0).
 *
 * Boots a stdio MCP server with zero tools. The ElevenLabs-backed tools
 * (list_voices, get_voice_settings, transform_voice) are added in M4.
 * See CLAUDE.md §7 and ROADMAP.md M4.
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: "voicescreen-mcp",
    version: "0.1.0",
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = (): void => {
    void server.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // stdout is reserved for the MCP protocol on the stdio transport, so log to stderr.
  console.error("[mcp-server] ready");
}

main().catch((error: unknown) => {
  console.error("[mcp-server] fatal:", error);
  process.exit(1);
});
