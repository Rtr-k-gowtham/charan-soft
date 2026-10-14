// src/pages/masters/ColorsPage.tsx
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { lookupPantone, normalizePantoneInput } from '../../lib/pantoneService';
import { Plus, Edit2, Trash2, AlertCircle, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';

interface ColorRecord {
  id: number;
  code?: string;
  name: string;
  hex_code: string;
  pantone_code?: string;
  status?: string;
}

export default function ColorsPage() {
  const [colors, setColors] = useState<ColorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editColor, setEditColor] = useState<ColorRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form states driven by Pantone Code manual entry & auto-lookup
  const [pantoneInput, setPantoneInput] = useState('');
  const [colorName, setColorName] = useState('');
  const [hexCode, setHexCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [verifiedInfo, setVerifiedInfo] = useState<{
    code: string;
    system: string;
    category: string;
  } | null>(null);

  // Delete modal state
  const [deleteColorItem, setDeleteColorItem] = useState<ColorRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = () => {
    setLoading(true);
    api.getColors()
      .then(d => setColors((d || []) as ColorRecord[]))
      .catch(() => setColors([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Debounced Pantone Code lookup
  useEffect(() => {
    if (!modalOpen) return;

    const trimmed = pantoneInput.trim();

    if (!trimmed) {
      setLookupLoading(false);
      setLookupError('');
      setColorName('');
      setHexCode('');
      setIsVerified(false);
      setVerifiedInfo(null);
      return;
    }

    // If currently recognized code already matches input, avoid re-clearing
    if (verifiedInfo && verifiedInfo.code.toUpperCase() === trimmed.toUpperCase()) {
      return;
    }

    // Clear stale color names and swatches immediately when code changes
    setIsVerified(false);
    setColorName('');
    setHexCode('');
    setVerifiedInfo(null);
    setLookupError('');
    setLookupLoading(true);

    const timer = setTimeout(() => {
      const res = lookupPantone(trimmed);
      setLookupLoading(false);

      if (res.found && res.name && res.hex_code) {
        setIsVerified(true);
        setColorName(res.name);
        setHexCode(res.hex_code);
        setLookupError('');
        setVerifiedInfo({
          code: res.pantone_code || trimmed,
          system: res.system || 'FHI TCX',
          category: res.category || 'Textile Reference'
        });
      } else {
        setIsVerified(false);
        setColorName('');
        setHexCode('');
        setVerifiedInfo(null);
        setLookupError(res.error || 'Pantone color not found in verified reference dataset');
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [pantoneInput, modalOpen, verifiedInfo]);

  const openCreate = () => {
    setEditColor(null);
    setPantoneInput('');
    setColorName('');
    setHexCode('');
    setIsVerified(false);
    setLookupLoading(false);
    setLookupError('');
    setVerifiedInfo(null);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (c: ColorRecord) => {
    setEditColor(c);
    setError('');
    const rawCode = c.pantone_code || '';
    setPantoneInput(rawCode);

    if (rawCode) {
      const res = lookupPantone(rawCode);
      if (res.found && res.name && res.hex_code) {
        setIsVerified(true);
        setColorName(res.name);
        setHexCode(res.hex_code);
        setLookupError('');
        setVerifiedInfo({
          code: res.pantone_code || rawCode,
          system: res.system || 'FHI TCX',
          category: res.category || 'Textile Reference'
        });
      } else {
        setIsVerified(false);
        setColorName(c.name);
        setHexCode(c.hex_code || '#64748b');
        setVerifiedInfo(null);
        setLookupError(`Pantone code "${rawCode}" not found in verified reference dataset`);
      }
    } else {
      // Legacy color record without Pantone code
      setIsVerified(false);
      setColorName(c.name);
      setHexCode(c.hex_code || '#64748b');
      setVerifiedInfo(null);
      setLookupError('');
    }

    setLookupLoading(false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setError('');

    if (editColor) {
      // Editing existing color
      if (pantoneInput.trim()) {
        if (!isVerified || !colorName.trim()) {
          setError(lookupError || 'Please enter a recognized Pantone Color Code before saving');
          return;
        }
      } else {
        if (!colorName.trim()) {
          setError('Color name is required');
          return;
        }
      }
    } else {
      // Creating new color - Pantone code is required
      if (!pantoneInput.trim()) {
        setError('Pantone Color Code is required');
        return;
      }
      if (!isVerified || !colorName.trim()) {
        setError(lookupError || 'Please enter a recognized Pantone Color Code before saving');
        return;
      }
    }

    setSaving(true);

    try {
      if (editColor) {
        await api.updateColor(editColor.id, {
          name: colorName.trim(),
          code: editColor.code || '', // Preserves internal code in database
          hex_code: hexCode || editColor.hex_code,
          pantone_code: isVerified ? (verifiedInfo?.code || normalizePantoneInput(pantoneInput)) : (pantoneInput.trim() || null),
          status: editColor.status || 'active'
        });
      } else {
        await api.createColor({
          name: colorName.trim(),
          code: '', // Backend automatically generates internal code CLR-XXXX
          hex_code: hexCode,
          pantone_code: verifiedInfo?.code || normalizePantoneInput(pantoneInput)
        });
      }
      setModalOpen(false);
      loadData();
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to save color');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteColorItem) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deleteColor(deleteColorItem.id);
      setDeleteColorItem(null);
      loadData();
    } catch (e: unknown) {
      setDeleteError((e as Error).message || 'Failed to delete color. It may be referenced in orders.');
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    {
      key: 'code',
      label: 'Internal Code',
      sortable: true,
      width: '120px',
      render: (r: ColorRecord) => (
        <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {r.code || `CLR-${String(r.id).padStart(4, '0')}`}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Color Name',
      sortable: true,
      render: (r: ColorRecord) => (
        <div className="flex items-center gap-2.5">
          <div
            className="w-5 h-5 rounded-md border border-slate-300 shrink-0 shadow-2xs"
            style={{ backgroundColor: r.hex_code || '#64748b' }}
            title={r.hex_code || '#64748b'}
          />
          <span className="font-semibold text-slate-800 text-xs">{r.name}</span>
        </div>
      )
    },
    {
      key: 'pantone_code',
      label: 'Pantone Color Code',
      sortable: true,
      render: (r: ColorRecord) => r.pantone_code ? (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md text-xs font-mono font-bold text-amber-900 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-xs shrink-0 border border-amber-300" style={{ backgroundColor: r.hex_code || '#D4A017' }} />
          {r.pantone_code}
        </span>
      ) : (
        <span className="text-slate-400 text-xs italic">Not assigned</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      width: '90px',
      render: (r: ColorRecord) => <StatusBadge status={r.status || 'active'} />
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Colors Master"
        subtitle="Manage textile Pantone color codes and official color specifications"
        breadcrumb={[{ label: 'Masters' }, { label: 'Colors' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
              title="Refresh Colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
              Add Color
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4">
        <DataTable
          data={colors}
          columns={columns}
          rowKey="id"
          actions={(r: ColorRecord) => (
            <div className="flex items-center gap-1">
              <button
                onClick={() => openEdit(r)}
                className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-slate-100 transition-colors"
                title="Edit Color"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setDeleteColorItem(r);
                  setDeleteError('');
                }}
                className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                title="Delete Color"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        />
      </div>

      {/* Add / Edit Color Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editColor ? `Edit Color: ${editColor.name}` : 'Add New Pantone Color'}
        size="md"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Pantone Color Code Input (Manual entry only, no visual picker) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Pantone Color Code <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={pantoneInput}
                onChange={(e) => setPantoneInput(e.target.value)}
                placeholder="Enter Pantone code (e.g., 19-4052 TCX)"
                className={`w-full px-3 py-2 text-xs font-mono font-medium rounded-lg border transition-all duration-150 pr-9 ${
                  lookupError
                    ? 'border-red-300 bg-red-50/20 text-red-900 focus:border-red-500 focus:ring-1 focus:ring-red-200'
                    : isVerified
                    ? 'border-emerald-400 bg-emerald-50/20 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200'
                    : 'border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'
                }`}
                autoFocus
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {lookupLoading ? (
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                ) : isVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : lookupError ? (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                ) : null}
              </div>
            </div>

            {/* Validation & Lookup Status Message */}
            <div className="mt-1.5 min-h-[18px]">
              {lookupLoading && (
                <div className="flex items-center gap-1.5 text-[11px] text-brand-600">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span>Looking up verified Pantone reference...</span>
                </div>
              )}
              {!lookupLoading && lookupError && (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}
              {!lookupLoading && isVerified && verifiedInfo && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  <span>Verified {verifiedInfo.system} standard ({verifiedInfo.category})</span>
                </div>
              )}
              {!lookupLoading && !lookupError && !isVerified && !pantoneInput && (
                <p className="text-[11px] text-slate-400">
                  Type or paste a textile Pantone code (e.g., 19-4052 TCX, 18-1662 TCX, PMS 286 C).
                </p>
              )}
            </div>
          </div>

          {/* 2. Color Name & 3. Digital Swatch in a unified layout */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start pt-1">
            {/* Color Name (automatically populated from verified reference) */}
            <div className="sm:col-span-3">
              <label className="text-xs font-semibold text-slate-700 block mb-1 flex items-center justify-between">
                <span>Color Name</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  {isVerified ? '(read-only, verified)' : '(automatically populated)'}
                </span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={colorName}
                  onChange={(e) => {
                    if (!isVerified) setColorName(e.target.value);
                  }}
                  readOnly={isVerified}
                  placeholder={
                    lookupLoading
                      ? 'Looking up color name...'
                      : isVerified
                      ? colorName
                      : 'Automatically populated from Pantone code'
                  }
                  className={`w-full px-3 py-2 text-xs rounded-lg border transition-all ${
                    isVerified
                      ? 'bg-slate-50 border-slate-200 text-slate-900 font-semibold cursor-default select-text'
                      : 'bg-slate-100 border-slate-200 text-slate-400 italic cursor-not-allowed'
                  }`}
                />
                {isVerified && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-semibold text-emerald-700">
                      Verified
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Digital Color Swatch (automatically populated, read-only preview) */}
            <div className="sm:col-span-1">
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Digital Swatch
              </label>
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-lg border border-slate-300 shrink-0 shadow-2xs flex items-center justify-center transition-all"
                  style={{
                    backgroundColor: hexCode || '#f1f5f9',
                  }}
                  title={hexCode ? `Representative digital preview: ${hexCode}` : 'No swatch available'}
                >
                  {!hexCode && <span className="text-[9px] text-slate-400 font-mono">—</span>}
                </div>
                <div className="min-w-0">
                  <span className="font-mono text-[11px] font-bold text-slate-800 block truncate">
                    {hexCode || '—'}
                  </span>
                  <span className="text-[9px] text-slate-400 block truncate">sRGB</span>
                </div>
              </div>
            </div>
          </div>

          {/* Verified Specification Summary Banner */}
          {isVerified && verifiedInfo && (
            <div className="p-3 bg-gradient-to-r from-slate-50 to-emerald-50/40 border border-emerald-200/80 rounded-lg flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-md border border-slate-300 shadow-2xs shrink-0"
                  style={{ backgroundColor: hexCode }}
                />
                <div>
                  <div className="font-semibold text-slate-900">{colorName}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {verifiedInfo.code} &bull; {verifiedInfo.category}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold text-[10px]">
                {verifiedInfo.system}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || lookupLoading || (!editColor && !isVerified)}
            >
              {saving ? 'Saving...' : editColor ? 'Update Color' : 'Save Color'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteColorItem}
        onClose={() => setDeleteColorItem(null)}
        title="Delete Color Confirmation"
        size="sm"
      >
        <div className="space-y-4">
          {deleteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{deleteError}</div>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            Are you sure you want to delete the color{' '}
            <strong className="text-slate-800 font-semibold">{deleteColorItem?.name}</strong>{' '}
            (<span className="font-mono font-bold text-slate-700">{deleteColorItem?.code || `CLR-${deleteColorItem?.id}`}</span>)?
          </p>

          {deleteColorItem?.pantone_code && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs flex items-center gap-2">
              <span className="w-3 h-3 rounded-xs shrink-0 border border-amber-300" style={{ backgroundColor: deleteColorItem.hex_code }} />
              <span className="font-mono font-semibold text-amber-900">{deleteColorItem.pantone_code}</span>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500">
            <strong>Referential Protection:</strong> Colors referenced in existing production orders or purchase orders cannot be deleted in order to preserve historical batch integrity.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setDeleteColorItem(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              Delete Color
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
