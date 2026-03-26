// Document Image Enhancer — HD Clarity Pipeline

function clamp(v: number): number { return v < 0 ? 0 : v > 255 ? 255 : v; }

function toSafe(src: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  const b = new Uint8ClampedArray(new ArrayBuffer(src.length));
  b.set(src);
  return b;
}

function boxBlur(src: Uint8ClampedArray<ArrayBuffer>, w: number, h: number, r: number): Uint8ClampedArray<ArrayBuffer> {
  const tmp = new Uint8ClampedArray(new ArrayBuffer(src.length));
  const out = new Uint8ClampedArray(new ArrayBuffer(src.length));
  const d = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[(y * w + Math.max(0, Math.min(w - 1, k))) * 4 + c];
      for (let x = 0; x < w; x++) {
        tmp[(y * w + x) * 4 + c] = sum / d;
        sum += src[(y * w + Math.max(0, Math.min(w - 1, x + r + 1))) * 4 + c]
             - src[(y * w + Math.max(0, Math.min(w - 1, x - r))) * 4 + c];
      }
    }
    for (let x = 0; x < w; x++) tmp[(y * w + x) * 4 + 3] = src[(y * w + x) * 4 + 3];
  }
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[(Math.max(0, Math.min(h - 1, k)) * w + x) * 4 + c];
      for (let y = 0; y < h; y++) {
        out[(y * w + x) * 4 + c] = sum / d;
        sum += tmp[(Math.max(0, Math.min(h - 1, y + r + 1)) * w + x) * 4 + c]
             - tmp[(Math.max(0, Math.min(h - 1, y - r)) * w + x) * 4 + c];
      }
    }
    for (let y = 0; y < h; y++) out[(y * w + x) * 4 + 3] = tmp[(y * w + x) * 4 + 3];
  }
  return out;
}

function unsharpMask(src: Uint8ClampedArray<ArrayBuffer>, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const blurred = boxBlur(src, w, h, 1);
  const out = new Uint8ClampedArray(new ArrayBuffer(src.length));
  for (let i = 0; i < src.length; i++) {
    if (i % 4 === 3) { out[i] = src[i]; continue; }
    out[i] = clamp(Math.round(src[i] + 1.4 * (src[i] - blurred[i])));
  }
  return out;
}

function adaptiveContrast(src: Uint8ClampedArray<ArrayBuffer>, w: number, h: number): Uint8ClampedArray<ArrayBuffer> {
  const TILES = 4;
  const tw = Math.ceil(w / TILES);
  const th = Math.ceil(h / TILES);
  const luts: Uint8Array[][] = [];
  for (let ty = 0; ty < TILES; ty++) {
    luts[ty] = [];
    for (let tx = 0; tx < TILES; tx++) {
      const hist = new Float32Array(256);
      let count = 0;
      const x0 = tx * tw, x1 = Math.min(w, x0 + tw);
      const y0 = ty * th, y1 = Math.min(h, y0 + th);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4;
          hist[Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2])]++;
          count++;
        }
      }
      const clipLimit = Math.max(1, (count / 256) * 2.5);
      let excess = 0;
      for (let v = 0; v < 256; v++) {
        if (hist[v] > clipLimit) { excess += hist[v] - clipLimit; hist[v] = clipLimit; }
      }
      const addVal = excess / 256;
      for (let v = 0; v < 256; v++) hist[v] += addVal;
      const lut = new Uint8Array(256);
      let cdf = 0, cdfMin = -1;
      for (let v = 0; v < 256; v++) {
        cdf += hist[v];
        if (cdfMin < 0 && cdf > 0) cdfMin = cdf;
        lut[v] = clamp(Math.round(((cdf - cdfMin) / (count - cdfMin)) * 255));
      }
      luts[ty][tx] = lut;
    }
  }
  const out = new Uint8ClampedArray(new ArrayBuffer(src.length));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const fx = (x / w) * TILES - 0.5;
      const fy = (y / h) * TILES - 0.5;
      const tx0 = Math.max(0, Math.min(TILES - 1, Math.floor(fx)));
      const ty0 = Math.max(0, Math.min(TILES - 1, Math.floor(fy)));
      const tx1 = Math.min(TILES - 1, tx0 + 1);
      const ty1 = Math.min(TILES - 1, ty0 + 1);
      const wx = fx - Math.floor(fx);
      const wy = fy - Math.floor(fy);
      const lum = Math.round(0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2]);
      const mapped =
        luts[ty0][tx0][lum] * (1 - wx) * (1 - wy) +
        luts[ty0][tx1][lum] * wx * (1 - wy) +
        luts[ty1][tx0][lum] * (1 - wx) * wy +
        luts[ty1][tx1][lum] * wx * wy;
      const gain = lum > 0 ? mapped / lum : 1;
      for (let c = 0; c < 3; c++) out[i + c] = clamp(Math.round(src[i + c] * gain));
      out[i + 3] = src[i + 3];
    }
  }
  return out;
}

function autoWhiteBalance(src: Uint8ClampedArray<ArrayBuffer>): Uint8ClampedArray<ArrayBuffer> {
  let rS = 0, gS = 0, bS = 0, n = 0;
  for (let i = 0; i < src.length; i += 4) { rS += src[i]; gS += src[i + 1]; bS += src[i + 2]; n++; }
  const avg = (rS + gS + bS) / (3 * n);
  const rG = avg / (rS / n), gG = avg / (gS / n), bG = avg / (bS / n);
  const out = new Uint8ClampedArray(new ArrayBuffer(src.length));
  for (let i = 0; i < src.length; i += 4) {
    out[i]     = clamp(Math.round(src[i]     * rG));
    out[i + 1] = clamp(Math.round(src[i + 1] * gG));
    out[i + 2] = clamp(Math.round(src[i + 2] * bG));
    out[i + 3] = src[i + 3];
  }
  return out;
}

function finalAdjust(src: Uint8ClampedArray<ArrayBuffer>, contrast = 1.12, brightness = 8): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(new ArrayBuffer(src.length));
  for (let i = 0; i < src.length; i++) {
    if (i % 4 === 3) { out[i] = src[i]; continue; }
    out[i] = clamp(Math.round((src[i] - 128) * contrast + 128 + brightness));
  }
  return out;
}

export async function enhanceImage(imageUrl: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => {
      const el2 = new Image();
      el2.onload = () => resolve(el2);
      el2.onerror = reject;
      el2.src = imageUrl;
    };
    el.src = imageUrl;
  });

  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;
  const scale = Math.min(2, 4096 / Math.max(srcW, srcH, 1));
  const W = Math.round(srcW * scale);
  const H = Math.round(srcH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);
  let px = toSafe(imageData.data);
  px = boxBlur(px, W, H, 1);
  px = unsharpMask(px, W, H);
  px = adaptiveContrast(px, W, H);
  px = autoWhiteBalance(px);
  px = finalAdjust(px, 1.12, 8);

  imageData.data.set(px);
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.95
    );
  });
}

export function isEnhanceableImage(fileType: string): boolean {
  return ["jpg", "jpeg", "png"].includes(fileType.toLowerCase());
}
