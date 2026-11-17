export const MAX_UPLOAD_SIDE_PX = 1024;

export interface TargetSize {
  width: number;
  height: number;
}

/**
 * Size that fits the photo in a maxSide × maxSide box keeping its aspect
 * ratio. Never enlarges. Unknown dimensions return null (keep the original).
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = MAX_UPLOAD_SIDE_PX,
): TargetSize | null {
  if (!(width > 0) || !(height > 0)) {
    return null;
  }

  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
