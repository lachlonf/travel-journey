import * as THREE from "three";

/** Sparse to dense. Index 0 must be blank: it's what empty space draws. */
export const GLYPH_RAMP = " .:-=+*#%@";

export function createGlyphAtlas(cell = 48): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = cell * GLYPH_RAMP.length;
  canvas.height = cell;

  const context = canvas.getContext("2d")!;
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  context.font = `${Math.round(cell * 0.82)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  [...GLYPH_RAMP].forEach((glyph, i) => context.fillText(glyph, (i + 0.5) * cell, cell * 0.54));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}
