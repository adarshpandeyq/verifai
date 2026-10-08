import sharp from "sharp";
import type { ConceptVector, ImageAnalysis } from "@/lib/types";
import { emptyConcepts, normalizeConcepts, topConcepts } from "@/lib/pipeline/concepts";
import { clamp } from "@/lib/pipeline/math";

const SIZE = 64;

function extractExifDate(exif?: Buffer): string | null {
  if (!exif) return null;
  const ascii = exif.toString("latin1");
  const match = ascii.match(/(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  if (year < 1990 || year > 2100) return null;
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
}

export async function analyzeImage(buffer: Buffer | null): Promise<ImageAnalysis> {
  if (!buffer || buffer.length < 24) {
    return {
      hasImage: false,
      width: 0,
      height: 0,
      format: null,
      averageColor: { r: 0, g: 0, b: 0 },
      brightness: 0,
      saturation: 0,
      contrast: 0,
      edgeEnergy: 0,
      visualConcepts: emptyConcepts(),
      conceptLabels: [],
      exifDate: null,
      likelyScreenshot: false,
      likelyDocument: false,
      notes: ["No image was provided. Text-image consistency cannot be computed."],
    };
  }

  let image: ReturnType<typeof sharp>;
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    image = sharp(buffer, { failOn: "none" }).rotate();
    meta = await image.metadata();
  } catch {
    return {
      hasImage: true,
      width: 0,
      height: 0,
      format: null,
      averageColor: { r: 0, g: 0, b: 0 },
      brightness: 0,
      saturation: 0,
      contrast: 0,
      edgeEnergy: 0,
      visualConcepts: emptyConcepts(),
      conceptLabels: [],
      exifDate: null,
      likelyScreenshot: false,
      likelyDocument: false,
      notes: ["The upload could not be decoded as a raster image."],
    };
  }
  const { data, info } = await image
    .clone()
    .resize(SIZE, SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const n = w * h;
  if (!n) {
    return {
      hasImage: true,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      format: meta.format ?? null,
      averageColor: { r: 0, g: 0, b: 0 },
      brightness: 0,
      saturation: 0,
      contrast: 0,
      edgeEnergy: 0,
      visualConcepts: emptyConcepts(),
      conceptLabels: [],
      exifDate: extractExifDate(meta.exif),
      likelyScreenshot: false,
      likelyDocument: false,
      notes: ["The image decoded but contained no raster samples."],
    };
  }
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let lumSum = 0;
  let lumSq = 0;
  let satSum = 0;
  let dark = 0;
  let bright = 0;
  let grayish = 0;
  let blueish = 0;
  let greenish = 0;
  let reddish = 0;
  let orange = 0;
  let skin = 0;
  let white = 0;
  let topBlue = 0;
  let botBlue = 0;
  let topCount = 0;
  let botCount = 0;
  let edge = 0;
  let brown = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      rSum += r;
      gSum += g;
      bSum += b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const sat = max === 0 ? 0 : (max - min) / max;
      lumSum += lum;
      lumSq += lum * lum;
      satSum += sat;
      if (lum < 38) dark += 1;
      if (lum > 210) bright += 1;
      if (sat < 0.14) grayish += 1;
      if (b > r + 12 && b > g && lum > 35 && lum < 210) blueish += 1;
      if (g > r + 8 && g > b + 4) greenish += 1;
      if (r > g + 25 && r > b + 25 && lum > 40) reddish += 1;
      if (r > 140 && g > 60 && g < 160 && b < 90 && r > g) orange += 1;
      if (
        r > 90 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        g > b &&
        r - g > 12 &&
        r - b > 18 &&
        lum > 55 &&
        lum < 210
      ) {
        skin += 1;
      }
      if (lum > 222 && sat < 0.12) white += 1;
      if (r > 70 && g > 40 && b < 70 && r > b && g > b && sat < 0.55 && lum < 160) brown += 1;
      if (y < h / 3) {
        topCount += 1;
        if (b > r && b > g - 8) topBlue += 1;
      }
      if (y > (2 * h) / 3) {
        botCount += 1;
        if (b > r - 10 && lum < 150) botBlue += 1;
      }
      if (x > 0) {
        const j = (y * w + x - 1) * 3;
        edge += Math.abs(r - data[j]) + Math.abs(g - data[j + 1]) + Math.abs(b - data[j + 2]);
      }
    }
  }

  const brightness = lumSum / n / 255;
  const saturation = satSum / n;
  const meanLum = lumSum / n;
  const variance = Math.max(0, lumSq / n - meanLum * meanLum);
  const contrast = clamp(Math.sqrt(variance) / 128, 0, 1);
  const edgeEnergy = clamp(edge / (n * 180), 0, 1);

  const concepts = emptyConcepts();
  const blueRatio = blueish / n;
  const botWater = botCount ? botBlue / botCount : 0;
  const topSky = topCount ? topBlue / topCount : 0;
  concepts.water = clamp(blueRatio * 1.6 + botWater * 0.9 + (brown / n) * 0.35, 0, 1);
  concepts.sky = clamp(topSky * 1.3 + blueRatio * 0.4, 0, 1);
  concepts.fire = clamp((orange / n) * 2.2 + (reddish / n) * 1.4, 0, 1);
  concepts.vegetation = clamp((greenish / n) * 2.1, 0, 1);
  concepts.urban = clamp((grayish / n) * 1.1 + edgeEnergy * 0.55 + contrast * 0.2, 0, 1);
  concepts.night = clamp((dark / n) * 1.8 - brightness * 0.4, 0, 1);
  concepts.snow = clamp((white / n) * 1.3 + (bright / n) * 0.8 - saturation * 0.5, 0, 1);
  concepts.document = clamp((white / n) * 1.4 + edgeEnergy * 0.8 - saturation * 0.6, 0, 1);
  concepts.portrait = clamp((skin / n) * 3.2, 0, 1);
  concepts.indoor = clamp((1 - concepts.sky) * (brightness > 0.18 ? 0.4 : 0.15) + (1 - blueRatio) * 0.2, 0, 1);
  concepts.crowd = clamp(concepts.portrait * 0.7 + edgeEnergy * 0.25, 0, 1);
  concepts.vehicle = clamp(concepts.urban * 0.4 + (grayish / n) * 0.3, 0, 1);
  concepts.weather = clamp(concepts.sky * 0.6 + concepts.water * 0.5 + concepts.snow * 0.4, 0, 1);
  concepts.disaster = clamp(
    concepts.water * 0.45 + concepts.fire * 0.55 + (brown / n) * 0.5 + concepts.urban * 0.2,
    0,
    1,
  );
  concepts.animal = clamp(concepts.portrait * 0.15 + concepts.vegetation * 0.1, 0, 1);
  concepts.food = clamp((orange / n) * 0.6 + (reddish / n) * 0.2, 0, 1);

  const visualConcepts = normalizeConcepts(concepts);
  const likelyDocument = visualConcepts.document > 0.62 && edgeEnergy > 0.28;
  const likelyScreenshot = likelyDocument && contrast > 0.35 && saturation < 0.35;
  const exifDate = extractExifDate(meta.exif);

  const notes: string[] = [];
  notes.push(
    `Frame is ${meta.width ?? 0}×${meta.height ?? 0}${meta.format ? ` ${meta.format.toUpperCase()}` : ""}.`,
  );
  notes.push(
    `Mean brightness ${(brightness * 100).toFixed(0)}%, saturation ${(saturation * 100).toFixed(0)}%, edge energy ${(edgeEnergy * 100).toFixed(0)}%.`,
  );
  const labels = topConcepts(visualConcepts, 0.22);
  if (labels.length) notes.push(`Dominant visual cues: ${labels.join(", ")}.`);
  if (exifDate) notes.push(`Embedded EXIF timestamp detected: ${exifDate.replace("T", " ")}.`);
  else notes.push("No usable EXIF capture date was found in the file.");
  if (likelyScreenshot) notes.push("High-frequency edges and flat color fields resemble a screenshot or graphic.");
  if (visualConcepts.water > 0.45) notes.push("Cool blue/gray regions in the lower frame are consistent with water or flooding.");
  if (visualConcepts.fire > 0.4) notes.push("Warm orange-red highlights are consistent with fire or artificial flare.");
  if (visualConcepts.night > 0.55) notes.push("The frame is globally dark, more typical of night or underexposed scenes.");

  return {
    hasImage: true,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: meta.format ?? null,
    averageColor: {
      r: Math.round(rSum / n),
      g: Math.round(gSum / n),
      b: Math.round(bSum / n),
    },
    brightness: round2(brightness),
    saturation: round2(saturation),
    contrast: round2(contrast),
    edgeEnergy: round2(edgeEnergy),
    visualConcepts,
    conceptLabels: labels,
    exifDate,
    likelyScreenshot,
    likelyDocument,
    notes,
  };
}

export async function makeThumbnail(buffer: Buffer): Promise<string | null> {
  try {
    const jpg = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize(640, 480, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
