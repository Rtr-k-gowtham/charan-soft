// src/components/buyers/BuyerColorsModal.tsx
import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import BuyerAvatar from '../ui/BuyerAvatar';
import { Buyer, BuyerColor } from '../../types';
import { api } from '../../lib/api';
import { lookupPantone, lookupPantoneAsync } from '../../lib/pantoneService';
import { Palette, Plus, Trash2, CheckCircle2, Sparkles, Hash, AlertCircle } from 'lucide-react';

interface Props {
  open: boolean;
  buyer: Buyer | null;
  onClose: () => void;
  onSaved?: (updatedColors: BuyerColor[]) => void;
}

export function parseBuyerColors(raw?: BuyerColor[] | string | null): BuyerColor[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function getBuyerColorsWithLocal(buyer: Buyer | null | undefined): BuyerColor[] {
  if (!buyer) return [];
  const serverColors = parseBuyerColors(buyer.preferred_colors);
  if (serverColors && serverColors.length > 0) return serverColors;

  if (typeof window !== 'undefined') {
    const localKey = `cheran_buyer_colors_${buyer.id}`;
    const localKey2 = buyer.code ? `cheran_buyer_colors_${buyer.code}` : null;
    const stored = localStorage.getItem(localKey) || (localKey2 ? localStorage.getItem(localKey2) : null);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }

// No hardcoded sample colors - buyers start clean
  }
  return [];
}

