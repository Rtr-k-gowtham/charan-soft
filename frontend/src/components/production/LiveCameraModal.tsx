import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Camera, 
  MapPin, 
  X, 
  RefreshCw, 
  AlertCircle
} from 'lucide-react';
import { 
  getCurrentLocation, 
  formatCoordinates, 
  processCameraCapture, 
  GeoLocationResult 
} from '../../utils/geoWatermark';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string, location: GeoLocationResult) => void;
  stageName?: string;
  orderNumber?: string;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  stageName,
  orderNumber,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [capturingStatus, setCapturingStatus] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);

  // Stop active media stream tracks
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setCameraError('');
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser camera API is not supported on this browser. You can use your device camera below.');
      return;
    }

    try {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoInputs.length > 1);
      } catch {
        // Ignore enumerate devices errors
      }

      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr: any) {
        if (firstErr.name === 'OverconstrainedError' || firstErr.name === 'ConstraintNotSatisfiedError') {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } else {
          throw firstErr;
        }
      }

      setStream(mediaStream);
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      let errorMsg = 'Could not access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission was denied. Please allow camera permissions in your browser or tap Device Camera below.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera device found on this laptop/phone.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is currently in use by another app or browser tab.';
      }
      setCameraError(errorMsg);
    }
  }, [stream]);

  // Connect stream to video element whenever stream or videoRef changes
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(console.error);
      };
      videoRef.current.play().catch(console.error);
    }
  }, [stream]);

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopStream();
      setIsCapturing(false);
      setCapturingStatus('');
    }
    return () => {
      stopStream();
    };
  }, [isOpen]);

  // Switch between front and back camera
  const toggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // User clicks "Take Photo"
  const handleTakePhoto = async () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);
    setCapturingStatus('Fetching GPS location...');

    try {
      // 1. Fetch live latitude and longitude automatically at moment of click
      const loc = await getCurrentLocation();

      setCapturingStatus('Processing photo with location...');

      // 2. Process camera frame and stamp watermark with coordinates
      const photoDataUrl = await processCameraCapture(videoRef.current, {
        stageName,
        orderNumber,
        location: loc,
      });

      // 3. Stop stream and send back
      stopStream();
      onCapture(photoDataUrl, loc);
      onClose();
    } catch (err) {
      console.error('Failed to take photo:', err);
      setCameraError('Failed to capture photo frame.');
    } finally {
      setIsCapturing(false);
      setCapturingStatus('');
    }
  };

  // Fallback for native device camera input
  const handleNativeDeviceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    setCapturingStatus('Fetching GPS location...');

    try {
      const loc = await getCurrentLocation();
      setCapturingStatus('Processing photo...');

      const photoDataUrl = await processCameraCapture(file, {
        stageName,
        orderNumber,
        location: loc,
      });

      stopStream();
      onCapture(photoDataUrl, loc);
      onClose();
    } catch (err) {
      console.error('Failed to process device camera photo:', err);
      setCameraError('Failed to process photograph.');
    } finally {
      setIsCapturing(false);
      setCapturingStatus('');
      if (e.target) e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Hidden native input strictly with capture="environment" */}
      <input
        type="file"
        ref={nativeInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleNativeDeviceFile}
        className="hidden"
      />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Camera Photo
              </h3>
              <p className="text-[11px] text-slate-500">
                {stageName || 'Production Evidence'} {orderNumber ? `• Order #${orderNumber}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasMultipleCameras && !cameraError && (
              <button
                type="button"
                onClick={toggleCamera}
                className="p-2 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition text-xs font-semibold"
                title="Switch Camera (Front/Rear)"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isCapturing}
              className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-slate-950 flex items-center justify-center min-h-[340px] sm:min-h-[400px] overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-md mx-auto space-y-4 text-white">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Camera Notice</h4>
                <p className="text-xs text-slate-300 leading-relaxed">{cameraError}</p>
              </div>
              <button
                type="button"
                onClick={() => nativeInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition"
              >
                <Camera className="w-4 h-4" />
                <span>Open Device Camera</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover min-h-[340px] sm:min-h-[400px]"
              />

              {/* Viewfinder Target Guidelines */}
              <div className="absolute inset-8 border border-white/20 rounded-xl pointer-events-none">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />
              </div>

              {/* Notice Banner */}
              <div className="absolute top-3 inset-x-4 flex items-center justify-center pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-slate-950/70 backdrop-blur-xs text-[11px] font-semibold text-slate-200 border border-white/10 flex items-center gap-1.5 shadow-md">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>GPS location will be automatically tagged on photo</span>
                </span>
              </div>
            </>
          )}

          {/* Capturing / Locating Overlay */}
          {isCapturing && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white z-20">
              <RefreshCw className="w-7 h-7 text-emerald-400 animate-spin" />
              <p className="text-xs font-bold text-emerald-300">{capturingStatus || 'Capturing...'}</p>
            </div>
          )}
        </div>

        {/* Footer Controls */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isCapturing}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition"
          >
            Cancel
          </button>

          {!cameraError ? (
            <button
              type="button"
              onClick={handleTakePhoto}
              disabled={isCapturing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-extrabold shadow-md shadow-emerald-600/20 transition cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Take Photo</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => nativeInputRef.current?.click()}
              disabled={isCapturing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-extrabold shadow-md transition"
            >
              <Camera className="w-4 h-4" />
              <span>Use Device Camera</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
