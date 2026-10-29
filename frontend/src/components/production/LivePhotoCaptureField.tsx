import React, { useState } from 'react';
import { 
  Camera, 
  MapPin, 
  X, 
  ZoomIn, 
  Trash2, 
  AlertTriangle,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { LiveCameraModal } from './LiveCameraModal';
import { GeoLocationResult, formatCoordinates } from '../../utils/geoWatermark';

interface LivePhotoCaptureFieldProps {
  label: string;
  required?: boolean;
  /** For multi-photo arrays */
  photos?: string[];
  onPhotosChange?: (photos: string[]) => void;
  /** For single-photo state */
  photo?: string | null;
  onPhotoChange?: (photo: string | null) => void;
  /** Maximum photos allowed */
  maxPhotos?: number;
  stageName?: string;
  orderNumber?: string;
  error?: string;
  helperText?: string;
  buttonText?: string;
  placeholderText?: string;
}

export const LivePhotoCaptureField: React.FC<LivePhotoCaptureFieldProps> = ({
  label,
  required = true,
  photos,
  onPhotosChange,
  photo,
  onPhotoChange,
  maxPhotos = photos !== undefined ? 5 : 1,
  stageName,
  orderNumber,
  error,
  helperText,
  buttonText,
  placeholderText,
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<GeoLocationResult | null>(null);

  // Normalize active photos list
  const activePhotos: string[] = photos !== undefined 
    ? photos 
    : photo 
      ? [photo] 
      : [];

  const handleCapture = (photoDataUrl: string, location: GeoLocationResult) => {
    setLastLocation(location);
    if (onPhotosChange) {
      if (maxPhotos === 1) {
        onPhotosChange([photoDataUrl]);
      } else {
        onPhotosChange([...(photos || []), photoDataUrl]);
      }
    } else if (onPhotoChange) {
      onPhotoChange(photoDataUrl);
    }
  };

  const handleRemove = (indexToRemove: number) => {
    if (onPhotosChange) {
      const updated = (photos || []).filter((_, idx) => idx !== indexToRemove);
      onPhotosChange(updated);
    } else if (onPhotoChange) {
      onPhotoChange(null);
    }
  };

  const canAddMore = activePhotos.length < maxPhotos;
  const hasPhotos = activePhotos.length > 0;

  return (
    <div className="space-y-1.5">
      {/* Field Label */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-rose-500 font-extrabold text-xs">*</span>}
        </label>
        {required && (
          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
            Mandatory
          </span>
        )}
      </div>

      {/* When NO photos are taken yet: Clean camera-only prompt box */}
      {!hasPhotos ? (
        <div 
          onClick={() => setIsCameraOpen(true)}
          className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-xl p-4 bg-slate-50/80 hover:bg-brand-50/20 transition-all cursor-pointer text-center group"
        >
          <div className="flex flex-col items-center justify-center space-y-1.5">
            <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600 group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-800 group-hover:text-brand-700">
              {placeholderText || 'Tap here to open camera'}
            </div>
            <div className="text-[11px] text-slate-400">
              {helperText || 'Live GPS coordinates & timestamp recorded automatically'}
            </div>
            <div className="pt-1.5" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{buttonText || 'Open Camera'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* When photo IS taken: Clean preview cards with coordinates */
        <div className="space-y-2 pt-1">
          <div className="flex flex-wrap items-center gap-3">
            {activePhotos.map((url, idx) => (
              <div 
                key={idx} 
                className="relative group flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition"
              >
                {/* Photo Thumbnail */}
                <div 
                  onClick={() => setZoomedImage(url)}
                  className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 cursor-pointer shrink-0 group-hover:opacity-90"
                >
                  <img 
                    src={url} 
                    alt={`Evidence ${idx + 1}`} 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <ZoomIn className="w-4 h-4 text-white" />
                  </div>
                </div>

                {/* Details & Actions */}
                <div className="flex flex-col justify-between text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Photo Verified</span>
                  </div>

                  {lastLocation?.latitude !== null && lastLocation?.latitude !== undefined ? (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{formatCoordinates(lastLocation.latitude, lastLocation.longitude)}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>GPS Geotagged</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Retake</span>
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {canAddMore && (
              <button
                type="button"
                onClick={() => setIsCameraOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer h-16"
              >
                <Camera className="w-4 h-4 text-brand-600" />
                <span>+ Camera</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 pt-0.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Camera Viewfinder Modal */}
      <LiveCameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapture}
        stageName={stageName}
        orderNumber={orderNumber}
      />

      {/* Full Resolution Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 sm:p-6 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setZoomedImage(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-2 flex flex-col items-center" 
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between px-3 py-2 border-b border-slate-800 text-slate-200">
              <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400 font-mono">
                <MapPin className="w-3.5 h-3.5" />
                <span>Camera Photo with GPS Watermark</span>
              </span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2 overflow-auto flex items-center justify-center max-h-[82vh]">
              <img
                src={zoomedImage}
                alt="Evidence Full View"
                className="max-h-[78vh] w-auto mx-auto object-contain rounded-lg shadow-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
