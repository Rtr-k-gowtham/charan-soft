// src/pages/settings/POTemplateSettings.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../lib/api';
import { 
  POTemplateColumn, 
  POTemplateProcessField, 
  POTemplateTerm, 
  POTemplateSignature, 
  POTemplateData 
} from '../../types';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import DynamicPOTemplate from '../../components/purchase/DynamicPOTemplate';
import { printHtmlElement } from '../../lib/printUtils';
import { 
  Save, 
  RotateCcw, 
  Eye, 
  Printer, 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown,
  Building2,
  FileText,
  Users,
  Table,
  Cpu,
  Calculator,
  Type,
  ScrollText,
  PenTool,
  PanelBottom,
  Printer as LayoutIcon,
  Hash,
  Check,
  AlertTriangle,
  RefreshCw,
  Sliders,
  Columns,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Search,
  ChevronRight,
  Sparkles,
  X,
  FileCheck2,
  Settings2,
  Layers
} from 'lucide-react';

type ViewMode = 'settings' | 'preview' | 'split';

interface TabItem {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: any;
  badge?: string;
}

interface TabCategory {
  title: string;
  tabs: TabItem[];
}

const TAB_CATEGORIES: TabCategory[] = [
  {
    title: 'Branding & Identity',
    tabs: [
      { id: 'company', label: '1. Company & Header', shortLabel: 'Company Info', description: 'Logo, legal entities, tax IDs & header titles', icon: Building2 },
      { id: 'document', label: '2. PO Document Meta', shortLabel: 'Document Labels', description: 'Labels for PO number, dates, ref & status', icon: FileText },
      { id: 'supplier', label: '3. Supplier Section', shortLabel: 'Supplier Box', description: 'Vendor code, contact, GSTIN & terms display', icon: Users },
      { id: 'numbering', label: '12. PO Numbering Series', shortLabel: 'Numbering', description: 'Prefix, financial year, padding & auto-reset', icon: Hash },
    ]
  },
  {
    title: 'Content & Line Items',
    tabs: [
      { id: 'item_table', label: '4. Item Table Columns', shortLabel: 'Columns Manager', description: '23-column visibility, widths, order & headers', icon: Table, badge: '23 cols' },
      { id: 'process', label: '5. Process Details', shortLabel: 'Process Specs', description: 'Textile technical specs, route & instructions', icon: Cpu, badge: 'Textile' },
    ]
  },
  {
    title: 'Taxation & Valuation',
    tabs: [
      { id: 'tax_totals', label: '6. Tax & Totals', shortLabel: 'Tax & Totals', description: 'Subtotal, CGST, SGST, IGST & round-off labels', icon: Calculator },
      { id: 'amount_words', label: '7. Amount in Words', shortLabel: 'Words Generator', description: 'Indian currency format (Lakhs, Crores) & case', icon: Type },
    ]
  },
  {
    title: 'Legal & Print Engine',
    tabs: [
      { id: 'terms', label: '8. Terms & Conditions', shortLabel: 'Terms & Conditions', description: 'Payment, delivery, inspection & quality clauses', icon: ScrollText, badge: 'Clauses' },
      { id: 'signature', label: '9. Signature Blocks', shortLabel: 'Signatures', description: 'Signatory blocks, designations, lines & stamps', icon: PenTool, badge: 'Signatories' },
      { id: 'footer', label: '10. Document Footer', shortLabel: 'Footer & Notice', description: 'Jurisdiction notice, pagination & declarations', icon: PanelBottom },
      { id: 'print_layout', label: '11. Print & Layout Design', shortLabel: 'Layout & Colors', description: 'A4 margins, typography & brand color palette', icon: LayoutIcon },
    ]
  }
];