export default function BuyerColorsModal({ open, buyer, onClose, onSaved }: Props) {
  const [colors, setColors] = useState<BuyerColor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New color form state
  const [name, setName] = useState('');
  const [pantoneCode, setPantoneCode] = useState('');
  const [hexCode, setHexCode] = useState('#0F2042');
  const [notes, setNotes] = useState('');
  const [lookupMatch, setLookupMatch] = useState<{ name?: string; code?: string; hex?: string } | null>(null);

  // Initialize colors when buyer changes or modal opens
  useEffect(() => {
    if (buyer) {
      setColors(getBuyerColorsWithLocal(buyer));
      setError('');
      setSuccessMsg('');
      resetAddForm();
    }
  }, [buyer, open]);

  const resetAddForm = () => {
    setName('');
    setPantoneCode('');
    setHexCode('#0F2042');
    setNotes('');
    setLookupMatch(null);
  };

  // Debounced Pantone Code Auto-detect
  useEffect(() => {
    const trimmed = pantoneCode.trim();
    if (!trimmed || trimmed.length < 2) {
      setLookupMatch(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const localMatch = lookupPantone(trimmed);
        if (localMatch && localMatch.hex_code) {
          setLookupMatch({
            name: localMatch.name,
            code: localMatch.pantone_code,
            hex: localMatch.hex_code,
          });
          setHexCode(localMatch.hex_code);
          if (!name.trim() && localMatch.name) {
            setName(localMatch.name);
          }
          return;
        }

        const asyncMatch = await lookupPantoneAsync(trimmed);
        if (asyncMatch && asyncMatch.hex_code) {
          setLookupMatch({
            name: asyncMatch.name,
            code: asyncMatch.pantone_code,
            hex: asyncMatch.hex_code,
          });
          setHexCode(asyncMatch.hex_code);
          if (!name.trim() && asyncMatch.name) {
            setName(asyncMatch.name);
          }
        } else {
          setLookupMatch(null);
        }
      } catch {
        setLookupMatch(null);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [pantoneCode]);

  const handleAddColor = () => {
    if (!name.trim() && !pantoneCode.trim()) {
      setError('Please provide a Color Name or Pantone Code.');
      return;
    }

    const colorName = name.trim() || pantoneCode.trim();
    const cleanHex = hexCode.startsWith('#') ? hexCode : `#${hexCode}`;

    // Check for duplicate color in list
    const isDup = colors.some(
      (c) =>
        c.name.toLowerCase() === colorName.toLowerCase() ||
        (pantoneCode.trim() && c.pantone_code && c.pantone_code.toLowerCase() === pantoneCode.trim().toLowerCase())
    );

    if (isDup) {
      setError(`Color "${colorName}" is already in this buyer's palette.`);
      return;
    }

    const newColorItem: BuyerColor = {
      id: `bc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: colorName,
      pantone_code: pantoneCode.trim() || undefined,
      hex_code: cleanHex,
      notes: notes.trim() || undefined,
    };

    setColors((prev) => [...prev, newColorItem]);
    setError('');
    resetAddForm();
  };

  const handleRemoveColor = (index: number) => {
    setColors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!buyer) return;
    setSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      // 1. Save to local storage for instant offline/caching resiliency
      if (typeof window !== 'undefined') {
        localStorage.setItem(`cheran_buyer_colors_${buyer.id}`, JSON.stringify(colors));
        if (buyer.code) {
          localStorage.setItem(`cheran_buyer_colors_${buyer.code}`, JSON.stringify(colors));
        }
      }

      // 2. Persist to server API
      try {
        await api.updateBuyer(buyer.id, {
          ...buyer,
          preferred_colors: colors,
        });
      } catch (apiErr) {
        console.warn('Server preferred_colors update warning (saved locally):', apiErr);
      }

      setSuccessMsg('Brand colors saved successfully!');
      if (onSaved) {
        onSaved(colors);
      }

      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save buyer brand colors');
    } finally {
      setSaving(false);
    }
  };

  if (!buyer) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Buyer Brand Colors: ${buyer.name}`}
      subtitle="Configure Pantone and HEX brand shades for this buyer"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500 font-medium">
            {colors.length} {colors.length === 1 ? 'color configured' : 'colors configured'}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save Brand Colors
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Buyer Header Banner */}
        <div className="flex items-center gap-3 p-3 bg-brand-50/60 border border-brand-100 rounded-xl">
          <BuyerAvatar buyer={buyer} size="md" shape="circle" showRing />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900 text-sm truncate">{buyer.name}</h4>
              <span className="font-mono text-[10px] font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded border border-brand-200">
                {buyer.code}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              These brand colors appear at the <strong>top of the color selector</strong> when creating orders for {buyer.name}.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Section 1: Add New Brand Color Form */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              Add Buyer Brand Color (Pantone or HEX)
            </span>
            {lookupMatch && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Pantone Verified ({lookupMatch.code})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            {/* Color Swatch / Picker */}
            <div className="sm:col-span-2 flex flex-col items-center">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Swatch
              </label>
              <div className="relative group">
                <div
                  className="w-10 h-10 rounded-xl border-2 border-white shadow-md ring-1 ring-slate-300 flex items-center justify-center cursor-pointer transition hover:scale-105"
                  style={{ backgroundColor: hexCode }}
                  title="Click to pick color"
                >
                  <input
                    type="color"
                    value={hexCode.startsWith('#') && hexCode.length === 7 ? hexCode : '#0F2042'}
                    onChange={(e) => setHexCode(e.target.value.toUpperCase())}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>
              </div>
            </div>

            {/* Color Name */}
            <div className="sm:col-span-4">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                Color Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Navy Blue, Heather Grey"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
              />
            </div>

            {/* Pantone Code */}
            <div className="sm:col-span-3">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                Pantone Code
              </label>
              <input
                type="text"
                value={pantoneCode}
                onChange={(e) => setPantoneCode(e.target.value)}
                placeholder="e.g. 19-4052 TCX"
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-medium"
              />
            </div>

            {/* HEX Code */}
            <div className="sm:col-span-3">
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                HEX Code
              </label>
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={hexCode.replace(/^#/, '')}
                  onChange={(e) => setHexCode(`#${e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()}`)}
                  placeholder="0F2042"
                  className="w-full pl-6 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono font-bold uppercase"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={handleAddColor}
              className="bg-brand-600 hover:bg-brand-700 text-white text-xs py-1.5"
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Color to Palette
            </Button>
          </div>
        </div>

        {/* Section 2: Configured Colors List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Configured Brand Colors ({colors.length})
            </span>
            {colors.length > 0 && (
              <span className="text-[11px] text-slate-400">
                These colors will automatically prioritize for {buyer.name}
              </span>
            )}
          </div>

          {colors.length === 0 ? (
            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <Palette className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-600">No brand colors configured yet</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Add standard brand colors with their Pantone codes or HEX shades so merchandising teams can pick them instantly during order creation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {colors.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="flex items-center justify-between gap-3 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 shadow-2xs transition group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-lg border border-slate-200 shrink-0 shadow-xs ring-1 ring-slate-100"
                      style={{ backgroundColor: c.hex_code || '#0F2042' }}
                      title={`${c.name} (${c.hex_code})`}
                    />
                    <div className="min-w-0 flex flex-col">
                      <span className="text-xs font-bold text-slate-800 truncate" title={c.name}>
                        {c.name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {c.pantone_code && (
                          <span className="font-mono text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                            {c.pantone_code}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-400">
                          {c.hex_code}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveColor(idx)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title={`Remove ${c.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
