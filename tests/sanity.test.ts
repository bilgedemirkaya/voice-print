import { describe, expect, it } from "vitest";

// Trivial test proving the Vitest toolchain is wired up (M0).
// Real unit tests arrive in M2 (audio features) and M4 (MCP tool schemas).
describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
