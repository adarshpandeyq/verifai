import type { ConsistencyResult, ImageAnalysis, TextAnalysis } from "@/lib/types";
import { CONCEPT_KEYS, conceptArray } from "@/lib/pipeline/concepts";
import { clamp, cosine } from "@/lib/pipeline/math";

export function compareTextAndImage(
  text: TextAnalysis,
  image: ImageAnalysis,
  now = new Date(),
): ConsistencyResult | null {
  if (!image.hasImage) return null;

  const t = conceptArray(text.concepts);
  const i = conceptArray(image.visualConcepts);
  const cos = cosine(t, i);
  const overlapping = CONCEPT_KEYS.map((concept) => ({
    concept,
    text: text.concepts[concept],
    image: image.visualConcepts[concept],
  }))
    .filter((row) => row.text > 0.18 && row.image > 0.18)
    .sort((a, b) => b.text * b.image - a.text * a.image)
    .slice(0, 6);

  const mismatches: string[] = [];
  for (const key of CONCEPT_KEYS) {
    if (text.concepts[key] > 0.55 && image.visualConcepts[key] < 0.16) {
      mismatches.push(
        `The claim leans on “${key}” but the image shows little evidence of that visual concept.`,
      );
    }
  }

  const caveats = [
    "Text–image similarity only measures whether the picture looks related to the words. It is not proof that the event happened, nor that the picture was taken where or when the claim says.",
  ];

  let exifConflict = false;
  const relative = text.dates.find((d) => d.kind === "relative");
  if (image.exifDate && relative) {
    const captured = new Date(image.exifDate);
    const ageDays = (now.getTime() - captured.getTime()) / 86400000;
    if (!Number.isNaN(ageDays) && ageDays > 2) {
      exifConflict = true;
      mismatches.push(
        `The file’s EXIF date is ${image.exifDate.slice(0, 10)}, which conflicts with the claim’s “${relative.raw}” timing.`,
      );
      caveats.push(
        "An old photograph can still be highly similar to a new claim. Recycled images are a common misinformation pattern.",
      );
    }
  }

  if (image.likelyScreenshot) {
    caveats.push(
      "The upload resembles a screenshot or graphic, which can be cropped, captioned, or fabricated independently of the scene it depicts.",
    );
  }

  const overlapBoost = overlapping.length ? Math.min(0.22, overlapping.length * 0.05) : 0;
  const mismatchPenalty = Math.min(0.35, mismatches.length * 0.08);
  const score = clamp((cos * 0.72 + overlapBoost + 0.12 - mismatchPenalty) * 100, 4, 96);

  return {
    score: Math.round(score),
    cosine: Math.round(cos * 1000) / 1000,
    overlappingConcepts: overlapping,
    mismatches,
    caveats,
    exifConflict,
  };
}
