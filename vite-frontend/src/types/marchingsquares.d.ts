declare module 'marchingsquares' {
  export function isoContours(
    grid: number[][],
    threshold: number,
    options?: { successCallback?: () => void; verbose?: boolean }
  ): Array<{ coordinates: number[][] }>;
}
