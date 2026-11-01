// src/utils/stageUtils.ts

/**
 * Utility functions for production stage name display.
 * Simplifies stage names across the ERP while preserving backend IDs, codes, and URLs:
 * - "Cutting — Product-wise" -> "Cutting"
 * - "Embroidery — Outward / Inward" / "Embroidery — Out/In" -> "Embroidery"
 * - "Stitching — Color-wise Tracking" / "Stitching — Color-wise" -> "Stitching"
 */
export function formatStageDisplayName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace(/Cutting\s*—\s*Product-wise/gi, 'Cutting')
    .replace(/Cutting\s*-\s*Product-wise/gi, 'Cutting')
    .replace(/Embroidery\s*—\s*(?:Outward\s*\/\s*Inward|Out\/In)/gi, 'Embroidery')
    .replace(/Embroidery\s*-\s*(?:Outward\s*\/\s*Inward|Out\/In)/gi, 'Embroidery')
    .replace(/Stitching\s*—\s*(?:Color-wise Tracking|Color-wise)/gi, 'Stitching')
    .replace(/Stitching\s*-\s*(?:Color-wise Tracking|Color-wise)/gi, 'Stitching');
}

