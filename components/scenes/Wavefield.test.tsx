import { describe, expect, it, vi } from "vitest";
import ReactThreeTestRenderer from "@react-three/test-renderer";
import type * as THREE from "three";
import { Wavefield } from "./Wavefield";
import { silentParams } from "@/lib/audio/params";
import { useAudioStore } from "@/lib/store/audioStore";

type ShaderMaterialLike = THREE.Material & {
  wireframe: boolean;
  uniforms: Record<string, { value: number }>;
};

describe("Wavefield (r3f)", () => {
  it("renders a shader-driven wireframe, reacts to params via uniforms, and disposes on unmount", async () => {
    useAudioStore.getState().setParams(silentParams());

    const renderer = await ReactThreeTestRenderer.create(<Wavefield />);
    const mesh = renderer.scene.findByType("Mesh").instance as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const material = mesh.material as ShaderMaterialLike;

    // Displacement + color now live in the shader, so the material is a ShaderMaterial whose
    // uniforms are the contract the scene drives each frame.
    expect(material.type).toBe("ShaderMaterial");
    expect(material.wireframe).toBe(true);
    expect(material.uniforms.uAmplitude.value).toBe(0); // nothing rendered yet

    // Energetic params should raise the displacement amplitude and advance the clock.
    useAudioStore.getState().setParams({
      ...silentParams(),
      energy: 1,
      bass: 1,
      mid: 1,
      treble: 1,
      brightness: 0.8,
    });
    await renderer.advanceFrames(3, 0.016);

    expect(material.uniforms.uAmplitude.value).toBeGreaterThan(0.5);
    expect(material.uniforms.uTime.value).toBeGreaterThan(0);

    const disposeGeometry = vi.spyOn(geometry, "dispose");
    const disposeMaterial = vi.spyOn(material, "dispose");
    await renderer.unmount();

    expect(disposeGeometry).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalled();
  });
});
