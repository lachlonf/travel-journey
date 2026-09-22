import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { distanceKm, EARTH_RADIUS_KM, flightPosition, latLngToVector3, vector3ToLatLng, type CameraStop } from "@/lib/geo";
import type { CountryNode } from "@/lib/journey";
import { WORLD_ALTITUDE, type CameraTarget, type Pin } from "@/lib/navigation";
import { buildCountryMask, countryIndexAt, type CountryMask } from "./countryMask";
import { createGlyphAtlas, GLYPH_RAMP } from "./glyphs";
import { writeTapestryHues, type HuedCountry } from "./hues";
import { detectQuality } from "./quality";
import { asciiFragment, fullscreenVertex, globeFragment, globeVertex } from "./shaders";

const UNLOCK_MS = 1800;
const UNLOCK_STAGGER_MS = 450;
const SEEN_KEY = "journey:seen-countries";
/** Must match the story panel's CSS. */
const PANEL_WIDTH_REM = 34;
const SHEET_BREAKPOINT_PX = 900;
const SHEET_HEIGHT = 0.6;

export type UnlockableCountry = Pick<CountryNode, "code" | "numericId" | "center">;

export interface GlobeEngine {
  flyTo(target: CameraTarget): void;
  setUnlocked(countries: readonly UnlockableCountry[]): void;
  setPins(pins: readonly Pin[], elements: ReadonlyMap<string, HTMLElement>): void;
  /** `sheetReserveRem`: extra space above the bottom sheet to keep clear, e.g. story mode's controls. */
  setPanelOpen(open: boolean, sheetReserveRem?: number): void;
  dispose(): void;
}

export function supportsWebGL(): boolean {
  try {
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}

// Remember which unlocks a viewer has watched, so each one only plays once per browser.
function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function rememberSeen(code: string): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...readSeen().add(code)]));
  } catch {
    // Storage blocked: the unlock just plays again next visit.
  }
}

