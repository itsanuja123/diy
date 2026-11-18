import * as THREE from 'three';

export interface ProceduralTextureSet {
  floorColor: THREE.CanvasTexture;
  floorEmissive: THREE.CanvasTexture;
  wallColor: THREE.CanvasTexture;
  rampColor: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Hex-Grid Architectural Arena Floor
  const floorCanvas = document.createElement('canvas');
  floorCanvas.width = 512;
  floorCanvas.height = 512;
  const fctx = floorCanvas.getContext('2d')!;
  fctx.fillStyle = '#0d1320';
  fctx.fillRect(0, 0, 512, 512);

  // Subtle brushed metal micro-tiles
  fctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  fctx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    fctx.beginPath();
    fctx.moveTo(i, 0);
    fctx.lineTo(i, 512);
    fctx.stroke();

    fctx.beginPath();
    fctx.moveTo(0, i);
    fctx.lineTo(512, i);
    fctx.stroke();
  }

  // Geometric sub-grid accents
  fctx.strokeStyle = 'rgba(56, 189, 248, 0.18)';
  fctx.lineWidth = 3;
  fctx.strokeRect(4, 4, 504, 504);
  fctx.fillStyle = 'rgba(30, 41, 59, 0.45)';
  fctx.fillRect(16, 16, 224, 224);
  fctx.fillRect(272, 272, 224, 224);

  const floorColor = new THREE.CanvasTexture(floorCanvas);
  floorColor.colorSpace = THREE.SRGBColorSpace;
  floorColor.wrapS = THREE.RepeatWrapping;
  floorColor.wrapT = THREE.RepeatWrapping;
  floorColor.repeat.set(18, 18);
  floorColor.anisotropy = maxAnisotropy;

  // Floor Emissive trace map
  const femCanvas = document.createElement('canvas');
  femCanvas.width = 512;
  femCanvas.height = 512;
  const femCtx = femCanvas.getContext('2d')!;
  femCtx.fillStyle = '#000000';
  femCtx.fillRect(0, 0, 512, 512);
  femCtx.strokeStyle = '#14425c';
  femCtx.lineWidth = 3;
  femCtx.strokeRect(2, 2, 508, 508);
  femCtx.fillStyle = '#0c2c3e';
  femCtx.fillRect(252, 0, 8, 512);
  femCtx.fillRect(0, 252, 512, 8);

  const floorEmissive = new THREE.CanvasTexture(femCanvas);
  floorEmissive.colorSpace = THREE.SRGBColorSpace;
  floorEmissive.wrapS = THREE.RepeatWrapping;
  floorEmissive.wrapT = THREE.RepeatWrapping;
  floorEmissive.repeat.set(18, 18);
  floorEmissive.anisotropy = maxAnisotropy;

  // 2. Carbon-Alloy Architectural Wall Panels
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 512;
  const wctx = wallCanvas.getContext('2d')!;
  wctx.fillStyle = '#131a29';
  wctx.fillRect(0, 0, 512, 512);

  wctx.fillStyle = '#182235';
  wctx.fillRect(16, 16, 228, 228);
  wctx.fillRect(268, 16, 228, 228);
  wctx.fillRect(16, 268, 228, 228);
  wctx.fillRect(268, 268, 228, 228);

  wctx.strokeStyle = '#2a3954';
  wctx.lineWidth = 4;
  wctx.strokeRect(16, 16, 228, 228);
  wctx.strokeRect(268, 16, 228, 228);
  wctx.strokeRect(16, 268, 228, 228);
  wctx.strokeRect(268, 268, 228, 228);

  // Subtle rivets
  wctx.fillStyle = '#475569';
  const corners = [
    [28, 28], [232, 28], [28, 232], [232, 232],
    [280, 28], [484, 28], [280, 232], [484, 232],
  ];
  for (const [cx, cy] of corners) {
    wctx.beginPath();
    wctx.arc(cx, cy, 4, 0, Math.PI * 2);
    wctx.fill();
  }

  const wallColor = new THREE.CanvasTexture(wallCanvas);
  wallColor.colorSpace = THREE.SRGBColorSpace;
  wallColor.wrapS = THREE.RepeatWrapping;
  wallColor.wrapT = THREE.RepeatWrapping;
  wallColor.anisotropy = maxAnisotropy;

  // 3. Ramp Chevron Grip Texture
  const rampCanvas = document.createElement('canvas');
  rampCanvas.width = 256;
  rampCanvas.height = 256;
  const rctx = rampCanvas.getContext('2d')!;
  rctx.fillStyle = '#151d2e';
  rctx.fillRect(0, 0, 256, 256);
  rctx.strokeStyle = 'rgba(248, 250, 252, 0.18)';
  rctx.lineWidth = 10;
  for (let y = 32; y < 256; y += 64) {
    rctx.beginPath();
    rctx.moveTo(32, y + 24);
    rctx.lineTo(128, y);
    rctx.lineTo(224, y + 24);
    rctx.stroke();
  }
  const rampColor = new THREE.CanvasTexture(rampCanvas);
  rampColor.colorSpace = THREE.SRGBColorSpace;
  rampColor.wrapS = THREE.RepeatWrapping;
  rampColor.wrapT = THREE.RepeatWrapping;
  rampColor.anisotropy = maxAnisotropy;

  // 4. Radial Contact Shadow Plane Texture
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);

  return {
    floorColor,
    floorEmissive,
    wallColor,
    rampColor,
    contactShadow,
    dispose: () => {
      floorColor.dispose();
      floorEmissive.dispose();
      wallColor.dispose();
      rampColor.dispose();
      contactShadow.dispose();
    },
  };
}
