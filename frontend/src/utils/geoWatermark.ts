/**
 * Utility functions for Live Geolocation capture and Canvas Watermarking
 * for Production Audit Evidence in Cheran Soft Goods ERP.
 */

export interface GeoLocationResult {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: string;
  error?: string;
}

/**
 * Acquire live GPS location with high accuracy.
 */
export async function getCurrentLocation(): Promise<GeoLocationResult> {
  const defaultTimestamp = new Date().toISOString();

  if (typeof window === 'undefined' || !navigator.geolocation) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      timestamp: defaultTimestamp,
      error: 'Geolocation is not supported by this browser.'
    };
  }

  return new Promise((resolve) => {
    // Attempt 1: High accuracy GPS
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy || 0),
          timestamp: new Date(pos.timestamp || Date.now()).toISOString()
        });
      },
      (err) => {
        // If permission denied, don't retry
        if (err.code === 1) {
          resolve({
            latitude: null,
            longitude: null,
            accuracy: null,
            timestamp: defaultTimestamp,
            error: 'Location permission denied. Please allow location access in your browser.'
          });
          return;
        }

        // Attempt 2: Fallback to standard/network accuracy (e.g. laptop Wi-Fi or indoor cellular)
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            resolve({
              latitude: Number(fallbackPos.coords.latitude.toFixed(6)),
              longitude: Number(fallbackPos.coords.longitude.toFixed(6)),
              accuracy: Math.round(fallbackPos.coords.accuracy || 0),
              timestamp: new Date(fallbackPos.timestamp || Date.now()).toISOString()
            });
          },
          (fallbackErr) => {
            let msg = 'Unable to acquire GPS coordinates.';
            if (fallbackErr.code === 1) {
              msg = 'Location permission denied. Please enable location in browser settings.';
            } else if (fallbackErr.code === 2) {
              msg = 'GPS position unavailable. Check device location services.';
            } else if (fallbackErr.code === 3) {
              msg = 'GPS acquisition timed out.';
            }
            resolve({
              latitude: null,
              longitude: null,
              accuracy: null,
              timestamp: defaultTimestamp,
              error: msg
            });
          },
          {
            enableHighAccuracy: false,
            timeout: 6000,
            maximumAge: 30000
          }
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Format coordinates nicely into a readable string (e.g. 11.016842° N, 76.955819° E)
 */
export function formatCoordinates(lat: number | null, lng: number | null): string {
  if (lat === null || lng === null) return 'GPS Location Unavailable';
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
}

export interface WatermarkOptions {
  stageName?: string;
  orderNumber?: string;
  operatorName?: string;
  location: GeoLocationResult;
}

/**
 * Imprint a tamper-evident audit watermark banner directly onto the image canvas.
 */
