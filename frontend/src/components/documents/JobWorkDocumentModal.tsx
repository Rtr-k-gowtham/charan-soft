// src/components/documents/JobWorkDocumentModal.tsx
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { 
  Printer, 
  Download, 
  CheckCircle2, 
  AlertTriangle,
  Loader2
} from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import defaultCompanyLogo from '../../assets/logo.png';
import { printHtmlElement, downloadElementAsPdf } from '../../lib/pdfUtils';
import { formatAmountInWords } from '../../lib/numberToWords';
import { api } from '../../lib/api';
import { POTemplateData } from '../../types';

export type JobWorkDocType = 
  | 'DYEING_OUTWARD' 
  | 'DYEING_INWARD' 
  | 'EMBROIDERY_OUTWARD' 
  | 'EMBROIDERY_INWARD';

export interface JobWorkDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  docType: JobWorkDocType;
  order: any;              // Production Order
  itemData: any;           // DyeingOrder, DyeingReceipt, EmbroideryJobOrder, or EmbroideryReceipt
  receiptList?: any[];     // All receipts for cumulative calculation
  supplier?: any;          // Vendor/Mill details
  companySettings?: any;
}

const fmt = (n: number | string | undefined | null, decimals = 0) =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(n || 0));

export default function JobWorkDocumentModal({
  isOpen,
  onClose,
  docType,
  order,
  itemData,
  supplier,
  companySettings,
}: JobWorkDocumentModalProps) {
  const docRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [templateData, setTemplateData] = useState<POTemplateData | null>(null);

  // Fetch PO template settings if available so document adheres to user customizations
  useEffect(() => {
    let isMounted = true;
    api.getPOTemplateSettings()
      .then((data) => {
        if (isMounted && data) {
          setTemplateData(data);
        }
      })
      .catch(() => {
        // Fallback gracefully to default template settings
      });
    return () => { isMounted = false; };
  }, []);

  // Safe helper to read setting from PO template configuration
  const settings = templateData?.settings || {};
  const getSetting = (key: string, def = '') => 
    settings[key] !== undefined && settings[key] !== '' ? settings[key] : def;

  // Primary colors & styles identical to DynamicPOTemplate
  const primaryColor = getSetting('primary_color', '#1e3a8a');
  const textColor = getSetting('text_color', '#1e293b');
  const tableHeaderBg = getSetting('table_header_bg', '#f1f5f9');
  const rawFont = getSetting('font_family', "'Poppins', sans-serif");
  const fontFamily = (!rawFont || rawFont.toLowerCase().includes('inter')) ? "'Poppins', sans-serif" : rawFont;

  // Registered Karur Company Details from PO Template
  const company = useMemo(() => {
    return {
      name: getSetting('company_name', companySettings?.company_name || 'Cheran Soft Goods Pvt Ltd.'),
      legalName: getSetting('company_legal_name', companySettings?.company_legal_name || 'Cheran Soft Goods Private Limited'),
      addressLine1: getSetting('address_line1', '1-A, Muthaladampatty South'),
      addressLine2: getSetting('address_line2', 'Cheran Nagar, Thanthondimalai Post'),
      city: getSetting('city', 'Karur'),
      district: getSetting('district', 'Karur'),
      state: getSetting('state', 'Tamil Nadu'),
      pincode: getSetting('pincode', '639 005'),
      country: getSetting('country', 'India'),
      phone: getSetting('phone', companySettings?.phone || '+91 4324 220000'),
      altPhone: getSetting('alt_phone', ''),
      email: getSetting('email', companySettings?.email || 'info@cheransoftgoods.in'),
      website: getSetting('website', 'www.cheransoftgoods.in'),
      gstin: getSetting('gstin', companySettings?.gstin || '33AAFCC2831H1Z1'),
      logo: getSetting('company_logo') || companySettings?.company_logo || defaultCompanyLogo,
    };
  }, [templateData, companySettings]);

  // Document metadata & labels
  const docConfig = useMemo(() => {
    switch (docType) {
      case 'DYEING_OUTWARD':
        return {
          modalTitle: `Dyeing Process Order: ${itemData?.dyeing_order_no || 'DYE-ORDER'}`,
          docTitle: 'FABRIC DYEING PROCESS ORDER',
          docSubtitle: 'JOB WORK / PROCESS OUTWARD CHALLAN',
          code: itemData?.dyeing_order_no || 'DYE-ORDER',
          filename: `DYE-ORDER-${itemData?.dyeing_order_no || 'JOB'}`,
          status: itemData?.status || 'APPROVED',
          isOutward: true,
          isInward: false,
        };
      case 'DYEING_INWARD':
        return {
          modalTitle: `Dyed Fabric Inward Receipt: ${itemData?.receipt_no || 'DYE-RECEIPT'}`,
          docTitle: 'DYED FABRIC INWARD RECEIPT & INSPECTION REPORT',
          docSubtitle: 'MATERIAL INWARD & QUALITY CLEARANCE REPORT',
          code: itemData?.receipt_no || 'DYE-RECEIPT',
          filename: `DYE-RECEIPT-${itemData?.receipt_no || 'GRN'}`,
          status: itemData?.qc_status || itemData?.shade_matching_status || 'VERIFIED',
          isOutward: false,
          isInward: true,
        };
      case 'EMBROIDERY_OUTWARD':
        return {
          modalTitle: `Embroidery Job Order: ${itemData?.job_order_number || 'EMB-ORDER'}`,
          docTitle: 'EMBROIDERY JOB WORK ORDER',
          docSubtitle: 'GARMENT EMBROIDERY OUTWARD CHALLAN',
          code: itemData?.job_order_number || 'EMB-ORDER',
          filename: `EMB-ORDER-${itemData?.job_order_number || 'JOB'}`,
          status: itemData?.status || 'ACTIVE',
          isOutward: true,
          isInward: false,
        };
      case 'EMBROIDERY_INWARD':
        return {
          modalTitle: `Embroidery Inward Receipt: ${itemData?.receipt_number || 'EMB-RECEIPT'}`,
          docTitle: 'EMBROIDERY INWARD RECEIPT & QUALITY INSPECTION REPORT',
          docSubtitle: 'GARMENT PANELS INWARD & QC RECONCILIATION',
          code: itemData?.receipt_number || 'EMB-RECEIPT',
          filename: `EMB-RECEIPT-${itemData?.receipt_number || 'GRN'}`,
          status: itemData?.qc_status || 'ACCEPTED',
          isOutward: false,
          isInward: true,
        };
      default:
        return {
          modalTitle: 'Job Work Document',
          docTitle: 'TEXTILE JOB WORK DOCUMENT',
          docSubtitle: 'PROCESS ORDER',
          code: 'DOC-001',
          filename: 'JOB-WORK-DOC',
          status: 'PENDING',
          isOutward: true,
          isInward: false,
        };
    }
  }, [docType, itemData]);

  // Print Handler matching PurchaseOrders.tsx
  const handlePrint = () => {
    const el = document.getElementById('printable-po-document');
    const docCode = docConfig.code || 'JOB-WORK';
    if (el) {
      printHtmlElement(el, docCode);
    } else {
      const origTitle = document.title;
      document.title = docCode;
      window.print();
      setTimeout(() => { document.title = origTitle; }, 1000);
    }
  };

  // PDF Download Action
  const handleDownloadPdf = async () => {
    const el = document.getElementById('printable-po-document');
    if (!el) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(el, docConfig.filename, {
        marginMm: 8,
        quality: 0.95,
      });
    } catch (err: any) {
      console.error('Failed to download PDF:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Vendor / Mill details
  const millName = itemData?.dyeing_mill_name || itemData?.vendor_name || supplier?.name || 'M/s. M.R.C. MILLS PRIVATE LIMITED';
  const millCode = supplier?.code || (docType.includes('DYEING') ? 'VEND-DYE-001' : 'VEND-EMB-001');
  const millAddress = supplier?.address || supplier?.city || 'SF No. 412/1B, Trichy Main Road, Puliyur Post, Karur - 639114, Tamil Nadu';
  const millPhone = supplier?.phone || '+91 98430 54566';
  const millEmail = supplier?.email || 'vendor@cheransoftgoods.in';
  const millGstin = supplier?.gstin || '33AAGCM5692R1Z0';

  // Process / Outward calculations
  const defaultRate = Number(itemData?.rate || itemData?.rate_per_piece || 45);
  const outwardItems = useMemo(() => {
    if (!itemData) return [];
    if (docType === 'DYEING_OUTWARD') {
      const raw = Array.isArray(itemData.items) && itemData.items.length > 0 
        ? itemData.items 
        : [{ color_name: 'Navy Blue', planned_quantity: itemData.total_fabric_quantity || 1000, pantone_code: '19-4052 TCX', hex_code: '#1e3a8a' }];
      return raw.map((it: any, idx: number) => {
        const qty = Number(it.planned_quantity || it.quantity || 0);
        const rate = Number(it.rate || itemData.rate || defaultRate);
        const taxable = qty * rate;
        const taxAmount = taxable * 0.05;
        const netAmount = taxable + taxAmount;
        return {
          s_no: idx + 1,
          item_code: itemData.fabric_code || 'FAB-CTN-40S',
          description: itemData.fabric_name || '100% Cotton Single Jersey Fabric',
          color: it.color_name || 'Standard Color',
          pantone: it.pantone_code || 'Standard',
          hex: it.hex_code || '#3b82f6',
          qty,
          uom: itemData.uom || 'KG',
          rate,
          taxable,
          taxPercent: 5,
          taxAmount,
          netAmount,
          notes: it.notes || 'Strict shade matching against approved lab dip',
        };
      });
    }

    if (docType === 'EMBROIDERY_OUTWARD') {
      const raw = Array.isArray(itemData.items) && itemData.items.length > 0
        ? itemData.items
        : [{ garment_piece: 'Chest Panel', color: 'Navy', size: 'L', quantity_dispatched: itemData.total_pieces || 1200 }];
      return raw.map((it: any, idx: number) => {
        const qty = Number(it.quantity_dispatched || it.quantity || it.planned_quantity || 0);
        const rate = Number(it.rate || itemData.rate_per_piece || defaultRate);
        const taxable = qty * rate;
        const taxAmount = taxable * 0.05;
        const netAmount = taxable + taxAmount;
        return {
          s_no: idx + 1,
          item_code: it.product_code || 'EMB-GAR-01',
          description: it.item_name || it.garment_piece || 'Cut Garment Front Piece',
          color: it.color || 'Standard',
          size: it.size || 'Free Size',
          design: itemData.artwork_code || itemData.placement || 'Left Chest Logo',
          qty,
          uom: 'PCS',
          rate,
          taxable,
          taxPercent: 5,
          taxAmount,
          netAmount,
        };
      });
    }

    return [];
  }, [docType, itemData, defaultRate]);

  // Inward calculations
  const inwardItems = useMemo(() => {
    if (!itemData) return [];
    if (docType === 'DYEING_INWARD') {
      const dispQty = Number(itemData.dispatched_quantity || itemData.total_fabric_quantity || 1000);
      const recQty = Number(itemData.received_quantity || 0);
      const accQty = Number(itemData.accepted_quantity || recQty);
      const rejQty = Number(itemData.rejected_quantity || 0);
      const diff = dispQty > 0 ? (((dispQty - recQty) / dispQty) * 100).toFixed(1) : '0.0';
      return [
        {
          s_no: 1,
          item_code: itemData.fabric_code || 'FAB-CTN-40S',
          description: itemData.fabric_name || '100% Cotton Single Jersey Fabric (Dyed)',
          color: itemData.color_name || 'Pantone Approved Shade',
          dispatched_qty: dispQty,
          received_qty: recQty,
          accepted_qty: accQty,
          rejected_qty: rejQty,
          diff_percent: `${diff}%`,
          uom: itemData.uom || 'KG',
          qc_status: itemData.shade_matching_status || itemData.qc_status || 'Approved',
          remarks: itemData.defect_remarks || 'Passed shade & 4-point visual inspection',
        }
      ];
    }

    if (docType === 'EMBROIDERY_INWARD') {
      const dispQty = Number(itemData.quantity_dispatched || itemData.dispatched_quantity || 1200);
      const recQty = Number(itemData.quantity_received || itemData.received_quantity || 0);
      const passQty = Number(itemData.quantity_passed || itemData.accepted_quantity || recQty);
      const rejQty = Number(itemData.quantity_rejected || itemData.rejected_quantity || 0);
      const balQty = Math.max(0, dispQty - recQty);
      return [
        {
          s_no: 1,
          item_code: itemData.artwork_code || 'EMB-GAR-01',
          description: itemData.placement ? `Garment Pieces (${itemData.placement})` : 'Embroidered Front Garment Panels',
          color: itemData.color || 'Navy',
          size: itemData.size || 'Assorted Sizes',
          dispatched_qty: dispQty,
          received_qty: recQty,
          accepted_qty: passQty,
          rejected_qty: rejQty,
          balance_qty: balQty,
          uom: 'PCS',
          qc_status: itemData.qc_status || (rejQty > 0 ? 'Passed with Rejections' : 'Passed Clean'),
          remarks: itemData.qc_remarks || 'Stitch density and tension verified',
        }
      ];
    }

    return [];
  }, [docType, itemData]);

  // Financial totals for outward order
  const totalOutwardQty = outwardItems.reduce((acc: number, it: any) => acc + it.qty, 0);
  const totalTaxable = outwardItems.reduce((acc: number, it: any) => acc + it.taxable, 0);
  const totalTax = outwardItems.reduce((acc: number, it: any) => acc + it.taxAmount, 0);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const grandTotal = totalTaxable + totalTax;

  const amountInWords = formatAmountInWords(
    grandTotal > 0 ? grandTotal : (totalOutwardQty * defaultRate * 1.05),
    getSetting('amount_in_words_prefix', 'RUPEES'),
    getSetting('amount_in_words_suffix', 'ONLY'),
    getSetting('amount_in_words_case', 'UPPERCASE') as any
  );

  // Return null only AFTER all hooks are evaluated
  if (!isOpen || !itemData) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={docConfig.modalTitle}
      subtitle="Standard A4 Document Preview • Dynamic PO Template"
      size="4xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-xs text-slate-400">
            Layout driven dynamically by PO Template Settings
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadPdf}
              disabled={downloading}
              icon={downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            >
              {downloading ? 'Downloading...' : 'PDF'}
            </Button>
            <Button 
              icon={<Printer className="w-3.5 h-3.5" />} 
              onClick={handlePrint}
            >
              Print / Save A4 PDF
            </Button>
          </div>
        </div>
      }
    >
      <div className="overflow-y-auto max-h-[78vh] p-4 sm:p-6 bg-slate-200/90 rounded-lg flex justify-center">
        <div className="w-full flex justify-center shadow-lg rounded">
          {/* Printable A4 Document Paper (Identical to DynamicPOTemplate) */}
          <div
            ref={docRef}
            id="printable-po-document"
            className="bg-white text-slate-800 shadow-lg border border-slate-200 transition-all po-template-container"
            style={{
              fontFamily,
              color: textColor,
              width: '100%',
              maxWidth: '210mm',
              minHeight: '297mm',
              margin: '0 auto',
              padding: '8mm 10mm 8mm 10mm',
              boxSizing: 'border-box',
              fontSize: '11.5px',
              lineHeight: '1.35',
            }}
          >
            {/* ================================================================= */}
            {/* 1. COMPANY HEADER                                                 */}
            {/* ================================================================= */}
            <div 
              className="po-header-section border-b-2 pb-2.5 mb-2.5" 
              style={{ borderColor: primaryColor, breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="flex flex-col items-center justify-center text-center w-full">
                {/* Centered Brand Logo */}
                <div className="mb-2 flex justify-center items-center w-full">
                  <img 
                    src={company.logo} 
                    alt="Cheran Soft Goods Pvt Ltd" 
                    className="h-12 sm:h-14 max-h-16 max-w-[420px] object-contain mx-auto" 
                    crossOrigin="anonymous"
                  />
                </div>

                {/* Registered Address */}
                <p className="text-[10px] text-slate-600 leading-tight max-w-xl mx-auto">
                  {[
                    company.addressLine1, 
                    company.addressLine2, 
                    company.city, 
                    company.district, 
                    company.state, 
                    company.pincode, 
                    company.country
                  ].filter(Boolean).join(', ')}
                </p>

                {/* Contact Details */}
                <div className="flex flex-wrap justify-center items-center gap-x-3.5 gap-y-0.5 text-[9.5px] text-slate-600 mt-1">
                  <span><strong>Phone:</strong> {company.phone}{company.altPhone ? ` / ${company.altPhone}` : ''}</span>
                  <span><strong>Email:</strong> {company.email}</span>
                  <span><strong>Web:</strong> {company.website}</span>
                </div>

                {/* Statutory Identifiers */}
                <div className="flex flex-wrap justify-center items-center gap-x-3.5 gap-y-0.5 text-[9.5px] text-slate-700 mt-0.5 font-medium">
                  <span className="text-brand-900"><strong>GSTIN:</strong> {company.gstin}</span>
                </div>
              </div>

              {/* Document Title Banner */}
              <div className="mt-2.5 pt-1.5 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold tracking-wider uppercase font-sans" style={{ color: primaryColor }}>
                    {docConfig.docTitle}
                  </h2>
                  <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                    {docConfig.docSubtitle}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-300 bg-slate-50 text-slate-700">
                  Status: {docConfig.status}
                </span>
              </div>
            </div>

            {/* ================================================================= */}
            {/* 2. PO DOCUMENT & SUPPLIER SECTION                                 */}
            {/* ================================================================= */}
            <div 
              className="po-meta-section grid grid-cols-2 gap-3 mb-2.5 text-[10.5px]"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              {/* Supplier / Mill Box */}
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50/40">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: primaryColor }}>
                  {docType.includes('DYEING') ? 'TO / DYEING PROCESSOR / MILL' : 'TO / EMBROIDERY UNIT / VENDOR'}
                </p>
                <p className="font-bold text-xs text-slate-900 leading-snug">
                  {millName}
                </p>
                <p className="text-[10px] font-mono text-slate-500">Code: {millCode}</p>
                <p className="text-[10px] text-slate-600 mt-1 leading-snug whitespace-pre-line">
                  {millAddress}
                </p>
                <div className="mt-1 pt-1 border-t border-slate-200/70 text-[10px] text-slate-600 space-y-0.5">
                  <p><strong>Attn:</strong> {supplier?.contact_person || 'Unit Production Incharge'}</p>
                  <p><strong>Phone:</strong> {millPhone}</p>
                  <p><strong>Email:</strong> {millEmail}</p>
                  <p className="font-semibold text-slate-800"><strong>GSTIN:</strong> {millGstin}</p>
                  <p><strong>Terms:</strong> 30 Days Credit (Job Work per Section 143)</p>
                </div>
              </div>

              {/* Order Meta Box */}
              <div className="border border-slate-200 rounded p-2.5 bg-slate-50/40 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                    <span className="font-bold text-slate-600">
                      {docConfig.isInward ? 'Receipt No:' : 'Order / PO No:'}
                    </span>
                    <span className="font-mono font-bold text-xs" style={{ color: primaryColor }}>
                      {docConfig.code}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">
                      {docConfig.isInward ? 'Receipt Date:' : 'Order Date:'}
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {itemData?.order_date || itemData?.receipt_date || new Date().toISOString().split('T')[0]}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">
                      {docConfig.isInward ? 'Gate Inward Date:' : 'Delivery Due Date:'}
                    </span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {itemData?.expected_delivery_date || itemData?.expected_return_date || itemData?.receipt_date || 'Prompt Delivery'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Delivery Challan No:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {itemData?.challan_no || itemData?.delivery_challan_no || itemData?.vendor_challan_no || itemData?.challan_number || 'CH-CSG-GATE-01'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Production Order:</span>
                    <span className="font-mono text-slate-700 font-medium truncate max-w-[170px]" title={order?.title}>
                      {order?.order_number || itemData?.production_order_number || 'ORD-5516'} {order?.title ? `• ${order.title}` : ''}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Client / Buyer:</span>
                    <span className="font-medium text-slate-700 truncate max-w-[170px]">
                      {order?.buyer_name || order?.customer_name || 'Cheran Soft Global Export'}
                    </span>
                  </div>
                </div>

                {/* Transport / Delivery Mode */}
                <div className="mt-2 pt-1 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between">
                  <span>Place of Supply: <strong>Tamil Nadu (33)</strong></span>
                  <span>Transport: <strong>{itemData?.transport_courier || itemData?.vehicle_number || 'Door Delivery / Mill Gate'}</strong></span>
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* 3. PROCESS SPECIFICATIONS TABLE                                   */}
            {/* ================================================================= */}
            <div 
              className="po-process-section border border-slate-200 rounded p-2 mb-2.5 bg-slate-50/40 text-[10px]"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <p className="font-bold uppercase tracking-wider mb-1 text-[9.5px]" style={{ color: primaryColor }}>
                PROCESS TECHNICAL SPECIFICATIONS & QUALITY REQUIREMENT
              </p>
              <div className="grid grid-cols-4 gap-2 text-slate-700">
                {docType.includes('DYEING') ? (
                  <>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Fabric Material</span>
                      <strong className="text-slate-900">{itemData?.fabric_name || '100% Combed Cotton'}</strong>
                      {itemData?.fabric_code && <span className="text-slate-500 block text-[9px]">({itemData.fabric_code})</span>}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Process Type</span>
                      <strong className="text-slate-900">{itemData?.process_type || 'Fabric Dyeing & Bio-Wash'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Total Fabric Quantity</span>
                      <strong className="text-blue-800 font-mono">
                        {fmt(itemData?.total_fabric_quantity || itemData?.dispatched_quantity || totalOutwardQty, 1)} {itemData?.uom || 'KG'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Quality Norm</span>
                      <strong className="text-slate-900">AATCC 4-Pt, Shrinkage &lt; 3%</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Placement Area</span>
                      <strong className="text-slate-900">{itemData?.placement || 'Left Chest / Front Pocket'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Stitch Specification</span>
                      <strong className="text-slate-900">
                        {itemData?.stitch_count ? `${fmt(itemData.stitch_count)} Stitches` : 'Standard Density'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Thread / Colors</span>
                      <strong className="text-slate-900">{itemData?.thread_colors || 'Poly Viscose Madeira'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase">Total Garment Panels</span>
                      <strong className="text-purple-800 font-mono">
                        {fmt(itemData?.total_pieces || itemData?.quantity_dispatched || totalOutwardQty)} PCS
                      </strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ================================================================= */}
            {/* 4. DYNAMIC ITEM TABLE (Exact PO Table Styling)                     */}
            {/* ================================================================= */}
            <div className="mb-2.5">
              <table 
                className="w-full border-collapse" 
                style={{ 
                  fontSize: '10px',
                  border: '1px solid #cbd5e1',
                  pageBreakInside: 'auto'
                }}
              >
                <thead style={{ display: 'table-header-group' }}>
                  <tr style={{ backgroundColor: tableHeaderBg, breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                    {docConfig.isOutward && docType === 'DYEING_OUTWARD' && (
                      <>
                        <th style={{ width: '35px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>#</th>
                        <th style={{ width: '130px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Pantone Color Shade</th>
                        <th style={{ width: '90px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Pantone Code</th>
                        <th style={{ width: '45px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Swatch</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Fabric Description</th>
                        <th style={{ width: '70px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Dispatched</th>
                        <th style={{ width: '45px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>UOM</th>
                        <th style={{ width: '70px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Job Rate</th>
                        <th style={{ width: '80px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Taxable</th>
                        <th style={{ width: '50px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Tax %</th>
                        <th style={{ width: '85px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Net Amount</th>
                      </>
                    )}

                    {docConfig.isOutward && docType === 'EMBROIDERY_OUTWARD' && (
                      <>
                        <th style={{ width: '35px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Garment Piece / Description</th>
                        <th style={{ width: '85px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Color</th>
                        <th style={{ width: '55px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Size</th>
                        <th style={{ width: '120px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Artwork / Design</th>
                        <th style={{ width: '70px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Dispatched</th>
                        <th style={{ width: '45px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>UOM</th>
                        <th style={{ width: '70px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Unit Rate</th>
                        <th style={{ width: '80px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Taxable</th>
                        <th style={{ width: '50px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Tax %</th>
                        <th style={{ width: '85px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Net Amount</th>
                      </>
                    )}

                    {docConfig.isInward && docType === 'DYEING_INWARD' && (
                      <>
                        <th style={{ width: '35px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Fabric Description</th>
                        <th style={{ width: '110px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Color Shade</th>
                        <th style={{ width: '75px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Dispatched</th>
                        <th style={{ width: '75px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Received</th>
                        <th style={{ width: '75px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Accepted</th>
                        <th style={{ width: '65px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Rejected</th>
                        <th style={{ width: '55px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Loss %</th>
                        <th style={{ width: '75px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>QC Status</th>
                        <th style={{ width: '130px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Inspection Remarks</th>
                      </>
                    )}

                    {docConfig.isInward && docType === 'EMBROIDERY_INWARD' && (
                      <>
                        <th style={{ width: '35px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>#</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Garment Piece Description</th>
                        <th style={{ width: '80px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Color</th>
                        <th style={{ width: '50px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Size</th>
                        <th style={{ width: '70px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Dispatched</th>
                        <th style={{ width: '70px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Received</th>
                        <th style={{ width: '70px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>QC Passed</th>
                        <th style={{ width: '60px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Rejected</th>
                        <th style={{ width: '60px', textAlign: 'right', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Balance</th>
                        <th style={{ width: '75px', textAlign: 'center', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>QC Status</th>
                        <th style={{ width: '120px', textAlign: 'left', padding: '4px 6px', border: '1px solid #cbd5e1', fontWeight: 700, textTransform: 'uppercase', fontSize: '9px', color: '#334155' }}>Inspection Remarks</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {docConfig.isOutward && outwardItems.map((row: any, idx: number) => (
                    <tr 
                      key={idx} 
                      className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}
                      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                    >
                      <td style={{ textAlign: 'center', padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.s_no}</td>
                      {docType === 'DYEING_OUTWARD' && (
                        <>
                          <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontWeight: 600 }}>{row.color}</td>
                          <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>{row.pantone}</td>
                          <td style={{ textAlign: 'center', padding: '4px 6px', border: '1px solid #e2e8f0' }}>
                            <span 
                              className="inline-block w-3.5 h-3.5 rounded-full border border-slate-300 align-middle shadow-2xs" 
                              style={{ backgroundColor: row.hex }}
                            />
                          </td>
                        </>
                      )}
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontWeight: 600 }}>{row.description}</td>
                      {docType === 'EMBROIDERY_OUTWARD' && (
                        <>
                          <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.color}</td>
                          <td style={{ textAlign: 'center', padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.size}</td>
                          <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>{row.design}</td>
                        </>
                      )}
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontWeight: 700 }}>{fmt(row.qty, 1)}</td>
                      <td style={{ textAlign: 'center', padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.uom}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>₹{Number(row.rate).toFixed(2)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>₹{fmt(row.taxable, 2)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.taxPercent}%</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 700 }}>₹{fmt(row.netAmount, 2)}</td>
                    </tr>
                  ))}

                  {docConfig.isInward && inwardItems.map((row: any, idx: number) => (
                    <tr 
                      key={idx} 
                      className={idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}
                      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                    >
                      <td style={{ textAlign: 'center', padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.s_no}</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontWeight: 600 }}>{row.description}</td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.color}</td>
                      {docType === 'EMBROIDERY_INWARD' && (
                        <td style={{ textAlign: 'center', padding: '4px 6px', border: '1px solid #e2e8f0' }}>{row.size}</td>
                      )}
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>{fmt(row.dispatched_qty, 1)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 700 }}>{fmt(row.received_qty, 1)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace', color: '#16a34a', fontWeight: 700 }}>{fmt(row.accepted_qty, 1)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace', color: Number(row.rejected_qty) > 0 ? '#dc2626' : '#64748b' }}>
                        {fmt(row.rejected_qty, 1)}
                      </td>
                      {docType === 'DYEING_INWARD' ? (
                        <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>{row.diff_percent}</td>
                      ) : (
                        <td style={{ textAlign: 'right', padding: '4px 6px', border: '1px solid #e2e8f0', fontFamily: 'monospace' }}>{fmt(row.balance_qty, 0)}</td>
                      )}
                      <td style={{ textAlign: 'center', padding: '4px 6px', border: '1px solid #e2e8f0' }}>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider ${
                          String(row.qc_status).toLowerCase().includes('reject') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {row.qc_status}
                        </span>
                      </td>
                      <td style={{ padding: '4px 6px', border: '1px solid #e2e8f0', fontSize: '9px', color: '#475569' }}>{row.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ================================================================= */}
            {/* 5. SUMMARY & AMOUNT IN WORDS SECTION                              */}
            {/* ================================================================= */}
            <div 
              className="po-totals-section grid grid-cols-12 gap-3 mb-2.5 items-start"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              {/* Left: Amount in Words / Statutory Notice */}
              <div className="col-span-7 border border-slate-200 rounded p-2 bg-slate-50/40">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  {docConfig.isOutward ? 'JOB WORK VALUE IN WORDS' : 'QUANTITY RECONCILIATION SUMMARY'}
                </p>
                <p className="text-[10.5px] font-bold tracking-tight leading-snug" style={{ color: primaryColor }}>
                  {docConfig.isOutward ? amountInWords : `TOTAL ACCEPTED: ${fmt(inwardItems[0]?.accepted_qty || 0)} ${itemData?.uom || (docType.includes('DYEING') ? 'KG' : 'PCS')} (VERIFIED BY QC STORE)`}
                </p>

                {/* Statutory Job Work Note */}
                <div className="mt-1.5 pt-1 border-t border-slate-200/70 text-[9px] text-slate-500 leading-tight space-y-0.5">
                  <p>• Goods dispatched for Job Work processing under <strong>Section 143 of CGST Act, 2017 &amp; Rule 55</strong> of CGST Rules.</p>
                  <p>• E-Way bill must accompany goods and cite this Job Work Delivery Challan reference.</p>
                  <p>• Processed material must be returned within the stipulated turnaround schedule without unauthorized shrinkage or loss.</p>
                </div>
              </div>

              {/* Right: Calculated Totals Table */}
              <div className="col-span-5 border border-slate-200 rounded overflow-hidden">
                <table className="w-full text-[10px]">
                  <tbody>
                    {docConfig.isOutward ? (
                      <>
                        <tr className="border-b border-slate-100">
                          <td className="py-0.5 px-2 text-slate-600">Total Quantity:</td>
                          <td className="py-0.5 px-2 text-right font-mono font-medium">
                            {fmt(totalOutwardQty, 1)} {itemData?.uom || (docType.includes('DYEING') ? 'KG' : 'PCS')}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100 font-semibold bg-slate-50/50">
                          <td className="py-0.5 px-2 text-slate-700">Taxable Value:</td>
                          <td className="py-0.5 px-2 text-right font-mono text-slate-900">₹{fmt(totalTaxable, 2)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 text-slate-600">
                          <td className="py-0.5 px-2">CGST (2.5%):</td>
                          <td className="py-0.5 px-2 text-right font-mono">₹{fmt(cgst, 2)}</td>
                        </tr>
                        <tr className="border-b border-slate-100 text-slate-600">
                          <td className="py-0.5 px-2">SGST (2.5%):</td>
                          <td className="py-0.5 px-2 text-right font-mono">₹{fmt(sgst, 2)}</td>
                        </tr>
                        <tr className="font-bold text-xs" style={{ backgroundColor: tableHeaderBg }}>
                          <td className="py-1.5 px-2 uppercase tracking-wide" style={{ color: primaryColor }}>
                            Total Job Value:
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-sm" style={{ color: primaryColor }}>
                            ₹{fmt(grandTotal, 2)}
                          </td>
                        </tr>
                      </>
                    ) : (
                      <>
                        <tr className="border-b border-slate-100">
                          <td className="py-0.5 px-2 text-slate-600">Total Dispatched:</td>
                          <td className="py-0.5 px-2 text-right font-mono font-medium">
                            {fmt(inwardItems[0]?.dispatched_qty || 0, 1)} {inwardItems[0]?.uom}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="py-0.5 px-2 text-slate-600">Total Inward Received:</td>
                          <td className="py-0.5 px-2 text-right font-mono font-bold text-slate-900">
                            {fmt(inwardItems[0]?.received_qty || 0, 1)} {inwardItems[0]?.uom}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100 text-emerald-700 bg-emerald-50/40">
                          <td className="py-0.5 px-2 font-semibold">Accepted by QC:</td>
                          <td className="py-0.5 px-2 text-right font-mono font-bold">
                            {fmt(inwardItems[0]?.accepted_qty || 0, 1)} {inwardItems[0]?.uom}
                          </td>
                        </tr>
                        <tr className="border-b border-slate-100 text-red-600">
                          <td className="py-0.5 px-2">Rejected Quantity:</td>
                          <td className="py-0.5 px-2 text-right font-mono font-bold">
                            {fmt(inwardItems[0]?.rejected_qty || 0, 1)} {inwardItems[0]?.uom}
                          </td>
                        </tr>
                        <tr className="font-bold text-xs" style={{ backgroundColor: tableHeaderBg }}>
                          <td className="py-1.5 px-2 uppercase tracking-wide" style={{ color: primaryColor }}>
                            QC Clearance:
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono text-xs uppercase" style={{ color: primaryColor }}>
                            {inwardItems[0]?.qc_status || 'VERIFIED'}
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ================================================================= */}
            {/* 6. TERMS & CONDITIONS                                             */}
            {/* ================================================================= */}
            <div 
              className="po-terms-section mb-2 border border-slate-200 rounded p-2 bg-slate-50/20 text-[9px]"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <p className="font-bold uppercase tracking-wider mb-1 text-[9.5px]" style={{ color: primaryColor }}>
                TERMS &amp; CONDITIONS FOR TEXTILE JOB WORK
              </p>
              <ol className="list-decimal list-inside space-y-0.5 text-slate-600 leading-snug grid grid-cols-2 gap-x-4">
                <li>
                  <strong>Quality &amp; Shade:</strong> Work must match approved sample / Pantone reference. Variations beyond tolerance will be rejected.
                </li>
                <li>
                  <strong>Turnaround Time:</strong> Processed goods must be delivered strictly on or before the due date at factory receiving bay.
                </li>
                <li>
                  <strong>Material Accountability:</strong> Full accounting of material dispatched, finished goods, and scrap/wastage is mandatory.
                </li>
                <li>
                  <strong>Defects &amp; Rejection:</strong> Substandard workmanship or damaged panels will be debited to the processor's account.
                </li>
                <li>
                  <strong>Statutory E-Way Bill:</strong> Relevant GST delivery challan and active e-Way bill must accompany every shipment.
                </li>
                <li>
                  <strong>Legal Jurisdiction:</strong> All disputes are subject to the exclusive jurisdiction of the Courts at Karur, Tamil Nadu.
                </li>
              </ol>
            </div>

            {/* ================================================================= */}
            {/* 7. SIGNATURE BLOCKS (Identical to PO Template)                    */}
            {/* ================================================================= */}
            <div 
              className="po-signatures-section mb-2 mt-2 pt-2 border-t border-slate-200"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div className="grid grid-cols-4 gap-2 text-center">
                {/* 1. Prepared By */}
                <div className="po-signature-box border border-slate-200 rounded p-1.5 flex flex-col justify-between bg-white min-h-[68px]">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700">
                    Prepared By
                  </p>
                  <div className="mt-auto pt-1">
                    <div className="border-t border-slate-300 w-4/5 mx-auto mb-1" />
                    <p className="text-[9.5px] font-bold text-slate-900 leading-tight">Merchandiser</p>
                    <p className="text-[8.5px] text-slate-500 leading-tight">Production Planning</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Date: ____________</p>
                  </div>
                </div>

                {/* 2. Quality Checked By */}
                <div className="po-signature-box border border-slate-200 rounded p-1.5 flex flex-col justify-between bg-white min-h-[68px]">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700">
                    Checked By (QC)
                  </p>
                  <div className="mt-auto pt-1">
                    <div className="border-t border-slate-300 w-4/5 mx-auto mb-1" />
                    <p className="text-[9.5px] font-bold text-slate-900 leading-tight">Quality In-charge</p>
                    <p className="text-[8.5px] text-slate-500 leading-tight">Technical Quality Manager</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Date: ____________</p>
                  </div>
                </div>

                {/* 3. Dispatch / Store Incharge */}
                <div className="po-signature-box border border-slate-200 rounded p-1.5 flex flex-col justify-between bg-white min-h-[68px]">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700">
                    {docConfig.isInward ? 'Received By (Store)' : 'Store / Dispatch'}
                  </p>
                  <div className="mt-auto pt-1">
                    <div className="border-t border-slate-300 w-4/5 mx-auto mb-1" />
                    <p className="text-[9.5px] font-bold text-slate-900 leading-tight">Store Officer</p>
                    <p className="text-[8.5px] text-slate-500 leading-tight">Warehouse &amp; Logistics</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Date: ____________</p>
                  </div>
                </div>

                {/* 4. Authorized Signatory */}
                <div className="po-signature-box border border-slate-200 rounded p-1.5 flex flex-col justify-between bg-white min-h-[68px]">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-700">
                    Authorized Signatory
                  </p>
                  <div className="my-0.5 h-2 flex items-center justify-center">
                    <span className="text-[7px] text-slate-300 border border-dashed border-slate-300 rounded px-1 uppercase tracking-widest">
                      SEAL / STAMP
                    </span>
                  </div>
                  <div className="mt-auto pt-1">
                    <div className="border-t border-slate-300 w-4/5 mx-auto mb-1" />
                    <p className="text-[9.5px] font-bold text-slate-900 leading-tight">Managing Director</p>
                    <p className="text-[8.5px] text-slate-500 leading-tight">For Cheran Soft Goods</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Date: ____________</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ================================================================= */}
            {/* 8. DOCUMENT FOOTER                                                */}
            {/* ================================================================= */}
            <div 
              className="po-footer-section pt-1.5 border-t border-slate-200 text-[8.5px] text-slate-500 flex flex-row items-center justify-between gap-1"
              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
            >
              <div>
                <p>This is a computer generated ERP job-work document. Subject to Karur jurisdiction.</p>
                <div className="flex gap-2 text-[8px] text-slate-400 mt-0.5">
                  <span>{company.name}</span>
                  <span>GSTIN: {company.gstin}</span>
                  <span>{company.website}</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="font-semibold text-slate-700">Page 1 of 1</p>
                <p className="text-[8px] text-slate-400">
                  Generated: {new Date().toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
