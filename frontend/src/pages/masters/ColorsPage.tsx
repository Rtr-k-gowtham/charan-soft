// src/pages/masters/ColorsPage.tsx
import React, { useEffect, useState, useTransition } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import {
  lookupPantoneAsync,
  normalizePantoneInput,
  hexToRgb,
  rgbToHex,
  isValidHex,
} from '../../lib/pantoneService';
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Palette,
  Sliders,
  Check,
  X,
  Layers,
} from 'lucide-react';

export interface PantoneRecord {
  id: number;
  pantone_name: string;
  pantone_code: string;
  unique_code?: string;
  hex_code: string;
  red: number;
  green: number;
  blue: number;
  color_system?: string;
  status?: string;
  created_at?: string;
}

export default function ColorsPage() {
  // Master Pantone Table state
  const [pantoneColors, setPantoneColors] = useState<PantoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [, startTransition] = useTransition();

  // Create / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PantoneRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form Fields
  const [pantoneInput, setPantoneInput] = useState('');
  const [colorName, setColorName] = useState('');
  const [hexCode, setHexCode] = useState('#0F2042');
  const [rgb, setRgb] = useState<{ r: number; g: number; b: number }>({ r: 15, g: 32, b: 66 });
  const [colorSystem, setColorSystem] = useState('PMS Coated');
  const [isVerified, setIsVerified] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');

  // Delete modal state
  const [deleteItem, setDeleteItem] = useState<PantoneRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Load Pantone Colors from database table
  const loadColors = (targetPage = page, query = search, pageSize = limit) => {
    setLoading(true);
    api.getPantoneColors({ page: targetPage, limit: pageSize, search: query.trim() })
      .then((res) => {
        setPantoneColors(res.items || []);
        setTotal(res.total || 0);
        setPage(res.page || 1);
        setTotalPages(res.total_pages || 1);
      })
      .catch((err) => {
        console.error('Failed to load pantone colors from database:', err);
        setPantoneColors([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadColors(page, search, limit);
  }, [page, limit]);

  // Debounced search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    startTransition(() => {
      setPage(1);
      loadColors(1, val, limit);
    });
  };

  const clearSearch = () => {
    setSearch('');
    setPage(1);
    loadColors(1, '', limit);
  };

  // Synchronize HEX input changes to RGB
  const handleHexChange = (val: string) => {
    let clean = val.trim();
    if (clean && !clean.startsWith('#')) clean = '#' + clean;
    setHexCode(clean);
    const parsed = hexToRgb(clean);
    if (parsed) {
      setRgb(parsed);
    }
  };

  // Synchronize RGB component changes to HEX
  const handleRgbChange = (channel: 'r' | 'g' | 'b', valStr: string) => {
    const num = parseInt(valStr, 10);
    const val = isNaN(num) ? 0 : Math.max(0, Math.min(255, num));
    const nextRgb = { ...rgb, [channel]: val };
    setRgb(nextRgb);
    setHexCode(rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b));
  };

  // Debounced lookup when user types Pantone Code in Add/Edit modal
  useEffect(() => {
    if (!modalOpen || editingItem) return;

    const trimmed = pantoneInput.trim();
    if (!trimmed) {
      setLookupLoading(false);
      setLookupMessage('');
      setIsVerified(false);
      setIsCustomMode(true);
      return;
    }

    setLookupLoading(true);
    setLookupMessage('');
    setIsVerified(false);
    setIsCustomMode(false);

    const timer = setTimeout(async () => {
      try {
        const res = await lookupPantoneAsync(trimmed);
        setLookupLoading(false);

        if (res.found && res.name && res.hex_code) {
          setIsVerified(true);
          setIsCustomMode(false);
          setColorName(res.name);
          setHexCode(res.hex_code);
          const parsedRgb = hexToRgb(res.hex_code) || {
            r: res.red || 0,
            g: res.green || 0,
            b: res.blue || 0,
          };
          setRgb(parsedRgb);
          setColorSystem(res.system || 'PMS Coated');
          setLookupMessage(`Verified Pantone reference: ${res.category || 'Standard'}`);
        } else {
          // Unlisted code: allow user to input Name, RGB & HEX
          setIsVerified(false);
          setIsCustomMode(true);
          setLookupMessage(
            'Pantone code not found in existing reference library. Please enter the Color Name and set the digital color using RGB or HEX values below.'
          );
        }
      } catch {
        setLookupLoading(false);
        setIsVerified(false);
        setIsCustomMode(true);
        setLookupMessage(
          'Pantone reference service unavailable. You can enter the color name and digital RGB / HEX values manually.'
        );
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [pantoneInput, modalOpen, editingItem]);

  // Open Add Color Modal (optionally prefill code from search)
  const openCreateModal = (prefillCode = '') => {
    setEditingItem(null);
    setFormError('');
    setPantoneInput(prefillCode);
    setColorName('');
    setHexCode('#0F2042');
    setRgb({ r: 15, g: 32, b: 66 });
    setColorSystem('PMS Coated');
    setIsVerified(false);
    setIsCustomMode(true);
    setLookupLoading(false);
    setLookupMessage(
      prefillCode
        ? 'Enter the Color Name and digital RGB or HEX values for this new Pantone color.'
        : ''
    );
    setModalOpen(true);
  };

  // Open Edit Color Modal
  const openEditModal = (item: PantoneRecord) => {
    setEditingItem(item);
    setFormError('');
    setPantoneInput(item.pantone_code);
    setColorName(item.pantone_name);
    setHexCode(item.hex_code || '#0F2042');
    setRgb({
      r: item.red || 0,
      g: item.green || 0,
      b: item.blue || 0,
    });
    setColorSystem(item.color_system || 'PMS Coated');
    setIsVerified(false);
    setIsCustomMode(true);
    setLookupLoading(false);
    setLookupMessage('');
    setModalOpen(true);
  };

  // Save (Create or Update) Pantone Color
  const handleSave = async () => {
    setFormError('');

    if (!colorName.trim()) {
      setFormError('Color Name is required');
      return;
    }
    if (!isValidHex(hexCode)) {
      setFormError('Please enter a valid 6-digit HEX color code (e.g. #FFE966)');
      return;
    }

    setSaving(true);
    const trimmedInput = pantoneInput.trim();
    const finalCode = trimmedInput ? (normalizePantoneInput(trimmedInput) || trimmedInput) : '';

    try {
      if (editingItem) {
        await api.updatePantoneColor(editingItem.id, {
          pantone_code: finalCode,
          pantone_name: colorName.trim(),
          hex_code: hexCode,
          red: rgb.r,
          green: rgb.g,
          blue: rgb.b,
          color_system: colorSystem,
        });
        setSuccessToast(`Successfully updated Pantone color "${finalCode}"`);
      } else {
        await api.createPantoneColor({
          pantone_code: finalCode,
          pantone_name: colorName.trim(),
          hex_code: hexCode,
          red: rgb.r,
          green: rgb.g,
          blue: rgb.b,
          color_system: colorSystem,
        });
        setSuccessToast(`Successfully added Pantone color "${finalCode}" to Master Library`);
      }

      setModalOpen(false);
      loadColors(page, search, limit);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (e: unknown) {
      setFormError((e as Error).message || 'Failed to save Pantone color');
    } finally {
      setSaving(false);
    }
  };

  // Delete Pantone Color
  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deletePantoneColor(deleteItem.id);
      setSuccessToast(`Deleted Pantone color "${deleteItem.pantone_code}"`);
      setDeleteItem(null);
      loadColors(page, search, limit);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (e: unknown) {
      setDeleteError((e as Error).message || 'Failed to delete Pantone color');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <PageHeader
        title="Pantone Colors Master"
        subtitle="Authoritative library of verified Pantone colors (3,219 colors) for textile dyeing and manufacturing"
        breadcrumb={[{ label: 'Masters' }, { label: 'Pantone Colors Master' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadColors(page, search, limit)}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 rounded-md bg-white hover:bg-slate-50 transition-colors shadow-2xs font-medium text-slate-700"
              title="Refresh Table"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <Button
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => openCreateModal('')}
            >
              Add Pantone Color
            </Button>
          </div>
        }
      />

      {/* Main Single Master Table View */}
      <div className="flex-1 flex flex-col overflow-hidden p-2.5 sm:p-4">
        {/* Success Toast Banner */}
        {successToast && (
          <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 font-medium flex items-center justify-between shadow-2xs animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast(null)}
              className="text-emerald-500 hover:text-emerald-700 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="bg-white p-3.5 rounded-2xl sm:rounded-t-lg sm:rounded-b-none border-0 sm:border sm:border-b-0 border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs sm:shadow-2xs mb-2.5 sm:mb-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search 3,219 Pantone colors by code, name, or HEX (e.g., 100 C, Navy, #FFE966)..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl sm:rounded-md border border-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-200 text-slate-800 font-medium shadow-2xs"
            />
            {search && (
              <button
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  const newLimit = parseInt(e.target.value, 10);
                  setLimit(newLimit);
                  setPage(1);
                  loadColors(1, search, newLimit);
                }}
                className="py-1 px-2 border border-slate-200 rounded text-xs bg-white font-medium text-slate-700"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
            <div className="font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
              Total: {total.toLocaleString()} colors
            </div>
          </div>
        </div>

        {/* Master Table Container */}
        <div className="flex-1 overflow-auto border-0 sm:border sm:border-slate-200 bg-transparent sm:bg-white">
          {loading ? (
            <div className="h-72 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white rounded-2xl sm:rounded-none">
              <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
              <span className="text-xs font-medium">Fetching Pantone colors from database table...</span>
            </div>
          ) : pantoneColors.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center text-center p-6 gap-3 bg-white rounded-2xl sm:rounded-none">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Palette className="w-6 h-6" />
              </div>
              <div className="max-w-md">
                <h4 className="text-sm font-bold text-slate-800">
                  {search ? `No Pantone colors matched "${search}"` : 'No Pantone colors found'}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  {search
                    ? 'The Pantone color code or name is not available in the database. You can add it now by entering RGB or HEX values.'
                    : 'The pantone_colors master table has no records.'}
                </p>
              </div>
              {search && (
                <button
                  type="button"
                  onClick={() => openCreateModal(search.trim())}
                  className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-md shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add "{search}" as New Pantone Color</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="hidden sm:table w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10 shadow-2xs backdrop-blur-xs">
                    <th className="py-2.5 px-3.5 w-16">Swatch</th>
                    <th className="py-2.5 px-3.5">Pantone Code</th>
                    <th className="py-2.5 px-3.5">Color Name</th>
                    <th className="py-2.5 px-3.5 w-24">Unique ID</th>
                    <th className="py-2.5 px-3.5 w-28">HEX Code</th>
                    <th className="py-2.5 px-3.5 w-36">sRGB Coordinates</th>
                    <th className="py-2.5 px-3.5 w-28">Color System</th>
                    <th className="py-2.5 px-3.5 w-20">Status</th>
                    <th className="py-2.5 px-3.5 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pantoneColors.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Swatch */}
                      <td className="py-2.5 px-3.5">
                        <div
                          className="w-7 h-7 rounded-md border border-slate-300 shadow-2xs shrink-0 cursor-pointer transition-transform hover:scale-110"
                          style={{ backgroundColor: item.hex_code }}
                          title={`${item.pantone_name} (${item.hex_code})`}
                        />
                      </td>

                      {/* Pantone Code */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-amber-900">
                        {item.pantone_code ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md shadow-2xs">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0 border border-amber-300"
                              style={{ backgroundColor: item.hex_code }}
                            />
                            {item.pantone_code}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Pantone Name */}
                      <td className="py-2.5 px-3.5 font-semibold text-slate-800">
                        {item.pantone_name}
                      </td>

                      {/* Unique Code */}
                      <td className="py-2.5 px-3.5 font-mono text-slate-500 text-[11px]">
                        {item.unique_code || `PAN-${item.id}`}
                      </td>

                      {/* HEX */}
                      <td className="py-2.5 px-3.5">
                        <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.hex_code}
                        </span>
                      </td>

                      {/* sRGB Coordinates */}
                      <td className="py-2.5 px-3.5 font-mono text-slate-500 text-[11px]">
                        rgb({item.red}, {item.green}, {item.blue})
                      </td>

                      {/* Color System */}
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium border border-slate-200">
                          {item.color_system || 'PMS Coated'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3.5">
                        <StatusBadge status={item.status || 'active'} />
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1.5 text-slate-500 hover:text-brand-600 rounded hover:bg-brand-50 transition-colors"
                            title="Edit Pantone Color"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteItem(item);
                              setDeleteError('');
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                            title="Delete Pantone Color"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Responsive Cards View */}
              <div className="sm:hidden space-y-3 pb-3">
                {pantoneColors.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 border-0 shadow-xs hover:shadow-md transition-all flex flex-col gap-3"
                  >
                    {/* Header: Swatch + Code + Name + Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-xl border border-slate-200/80 shadow-2xs shrink-0 cursor-pointer transition-transform hover:scale-105"
                          style={{ backgroundColor: item.hex_code }}
                          title={`${item.pantone_name} (${item.hex_code})`}
                          onClick={() => openEditModal(item)}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-amber-950 text-sm truncate">
                              {item.pantone_code || '—'}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-800 mt-0.5 truncate">
                            {item.pantone_name}
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 pt-0.5">
                        <StatusBadge status={item.status || 'active'} />
                      </div>
                    </div>

                    {/* Color Specs Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50/80 rounded-xl p-2.5 flex flex-col justify-center border-0 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">HEX Code</span>
                        <div className="flex items-center gap-1.5 mt-0.5 font-mono font-semibold text-slate-800 truncate">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-300" style={{ backgroundColor: item.hex_code }} />
                          <span className="truncate">{item.hex_code}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 flex flex-col justify-center border-0 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">sRGB</span>
                        <span className="font-mono text-xs font-medium text-slate-700 mt-0.5 truncate">
                          rgb({item.red}, {item.green}, {item.blue})
                        </span>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 flex flex-col justify-center border-0 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">Unique Code</span>
                        <span className="font-mono text-xs font-medium text-slate-600 mt-0.5 truncate">
                          {item.unique_code || `PAN-${item.id}`}
                        </span>
                      </div>

                      <div className="bg-slate-50/80 rounded-xl p-2.5 flex flex-col justify-center border-0 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">System</span>
                        <span className="text-xs font-medium text-slate-700 mt-0.5 truncate">
                          {item.color_system || 'PMS Coated'}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => openEditModal(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-brand-600 bg-slate-50 hover:bg-brand-50 rounded-lg transition-colors min-h-[36px]"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => {
                          setDeleteItem(item);
                          setDeleteError('');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50/60 hover:bg-red-50 rounded-lg transition-colors min-h-[36px]"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Responsive Pagination Bar */}
        <div className="bg-white p-3.5 rounded-2xl sm:rounded-b-lg sm:rounded-t-none border-0 sm:border sm:border-t-0 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs sm:shadow-2xs mt-2.5 sm:mt-0">
          <div className="text-slate-500">
            Showing <strong className="text-slate-700">{total > 0 ? (page - 1) * limit + 1 : 0}</strong> to{' '}
            <strong className="text-slate-700">{Math.min(page * limit, total)}</strong> of{' '}
            <strong className="text-slate-700">{total.toLocaleString()}</strong> colors
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (page > 1) {
                  setPage(page - 1);
                  loadColors(page - 1, search, limit);
                }
              }}
              disabled={page <= 1 || loading}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => {
                if (page < totalPages) {
                  setPage(page + 1);
                  loadColors(page + 1, search, limit);
                }
              }}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-medium"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Pantone Color Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Edit Pantone Color' : 'Add New Pantone Color'}
        size="md"
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Pantone Color Code Input */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Pantone Color Code <span className="text-slate-400 font-normal text-[11px]">(Optional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={pantoneInput}
                onChange={(e) => setPantoneInput(e.target.value)}
                placeholder="Enter Pantone code (optional, e.g., 19-4052 TCX, 100 C)"
                className={`w-full px-3 py-2 text-xs font-mono font-medium rounded-lg border transition-all duration-150 pr-9 ${
                  isVerified
                    ? 'border-emerald-400 bg-emerald-50/20 text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200'
                    : isCustomMode
                    ? 'border-amber-300 bg-amber-50/15 text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-200'
                    : 'border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-200'
                }`}
                autoFocus
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                {lookupLoading ? (
                  <Loader2 className="w-4 h-4 text-brand-600 animate-spin" />
                ) : isVerified ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : isCustomMode ? (
                  <Palette className="w-4 h-4 text-amber-500" />
                ) : null}
              </div>
            </div>

            {/* Status indicator message */}
            {lookupMessage && (
              <p
                className={`text-[11px] mt-1.5 flex items-start gap-1.5 ${
                  isVerified
                    ? 'text-emerald-700 font-medium'
                    : 'text-amber-800 bg-amber-50 p-2 rounded border border-amber-200'
                }`}
              >
                {isVerified ? (
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                )}
                <span>{lookupMessage}</span>
              </p>
            )}
          </div>

          {/* 2. Color Name Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Color Name <span className="text-red-500">*</span>
              </label>
              {isVerified && (
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Verified Library Name
                </span>
              )}
            </div>
            <input
              type="text"
              value={colorName}
              onChange={(e) => setColorName(e.target.value)}
              placeholder="Enter color name (e.g., PANTONE 100 C or Classic Navy)"
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-200 font-medium"
            />
          </div>

          {/* 3. Digital Color Definition (Live Swatch + HEX + RGB with Two-Way Sync) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-brand-600" />
                <span>Digital Color (RGB & HEX Values)</span>
              </span>
              <span className="text-[10px] text-slate-400">Two-way synchronized</span>
            </div>

            <div className="flex items-start gap-3.5">
              {/* Visual Swatch Preview Box with Native Color Picker */}
              <div className="relative group shrink-0">
                <div
                  className="w-14 h-14 rounded-lg border-2 border-white shadow-md ring-1 ring-slate-300 overflow-hidden cursor-pointer"
                  style={{ backgroundColor: isValidHex(hexCode) ? hexCode : '#0F2042' }}
                  title="Click to pick color visually"
                >
                  <input
                    type="color"
                    value={isValidHex(hexCode) ? hexCode : '#0F2042'}
                    onChange={(e) => handleHexChange(e.target.value)}
                    className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  />
                </div>
                <span className="block text-[10px] text-center text-slate-400 mt-1">Pick</span>
              </div>

              {/* HEX & RGB inputs side by side */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-2">
                {/* HEX Input */}
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium text-slate-600 block mb-0.5">
                    HEX Code
                  </label>
                  <input
                    type="text"
                    value={hexCode}
                    onChange={(e) => handleHexChange(e.target.value)}
                    placeholder="#FFE966"
                    className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded border border-slate-300 bg-white text-slate-800 focus:border-brand-500 uppercase"
                  />
                </div>

                {/* Red (R) */}
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium text-red-600 block mb-0.5">
                    Red (R)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.r}
                    onChange={(e) => handleRgbChange('r', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono font-semibold rounded border border-slate-300 bg-white text-slate-800 text-center"
                  />
                </div>

                {/* Green (G) */}
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium text-emerald-600 block mb-0.5">
                    Green (G)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.g}
                    onChange={(e) => handleRgbChange('g', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono font-semibold rounded border border-slate-300 bg-white text-slate-800 text-center"
                  />
                </div>

                {/* Blue (B) */}
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-medium text-blue-600 block mb-0.5">
                    Blue (B)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.b}
                    onChange={(e) => handleRgbChange('b', e.target.value)}
                    className="w-full px-2 py-1.5 text-xs font-mono font-semibold rounded border border-slate-300 bg-white text-slate-800 text-center"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Color System */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Color System / Classification
            </label>
            <select
              value={colorSystem}
              onChange={(e) => setColorSystem(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
            >
              <option value="PMS Coated">PMS Coated (Formula Guide)</option>
              <option value="TCX Cotton">TCX Cotton (Fashion & Home)</option>
              <option value="TPX Paper">TPX Paper (Fashion & Home)</option>
              <option value="Custom Pantone">Custom Pantone</option>
            </select>
          </div>

          {/* Modal Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              icon={<Check className="w-3.5 h-3.5" />}
              onClick={handleSave}
            >
              {editingItem ? 'Save Changes' : 'Save Pantone Color'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Delete Pantone Color"
        size="sm"
      >
        <div className="space-y-3">
          {deleteError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}

          <p className="text-xs text-slate-600">
            Are you sure you want to delete Pantone color{' '}
            <strong className="text-slate-800 font-mono font-bold">
              {deleteItem?.pantone_code}
            </strong>{' '}
            ({deleteItem?.pantone_name})? This color will be permanently removed from the master library.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setDeleteItem(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleting} onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