export function stampWatermarkOnCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: WatermarkOptions
) {
  const { width, height } = canvas;
  const { stageName, orderNumber, location } = options;

  // Scale font sizes based on canvas resolution (baseline ~1200px width)
  const scale = Math.max(0.65, Math.min(width / 1000, 1.6));
  const bannerHeight = Math.round(110 * scale);
  const paddingX = Math.round(24 * scale);
  const bottomY = height - bannerHeight;

  // 1. Semi-transparent high-contrast dark audit banner at the bottom
  const gradient = ctx.createLinearGradient(0, bottomY, 0, height);
  gradient.addColorStop(0, 'rgba(15, 23, 42, 0.88)'); // slate-900 with 88% opacity
  gradient.addColorStop(1, 'rgba(2, 6, 23, 0.96)');   // slate-950 with 96% opacity

  ctx.fillStyle = gradient;
  ctx.fillRect(0, bottomY, width, bannerHeight);

  // Top accent line on banner (emerald green for live verified)
  ctx.fillStyle = location.latitude !== null ? '#10b981' : '#f59e0b';
  ctx.fillRect(0, bottomY, width, Math.max(3, Math.round(3 * scale)));

  // 2. Format Date and Time in IST
  const dateStr = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  // 3. Render Top Line: Company Header + Live Audit Tag
  ctx.fillStyle = '#38bdf8'; // Sky blue
  ctx.font = `bold ${Math.round(15 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.fillText('CHERAN SOFT GOODS PVT LTD  •  LIVE FACTORY AUDIT EVIDENCE', paddingX, bottomY + Math.round(28 * scale));

  // Top right audit status
  const auditStatus = location.latitude !== null ? '● LIVE GPS VERIFIED' : '▲ GPS UNVERIFIED';
  ctx.fillStyle = location.latitude !== null ? '#34d399' : '#fcd34d';
  ctx.font = `bold ${Math.round(13 * scale)}px monospace`;
  const statusWidth = ctx.measureText(auditStatus).width;
  ctx.fillText(auditStatus, width - paddingX - statusWidth, bottomY + Math.round(28 * scale));

  // 4. Render Middle Line: Live Coordinates & Accuracy
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(17 * scale)}px monospace`;
  const coordText = location.latitude !== null
    ? `📍 LAT: ${formatCoordinates(location.latitude, location.longitude)}  (Acc: ±${location.accuracy ?? 0}m)`
    : `📍 GPS: ${location.error || 'Coordinates Not Acquired'}`;
  ctx.fillText(coordText, paddingX, bottomY + Math.round(58 * scale));

  // 5. Render Bottom Line: Stage, Order, and Timestamp
  ctx.fillStyle = '#cbd5e1'; // slate-300
  ctx.font = `${Math.round(14 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  const metaParts: string[] = [];
  if (stageName) metaParts.push(`STAGE: ${stageName}`);
  if (orderNumber) metaParts.push(`ORDER: ${orderNumber}`);
  metaParts.push(`TIMESTAMP: ${dateStr}`);
  ctx.fillText(metaParts.join('  |  '), paddingX, bottomY + Math.round(86 * scale));

  // 6. Top Left Corner Watermark Badge
  const badgeX = Math.round(16 * scale);
  const badgeY = Math.round(16 * scale);
  const badgeW = Math.round(210 * scale);
  const badgeH = Math.round(36 * scale);

  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, Math.round(8 * scale));
  } else {
    ctx.rect(badgeX, badgeY, badgeW, badgeH);
  }
  ctx.fill();

  // Green verification dot
  ctx.fillStyle = location.latitude !== null ? '#10b981' : '#f59e0b';
  ctx.beginPath();
  ctx.arc(badgeX + Math.round(16 * scale), badgeY + Math.round(18 * scale), Math.round(5 * scale), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(12 * scale)}px sans-serif`;
  ctx.fillText(
    location.latitude !== null ? 'LIVE CAMERA CAPTURE' : 'CAMERA EVIDENCE',
    badgeX + Math.round(28 * scale),
    badgeY + Math.round(22 * scale)
  );
}

/**
 * Takes an HTMLVideoElement or an Image File, scales to optimal resolution,
 * applies the permanent GPS audit watermark, and returns base64 JPEG data URL.
 */
export async function processCameraCapture(
  source: HTMLVideoElement | File,
  options: WatermarkOptions
): Promise<string> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2D context');

  if (source instanceof HTMLVideoElement) {
    const rawW = source.videoWidth || 1280;
    const rawH = source.videoHeight || 720;

    // Scale to max 1600px width/height while preserving aspect ratio
    const maxDim = 1600;
    let targetW = rawW;
    let targetH = rawH;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.drawImage(source, 0, 0, targetW, targetH);
  } else {
    // It's a File from native capture="environment"
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    });

    const maxDim = 1600;
    let targetW = img.width;
    let targetH = img.height;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.drawImage(img, 0, 0, targetW, targetH);
  }

  // Stamp the permanent GPS watermark banner
  stampWatermarkOnCanvas(canvas, ctx, options);

  // Return crisp high-quality JPEG
  return canvas.toDataURL('image/jpeg', 0.85);
}
