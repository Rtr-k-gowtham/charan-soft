// src/components/purchase/DynamicPOTemplate.tsx
import React from 'react';
import { 
  POTemplateColumn, 
  POTemplateProcessField, 
  POTemplateTerm, 
  POTemplateSignature, 
  PurchaseOrder,
  Category,
  CategoryField
} from '../../types';
import { formatAmountInWords } from '../../lib/numberToWords';
import defaultCompanyLogo from '../../assets/logo.png';

export interface DynamicPOTemplateProps {
  settings: Record<string, string>;
  columns?: POTemplateColumn[];
  processFields: POTemplateProcessField[];
  terms: POTemplateTerm[];
  signatures: POTemplateSignature[];
  poData?: Partial<PurchaseOrder> & {
    supplier?: any;
    items?: any[];
    process_data?: Record<string, string>;
  };
  categories?: Category[];
  selectedCategoryId?: number | string;
  categoryColumnConfigs?: Record<string, any>;
  isPrintPreview?: boolean;
}

export default function DynamicPOTemplate({
  settings,
  columns = [],
  processFields,
  terms,
  signatures,
  poData,
  categories = [],
  selectedCategoryId,
  categoryColumnConfigs = {},
  isPrintPreview = false,
}: DynamicPOTemplateProps) {
  // Safe helper to read setting
  const get = (key: string, def = '') => settings[key] !== undefined && settings[key] !== '' ? settings[key] : def;
  const isTrue = (key: string, def = '1') => get(key, def) === '1' || get(key, def) === 'true';

  // Determine active category (from real PO or preview selector)
  const activeCatId = poData?.category_id || selectedCategoryId || (categories.length > 0 ? categories[0].id : 2);
  const currentCat = categories.find(c => String(c.id) === String(activeCatId));
  const categoryName = currentCat?.name || (poData as any)?.category_name || 'FABRIC WEAVING PROCESS ORDER';

  // Generate category-based sample items for preview
  const getCategorySampleItems = (catName: string) => {
    const cn = (catName || '').toUpperCase();
    if (cn.includes('ACCESSORY')) {
      return [
        {
          s_no: 1,
          serial_no: 1,
          item_code: 'ACC-BTN-18L',
          item_description: 'Poly 4-Hole Horn Buttons 18L (Dyed to Match)',
          description: 'Poly 4-Hole Horn Buttons 18L (Dyed to Match)',
          color: 'Midnight Navy',
          size: '18L',
          qty: 5000,
          quantity: 5000,
          uom: 'Gross',
          rate: 45.00,
          taxable_amount: 225000.00,
          tax_percent: 12,
          tax_amount: 27000.00,
          net_amount: 252000.00,
        },
        {
          s_no: 2,
          serial_no: 2,
          item_code: 'ACC-ZIP-YKK',
          item_description: 'YKK Nylon Coil Invisible Zipper',
          description: 'YKK Nylon Coil Invisible Zipper',
          color: 'Black 580',
          size: '16 Inch',
          qty: 2400,
          quantity: 2400,
          uom: 'PCS',
          rate: 18.50,
          taxable_amount: 44400.00,
          tax_percent: 12,
          tax_amount: 5328.00,
          net_amount: 49728.00,
        }
      ];
    }

    if (cn.includes('WEAVING ORDER') && !cn.includes('PROCESS')) {
      return [
        {
          s_no: 1,
          serial_no: 1,
          order_no: 'ORD-2026-WEAV1',
          description: '100% Cotton Dobby Loom Woven Base Fabric',
          item_description: '100% Cotton Dobby Loom Woven Base Fabric',
          design: 'Diamond Jacquard',
          size: '60"',
          color: 'Bleached White',
          qty: 3500,
          quantity: 3500,
          uom: 'MTR',
          rate: 165.00,
          taxable_amount: 577500.00,
          tax_percent: 5,
          tax_amount: 28875.00,
          net_amount: 606375.00,
        },
        {
          s_no: 2,
          serial_no: 2,
          order_no: 'ORD-2026-WEAV2',
          description: '40s Combed Poplin Weave Striped Fabric',
          item_description: '40s Combed Poplin Weave Striped Fabric',
          design: 'Stripe 0.5cm',
          size: '58"',
          color: 'Sky Blue / White',
          qty: 2200,
          quantity: 2200,
          uom: 'MTR',
          rate: 145.00,
          taxable_amount: 319000.00,
          tax_percent: 5,
          tax_amount: 15950.00,
          net_amount: 334950.00,
        }
      ];
    }

    // Default Fabric Weaving / Dyeing / Process Orders
    return [
      {
        s_no: 1,
        serial_no: 1,
        order_no: 'ORD-2026-089',
        item_code: 'MAT-FAB-CTN40',
        item_description: '100% Combed Cotton Single Jersey (Bio-Washed)',
        description: '100% Combed Cotton Single Jersey (Bio-Washed)',
        hsn_sac: '5208',
        fabric_type: 'Single Jersey',
        width: '68"',
        construction: '40s Combed',
        design: 'Floral Bloom 26',
        color: 'Navy Blue / Coral',
        process: 'Pigment Print & Soft Finish',
        qty: 1200,
        quantity: 1200,
        uom: 'KG',
        kgs: 1200,
        weight_kgs: 1200,
        rate: 260.00,
        discount: 0,
        tax_percent: 5,
        taxable_amount: 312000.00,
        cgst: 7800.00,
        sgst: 7800.00,
        igst: 0.00,
        tax_amount: 15600.00,
        net_amount: 327600.00,
      },
      {
        s_no: 2,
        serial_no: 2,
        order_no: 'ORD-2026-090',
        item_code: 'MAT-FAB-CTN30',
        item_description: 'Cotton Satin 300TC Weave Base Fabric',
        description: 'Cotton Satin 300TC Weave Base Fabric',
        hsn_sac: '5208',
        fabric_type: 'Cotton Satin',
        width: '72"',
        construction: '300TC Satin',
        design: 'Geo Abstract',
        color: 'Olive Green',
        process: 'Reactive Print',
        qty: 850,
        quantity: 850,
        uom: 'KG',
        kgs: 850,
        weight_kgs: 850,
        rate: 295.00,
        discount: 0,
        tax_percent: 5,
        taxable_amount: 250750.00,
        cgst: 6268.75,
        sgst: 6268.75,
        igst: 0.00,
        tax_amount: 12537.50,
        net_amount: 263287.50,
      }
    ];
  };

  // Fallback sample data if no real PO is passed (for live preview in settings)
  const defaultSamplePo = {
    po_number: `${get('numbering_prefix', 'PO')}-${get('numbering_financial_year', '2026-27')}-00045`,
    po_date: new Date().toISOString().split('T')[0],
    delivery_due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    status: 'APPROVED',
    category_name: categoryName,
    supplier_name: 'M/s. M.R.C. MILLS PRIVATE LIMITED',
    supplier_phone: '+91 98430 54566',
    supplier: {
      code: 'VEND-DYE-001',
      name: 'M/s. M.R.C. MILLS PRIVATE LIMITED',
      address: 'SF No. 412/1B, Trichy Main Road, Puliyur Post, Karur - 639114, Tamil Nadu',
      contact_person: 'Mr. R. Chandrasekaran',
      phone: '+91 98430 54566',
      email: 'sales@mrcmills.com',
      gstin: '33AAGCM5692R1Z0',
      pan: 'AAGCM5692R',
      state: 'Tamil Nadu',
      country: 'India',
      payment_terms: '30 Days Credit',
      credit_days: 30,
    },
    items: getCategorySampleItems(categoryName),
    process_data: {
      fabric_type: '100% Combed Cotton Knit / Satin',
      fabric_construction: '40s Combed Yarn (Bio-Polished)',
      width: '68" / 72" Open Width',
      gsm: '160 - 180 GSM',
      count: '40s / 300TC',
      design: 'Cheran SS26 Global Collection',
      color: 'Pantone 19-4052 Classic Navy',
      printing_type: 'Rotary Screen Printing',
      printing_method: 'Reactive Dyes with Color Fastness 4-5',
      process_route: 'Singeing -> Bleaching -> Printing -> Steaming -> Washing -> Stenter Finish',
      finishing: 'Silicone Softener & Compact Finish',
      quality_requirement: 'AATCC 4-Point Inspection, Shrinkage under 3%',
      special_instructions: 'Strictly avoid bowing/skewing exceeding 1.5%. Deliver on cardboard tubes wrapped in HDPE.'
    }
  };

  const po = poData ? {
    ...defaultSamplePo,
    ...poData,
    supplier: poData.supplier || {
      name: poData.supplier_name || defaultSamplePo.supplier.name,
      code: (poData as any).supplier_code || 'VEND-001',
      phone: (poData as any).supplier_phone || '',
      email: (poData as any).supplier_email || '',
      address: (poData as any).supplier_address || 'Tirupur, Tamil Nadu',
      contact_person: (poData as any).supplier_contact || '',
      gstin: (poData as any).supplier_gstin || '',
      payment_terms: '30 Days Credit',
      credit_days: 30,
    },
    items: (poData.items && poData.items.length > 0) ? poData.items : defaultSamplePo.items,
  } : defaultSamplePo;

  // Build CATEGORY-BASED COLUMNS dynamically
  let activeColumns: POTemplateColumn[] = [];
  if (currentCat && currentCat.fields && currentCat.fields.length > 0) {
    activeColumns = currentCat.fields
      .filter(f => Boolean(f.is_visible) && f.field_name !== 'order_no' && f.field_name !== 'order_number')
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map((f, idx) => {
        const key = f.field_name;
        const label = f.field_label || f.field_name;
        let width = 'auto';
        let alignment: 'left' | 'center' | 'right' = 'left';

        if (key === 's_no' || key === 'serial_no') {
          width = '35px'; alignment = 'center';
        } else if (key === 'order_no' || key === 'item_code') {
          width = '90px'; alignment = 'left';
        } else if (key === 'item_description' || key === 'description') {
          width = '200px'; alignment = 'left';
        } else if (key === 'design' || key === 'color' || key === 'size') {
          width = '80px'; alignment = 'left';
        } else if (key === 'uom') {
          width = '55px'; alignment = 'center';
        } else if (key === 'qty' || key === 'quantity' || key === 'kgs' || key === 'weight_kgs') {
          width = '70px'; alignment = 'right';
        } else if (key === 'rate' || key === 'taxable_amount' || key === 'cgst' || key === 'sgst' || key === 'igst' || key === 'tax_amount' || key === 'net_amount') {
          width = '85px'; alignment = 'right';
        } else if (key === 'tax_percent') {
          width = '55px'; alignment = 'right';
        }

        // Custom config override if available
        const override = (columns || []).find(c => c.column_key === key);
        return {
          column_key: key,
          label: override?.label || label,
          is_visible: override?.is_visible !== undefined ? override.is_visible : 1,
          display_order: override?.display_order !== undefined ? override.display_order : (f.sort_order || idx + 1),
          width: override?.width || width,
          alignment: override?.alignment || alignment,
        };
      });
  } else {
    // Fallback to configured columns if category has no custom fields
    activeColumns = (columns || [])
      .filter(c => (c.is_visible == 1 || c.is_visible === true) && c.column_key !== 'order_no' && c.column_key !== 'order_number')
      .sort((a, b) => a.display_order - b.display_order);
  }


  // Active terms sorted
  const activeTerms = (terms || [])
    .filter(t => t.is_active == 1 || t.is_active === true)
    .sort((a, b) => a.display_order - b.display_order);

  // Signatures sorted
  const activeSignatures = (signatures || [])
    .slice()
    .sort((a, b) => a.display_order - b.display_order);

  // Calculations
  const items: any[] = ((po.items as any[]) || []);
  const subtotal = items.reduce((s: number, it: any) => s + (Number(it.taxable_amount) || (Number(it.quantity || it.qty || 0) * Number(it.rate || 0))), 0);
  const discountTotal = items.reduce((s: number, it: any) => s + (Number(it.discount) || 0), 0);
  const taxableTotal = subtotal - discountTotal;
  const isIGST = get('tax_mode', 'CGST + SGST') === 'IGST';
  const totalTax = items.reduce((s: number, it: any) => s + (Number(it.tax_amount) || (Number(it.taxable_amount || 0) * (Number(it.tax_percent || 0) / 100)) || 0), 0);
  const cgstTotal = isIGST ? 0 : totalTax / 2;
  const sgstTotal = isIGST ? 0 : totalTax / 2;
  const igstTotal = isIGST ? totalTax : 0;
  const grandTotal = taxableTotal + totalTax;

  const curSymbol = get('currency_symbol', '₹');
  const decimals = parseInt(get('decimal_places', '2'), 10);
  const fmtMoney = (n: number) => `${curSymbol}${n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

  const amountInWords = formatAmountInWords(
    grandTotal,
    get('amount_in_words_prefix', 'RUPEES'),
    get('amount_in_words_suffix', 'ONLY'),
    get('amount_in_words_case', 'UPPERCASE') as any
  );

  // Styling properties from settings
  const primaryColor = get('primary_color', '#1e3a8a');
  const textColor = get('text_color', '#1e293b');
  const tableHeaderBg = get('table_header_bg', '#f1f5f9');
  const rawFont = get('font_family', "'Poppins', sans-serif");
  const fontFamily = (!rawFont || rawFont.toLowerCase().includes('inter')) ? "'Poppins', sans-serif" : rawFont;

  return (
    <div 
      id="printable-po-document"
      className="bg-white text-slate-800 shadow-lg border border-slate-200 transition-all po-template-container"
      style={{
        fontFamily,
        color: textColor,
        width: '100%',
        maxWidth: '210mm', // standard A4 width
        minHeight: isPrintPreview ? '297mm' : 'auto',
        margin: '0 auto',
        padding: `${get('margin_top', '8mm')} ${get('margin_right', '10mm')} ${get('margin_bottom', '8mm')} ${get('margin_left', '10mm')}`,
        boxSizing: 'border-box',
        fontSize: get('font_size', '11.5px'),
        lineHeight: get('line_height', '1.35'),
      }}
    >
      {/* ================================================================= */}
      {/* 1. COMPANY HEADER                                                 */}
      {/* ================================================================= */}
      <div 
        className="po-header-section border-b-2 pb-2.5 mb-2.5" 
        style={{ borderColor: primaryColor, breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {/* Company Header: Center Aligned */}
        <div className="flex flex-col items-center justify-center text-center w-full">
          {/* Centered Brand Logo */}
          {isTrue('show_logo') && (
            <div className="mb-2 flex justify-center items-center w-full">
              <img 
                src={get('company_logo') || defaultCompanyLogo} 
                alt="Cheran Soft Goods Pvt Ltd" 
                className="h-12 sm:h-14 max-h-16 max-w-[420px] object-contain mx-auto" 
              />
            </div>
          )}

          {/* Registered Address */}
          <p className="text-[10px] text-slate-600 leading-tight max-w-xl mx-auto">
            {[
              get('address_line1', '1-A, Muthaladampatty South'), 
              get('address_line2', 'Cheran Nagar, Thanthondimalai Post'), 
              get('city', 'Karur'), 
              get('district', 'Karur'), 
              get('state', 'Tamil Nadu'), 
              get('pincode', '639 005'), 
              get('country', 'India')
            ].filter(Boolean).join(', ')}
          </p>

          {/* Contact Details */}
          <div className="flex flex-wrap justify-center items-center gap-x-3.5 gap-y-0.5 text-[9.5px] text-slate-600 mt-1">
            {isTrue('show_phone') && get('phone', '+91 4324 220000') && (
              <span><strong>Phone:</strong> {get('phone', '+91 4324 220000')}{get('alt_phone') ? ` / ${get('alt_phone')}` : ''}</span>
            )}
            {isTrue('show_email') && get('email', 'info@cheransoftgoods.in') && (
              <span><strong>Email:</strong> {get('email', 'info@cheransoftgoods.in')}</span>
            )}
            {isTrue('show_website') && get('website', 'www.cheransoftgoods.in') && (
              <span><strong>Web:</strong> {get('website', 'www.cheransoftgoods.in')}</span>
            )}
          </div>

          {/* Statutory Identifiers */}
          {isTrue('show_gstin') && get('gstin', '33AAFCC2831H1Z1') && (
            <div className="flex flex-wrap justify-center items-center gap-x-3.5 gap-y-0.5 text-[9.5px] text-slate-700 mt-0.5 font-medium">
              <span className="text-brand-900"><strong>GSTIN:</strong> {get('gstin', '33AAFCC2831H1Z1')}</span>
            </div>
          )}
        </div>

        {/* Document Title Banner */}
        <div className="mt-2.5 pt-1.5 border-t border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase" style={{ color: primaryColor }}>
              {get('document_title', categoryName || 'FABRIC PRINTING PROCESS ORDER')}
            </h2>
            {get('document_subtitle') && (
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                {get('document_subtitle', 'PURCHASE ORDER')}
              </p>
            )}
          </div>
          {isTrue('show_status') && po.status && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-300 bg-slate-50 text-slate-700">
              {get('status_label', 'Status')}: {po.status}
            </span>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. PO DOCUMENT & SUPPLIER SECTION                                 */}
      {/* ================================================================= */}
      <div 
        className="po-meta-section grid grid-cols-2 gap-3 mb-2.5 text-[10.5px]"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {/* Supplier Box */}
        <div className="border border-slate-200 rounded p-2.5 bg-slate-50/40">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: primaryColor }}>
            {get('supplier_section_title', 'TO / SUPPLIER')}
          </p>
          <p className="font-bold text-xs text-slate-900 leading-snug">
            {isTrue('show_supplier_name') && (po.supplier?.name || po.supplier_name || '{{supplier_name}}')}
          </p>
          {isTrue('show_supplier_code') && po.supplier?.code && (
            <p className="text-[10px] font-mono text-slate-500">Code: {po.supplier.code}</p>
          )}
          {isTrue('show_supplier_address') && po.supplier?.address && (
            <p className="text-[10px] text-slate-600 mt-1 leading-snug whitespace-pre-line">
              {po.supplier.address}
            </p>
          )}
          <div className="mt-1 pt-1 border-t border-slate-200/70 text-[10px] text-slate-600 space-y-0.5">
            {isTrue('show_supplier_contact') && po.supplier?.contact_person && (
              <p><strong>Attn:</strong> {po.supplier.contact_person}</p>
            )}
            {isTrue('show_supplier_phone') && (po.supplier?.phone || po.supplier_phone) && (
              <p><strong>Phone:</strong> {po.supplier?.phone || po.supplier_phone}</p>
            )}
            {isTrue('show_supplier_email') && po.supplier?.email && (
              <p><strong>Email:</strong> {po.supplier.email}</p>
            )}
            {isTrue('show_supplier_gstin') && po.supplier?.gstin && (
              <p className="font-semibold text-slate-800"><strong>GSTIN:</strong> {po.supplier.gstin}</p>
            )}
            {isTrue('show_supplier_pan') && po.supplier?.pan && (
              <p><strong>PAN:</strong> {po.supplier.pan}</p>
            )}
            {isTrue('show_supplier_payment_terms') && po.supplier?.payment_terms && (
              <p><strong>Terms:</strong> {po.supplier.payment_terms} ({po.supplier.credit_days || 30} Days)</p>
            )}
          </div>
        </div>

        {/* PO Meta Box */}
        <div className="border border-slate-200 rounded p-2.5 bg-slate-50/40 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center pb-1 border-b border-slate-200">
              <span className="font-bold text-slate-600">{get('po_number_label', 'PO No.')}:</span>
              <span className="font-mono font-bold text-xs" style={{ color: primaryColor }}>
                {po.po_number || '{{po_number}}'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{get('po_date_label', 'PO Date')}:</span>
              <span className="font-semibold text-slate-800">{po.po_date || '{{po_date}}'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{get('delivery_date_label', 'Delivery Date')}:</span>
              <span className="font-semibold text-slate-800">{po.delivery_due_date || '{{delivery_date}}'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{get('reference_no_label', 'Ref No.')}:</span>
              <span className="font-mono text-slate-700">{(po as any).reference_number || 'CSG/PROC/26-08'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{get('supplier_label', 'Supplier')}:</span>
              <span className="font-medium text-slate-700 truncate max-w-[170px]">{po.supplier_name || '—'}</span>
            </div>
          </div>

          {/* Transport / Delivery Mode */}
          <div className="mt-2 pt-1 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
            <span>Place of Supply: <strong>{get('state', 'Tamil Nadu')} (33)</strong></span>
            <span>Delivery: <strong>Door Delivery / Mill Gate</strong></span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. DYNAMIC ITEM TABLE                                             */}
      {/* ================================================================= */}
      <div className="mb-2.5">
        <table 
          className="w-full border-collapse" 
          style={{ 
            fontSize: get('table_font_size', '10px'),
            border: `${get('border_width', '1px')} ${get('border_style', 'solid')} #cbd5e1`,
            pageBreakInside: 'auto'
          }}
        >
          <thead style={{ display: 'table-header-group' }}>
            <tr style={{ backgroundColor: tableHeaderBg, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
              {activeColumns.map(col => (
                <th
                  key={col.column_key}
                  style={{
                    width: col.width,
                    textAlign: col.alignment,
                    padding: '4px 6px',
                    border: '1px solid #cbd5e1',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '9px',
                    letterSpacing: '0.02em',
                    color: '#334155'
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row: any, rIdx) => (
              <tr 
                key={rIdx} 
                className={rIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                {activeColumns.map(col => {
                  let val = (row as any)[col.column_key];

                  // Resolve aliases across different category field naming
                  if (val === undefined || val === null || val === '') {
                    if (col.column_key === 's_no' || col.column_key === 'serial_no') val = rIdx + 1;
                    else if (col.column_key === 'item_description') val = row.description || row.item_name || row.name;
                    else if (col.column_key === 'description') val = row.item_description || row.item_name || row.name;
                    else if (col.column_key === 'qty') val = row.quantity;
                    else if (col.column_key === 'quantity') val = row.qty;
                    else if (col.column_key === 'kgs') val = row.weight_kgs || row.weight_kg;
                    else if (col.column_key === 'weight_kgs') val = row.kgs || row.weight_kg;
                    else if (col.column_key === 'item_code') val = row.code || row.material_code;
                    else if (col.column_key === 'tax_percent') val = row.tax_percent ?? row.tax_rate ?? 5;
                    else if (col.column_key === 'taxable_amount') val = row.taxable_amount || (Number(row.quantity || row.qty || 0) * Number(row.rate || 0));
                    else if (col.column_key === 'tax_amount') val = row.tax_amount || (Number(row.taxable_amount || 0) * (Number(row.tax_percent || 5) / 100));
                    else if (col.column_key === 'net_amount') val = row.net_amount || (Number(row.taxable_amount || 0) + Number(row.tax_amount || 0));
                  }

                  // Custom render formatting
                  if (col.column_key === 'serial_no' || col.column_key === 's_no') {
                    val = rIdx + 1;
                  } else if (col.column_key === 'rate' || col.column_key === 'discount') {
                    val = Number(val || 0).toFixed(decimals);
                  } else if (col.column_key === 'taxable_amount' || col.column_key === 'cgst' || col.column_key === 'sgst' || col.column_key === 'igst' || col.column_key === 'tax_amount' || col.column_key === 'net_amount') {
                    val = Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
                  } else if (col.column_key === 'quantity' || col.column_key === 'qty' || col.column_key === 'weight_kgs' || col.column_key === 'kgs') {
                    val = Number(val || 0).toLocaleString('en-IN');
                  } else if (col.column_key === 'tax_percent') {
                    val = `${Number(val || 0)}%`;
                  }

                  return (
                    <td
                      key={col.column_key}
                      style={{
                        textAlign: col.alignment,
                        padding: '4px 6px',
                        border: '1px solid #e2e8f0',
                        fontWeight: col.column_key === 'net_amount' || col.column_key === 'item_description' ? 600 : 400,
                      }}
                    >
                      {val ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>


      {/* ================================================================= */}
      {/* 5. TAX SUMMARY & AMOUNT IN WORDS                                  */}
      {/* ================================================================= */}
      <div 
        className="po-totals-section grid grid-cols-12 gap-3 mb-2.5 items-start"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        {/* Left: Amount in Words */}
        <div className="col-span-7 border border-slate-200 rounded p-2 bg-slate-50/40">
          {isTrue('enable_amount_in_words') && (
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                {get('amount_in_words_title', 'AMOUNT IN WORDS')}
              </p>
              <p className="text-[10.5px] font-bold tracking-tight leading-snug" style={{ color: primaryColor }}>
                {amountInWords}
              </p>
            </div>
          )}

          {/* Bank / Statutory note */}
          <div className="mt-1.5 pt-1 border-t border-slate-200/70 text-[9px] text-slate-500 leading-tight">
            <p>• Tax is charged as applicable under GST reverse charge / forward charge provisions.</p>
            <p>• E-Way bill must mention this PO Number for warehouse gate pass generation.</p>
          </div>
        </div>

        {/* Right: Calculated Totals Table */}
        <div className="col-span-5 border border-slate-200 rounded overflow-hidden">
          <table className="w-full text-[10px]">
            <tbody>
              {isTrue('show_subtotal') && (
                <tr className="border-b border-slate-100">
                  <td className="py-0.5 px-2 text-slate-600">{get('subtotal_label', 'Subtotal')}:</td>
                  <td className="py-0.5 px-2 text-right font-mono font-medium">{fmtMoney(subtotal)}</td>
                </tr>
              )}

              {isTrue('show_discount') && discountTotal > 0 && (
                <tr className="border-b border-slate-100 text-green-700">
                  <td className="py-0.5 px-2">{get('discount_label', 'Discount')}:</td>
                  <td className="py-0.5 px-2 text-right font-mono font-medium">- {fmtMoney(discountTotal)}</td>
                </tr>
              )}

              {isTrue('show_taxable_amount') && (
                <tr className="border-b border-slate-100 font-semibold bg-slate-50/50">
                  <td className="py-0.5 px-2 text-slate-700">{get('taxable_amount_label', 'Taxable Amount')}:</td>
                  <td className="py-0.5 px-2 text-right font-mono text-slate-900">{fmtMoney(taxableTotal)}</td>
                </tr>
              )}

              {/* GST lines */}
              {!isIGST && isTrue('show_cgst') && (
                <tr className="border-b border-slate-100 text-slate-600">
                  <td className="py-0.5 px-2">{get('cgst_label', 'CGST')} (2.5%):</td>
                  <td className="py-0.5 px-2 text-right font-mono">{fmtMoney(cgstTotal)}</td>
                </tr>
              )}

              {!isIGST && isTrue('show_sgst') && (
                <tr className="border-b border-slate-100 text-slate-600">
                  <td className="py-0.5 px-2">{get('sgst_label', 'SGST')} (2.5%):</td>
                  <td className="py-0.5 px-2 text-right font-mono">{fmtMoney(sgstTotal)}</td>
                </tr>
              )}

              {isIGST && isTrue('show_igst') && (
                <tr className="border-b border-slate-100 text-slate-600">
                  <td className="py-0.5 px-2">{get('igst_label', 'IGST')} (5%):</td>
                  <td className="py-0.5 px-2 text-right font-mono">{fmtMoney(igstTotal)}</td>
                </tr>
              )}

              {isTrue('show_round_off') && (
                <tr className="border-b border-slate-100 text-slate-500 text-[9.5px]">
                  <td className="py-0.5 px-2">{get('round_off_label', 'Round Off')}:</td>
                  <td className="py-0.5 px-2 text-right font-mono">₹0.00</td>
                </tr>
              )}

              {isTrue('show_grand_total') && (
                <tr className="font-bold text-xs" style={{ backgroundColor: tableHeaderBg }}>
                  <td className="py-1.5 px-2 uppercase tracking-wide" style={{ color: primaryColor }}>
                    {get('grand_total_label', 'Grand Total')}:
                  </td>
                  <td className="py-1.5 px-2 text-right font-mono text-sm" style={{ color: primaryColor }}>
                    {fmtMoney(grandTotal)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 6. TERMS & CONDITIONS                                             */}
      {/* ================================================================= */}
      {activeTerms.length > 0 && (
        <div 
          className="po-terms-section mb-2 border border-slate-200 rounded p-2 bg-slate-50/20 text-[9px]"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <p className="font-bold uppercase tracking-wider mb-1 text-[9.5px]" style={{ color: primaryColor }}>
            TERMS & CONDITIONS
          </p>
          <ol className={`list-decimal list-inside space-y-0.5 text-slate-600 leading-snug ${activeTerms.length > 4 ? 'grid grid-cols-2 gap-x-4' : ''}`}>
            {activeTerms.map(term => (
              <li key={term.term_key || term.id}>
                <strong>{term.title}:</strong> {term.content}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* ================================================================= */}
      {/* 7. SIGNATURE BLOCKS                                               */}
      {/* ================================================================= */}
      {activeSignatures.length > 0 && (
        <div 
          className="po-signatures-section mb-2 mt-2.5 pt-2 border-t border-slate-200"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <div 
            className="grid gap-2 text-center"
            style={{ 
              gridTemplateColumns: `repeat(${Math.min(activeSignatures.length, 4)}, minmax(0, 1fr))` 
            }}
          >
            {activeSignatures.map(sig => (
              <div 
                key={sig.id || sig.title} 
                className="po-signature-box border border-slate-200 rounded p-1.5 flex flex-col justify-between bg-white min-h-[72px]"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700">
                  {sig.title}
                </p>

                {/* Stamp space */}
                {Boolean(sig.show_stamp) && (
                  <div className="my-0.5 h-3 flex items-center justify-center">
                    <span className="text-[7.5px] text-slate-300 border border-dashed border-slate-300 rounded px-1.5 py-0.2 uppercase tracking-widest">
                      SEAL / STAMP
                    </span>
                  </div>
                )}

                <div className="mt-auto pt-1">
                  {Boolean(sig.show_signature_line) && (
                    <div className="border-t border-slate-300 w-4/5 mx-auto mb-1" />
                  )}
                  {sig.name && (
                    <p className="text-[9.5px] font-bold text-slate-900 leading-tight">{sig.name}</p>
                  )}
                  {sig.designation && (
                    <p className="text-[8.5px] text-slate-500 leading-tight">{sig.designation}</p>
                  )}
                  {Boolean(sig.show_date) && (
                    <p className="text-[8px] text-slate-400 mt-0.5">Date: ____________</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 8. FOOTER                                                         */}
      {/* ================================================================= */}
      {isTrue('show_footer') && (
        <div 
          className="po-footer-section pt-1.5 border-t border-slate-200 text-[8.5px] text-slate-500 flex flex-row items-center justify-between gap-1"
          style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
        >
          <div>
            {get('footer_text') && <p>{get('footer_text')}</p>}
            {get('footer_line1') && <p className="font-medium text-slate-600">{get('footer_line1')}</p>}
            <div className="flex gap-2 text-[8px] text-slate-400 mt-0.5">
              {isTrue('footer_show_company_name') && <span>{get('company_name')}</span>}
              {isTrue('footer_show_gstin') && get('gstin') && <span>GSTIN: {get('gstin')}</span>}
              {isTrue('footer_show_website') && get('website') && <span>{get('website')}</span>}
            </div>
          </div>

          <div className="text-right shrink-0">
            {isTrue('footer_show_page_number') && (
              <p className="font-semibold text-slate-700">
                {get('footer_page_format', 'Page {current} of {total}').replace('{current}', '1').replace('{total}', '1')}
              </p>
            )}
            {isTrue('footer_show_generated_date') && (
              <p className="text-[8px] text-slate-400">
                Generated: {new Date().toLocaleString('en-IN')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
