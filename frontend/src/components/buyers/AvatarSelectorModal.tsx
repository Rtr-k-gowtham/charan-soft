// frontend/src/components/buyers/AvatarSelectorModal.tsx
import React, { useState, useMemo } from 'react';
import {
  AvatarStyle,
  AvatarConfig,
  LORELEI_PRESETS,
  AVATAR_BG_PALETTE,
  AVATAR_LICENSES,
} from '../../lib/avatarService';
import BuyerAvatar from '../ui/BuyerAvatar';
import Button from '../ui/Button';
import { Check, Dices, Sparkles, Palette, ShieldCheck, X, RefreshCw, Search } from 'lucide-react';

interface AvatarSelectorModalProps {
  open: boolean;
  onClose: () => void;
  initialStyle?: AvatarStyle;
  initialSeed?: string;
  initialConfig?: AvatarConfig;
  buyerName?: string;
  buyerCode?: string;
  onSelect: (selection: {
    avatar_style: AvatarStyle;
    avatar_seed: string;
    avatar_config: AvatarConfig;
  }) => void;
}

export default function AvatarSelectorModal({
  open,
  onClose,
  initialSeed = '',
  initialConfig,
  buyerCode = 'BUY-NEW',
  onSelect,
}: AvatarSelectorModalProps) {
  // Style is strictly Lorelei
  const selectedStyle: AvatarStyle = 'lorelei';
  
  // Active seed
  const [currentSeed, setCurrentSeed] = useState<string>(
    initialSeed || `buyer-${buyerCode || 'custom'}`
  );
  
  // Active background color
  const [selectedBg, setSelectedBg] = useState<string>(
    initialConfig?.backgroundColor || 'b6e3f4'
  );

  // Active shape
  const [shape, setShape] = useState<'circle' | 'rounded'>('circle');

  // Filter or custom search input
  const [searchFilter, setSearchFilter] = useState('');

  // Active presets based on Lorelei style
  const currentPresets = useMemo(() => {
    if (!searchFilter.trim()) return LORELEI_PRESETS;
    const q = searchFilter.toLowerCase();
    return LORELEI_PRESETS.filter((p) => p.label.toLowerCase().includes(q) || p.seed.toLowerCase().includes(q));
  }, [searchFilter]);

  // Current config object
  const activeConfig: AvatarConfig = useMemo(() => {
    return {
      backgroundColor: selectedBg,
      radius: shape === 'rounded' ? 20 : 0,
    };
  }, [selectedBg, shape]);

  if (!open) return null;

  // Quick seed randomizer for Lorelei
  const handleRandomizeSeed = () => {
    const prefixes = ['Avery', 'Bella', 'Caleb', 'Daphne', 'Ethan', 'Fiona', 'Gavin', 'Harper', 'Iris', 'Jasper', 'Keira', 'Liam', 'Maya', 'Noah', 'Olivia', 'Quinn', 'Rowan', 'Theo', 'Zoe'];
    const randomName = `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${Math.floor(100 + Math.random() * 900)}`;
    setCurrentSeed(randomName);
  };

  const handleApply = () => {
    onSelect({
      avatar_style: 'lorelei',
      avatar_seed: currentSeed.trim() || `buyer-${buyerCode}`,
      avatar_config: activeConfig,
    });
    onClose();
  };

  const activeLicense = AVATAR_LICENSES.lorelei;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">Choose Cartoon Avatar (Lorelei)</h3>
              <p className="text-xs text-slate-500">Pick from our Lorelei character collection or create your own custom seed</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* Top Preview & Controls Box */}
          <div className="bg-gradient-to-br from-slate-50 via-brand-50/30 to-indigo-50/30 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-5">
            {/* Live Large Preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative group">
                <BuyerAvatar
                  style="lorelei"
                  seed={currentSeed}
                  config={activeConfig}
                  size="2xl"
                  shape={shape}
                  className="shadow-md ring-4 ring-white"
                />
                <button
                  type="button"
                  onClick={handleRandomizeSeed}
                  title="Randomize character"
                  className="absolute -bottom-1 -right-1 p-1.5 bg-brand-600 text-white rounded-full shadow hover:bg-brand-700 transition"
                >
                  <Dices className="w-4 h-4" />
                </button>
              </div>
              <span className="text-[11px] font-semibold text-slate-700 tracking-wide uppercase">
                Live Preview
              </span>
            </div>

            {/* Config Controls */}
            <div className="flex-1 w-full space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                  <Palette className="w-3.5 h-3.5 text-brand-600" />
                  Background Color
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {AVATAR_BG_PALETTE.map((hex) => {
                    const isSelected = selectedBg.toLowerCase() === hex.toLowerCase();
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setSelectedBg(hex)}
                        style={{ backgroundColor: `#${hex}` }}
                        className={`w-6 h-6 rounded-full border transition-all ${
                          isSelected
                            ? 'ring-2 ring-brand-600 scale-110 border-white shadow'
                            : 'border-slate-300 hover:scale-105'
                        }`}
                        title={`#${hex}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Seed Editor / Customizer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Avatar Seed / Character Name
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={currentSeed}
                      onChange={(e) => setCurrentSeed(e.target.value)}
                      placeholder="e.g. Avery, Emma, BUY-001"
                      className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleRandomizeSeed}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1"
                      title="Generate random character"
                    >
                      <RefreshCw className="w-3 h-3 text-slate-500" />
                      <span>Roll</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Avatar Shape
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShape('circle')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                        shape === 'circle'
                          ? 'border-brand-500 bg-brand-50/50 text-brand-700 font-semibold'
                          : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                      }`}
                    >
                      Circular
                    </button>
                    <button
                      type="button"
                      onClick={() => setShape('rounded')}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition ${
                        shape === 'rounded'
                          ? 'border-brand-500 bg-brand-50/50 text-brand-700 font-semibold'
                          : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                      }`}
                    >
                      Rounded
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Presets Gallery Header & Search */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Lorelei Gallery ({currentPresets.length})
                </span>
                <div className="relative">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search characters..."
                    className="text-[11px] pl-6 pr-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 w-36"
                  />
                </div>
              </div>

              {/* License Info Badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>
                  {activeLicense.name} by {activeLicense.creator} ({activeLicense.license})
                </span>
              </div>
            </div>

            {/* Presets Gallery Grid */}
            <div>
              <p className="text-xs text-slate-500 mb-2">
                Click any character card below to apply its features:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto p-1">
                {currentPresets.map((preset) => {
                  const isSelected = currentSeed.toLowerCase() === preset.seed.toLowerCase();
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCurrentSeed(preset.seed);
                        if (preset.backgroundColor) {
                          setSelectedBg(preset.backgroundColor);
                        }
                      }}
                      className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50/70 shadow-sm ring-2 ring-brand-500/30'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative mb-1.5">
                        <BuyerAvatar
                          style="lorelei"
                          seed={preset.seed}
                          config={{ backgroundColor: preset.backgroundColor || selectedBg }}
                          size="lg"
                          shape={shape}
                        />
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 bg-brand-600 text-white rounded-full p-0.5 shadow">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-slate-800 truncate w-full">
                        {preset.seed}
                      </span>
                      <span className="text-[9px] text-slate-400 capitalize">
                        Lorelei
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Selected: <span className="font-semibold text-slate-700 capitalize">Lorelei</span> ({currentSeed})
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button onClick={handleApply} className="flex-1 sm:flex-none">
              Apply Avatar
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
