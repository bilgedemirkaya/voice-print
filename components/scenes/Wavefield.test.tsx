import { describe, expect, it, vi } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import type * as THREE from "three";
import { Wavefield } from "./Wavefield";
import { silentParams } from "@/lib/audio/params";
import { useAudioStore } from "@/lib/store/audioStore";

describe("Wavefield (r3f)", () => {
  it("renders a wireframe mesh, reacts to params, and disposes on unmount", async () => {
    useAudioStore.getState().setParams(silentParams());

    const renderer = await ReactThreeTestRenderer.create(<Wavefield />);
    const mesh = renderer.scene.findByType("Mesh").instance as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const material = mesh.material as THREE.MeshBasicMaterial;

    expect(material.wireframe).toBe(true);
    expect(material.vertexColors).toBe(true);

    const position = geometry.attributes.position;
    const before = Float32Array.from(position.array as Float32Array);

    // Energetic params should displace the terrain.
    useAudioStore.getState().setParams({
      ...silentParams(),
      energy: 1,
      bass: 1,
      mid: 1,
      treble: 1,
      brightness: 0.8,
    });
    await renderer.advanceFrames(3, 0.016);

    const after = position.array as Float32Array;
    let changed = false;
    for (let i = 0; i < after.length; i++) {
      if (after[i] !== before[i]) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);

    const disposeGeometry = vi.spyOn(geometry, "dispose");
    const disposeMaterial = vi.spyOn(material, "dispose");
    await renderer.unmount();

    expect(disposeGeometry).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalled();
  });
});
