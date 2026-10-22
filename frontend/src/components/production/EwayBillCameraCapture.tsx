// frontend/src/components/production/EwayBillCameraCapture.tsx
// Cheran Soft Goods ERP — Dedicated Live Camera Capture for E-Way Bill Proof (No File Picker)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  RefreshCw,
  X,
  FileText,
  MapPin,
  ShieldCheck,
  Eye
} from 'lucide-react';
import {
  getCurrentLocation,
  formatCoordinates,
  processCameraCapture,
  GeoLocationResult
} from '../../utils/geoWatermark';

export interface EwayBillCameraCaptureProps {
  value: string | null;
  onChange: (photoDataUrl: string | null) => void;
  ewayBillNumber?: string;
  orderNumber?: string;
  error?: string;
  required?: boolean;
}

export const EwayBillCameraCapture: React.FC<EwayBillCameraCaptureProps> = ({
  value,
  onChange,
  ewayBillNumber,
  orderNumber,
  error,
  required = true,
}) => {
  // Modal & Stream State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Capture & Preview State
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [captureStatus, setCaptureStatus] = useState<string>('');
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [lastLocation, setLastLocation] = useState<GeoLocationResult | null>(null);

  // Full-size zoom modal
  const [zoomOpen, setZoomOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Stop active media stream tracks
  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  // Start browser camera stream
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    setCameraError('');
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Browser camera API (getUserMedia) is not supported or accessible on this browser.');
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
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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
      console.warn('E-Way Bill Camera error:', err);
      let errorMsg = 'Could not access device camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera permission was denied. Please allow camera access in your browser address bar/settings to capture the E-Way Bill.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera device found on this system. Please connect a webcam or use a mobile device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera is currently in use by another application or browser tab. Please close other camera apps and retry.';
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

  // Clean up when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      stopStream();
      setCapturedPreview(null);
      setIsCapturing(false);
      setCaptureStatus('');
    }
  }, [isModalOpen, stopStream]);

  // Open modal and launch camera
  const handleOpenCaptureModal = () => {
    setCapturedPreview(null);
    setCameraError('');
    setIsModalOpen(true);
    startCamera(facingMode);
  };

  // Toggle front/back camera
  const handleToggleCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Take photo from video frame
  const handleSnapPhoto = async () => {
    if (!videoRef.current || isCapturing) return;

    setIsCapturing(true);
    setCaptureStatus('Acquiring GPS coordinates & timestamp...');

    try {
      const loc = await getCurrentLocation();
      setLastLocation(loc);
      setCaptureStatus('Generating verified audit watermark...');

      const photoDataUrl = await processCameraCapture(videoRef.current, {
        stageName: 'Stage 10: E-Way Bill Dispatch Proof',
        orderNumber: orderNumber || 'Stage-10-Dispatch',
        location: loc,
      });

      // Stop active stream and freeze on preview
      stopStream();
      setCapturedPreview(photoDataUrl);
    } catch (err: any) {
      console.error('Failed to capture E-Way Bill photo:', err);
      setCameraError('Failed to capture photograph frame. Please try again.');
    } finally {
      setIsCapturing(false);
      setCaptureStatus('');
    }
  };

  // Retake: discard captured preview and restart camera
  const handleRetake = () => {
    setCapturedPreview(null);
    startCamera(facingMode);
  };

  // Confirm: accept the captured photo and close modal
  const handleConfirm = () => {
    if (!capturedPreview) return;
    onChange(capturedPreview);
    setIsModalOpen(false);
  };

  // Clear confirmed photo from parent form
  const handleClearConfirmed = () => {
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {/* Label and Mandatory indicator */}
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          <span>E-Way Bill Photograph (Live Camera Proof)</span>
          {required && <span className="text-rose-500 font-extrabold text-xs">*</span>}
        </label>
        {required && (
          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            Mandatory Camera Proof
          </span>
        )}
      </div>

      {/* State 1: No photo captured yet */}
      {!value ? (
        <div className={`p-4 rounded-xl border ${error ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'} transition`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Live E-Way Bill Document Capture</span>
              </div>
              <p className="text-[11px] text-slate-500 max-w-md">
                A live camera photograph of the printed E-Way Bill is required before dispatch can be finalized.
                Default is rear-facing camera. <span className="font-semibold text-slate-700">File upload is disabled.</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCaptureModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span>Capture E-Way Bill</span>
            </button>
          </div>

          {error && (
            <div className="mt-2 text-xs font-medium text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        /* State 2: Photo captured and confirmed */
        <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            {/* Thumbnail */}
            <div
              onClick={() => setZoomOpen(true)}
              className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-900 border border-emerald-300 cursor-pointer shrink-0 group shadow-2xs"
              title="Click to view full size"
            >
              <img src={value} alt="E-Way Bill Proof" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                <ZoomIn className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Verification Details */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-900">E-Way Bill Proof Verified</span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Camera Captured
                </span>
              </div>
              {ewayBillNumber && (
                <div className="text-[11px] font-mono text-slate-700 font-semibold">
                  E-Way Bill: {ewayBillNumber}
                </div>
              )}
              <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Watermarked with Date, Time & Live Coordinates</span>
              </div>
            </div>
          </div>

          {/* Action buttons on confirmed card */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-semibold transition"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>View</span>
            </button>
            <button
              type="button"
              onClick={handleOpenCaptureModal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-300 rounded-lg text-xs font-semibold transition"
              title="Retake E-Way Bill photo"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
              <span>Retake</span>
            </button>
            <button
              type="button"
              onClick={handleClearConfirmed}
              className="inline-flex items-center gap-1 p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition"
              title="Remove photo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Camera Capture & Preview Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {capturedPreview ? 'Review E-Way Bill Photograph' : 'Live Camera: Capture E-Way Bill'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {orderNumber ? `Order #${orderNumber}` : 'Stage 10 Completed'} {ewayBillNumber ? `• E-Way Bill: ${ewayBillNumber}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!capturedPreview && hasMultipleCameras && !cameraError && (
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition text-xs font-semibold flex items-center gap-1"
                    title="Switch Front/Rear Camera"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">{facingMode === 'environment' ? 'Rear' : 'Front'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                  title="Close Camera"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Viewfinder / Preview Body */}
            <div className="relative bg-black flex items-center justify-center min-h-[300px] sm:min-h-[380px] max-h-[62vh] overflow-hidden">
              {/* Error State */}
              {cameraError ? (
                <div className="p-6 text-center text-white max-w-md space-y-3">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-red-200">Camera Access Error</h4>
                  <p className="text-xs text-slate-300">{cameraError}</p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition"
                    >
                      Retry Camera Access
                    </button>
                  </div>
                </div>
              ) : capturedPreview ? (
                /* Sub-State: Photo has been captured, showing Preview for Retake / Confirm */
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={capturedPreview}
                    alt="Captured E-Way Bill"
                    className="max-h-[62vh] w-full object-contain"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] px-2.5 py-1 rounded-full font-mono border border-white/20 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Photo Stamped & Geotagged</span>
                  </div>
                </div>
              ) : (
                /* Sub-State: Live Camera Viewfinder */
                <div className="relative w-full h-full flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full max-h-[62vh] object-cover"
                  />

                  {/* Document Framing Overlay Guide */}
                  <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-emerald-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-2 shadow-inner">
                    <div className="flex justify-between items-center text-[10px] text-emerald-300 bg-black/50 px-2 py-0.5 rounded backdrop-blur-xs self-center font-mono">
                      Align printed E-Way Bill inside this frame
                    </div>
                    <div className="text-[9px] text-emerald-300/80 bg-black/40 px-2 py-0.5 rounded backdrop-blur-xs self-center font-mono">
                      Ensure bill number & QR code are clearly legible
                    </div>
                  </div>

                  {/* Capturing Processing Overlay */}
                  {isCapturing && (
                    <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white gap-2 z-20">
                      <RefreshCw className="w-8 h-8 animate-spin text-emerald-400" />
                      <p className="text-xs font-semibold">{captureStatus || 'Processing...'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200">
              {capturedPreview ? (
                /* Actions when in Preview Mode: Retake vs Confirm */
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                  <p className="text-[11px] text-slate-500 text-center sm:text-left">
                    Is the document clear and legible? Click Confirm to save as dispatch proof.
                  </p>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleRetake}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                      <span>Retake</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Photograph</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Actions when in Live Viewfinder Mode: Capture Shutter Button */
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[11px] text-slate-500 hidden sm:block">
                    Live camera stream • High-res snapshot with GPS watermark
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSnapPhoto}
                      disabled={isCapturing || !!cameraError}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-95 text-white text-xs font-bold rounded-lg shadow transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Take Photo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full-size zoom lightbox modal */}
      {zoomOpen && value && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setZoomOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 rounded-2xl overflow-hidden p-2 flex flex-col border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 px-2 text-white">
              <span className="text-xs font-bold font-mono">E-Way Bill Camera Proof Viewer</span>
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={value}
              alt="E-Way Bill Full Size"
              className="max-h-[80vh] w-auto object-contain rounded-lg mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EwayBillCameraCapture;
