// frontend/src/components/buyer-products/ProductImageUploader.tsx
import React, { useRef, useState } from 'react';
import { Upload, X, RefreshCw, Image as ImageIcon } from 'lucide-react';

interface Props {
  imageUrl?: string;
  onChange: (url: string) => void;
}

export const compressImage = (file: File, maxWidth = 600, maxHeight = 600, quality = 0.82): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
};

export default function ProductImageUploader({ imageUrl, onChange }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsProcessing(true);
    try {
      const compressed = await compressImage(file);
      onChange(compressed);
    } catch (err) {
      console.error('Image compression failed', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-700">Product Image</label>
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {imageUrl ? (
        <div className="relative group w-full h-44 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center shadow-sm">
          <img
            src={imageUrl}
            alt="Product Preview"
            className="w-full h-full object-contain p-2"
          />
          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white text-slate-800 text-xs font-medium rounded-md shadow hover:bg-slate-100 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Replace Image
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md shadow hover:bg-red-700 flex items-center gap-1.5 transition"
            >
              <X className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors p-4 text-center ${
            isDragging
              ? 'border-brand-500 bg-brand-50/50 text-brand-700'
              : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50/70 text-slate-500'
          }`}
        >
          {isProcessing ? (
            <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand-50">
              <Upload className="w-5 h-5 text-brand-600" />
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-slate-700">
              Drag & drop product photo or <span className="text-brand-600 underline">browse</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Supports JPG, PNG, WEBP (auto-compressed)</p>
          </div>
        </div>
      )}
    </div>
  );
}
