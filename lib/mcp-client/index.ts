import "server-only";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { audioStoreDir } from "@/lib/store/audioFiles";

export type Voice = { id: string; name: string; labels: Record<string, string> };
export type VoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
};
export type TransformResult = { resultHandle: string; durationMs: number; voiceId: string };

// Survive Next dev hot-reloads so we don't spawn a new MCP server per HMR cycle.
const store = globalThis as unknown as { __mcpClient?: Promise<Client> };

async function createClient(): Promise<Client> {
  const mcpDir = path.join(process.cwd(), "mcp-server");
  // Run the TypeScript server entry through tsx, sharing our audio store dir.
  // The server reads ELEVENLABS_API_KEY from mcp-server/.env via dotenv (cwd below).
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "index.ts"],
    cwd: mcpDir,
    env: { ...getDefaultEnvironment(), AUDIO_TMP_DIR: audioStoreDir() },
  });
  const client = new Client({ name: "voicescreen-web", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

function getClient(): Promise<Client> {
  if (!store.__mcpClient) {
    store.__mcpClient = createClient().catch((err: unknown) => {
      store.__mcpClient = undefined;
      throw err;
    });
  }
  return store.__mcpClient;
}

function textOf(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part && typeof part === "object" && "text" in part ? String((part as { text: unknown }).text) : "",
    )
    .join(" ")
    .trim();
}

export async function listVoices(): Promise<Voice[]> {
  const client = await getClient();
  const res = await client.callTool({ name: "list_voices", arguments: {} });
  if (res.isError) throw new Error(textOf(res.content) || "list_voices failed");
  return (res.structuredContent as { voices: Voice[] }).voices;
}

export async function transformVoice(input: {
  audioHandle: string;
  targetVoiceId: string;
  settings?: VoiceSettings;
}): Promise<TransformResult> {
  const client = await getClient();
  const res = await client.callTool({ name: "transform_voice", arguments: input });
  if (res.isError) throw new Error(textOf(res.content) || "transform_voice failed");
  return res.structuredContent as TransformResult;
}
