export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function l2normalize(vec: number[]): number[] {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (mag < 1e-9) return vec.map(() => 0);
  return vec.map((v) => v / mag);
}

export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na < 1e-9 || nb < 1e-9) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function mean(nums: number[]): number {
  if (!nums.length) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function fnv1a(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashEmbedding(tokens: string[], dim = 64): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const token of tokens) {
    const h = fnv1a(token);
    vec[h % dim] += 1;
    vec[(h * 2654435761) % dim] += 0.45;
    if (token.length > 3) {
      const bi = fnv1a(token.slice(0, 3));
      vec[bi % dim] += 0.2;
    }
  }
  return l2normalize(vec);
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