export default function POTemplateSettings() {
  const [activeTab, setActiveTab] = useState('company');
  const [viewMode, setViewMode] = useState<ViewMode>('settings');
  const [searchFilter, setSearchFilter] = useState('');
  
  // A4 Preview Zoom & Drawer state
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [splitZoom, setSplitZoom] = useState<number>(68);
  const [quickDrawerOpen, setQuickDrawerOpen] = useState(false);
  const [showMargins, setShowMargins] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [columns, setColumns] = useState<POTemplateColumn[]>([]);
  const [processFields, setProcessFields] = useState<POTemplateProcessField[]>([]);
  const [terms, setTerms] = useState<POTemplateTerm[]>([]);
  const [signatures, setSignatures] = useState<POTemplateSignature[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | string>(2); // Default to FABRIC WEAVING PROCESS ORDER or 1st
  const [metadata, setMetadata] = useState<{ last_updated?: string; updated_by?: string; updated_date?: string }>({
    updated_by: 'Administrator'
  });

  // UI State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmRestoreOpen, setConfirmRestoreOpen] = useState(false);

  // Load from API
  const loadData = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await api.getPOTemplateSettings();
      if (res) {
        setSettings(res.settings || {});
        setColumns(res.columns || []);
        setProcessFields(res.process_fields || []);
        setTerms(res.terms || []);
        setSignatures(res.signatures || []);
        if (res.metadata) setMetadata(res.metadata);
        if (res.categories && res.categories.length > 0) {
          setCategories(res.categories);
          setSelectedCategoryId(res.categories[0].id);
        } else {
          // Fetch categories from categories endpoint if not in template response
          const catList: any = await api.getCategories();
          if (catList && Array.isArray(catList)) {
            setCategories(catList);
            if (catList.length > 0) setSelectedCategoryId(catList[0].id);
          }
        }
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to load PO template settings' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSettingChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleToggle = (key: string) => {
    setSettings(prev => ({ ...prev, [key]: prev[key] === '1' ? '0' : '1' }));
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMessage(null);
    try {
      const allCategoryFields = categories.flatMap(c => (c.fields || []).map((f: any) => ({
        id: f.id,
        category_id: c.id,
        field_name: f.field_name,
        field_label: f.field_label,
        is_visible: f.is_visible ? 1 : 0,
        sort_order: f.sort_order,
      })));

      await api.savePOTemplateSettings({
        settings,
        columns,
        process_fields: processFields,
        terms,
        signatures,
        category_fields: allCategoryFields,
      });
      setStatusMessage({ type: 'success', text: 'All PO Template settings & category columns saved successfully!' });
      setMetadata(prev => ({
        ...prev,
        last_updated: new Date().toISOString(),
        updated_date: new Date().toISOString().split('T')[0]
      }));
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  // Category-based column helpers
  const currentCategory = categories.find(c => c.id === selectedCategoryId) || categories[0];
  const currentCategoryFields = currentCategory?.fields || [];

  const handleCategoryFieldChange = (fieldIdx: number, key: string, value: any) => {
    setCategories(prev => {
      const next = [...prev];
      const catIdx = next.findIndex(c => c.id === selectedCategoryId);
      if (catIdx !== -1 && next[catIdx].fields) {
        const fields = [...next[catIdx].fields];
        fields[fieldIdx] = { ...fields[fieldIdx], [key]: value };
        next[catIdx] = { ...next[catIdx], fields };
      }
      return next;
    });
  };

  const moveCategoryField = (fieldIdx: number, dir: -1 | 1) => {
    if (!currentCategory?.fields) return;
    if ((dir === -1 && fieldIdx === 0) || (dir === 1 && fieldIdx === currentCategory.fields.length - 1)) return;
    setCategories(prev => {
      const next = [...prev];
      const catIdx = next.findIndex(c => c.id === selectedCategoryId);
      if (catIdx !== -1 && next[catIdx].fields) {
        const fields = [...next[catIdx].fields];
        const targetIdx = fieldIdx + dir;
        const temp = fields[fieldIdx];
        fields[fieldIdx] = fields[targetIdx];
        fields[targetIdx] = temp;
        next[catIdx] = {
          ...next[catIdx],
          fields: fields.map((f: any, i: number) => ({ ...f, sort_order: i + 1 }))
        };
      }
      return next;
    });
  };

  const addCategoryField = () => {
    if (!currentCategory) return;
    const newFieldName = `field_${Date.now()}`;
    const newFieldLabel = `Custom Column ${(currentCategory.fields?.length || 0) + 1}`;
    setCategories(prev => {
      const next = [...prev];
      const catIdx = next.findIndex(c => c.id === selectedCategoryId);
      if (catIdx !== -1) {
        const fields = [...(next[catIdx].fields || [])];
        fields.push({
          id: Date.now(),
          category_id: selectedCategoryId,
          field_name: newFieldName,
          field_label: newFieldLabel,
          field_type: 'text',
          is_required: false,
          is_visible: true,
          sort_order: fields.length + 1
        });
        next[catIdx] = { ...next[catIdx], fields };
      }
      return next;
    });
  };

  const handleRestoreDefaults = async () => {
    setSaving(true);
    try {
      await api.restorePOTemplateDefaults();
      setConfirmRestoreOpen(false);
      setStatusMessage({ type: 'success', text: 'Default PO Template settings restored successfully!' });
      loadData();
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Failed to restore defaults' });
    } finally {
      setSaving(false);
    }
  };

  // Column helpers
  const handleColumnChange = (idx: number, field: keyof POTemplateColumn, value: any) => {
    setColumns(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    if ((dir === -1 && idx === 0) || (dir === 1 && idx === columns.length - 1)) return;
    setColumns(prev => {
      const next = [...prev];
      const targetIdx = idx + dir;
      const temp = next[idx];
      next[idx] = next[targetIdx];
      next[targetIdx] = temp;
      return next.map((c, i) => ({ ...c, display_order: i + 1 }));
    });
  };

  // Term helpers
  const addTerm = () => {
    const newId = terms.length + 1;
    setTerms(prev => [
      ...prev,
      {
        term_key: `term_${Date.now()}`,
        title: `Custom Condition ${newId}`,
        content: 'Enter the contractual or process specification condition terms here.',
        display_order: newId,
        is_active: 1
      }
    ]);
  };

  const updateTerm = (idx: number, field: keyof POTemplateTerm, value: any) => {
    setTerms(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const deleteTerm = (idx: number) => {
    setTerms(prev => prev.filter((_, i) => i !== idx));
  };

  // Signature helpers
  const addSignature = () => {
    const newId = signatures.length + 1;
    setSignatures(prev => [
      ...prev,
      {
        title: `Authorized Signatory ${newId}`,
        name: '',
        designation: 'Authorized Person',
        show_signature_line: 1,
        show_date: 1,
        show_stamp: 0,
        display_order: newId
      }
    ]);
  };

  const updateSignature = (idx: number, field: keyof POTemplateSignature, value: any) => {
    setSignatures(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const deleteSignature = (idx: number) => {
    setSignatures(prev => prev.filter((_, i) => i !== idx));
  };

  // Print helper
  const handlePrint = () => {
    const el = document.getElementById('printable-po-document');
    if (el) {
      printHtmlElement(el, 'Cheran Soft Goods - Purchase Order Template');
    } else {
      window.print();
    }
  };

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchFilter.trim()) return TAB_CATEGORIES;
    const q = searchFilter.toLowerCase();
    return TAB_CATEGORIES.map(cat => ({
      ...cat,
      tabs: cat.tabs.filter(t => 
        t.label.toLowerCase().includes(q) || 
        t.description.toLowerCase().includes(q) ||
        t.shortLabel.toLowerCase().includes(q)
      )
    })).filter(cat => cat.tabs.length > 0);
  }, [searchFilter]);

  const activeTabDetails = useMemo(() => {
    for (const cat of TAB_CATEGORIES) {
      const found = cat.tabs.find(t => t.id === activeTab);
      if (found) return found;
    }
    return TAB_CATEGORIES[0].tabs[0];
  }, [activeTab]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50/50 overflow-hidden font-sans">
      {/* ========================================================================= */}
      {/* 1. TOP ENTERPRISE COMMAND BAR                                              */}
      {/* ========================================================================= */}
      <header className="px-6 py-3 bg-white border-b border-slate-200/80 shrink-0 flex items-center justify-between gap-4 z-20 shadow-xs">
        {/* Left: Module Title & Metadata */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shadow-xs">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 tracking-tight">PO Template Studio</h1>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                A4 Dynamic Engine
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Configure dynamic enterprise purchase orders • Zero hardcoding • Real-time database sync
            </p>
          </div>
        </div>

        {/* Center: High-Level View Mode Switcher */}
        <div className="hidden md:flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            onClick={() => setViewMode('settings')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'settings'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Settings Editor
          </button>
          
          <button
            onClick={() => setViewMode('preview')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'preview'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-brand-600" />
            A4 Document Studio
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse"></span>
          </button>

          <button
            onClick={() => setViewMode('split')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'split'
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            Split Studio
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {viewMode === 'settings' && (
            <button
              onClick={() => setQuickDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-brand-200 bg-brand-50/60 text-brand-700 hover:bg-brand-100/70 transition-all shadow-xs"
              title="Open Quick A4 Slide-Over Preview"
            >
              <Eye className="w-3.5 h-3.5 text-brand-600" />
              Quick A4 Preview
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Print PO Preview"
          >
            <Printer className="w-3.5 h-3.5" />
            Print A4
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-500 bg-white transition-colors"
            title="Reload settings from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Button
            variant="secondary"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={() => setConfirmRestoreOpen(true)}
            className="text-xs"
          >
            Restore Defaults
          </Button>

          <Button
            loading={saving}
            icon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSave}
            className="text-xs shadow-sm bg-brand-600 hover:bg-brand-700"
          >
            Save Changes
          </Button>
        </div>
      </header>

      {/* Status Bar */}
      {statusMessage && (
        <div className={`px-6 py-2 text-xs font-medium border-b flex items-center justify-between shrink-0 transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold px-1">✕</button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE VIEW (SETTINGS / PREVIEW / SPLIT)                         */}
      {/* ========================================================================= */}
      <div className="flex-1 flex overflow-hidden">

        {/* ----------------------------------------------------------------------- */}
        {/* VIEW MODE: SETTINGS EDITOR OR LEFT PANE OF SPLIT                        */}
        {/* ----------------------------------------------------------------------- */}
        {(viewMode === 'settings' || viewMode === 'split') && (
          <div className={`flex flex-col border-r border-slate-200 bg-white overflow-hidden transition-all duration-300 ${
            viewMode === 'split' ? 'w-full lg:w-1/2' : 'w-full'
          }`}>
            <div className="flex-1 flex overflow-hidden">
              {/* Left Categorized Navigation Sidebar */}
              <aside className="w-72 border-r border-slate-200/90 bg-slate-50/70 flex flex-col shrink-0 overflow-hidden">
                {/* Search / Filter Box */}
                <div className="p-3 border-b border-slate-200 bg-white">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value)}
                      placeholder="Filter settings sections..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
                    />
                    {searchFilter && (
                      <button 
                        onClick={() => setSearchFilter('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Categorized Tab List */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
                  {filteredCategories.map(cat => (
                    <div key={cat.title} className="space-y-1">
                      <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        {cat.title}
                      </p>
                      <div className="space-y-0.5">
                        {cat.tabs.map(tab => {
                          const Icon = tab.icon;
                          const isActive = activeTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id)}
                              className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                                isActive
                                  ? 'bg-brand-600 text-white shadow-sm ring-1 ring-brand-700/20'
                                  : 'text-slate-700 hover:bg-slate-200/60'
                              }`}
                            >
                              <div className={`mt-0.5 p-1 rounded-lg shrink-0 ${
                                isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-500 border border-slate-200'
                              }`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold truncate leading-tight">
                                    {tab.shortLabel}
                                  </span>
                                  {tab.badge && (
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200/70 text-slate-600'
                                    }`}>
                                      {tab.badge}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-[10px] truncate leading-tight mt-0.5 ${
                                  isActive ? 'text-brand-100' : 'text-slate-400'
                                }`}>
                                  {tab.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Audit Info Footer in Sidebar */}
                <div className="p-3 border-t border-slate-200/80 bg-white/70 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Last Saved:</span>
                    <span className="font-medium text-slate-600">{metadata.last_updated ? new Date(metadata.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ready'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admin User:</span>
                    <span className="font-medium text-slate-600 truncate max-w-[120px]">{metadata.updated_by}</span>
                  </div>
                </div>
              </aside>

              {/* Right Content Form Area */}
              <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/30">
                <div className="max-w-4xl mx-auto space-y-6">
                  {/* Active Section Header Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                        {React.createElement(activeTabDetails.icon, { className: 'w-5 h-5' })}
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">{activeTabDetails.label}</h2>
                        <p className="text-xs text-slate-500">{activeTabDetails.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-mono">Real-time sync</span>
                      <button
                        type="button"
                        onClick={() => setQuickDrawerOpen(true)}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-brand-600" />
                        Preview A4
                      </button>
                    </div>
                  </div>

                  {/* Form Container Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-7 shadow-xs space-y-6">
                    {/* ---------------- 1. COMPANY & HEADER ---------------- */}
                    {activeTab === 'company' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Enterprise Identity</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Company Name *" value={settings.company_name || ''} onChange={e => handleSettingChange('company_name', e.target.value)} placeholder="e.g. Cheran Soft Goods Pvt Ltd." required />
                            <FormField label="Legal Name (Optional)" value={settings.company_legal_name || ''} onChange={e => handleSettingChange('company_legal_name', e.target.value)} placeholder="Full registered company name" />
                            <FormField label="Company Logo URL / Path" value={settings.company_logo || ''} onChange={e => handleSettingChange('company_logo', e.target.value)} placeholder="https://example.com/logo.png" />
                            
                            <div className="flex flex-col gap-1">
                              <label className="text-xs font-semibold text-slate-700">Logo Alignment</label>
                              <select
                                value={settings.logo_position || 'left'}
                                onChange={e => handleSettingChange('logo_position', e.target.value)}
                                className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-brand-500"
                              >
                                <option value="left">Left Aligned</option>
                                <option value="center">Centered</option>
                                <option value="right">Right Aligned</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Location & Postal Address</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Address Line 1" value={settings.address_line1 || ''} onChange={e => handleSettingChange('address_line1', e.target.value)} />
                            <FormField label="Address Line 2" value={settings.address_line2 || ''} onChange={e => handleSettingChange('address_line2', e.target.value)} />
                            <FormField label="City" value={settings.city || ''} onChange={e => handleSettingChange('city', e.target.value)} />
                            <FormField label="District" value={settings.district || ''} onChange={e => handleSettingChange('district', e.target.value)} />
                            <FormField label="State" value={settings.state || ''} onChange={e => handleSettingChange('state', e.target.value)} />
                            <FormField label="Pincode" value={settings.pincode || ''} onChange={e => handleSettingChange('pincode', e.target.value)} />
                            <FormField label="Country" value={settings.country || 'India'} onChange={e => handleSettingChange('country', e.target.value)} />
                            <FormField label="Primary Phone" value={settings.phone || ''} onChange={e => handleSettingChange('phone', e.target.value)} />
                            <FormField label="Alternate Phone" value={settings.alt_phone || ''} onChange={e => handleSettingChange('alt_phone', e.target.value)} />
                            <FormField label="Corporate Email" value={settings.email || ''} onChange={e => handleSettingChange('email', e.target.value)} />
                            <FormField label="Official Website" value={settings.website || ''} onChange={e => handleSettingChange('website', e.target.value)} />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Taxation & Statutory Identifiers</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <FormField label="GSTIN" value={settings.gstin || ''} onChange={e => handleSettingChange('gstin', e.target.value)} />
                            <FormField label="PAN" value={settings.pan || ''} onChange={e => handleSettingChange('pan', e.target.value)} />
                            <FormField label="CIN" value={settings.cin || ''} onChange={e => handleSettingChange('cin', e.target.value)} />
                            <FormField label="Udyam / Reg. Number" value={settings.udyam || ''} onChange={e => handleSettingChange('udyam', e.target.value)} />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Document Header Titles</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField label="Document Title" value={settings.document_title || ''} onChange={e => handleSettingChange('document_title', e.target.value)} placeholder="FABRIC PRINTING PROCESS ORDER" />
                            <FormField label="Document Subtitle" value={settings.document_subtitle || ''} onChange={e => handleSettingChange('document_subtitle', e.target.value)} placeholder="PURCHASE ORDER" />
                            <FormField label="Document Prefix" value={settings.document_prefix || 'PO'} onChange={e => handleSettingChange('document_prefix', e.target.value)} />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Header Field Visibility Switches</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                              { key: 'show_logo', label: 'Display Logo' },
                              { key: 'show_gstin', label: 'Display GSTIN' },
                              { key: 'show_phone', label: 'Display Phone' },
                              { key: 'show_email', label: 'Display Email' },
                              { key: 'show_website', label: 'Display Website' },
                            ].map(tog => (
                              <label key={tog.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/90 cursor-pointer hover:bg-slate-100/70 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={settings[tog.key] === '1'}
                                  onChange={() => handleToggle(tog.key)}
                                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                                />
                                <span className="text-xs font-semibold text-slate-700">{tog.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 2. PO DOCUMENT ---------------- */}
                    {activeTab === 'document' && (
                      <div className="space-y-6">
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Custom Document Field Labels</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="PO Number Label" value={settings.po_number_label || 'PO No.'} onChange={e => handleSettingChange('po_number_label', e.target.value)} />
                            <FormField label="PO Date Label" value={settings.po_date_label || 'PO Date'} onChange={e => handleSettingChange('po_date_label', e.target.value)} />
                            <FormField label="Delivery Date Label" value={settings.delivery_date_label || 'Delivery Date'} onChange={e => handleSettingChange('delivery_date_label', e.target.value)} />
                            <FormField label="Reference Number Label" value={settings.reference_no_label || 'Ref No.'} onChange={e => handleSettingChange('reference_no_label', e.target.value)} />
                            <FormField label="Supplier Label" value={settings.supplier_label || 'Supplier'} onChange={e => handleSettingChange('supplier_label', e.target.value)} />
                            <FormField label="Status Label" value={settings.status_label || 'Status'} onChange={e => handleSettingChange('status_label', e.target.value)} />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <label className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.show_status === '1'}
                              onChange={() => handleToggle('show_status')}
                              className="w-4 h-4 rounded text-brand-600"
                            />
                            <div>
                              <span className="text-xs font-bold text-slate-800">Display Status Badge on PO Header</span>
                              <p className="text-[11px] text-slate-500">Supports: Draft, Pending Approval, Approved, Sent, Partially Received, Completed, Cancelled</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 3. SUPPLIER SECTION ---------------- */}
                    {activeTab === 'supplier' && (
                      <div className="space-y-6">
                        <FormField
                          label="Supplier Section Title"
                          value={settings.supplier_section_title || 'TO / SUPPLIER'}
                          onChange={e => handleSettingChange('supplier_section_title', e.target.value)}
                          placeholder="e.g. TO / SUPPLIER or VENDOR DETAILS"
                        />

                        <div className="pt-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Supplier Fields to Display on PO</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                              { key: 'show_supplier_code', label: 'Supplier Code' },
                              { key: 'show_supplier_name', label: 'Supplier Name' },
                              { key: 'show_supplier_address', label: 'Full Street Address' },
                              { key: 'show_supplier_contact', label: 'Contact Person (Attn)' },
                              { key: 'show_supplier_phone', label: 'Phone Number' },
                              { key: 'show_supplier_email', label: 'Email Address' },
                              { key: 'show_supplier_gstin', label: 'GSTIN Number' },
                              { key: 'show_supplier_pan', label: 'PAN Number' },
                              { key: 'show_supplier_state', label: 'State' },
                              { key: 'show_supplier_country', label: 'Country' },
                              { key: 'show_supplier_payment_terms', label: 'Payment Terms' },
                              { key: 'show_supplier_credit_days', label: 'Credit Days' },
                            ].map(f => (
                              <label key={f.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/90 cursor-pointer hover:bg-slate-100/70 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={settings[f.key] === '1'}
                                  onChange={() => handleToggle(f.key)}
                                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
                                />
                                <span className="text-xs font-medium text-slate-700">{f.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 4. ITEM TABLE (CATEGORY-BASED COLUMN MANAGER) ---------------- */}
                    {activeTab === 'item_table' && (
                      <div className="space-y-5">
                        {/* Header & Category Selector */}
                        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider bg-brand-500 text-white rounded">
                                  Category-Driven
                                </span>
                                <h3 className="text-sm font-bold text-slate-800">PO Category Column Manager</h3>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                PO item table columns are dynamically configured per PO Category. Select a category below to configure its columns.
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">Active Category:</label>
                              <select
                                value={selectedCategoryId || ''}
                                onChange={e => setSelectedCategoryId(Number(e.target.value) || e.target.value)}
                                className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-lg bg-white text-brand-700 shadow-xs focus:ring-2 focus:ring-brand-500 focus:outline-none"
                              >
                                {categories.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.name} ({c.code || 'PO'})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Quick Category Badges */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-3">
                            <span className="text-[11px] font-semibold text-slate-500 mr-1">Switch:</span>
                            {categories.map(c => {
                              const isSelected = selectedCategoryId === c.id;
                              const visibleCount = (c.fields || []).filter((f: any) => f.is_visible !== false && f.is_visible !== 0).length;
                              return (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => setSelectedCategoryId(c.id)}
                                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                                    isSelected
                                      ? 'bg-brand-600 text-white shadow-xs'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100/80'
                                  }`}
                                >
                                  <span>{c.name}</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                    isSelected ? 'bg-brand-700/80 text-white' : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {visibleCount} cols
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Category Columns Table */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                Columns for: <span className="text-brand-600 font-extrabold">{currentCategory?.name || 'Selected Category'}</span>
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                {currentCategoryFields.filter((f: any) => f.is_visible !== false && f.is_visible !== 0).length} of {currentCategoryFields.length} visible
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={addCategoryField}
                              className="px-3 py-1.5 text-xs font-bold bg-white text-brand-600 border border-brand-200 hover:bg-brand-50 rounded-lg shadow-xs transition-colors flex items-center gap-1"
                            >
                              + Add Custom Column to {currentCategory?.code || 'Category'}
                            </button>
                          </div>

                          {currentCategoryFields.length === 0 ? (
                            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-xs">
                              No columns defined for this category yet. Click &quot;Add Custom Column&quot; above to create columns.
                            </div>
                          ) : (
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold">
                                    <th className="py-2.5 px-3 text-center w-14">Visible</th>
                                    <th className="py-2.5 px-3 w-40 text-left">Field Key</th>
                                    <th className="py-2.5 px-3 text-left">Custom Label (Printed on PO)</th>
                                    <th className="py-2.5 px-3 w-28 text-center">Type</th>
                                    <th className="py-2.5 px-3 w-24 text-center">Required</th>
                                    <th className="py-2.5 px-3 text-center w-24">Reorder</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {currentCategoryFields.map((field: any, idx: number) => {
                                    const isVis = field.is_visible !== false && field.is_visible !== 0;
                                    return (
                                      <tr key={field.id || field.field_name || idx} className={isVis ? 'bg-white hover:bg-slate-50/50' : 'bg-slate-50/80 opacity-60'}>
                                        <td className="py-2.5 px-3 text-center">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(isVis)}
                                            onChange={e => handleCategoryFieldChange(idx, 'is_visible', e.target.checked ? 1 : 0)}
                                            className="w-4 h-4 rounded text-brand-600 cursor-pointer"
                                          />
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 font-semibold">
                                          {field.field_name}
                                        </td>
                                        <td className="py-2.5 px-3">
                                          <input
                                            type="text"
                                            value={field.field_label || ''}
                                            onChange={e => handleCategoryFieldChange(idx, 'field_label', e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 font-semibold text-slate-800"
                                            placeholder="Display Label on PO"
                                          />
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200">
                                            {field.field_type || 'text'}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          {field.is_required ? (
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Yes</span>
                                          ) : (
                                            <span className="text-[10px] text-slate-400">Optional</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <button
                                              type="button"
                                              disabled={idx === 0}
                                              onClick={() => moveCategoryField(idx, -1)}
                                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                                              title="Move column up"
                                            >
                                              <MoveUp className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={idx === currentCategoryFields.length - 1}
                                              onClick={() => moveCategoryField(idx, 1)}
                                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded hover:bg-slate-100"
                                              title="Move column down"
                                            >
                                              <MoveDown className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ---------------- 5. PROCESS DETAILS ---------------- */}
                    {activeTab === 'process' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Textile Processing Configuration</h3>
                            <p className="text-xs text-slate-500">Configure fabric parameters, finishing instructions, and stages.</p>
                          </div>
                          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.enable_process_section === '1'}
                              onChange={() => handleToggle('enable_process_section')}
                              className="w-4 h-4 rounded text-brand-600"
                            />
                            Enable Section
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            label="Section Title"
                            value={settings.process_section_title || 'PROCESS / PRODUCTION DETAILS'}
                            onChange={e => handleSettingChange('process_section_title', e.target.value)}
                          />
                          <FormField
                            label="Process Stages (Comma separated)"
                            value={settings.process_stages || ''}
                            onChange={e => handleSettingChange('process_stages', e.target.value)}
                            placeholder="Singeing, Mercerizing, Printing, Washing, Finishing, Inspection"
                          />
                        </div>

                        <FormField
                          as="textarea"
                          label="Process Description / General Instructions"
                          value={settings.process_description || ''}
                          onChange={e => handleSettingChange('process_description', e.target.value)}
                          rows={2}
                        />

                        <div className="pt-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Technical Process Fields</h3>
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                  <th className="py-2.5 px-3 text-center w-14">Show</th>
                                  <th className="py-2.5 px-3 w-44 text-left">Field Key</th>
                                  <th className="py-2.5 px-3 text-left">Custom Label</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {processFields.map((pf, idx) => (
                                  <tr key={pf.field_key}>
                                    <td className="py-2 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(pf.is_visible)}
                                        onChange={e => {
                                          const next = [...processFields];
                                          next[idx] = { ...next[idx], is_visible: e.target.checked ? 1 : 0 };
                                          setProcessFields(next);
                                        }}
                                        className="w-4 h-4 rounded text-brand-600 cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-2 px-3 font-mono text-slate-500">{pf.field_key}</td>
                                    <td className="py-2 px-3">
                                      <input
                                        type="text"
                                        value={pf.label}
                                        onChange={e => {
                                          const next = [...processFields];
                                          next[idx] = { ...next[idx], label: e.target.value };
                                          setProcessFields(next);
                                        }}
                                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 font-medium"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 6. TAX & TOTALS ---------------- */}
                    {activeTab === 'tax_totals' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-700">Tax Mode</label>
                            <select
                              value={settings.tax_mode || 'CGST + SGST'}
                              onChange={e => handleSettingChange('tax_mode', e.target.value)}
                              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="CGST + SGST">CGST + SGST (Intra-state)</option>
                              <option value="IGST">IGST (Inter-state)</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-700">Tax Display Style</label>
                            <select
                              value={settings.tax_display || 'Percentage + Amount'}
                              onChange={e => handleSettingChange('tax_display', e.target.value)}
                              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="Percentage + Amount">Percentage + Amount</option>
                              <option value="Amount only">Amount only</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-700">Currency Symbol</label>
                            <input
                              type="text"
                              value={settings.currency_symbol || '₹'}
                              onChange={e => handleSettingChange('currency_symbol', e.target.value)}
                              className="px-3 py-2 text-xs border border-slate-300 rounded-lg"
                            />
                          </div>
                        </div>

                        <div className="pt-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Total Rows & Custom Labels</h3>
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                                  <th className="py-2.5 px-3 text-center w-16">Visible</th>
                                  <th className="py-2.5 px-3 w-44 text-left">Summary Item</th>
                                  <th className="py-2.5 px-3 text-left">Custom Display Label</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {[
                                  { key: 'show_subtotal', labelKey: 'subtotal_label', name: 'Subtotal', defLabel: 'Subtotal' },
                                  { key: 'show_discount', labelKey: 'discount_label', name: 'Discount', defLabel: 'Discount' },
                                  { key: 'show_taxable_amount', labelKey: 'taxable_amount_label', name: 'Taxable Amount', defLabel: 'Taxable Amount' },
                                  { key: 'show_cgst', labelKey: 'cgst_label', name: 'CGST', defLabel: 'CGST' },
                                  { key: 'show_sgst', labelKey: 'sgst_label', name: 'SGST', defLabel: 'SGST' },
                                  { key: 'show_igst', labelKey: 'igst_label', name: 'IGST', defLabel: 'IGST' },
                                  { key: 'show_other_charges', labelKey: 'other_charges_label', name: 'Other Charges', defLabel: 'Other Charges' },
                                  { key: 'show_round_off', labelKey: 'round_off_label', name: 'Round Off', defLabel: 'Round Off' },
                                  { key: 'show_grand_total', labelKey: 'grand_total_label', name: 'Grand Total', defLabel: 'Grand Total' },
                                ].map(row => (
                                  <tr key={row.key}>
                                    <td className="py-2 px-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={settings[row.key] === '1'}
                                        onChange={() => handleToggle(row.key)}
                                        className="w-4 h-4 rounded text-brand-600 cursor-pointer"
                                      />
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-slate-800">{row.name}</td>
                                    <td className="py-2 px-3">
                                      <input
                                        type="text"
                                        value={settings[row.labelKey] ?? row.defLabel}
                                        onChange={e => handleSettingChange(row.labelKey, e.target.value)}
                                        className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500"
                                      />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 7. AMOUNT IN WORDS ---------------- */}
                    {activeTab === 'amount_words' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Indian Numbering System Engine</h3>
                            <p className="text-xs text-slate-500">Automatically translates Grand Total into Indian Lakhs & Crores.</p>
                          </div>
                          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.enable_amount_in_words === '1'}
                              onChange={() => handleToggle('enable_amount_in_words')}
                              className="w-4 h-4 rounded text-brand-600"
                            />
                            Enable Generator
                          </label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            label="Section Title"
                            value={settings.amount_in_words_title || 'AMOUNT IN WORDS'}
                            onChange={e => handleSettingChange('amount_in_words_title', e.target.value)}
                          />
                          <FormField
                            label="Prefix"
                            value={settings.amount_in_words_prefix || 'RUPEES'}
                            onChange={e => handleSettingChange('amount_in_words_prefix', e.target.value)}
                            placeholder="e.g. RUPEES"
                          />
                          <FormField
                            label="Suffix"
                            value={settings.amount_in_words_suffix || 'ONLY'}
                            onChange={e => handleSettingChange('amount_in_words_suffix', e.target.value)}
                            placeholder="e.g. ONLY"
                          />

                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-slate-700">Letter Casing</label>
                            <select
                              value={settings.amount_in_words_case || 'UPPERCASE'}
                              onChange={e => handleSettingChange('amount_in_words_case', e.target.value)}
                              className="px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                            >
                              <option value="UPPERCASE">UPPERCASE (RUPEES ONE LAKH...)</option>
                              <option value="Title Case">Title Case (Rupees One Lakh...)</option>
                              <option value="Sentence Case">Sentence Case (Rupees one lakh...)</option>
                            </select>
                          </div>
                        </div>

                        <div className="p-4 bg-brand-50/50 border border-brand-200/80 rounded-xl">
                          <p className="text-[10px] uppercase font-bold text-brand-600 font-mono">Live Generator Sample Output</p>
                          <p className="text-xs font-black text-brand-950 mt-1">
                            {settings.amount_in_words_prefix || 'RUPEES'} FIVE LAKH NINETY THOUSAND EIGHT HUNDRED EIGHTY-SEVEN {settings.amount_in_words_suffix || 'ONLY'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 8. TERMS & CONDITIONS ---------------- */}
                    {activeTab === 'terms' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Contractual Terms & Conditions</h3>
                            <p className="text-xs text-slate-500">Add, edit, reorder or toggle active clauses printed on the PO.</p>
                          </div>
                          <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={addTerm} className="text-xs">
                            Add New Term
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {terms.map((term, idx) => (
                            <div key={term.term_key || idx} className={`p-4 rounded-xl border transition-all ${
                              term.is_active ? 'bg-white border-slate-200/90 shadow-xs' : 'bg-slate-50 border-slate-200 opacity-60'
                            }`}>
                              <div className="flex items-center justify-between gap-3 mb-2.5">
                                <div className="flex items-center gap-2.5 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(term.is_active)}
                                    onChange={e => updateTerm(idx, 'is_active', e.target.checked ? 1 : 0)}
                                    className="w-4 h-4 rounded text-brand-600 cursor-pointer"
                                  />
                                  <span className="font-mono text-xs text-slate-400 font-bold">#{idx + 1}</span>
                                  <input
                                    type="text"
                                    value={term.title}
                                    onChange={e => updateTerm(idx, 'title', e.target.value)}
                                    className="px-2.5 py-1 text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 flex-1 max-w-sm"
                                    placeholder="Clause Title"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => deleteTerm(idx)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                  title="Delete clause"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <textarea
                                value={term.content}
                                onChange={e => updateTerm(idx, 'content', e.target.value)}
                                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 text-slate-700"
                                rows={2}
                                placeholder="Enter condition terms..."
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ---------------- 9. SIGNATURES ---------------- */}
                    {activeTab === 'signature' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Signatory Authority Blocks</h3>
                            <p className="text-xs text-slate-500">Configure signature boxes printed at the bottom of the order.</p>
                          </div>
                          <Button icon={<Plus className="w-3.5 h-3.5" />} onClick={addSignature} className="text-xs">
                            Add Signature Block
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {signatures.map((sig, idx) => (
                            <div key={sig.id || idx} className="p-4 bg-white border border-slate-200/90 rounded-xl shadow-xs space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-brand-700 uppercase tracking-wider font-mono">
                                  Signatory Box #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deleteSignature(idx)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                                  title="Delete block"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <FormField
                                label="Block Title"
                                value={sig.title}
                                onChange={e => updateSignature(idx, 'title', e.target.value)}
                                placeholder="e.g. Prepared By, Approved By"
                              />

                              <div className="grid grid-cols-2 gap-2">
                                <FormField
                                  label="Name"
                                  value={sig.name || ''}
                                  onChange={e => updateSignature(idx, 'name', e.target.value)}
                                />
                                <FormField
                                  label="Designation"
                                  value={sig.designation || ''}
                                  onChange={e => updateSignature(idx, 'designation', e.target.value)}
                                />
                              </div>

                              <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100 text-xs">
                                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sig.show_signature_line)}
                                    onChange={e => updateSignature(idx, 'show_signature_line', e.target.checked ? 1 : 0)}
                                    className="w-4 h-4 rounded text-brand-600"
                                  />
                                  Sig Line
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sig.show_date)}
                                    onChange={e => updateSignature(idx, 'show_date', e.target.checked ? 1 : 0)}
                                    className="w-4 h-4 rounded text-brand-600"
                                  />
                                  Date Box
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-medium">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(sig.show_stamp)}
                                    onChange={e => updateSignature(idx, 'show_stamp', e.target.checked ? 1 : 0)}
                                    className="w-4 h-4 rounded text-brand-600"
                                  />
                                  Company Stamp
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ---------------- 10. FOOTER ---------------- */}
                    {activeTab === 'footer' && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Legal Jurisdiction & Footer Notice</h3>
                            <p className="text-xs text-slate-500">Notice printed at the base of every page.</p>
                          </div>
                          <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.show_footer === '1'}
                              onChange={() => handleToggle('show_footer')}
                              className="w-4 h-4 rounded text-brand-600"
                            />
                            Show Footer
                          </label>
                        </div>

                        <FormField
                          label="Footer Declaration / Generation Notice"
                          value={settings.footer_text || ''}
                          onChange={e => handleSettingChange('footer_text', e.target.value)}
                          placeholder="This is a computer generated purchase order."
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            label="Footer Line 1 (Jurisdiction Notice)"
                            value={settings.footer_line1 || ''}
                            onChange={e => handleSettingChange('footer_line1', e.target.value)}
                            placeholder="Subject to Karur Jurisdiction."
                          />
                          <FormField
                            label="Page Number Format"
                            value={settings.footer_page_format || 'Page {current} of {total}'}
                            onChange={e => handleSettingChange('footer_page_format', e.target.value)}
                          />
                        </div>

                        <div className="pt-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Display In Footer</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                              { key: 'footer_show_company_name', label: 'Company Name' },
                              { key: 'footer_show_address', label: 'Address' },
                              { key: 'footer_show_gstin', label: 'GSTIN' },
                              { key: 'footer_show_website', label: 'Website' },
                              { key: 'footer_show_page_number', label: 'Page Number' },
                              { key: 'footer_show_generated_date', label: 'Generated Date' },
                              { key: 'footer_show_generated_by', label: 'Generated By' },
                            ].map(f => (
                              <label key={f.key} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/90 cursor-pointer hover:bg-slate-100/70 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={settings[f.key] === '1'}
                                  onChange={() => handleToggle(f.key)}
                                  className="w-4 h-4 rounded text-brand-600"
                                />
                                <span className="text-xs font-medium text-slate-700">{f.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 11. PRINT & LAYOUT ---------------- */}
                    {activeTab === 'print_layout' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <FormField label="Paper Size" value={settings.paper_size || 'A4'} onChange={e => handleSettingChange('paper_size', e.target.value)} disabled />
                          <FormField label="Orientation" value={settings.orientation || 'Portrait'} onChange={e => handleSettingChange('orientation', e.target.value)} />
                          <FormField label="Top Margin" value={settings.margin_top || '10mm'} onChange={e => handleSettingChange('margin_top', e.target.value)} />
                          <FormField label="Bottom Margin" value={settings.margin_bottom || '10mm'} onChange={e => handleSettingChange('margin_bottom', e.target.value)} />
                          <FormField label="Left Margin" value={settings.margin_left || '10mm'} onChange={e => handleSettingChange('margin_left', e.target.value)} />
                          <FormField label="Right Margin" value={settings.margin_right || '10mm'} onChange={e => handleSettingChange('margin_right', e.target.value)} />
                          <FormField label="Font Family" value={settings.font_family || 'Poppins, sans-serif'} onChange={e => handleSettingChange('font_family', e.target.value)} />
                          <FormField label="Base Font Size" value={settings.font_size || '12px'} onChange={e => handleSettingChange('font_size', e.target.value)} />
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Brand Color Palette</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs font-semibold text-slate-700">Primary Color</label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  value={settings.primary_color || '#1e3a8a'}
                                  onChange={e => handleSettingChange('primary_color', e.target.value)}
                                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                                />
                                <input
                                  type="text"
                                  value={settings.primary_color || '#1e3a8a'}
                                  onChange={e => handleSettingChange('primary_color', e.target.value)}
                                  className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700">Secondary Color</label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  value={settings.secondary_color || '#0f766e'}
                                  onChange={e => handleSettingChange('secondary_color', e.target.value)}
                                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                                />
                                <input
                                  type="text"
                                  value={settings.secondary_color || '#0f766e'}
                                  onChange={e => handleSettingChange('secondary_color', e.target.value)}
                                  className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700">Table Header BG</label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  value={settings.table_header_bg || '#f1f5f9'}
                                  onChange={e => handleSettingChange('table_header_bg', e.target.value)}
                                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                                />
                                <input
                                  type="text"
                                  value={settings.table_header_bg || '#f1f5f9'}
                                  onChange={e => handleSettingChange('table_header_bg', e.target.value)}
                                  className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-semibold text-slate-700">Body Text Color</label>
                              <div className="flex items-center gap-2 mt-1">
                                <input
                                  type="color"
                                  value={settings.text_color || '#1e293b'}
                                  onChange={e => handleSettingChange('text_color', e.target.value)}
                                  className="w-9 h-9 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                                />
                                <input
                                  type="text"
                                  value={settings.text_color || '#1e293b'}
                                  onChange={e => handleSettingChange('text_color', e.target.value)}
                                  className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ---------------- 12. NUMBERING ---------------- */}
                    {activeTab === 'numbering' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <FormField
                            label="PO Prefix"
                            value={settings.numbering_prefix || 'PO'}
                            onChange={e => handleSettingChange('numbering_prefix', e.target.value)}
                            placeholder="e.g. PO or CSG-PO"
                          />
                          <FormField
                            label="Financial Year"
                            value={settings.numbering_financial_year || '2026-27'}
                            onChange={e => handleSettingChange('numbering_financial_year', e.target.value)}
                            placeholder="e.g. 2026-27"
                          />
                          <FormField
                            label="Separator Character"
                            value={settings.numbering_separator || '-'}
                            onChange={e => handleSettingChange('numbering_separator', e.target.value)}
                          />
                          <FormField
                            label="Starting Sequence Number"
                            value={settings.numbering_starting_number || '1'}
                            onChange={e => handleSettingChange('numbering_starting_number', e.target.value)}
                          />
                          <FormField
                            label="Minimum Digits Padding"
                            value={settings.numbering_minimum_digits || '5'}
                            onChange={e => handleSettingChange('numbering_minimum_digits', e.target.value)}
                          />
                          <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer p-2.5 bg-slate-50 rounded-xl border border-slate-200 w-full">
                              <input
                                type="checkbox"
                                checked={settings.numbering_reset_every_fy === '1'}
                                onChange={() => handleToggle('numbering_reset_every_fy')}
                                className="w-4 h-4 rounded text-brand-600"
                              />
                              Reset Every Financial Year
                            </label>
                          </div>
                        </div>

                        {/* Live Number Preview Card */}
                        <div className="p-5 bg-slate-900 rounded-2xl text-white flex items-center justify-between shadow-sm">
                          <div>
                            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono">Next Generated PO Number Preview</p>
                            <p className="text-xl font-black font-mono text-emerald-400 mt-1">
                              {settings.numbering_prefix || 'PO'}{settings.numbering_separator || '-'}{settings.numbering_financial_year || '2026-27'}{settings.numbering_separator || '-'}{String(settings.numbering_starting_number || '1').padStart(parseInt(settings.numbering_minimum_digits || '5', 10), '0')}
                            </p>
                          </div>
                          <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30">
                            Valid Pattern
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </main>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* VIEW MODE: DEDICATED A4 DOCUMENT STUDIO (FULL SCREEN OR SPLIT RIGHT)     */}
        {/* ----------------------------------------------------------------------- */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`flex-1 flex flex-col bg-slate-200/90 overflow-hidden ${
            viewMode === 'split' ? 'w-full lg:w-1/2 border-l border-slate-300' : 'w-full'
          }`}>
            {/* Studio Workbench Control Bar */}
            <div className="px-5 py-2.5 bg-white border-b border-slate-300 flex items-center justify-between gap-3 shrink-0 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-brand-50 text-brand-800 text-xs font-bold border border-brand-200 flex items-center gap-1.5">
                  <FileCheck2 className="w-3.5 h-3.5 text-brand-600" />
                  A4 Print-Ready Preview
                </span>
                <span className="text-xs text-slate-500 hidden sm:inline">
                  210 × 297 mm • Standard Sheet
                </span>
              </div>

              {/* Category Selector for Live Preview */}
              <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">Preview Category:</span>
                <select
                  value={selectedCategoryId || ''}
                  onChange={e => setSelectedCategoryId(Number(e.target.value) || e.target.value)}
                  className="text-xs font-bold bg-white text-brand-700 px-2 py-1 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    const target = viewMode === 'split' ? setSplitZoom : setZoomLevel;
                    target(z => Math.max(z - 10, 40));
                  }}
                  className="p-1 hover:bg-white rounded text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1 px-1 text-xs font-bold font-mono text-slate-700">
                  {viewMode === 'split' ? splitZoom : zoomLevel}%
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const target = viewMode === 'split' ? setSplitZoom : setZoomLevel;
                    target(z => Math.min(z + 10, 150));
                  }}
                  className="p-1 hover:bg-white rounded text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>

                <div className="h-3 w-px bg-slate-300 mx-1"></div>

                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === 'split') setSplitZoom(68);
                    else setZoomLevel(100);
                  }}
                  className="px-2 py-0.5 text-[10px] font-bold rounded hover:bg-white text-slate-600"
                  title="Reset to 100%"
                >
                  Reset
                </button>
              </div>

              {/* View mode toggle button if in split */}
              {viewMode === 'split' ? (
                <button
                  onClick={() => setViewMode('preview')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                  title="Maximize Document Studio"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  Full Preview
                </button>
              ) : (
                <button
                  onClick={() => setViewMode('settings')}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  Back to Settings
                </button>
              )}
            </div>

            {/* A4 Workbench Canvas */}
            <div className="flex-1 overflow-auto p-6 flex flex-col items-center bg-slate-200/90 relative">
              <div 
                className="transition-transform duration-200 origin-top shadow-2xl rounded-sm my-4 bg-white"
                style={{
                  transform: `scale(${(viewMode === 'split' ? splitZoom : zoomLevel) / 100})`,
                  transformOrigin: 'top center',
                  width: '210mm',
                  minHeight: '297mm',
                  boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(15, 23, 42, 0.1)'
                }}
              >
                <DynamicPOTemplate
                  settings={settings}
                  columns={columns}
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  processFields={processFields}
                  terms={terms}
                  signatures={signatures}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. QUICK SLIDE-OVER A4 PREVIEW DRAWER (FOR INSTANT INSPECTION)            */}
      {/* ========================================================================= */}
      {quickDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in">
          <div className="w-full max-w-4xl h-full bg-slate-200/95 flex flex-col shadow-2xl border-l border-slate-300">
            {/* Drawer Header */}
            <div className="px-5 py-3 bg-white border-b border-slate-300 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-brand-600" />
                  <h3 className="text-sm font-bold text-slate-900">Live A4 Preview</h3>
                </div>
                
                <div className="flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500">Category:</span>
                  <select
                    value={selectedCategoryId || ''}
                    onChange={e => setSelectedCategoryId(Number(e.target.value) || e.target.value)}
                    className="text-xs font-bold bg-transparent text-brand-700 focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  onClick={() => setQuickDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-auto p-6 flex flex-col items-center">
              <div 
                className="shadow-2xl rounded-sm my-2 bg-white"
                style={{
                  transform: 'scale(0.85)',
                  transformOrigin: 'top center',
                  width: '210mm',
                  minHeight: '297mm',
                  boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(15, 23, 42, 0.1)'
                }}
              >
                <DynamicPOTemplate
                  settings={settings}
                  columns={columns}
                  categories={categories}
                  selectedCategoryId={selectedCategoryId}
                  processFields={processFields}
                  terms={terms}
                  signatures={signatures}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Restore Defaults */}
      <Modal
        open={confirmRestoreOpen}
        onClose={() => setConfirmRestoreOpen(false)}
        title="Restore Default PO Template Settings"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRestoreOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleRestoreDefaults}>
              Yes, Restore Defaults
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 p-2">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Are you sure you want to restore default template settings?</p>
            <p>This will reset all custom company info, columns, process fields, terms, and signature blocks back to the standard Cheran Soft Goods factory template.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