export function createGlobeEngine(container: HTMLElement, options: { onCountryClick(code: string): void }): GlobeEngine {
  const quality = detectQuality();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let disposed = false;

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(quality.pixelRatio);
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100);
  camera.position.set(...latLngToVector3(5, -65, 1 + WORLD_ALTITUDE));
  camera.lookAt(0, 0, 0);

  // Pass 1 renders the globe off-screen, with each pixel's unlock progress in alpha.
  const unlockData = new Uint8Array(256 * 4);
  const unlockTexture = new THREE.DataTexture(unlockData, 256, 1);
  unlockTexture.needsUpdate = true;
  // The hue each country blooms into, which only the glyph pass reads.
  const hueData = new Uint8Array(256 * 4);
  const hueTexture = new THREE.DataTexture(hueData, 256, 1);
  hueTexture.needsUpdate = true;
  const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
  blank.needsUpdate = true;

  const globeMaterial = new THREE.ShaderMaterial({
    vertexShader: globeVertex,
    fragmentShader: globeFragment,
    uniforms: {
      earthMap: { value: blank as THREE.Texture },
      countryMask: { value: blank as THREE.Texture },
      unlockTex: { value: unlockTexture },
    },
  });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(1, quality.segments, quality.segments / 2), globeMaterial);
  const scene = new THREE.Scene();
  scene.add(globe);
  // Nearest, because pass 1's channels are facts about a pixel rather than a picture:
  // blending them across a border would hand the glyph pass a country that isn't there.
  const sceneTarget = new THREE.WebGLRenderTarget(1, 1, {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
  });

  // Pass 2 draws that image as glyphs, except where a country has unlocked.
  const glyphs = createGlyphAtlas();
  const asciiMaterial = new THREE.ShaderMaterial({
    vertexShader: fullscreenVertex,
    fragmentShader: asciiFragment,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      scene: { value: sceneTarget.texture },
      hues: { value: hueTexture },
      glyphs: { value: glyphs },
      glyphCount: { value: GLYPH_RAMP.length },
      resolution: { value: new THREE.Vector2(1, 1) },
      cellSize: { value: quality.cellSize },
      time: { value: 0 },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), asciiMaterial);
  quad.frustumCulled = false;
  const post = new THREE.Scene();
  post.add(quad);
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.35;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
  });

  let altitude = WORLD_ALTITUDE;
  function settleAt(nextAltitude: number) {
    controls.minDistance = 1 + nextAltitude * 0.5;
    controls.maxDistance = 1 + nextAltitude * 1.8;
    // Drag slower the closer you are, or a flick sends a city across the screen.
    controls.rotateSpeed = Math.min(1, Math.max(0.02, nextAltitude / WORLD_ALTITUDE));
  }
  settleAt(altitude);

  // Camera flights.
  let flight: { from: CameraStop; to: CameraStop; start: number; duration: number } | null = null;

  function flyTo(target: CameraTarget) {
    const here = vector3ToLatLng(camera.position.toArray());
    const from = { ...here, altitude: camera.position.length() - 1 };
    // Places are framed for the whole screen; on phones the sheet hides part of it, so pull back to fit above.
    const visible = 1 - sheetCover(container.clientWidth, container.clientHeight);
    const to = {
      lat: target.lat ?? here.lat,
      lng: target.lng ?? here.lng,
      altitude: target.lat === null ? target.altitude : target.altitude / visible,
    };
    const hop = distanceKm(from, to) / EARTH_RADIUS_KM;
    const still = hop < 1e-5 && Math.abs(to.altitude - from.altitude) < 1e-3;
    const effort = Math.min(1, hop / 1.5 + Math.abs(Math.log(to.altitude / from.altitude)) / 5);

    flight = { from, to, start: performance.now(), duration: reducedMotion || still ? 0 : 1100 + 1500 * effort };
    altitude = to.altitude;
    controls.enabled = false;
    controls.autoRotate = target.lat === null && !reducedMotion;
  }

  // Unlocks.
  let mask: CountryMask | null = null;
  let unlocked: readonly UnlockableCountry[] = [];
  const unlocking = new Map<number, { code: string; start: number }>();

  function applyUnlocked() {
    if (!mask) return;
    const seen = readSeen();
    const wanted = new Set<number>();
    const hued: HuedCountry[] = [];
    let firstNew: UnlockableCountry | undefined;
    let queued = 0;

    for (const country of unlocked) {
      // Microstates below the atlas's resolution have no shape to colour; their pins still work.
      const index = country.numericId ? mask.indexByNumericId.get(country.numericId) : undefined;
      if (!index) continue;
      wanted.add(index);
      hued.push({ code: country.code, index });
      if (unlockData[index * 4] === 255 || unlocking.has(index)) continue;

      if (seen.has(country.code) || reducedMotion) {
        unlockData[index * 4] = 255;
      } else {
        unlocking.set(index, { code: country.code, start: performance.now() + 700 + queued++ * UNLOCK_STAGGER_MS });
        firstNew ??= country;
      }
    }
    for (let index = 1; index < 256; index++) {
      if (!wanted.has(index)) {
        unlockData[index * 4] = 0;
        unlocking.delete(index);
      }
    }
    unlockTexture.needsUpdate = true;
    writeTapestryHues(hueData, hued);
    hueTexture.needsUpdate = true;

    // Turn the globe to face a new unlock, if the viewer is still just looking at the world.
    if (firstNew && !flight && altitude === WORLD_ALTITUDE && controls.autoRotate) {
      flyTo({ ...firstNew.center, altitude: WORLD_ALTITUDE });
    }
  }

  function stepUnlocks(now: number) {
    if (!unlocking.size) return;
    for (const [index, { code, start }] of unlocking) {
      const t = Math.min(1, Math.max(0, (now - start) / UNLOCK_MS));
      unlockData[index * 4] = Math.round(t * 255);
      if (t === 1) {
        unlocking.delete(index);
        rememberSeen(code);
      }
    }
    unlockTexture.needsUpdate = true;
  }

  // HTML pins, positioned over the canvas each frame.
  let pinSlots: { element: HTMLElement; position: THREE.Vector3 }[] = [];
  const projected = new THREE.Vector3();

  function updatePins(width: number, height: number) {
    for (const { element, position } of pinSlots) {
      projected.copy(position).project(camera);
      // A point on the unit sphere faces the camera exactly when position · camera > 1.
      const visible = position.dot(camera.position) > 1 && Math.abs(projected.x) < 1.2 && Math.abs(projected.y) < 1.2;
      element.style.visibility = visible ? "visible" : "hidden";
      if (visible) {
        const x = ((projected.x + 1) / 2) * width;
        const y = ((1 - projected.y) / 2) * height;
        element.style.transform = `translate3d(${x}px, ${y}px, 0) translateY(-50%)`;
      }
    }
  }

  // Clicking a country's shape opens it.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pressedAt: { x: number; y: number } | null = null;

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pressedAt = { x: event.clientX, y: event.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (event) => {
    const isClick = pressedAt !== null && Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) < 6;
    pressedAt = null;
    if (!isClick || !mask) return;

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(globe, false)[0];
    if (!hit) return;

    const { lat, lng } = vector3ToLatLng(hit.point.toArray());
    const numericId = mask.numericIdByIndex[countryIndexAt(mask, lat, lng)];
    const country = numericId ? unlocked.find((c) => c.numericId === numericId) : undefined;
    if (country) options.onCountryClick(country.code);
  });

  // Sizing.
  const bufferSize = new THREE.Vector2();
  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height);
    renderer.getDrawingBufferSize(bufferSize);
    sceneTarget.setSize(bufferSize.x, bufferSize.y);
    asciiMaterial.uniforms.resolution.value.copy(bufferSize);
    camera.aspect = width / height;
    // Keep 45° across the narrower side, so portrait phones see the whole globe.
    camera.fov = width >= height ? 45 : (2 * Math.atan(Math.tan(Math.PI / 8) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // Assets.
  let earthTexture: THREE.Texture | null = null;
  new THREE.TextureLoader().loadAsync("/textures/earth.jpg").then(
    (texture) => {
      if (disposed) return texture.dispose();
      texture.colorSpace = THREE.NoColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      earthTexture = texture;
      globeMaterial.uniforms.earthMap.value = texture;
    },
    (error) => console.error("Earth texture failed to load", error),
  );
  buildCountryMask(quality.atlas, quality.maskWidth).then(
    (built) => {
      if (disposed) return built.texture.dispose();
      mask = built;
      // Green and blue carry each country's horizontal extent, so the reveal can sweep across it.
      built.extents.forEach(({ start, span }, index) => {
        unlockData[index * 4 + 1] = Math.round(start * 255);
        unlockData[index * 4 + 2] = Math.max(1, Math.round(span * 255));
      });
      globeMaterial.uniforms.countryMask.value = built.texture;
      applyUnlocked();
    },
    (error) => console.error(error),
  );

  // Frame loop.
  let panelOpen = false;
  let sheetReserve = 0;
  const inset = new THREE.Vector2();
  const insetGoal = new THREE.Vector2();

  /** Fraction of the screen's height hidden by the bottom sheet and anything reserved above it. */
  function sheetCover(width: number, height: number): number {
    if (!panelOpen || width > SHEET_BREAKPOINT_PX || !height) return 0;
    return Math.min(0.8, SHEET_HEIGHT + (sheetReserve * remPx) / height);
  }
  let frameId = requestAnimationFrame(frame);

  function frame(now: number) {
    frameId = requestAnimationFrame(frame);
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    if (flight) {
      const t = flight.duration > 0 ? (now - flight.start) / flight.duration : 1;
      camera.position.set(...flightPosition(flight.from, flight.to, t));
      camera.lookAt(0, 0, 0);
      if (t >= 1) {
        flight = null;
        settleAt(altitude);
        controls.enabled = true;
      }
    } else {
      controls.update();
    }

    // Centre the view in whatever part of the screen the story panel leaves uncovered.
    const sideways = panelOpen && width > SHEET_BREAKPOINT_PX;
    insetGoal.set(sideways ? Math.min(PANEL_WIDTH_REM * remPx, width) : 0, height * sheetCover(width, height));
    inset.lerp(insetGoal, reducedMotion ? 1 : 0.08);
    camera.setViewOffset(width, height, inset.x / 2, inset.y / 2, width, height);

    stepUnlocks(now);
    updatePins(width, height);
    asciiMaterial.uniforms.time.value = now / 1000;

    renderer.setRenderTarget(sceneTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(post, postCamera);
  }

  return {
    flyTo,
    setUnlocked(countries) {
      unlocked = countries;
      applyUnlocked();
    },
    setPins(pins, elements) {
      pinSlots = pins.flatMap((pin) => {
        const element = elements.get(pin.id);
        return element ? [{ element, position: new THREE.Vector3(...latLngToVector3(pin.lat, pin.lng)) }] : [];
      });
    },
    setPanelOpen(open, sheetReserveRem = 0) {
      panelOpen = open;
      sheetReserve = sheetReserveRem;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      const resources = [globe.geometry, globeMaterial, quad.geometry, asciiMaterial, sceneTarget, unlockTexture, hueTexture, blank, glyphs];
      for (const resource of resources) {
        resource.dispose();
      }
      earthTexture?.dispose();
      mask?.texture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
