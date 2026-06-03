import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Mock the ElevenLabs REST client — no network, no API key needed.
vi.mock("./lib/elevenlabs.js", () => ({
  listVoices: vi.fn(async () => [
    { id: "voice_robot", name: "Robotic", labels: { accent: "american", age: "young" } },
  ]),
  getVoiceSettings: vi.fn(async () => ({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.1,
    use_speaker_boost: true,
  })),
  speechToSpeech: vi.fn(async () => ({
    audio: Buffer.from("FAKE_MP3_BYTES"),
    contentType: "audio/mpeg",
    durationMsApprox: 4242,
  })),
}));

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetVoiceSettings } from "./tools/getVoiceSettings.js";
import { registerListVoices } from "./tools/listVoices.js";
import { registerTransformVoice } from "./tools/transformVoice.js";
import { speechToSpeech } from "./lib/elevenlabs.js";

const SECRET = "sk_super_secret_key";
let tmpDir: string;

async function connectedClient(): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerListVoices(server);
  registerGetVoiceSettings(server);
  registerTransformVoice(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

beforeAll(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "voiceprint-test-"));
  process.env.AUDIO_TMP_DIR = tmpDir;
  process.env.ELEVENLABS_API_KEY = SECRET;
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe("MCP tools (ElevenLabs mocked)", () => {
  it("list_voices maps the API response to {id,name,labels}", async () => {
    const client = await connectedClient();
    const res = await client.callTool({ name: "list_voices", arguments: {} });
    expect(res.structuredContent).toEqual({
      voices: [
        { id: "voice_robot", name: "Robotic", labels: { accent: "american", age: "young" } },
      ],
    });
  });

  it("get_voice_settings returns the settings object", async () => {
    const client = await connectedClient();
    const res = await client.callTool({
      name: "get_voice_settings",
      arguments: { voiceId: "voice_robot" },
    });
    expect(res.structuredContent).toMatchObject({ stability: 0.5, similarity_boost: 0.75 });
  });

  it("transform_voice writes a temp file and returns a handle + metadata", async () => {
    const sourceHandle = "source.webm";
    await writeFile(path.join(tmpDir, sourceHandle), Buffer.from("INPUT_AUDIO"));

    const client = await connectedClient();
    const res = await client.callTool({
      name: "transform_voice",
      arguments: { audioHandle: sourceHandle, targetVoiceId: "voice_robot" },
    });

    const out = res.structuredContent as {
      resultHandle: string;
      durationMs: number;
      voiceId: string;
    };
    expect(out.voiceId).toBe("voice_robot");
    expect(out.durationMs).toBe(4242);
    expect(out.resultHandle).toMatch(/\.mp3$/);

    // the converted audio was actually persisted to the store
    const written = await readFile(path.join(tmpDir, out.resultHandle));
    expect(written.toString()).toBe("FAKE_MP3_BYTES");

    // the source audio was forwarded to ElevenLabs
    expect(vi.mocked(speechToSpeech)).toHaveBeenCalledWith(
      expect.objectContaining({ voiceId: "voice_robot" }),
    );
  });

  it("rejects invalid transform_voice input (schema validation)", async () => {
    const client = await connectedClient();
    let threw = false;
    let isError = false;
    try {
      const res = await client.callTool({
        name: "transform_voice",
        arguments: { audioHandle: "x.webm" }, // missing targetVoiceId
      });
      isError = res.isError === true;
    } catch {
      threw = true;
    }
    expect(threw || isError).toBe(true);
  });

  it("never leaks the API key in any tool output", async () => {
    const client = await connectedClient();
    const results = await Promise.all([
      client.callTool({ name: "list_voices", arguments: {} }),
      client.callTool({ name: "get_voice_settings", arguments: { voiceId: "voice_robot" } }),
    ]);
    for (const result of results) {
      expect(JSON.stringify(result)).not.toContain(SECRET);
    }
  });
});
