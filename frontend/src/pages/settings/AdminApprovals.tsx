import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { StageModificationRequest, StageModificationDiffItem } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import FormField from '../../components/ui/FormField';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  Layers,
  Calendar,
  User as UserIcon,
  Check,
  X,
  AlertCircle,
  Hash,
  ChevronRight,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';

const STAGES = [
  { id: 1, name: '01. Requirement gathering', role: 'Role 1' },
  { id: 2, name: '02. PO (Purchase Order)', role: 'Role 1' },
  { id: 3, name: '03. Inward', role: 'Role 1' },
  { id: 4, name: '04. Dyeing', role: 'Role 2' },
  { id: 5, name: '05. Cutting — Product-wise', role: 'Role 2' },
  { id: 6, name: '06. Embroidery — Out/In', role: 'Role 2' },
  { id: 7, name: '07. Stitching — Color-wise', role: 'Role 2' },
  { id: 8, name: '08. Checking', role: 'Role 2' },
  { id: 9, name: '09. Packing', role: 'Role 1' },
  { id: 10, name: '10. Completed', role: 'Role 1' },
];

export default function AdminApprovals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRequestId = searchParams.get('request_id');

  const [requests, setRequests] = useState<StageModificationRequest[]>([]);
  const [stats, setStats] = useState({
    total_requests: 0,
    pending_approval: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected request for details modal
  const [selectedRequest, setSelectedRequest] = useState<StageModificationRequest | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Approve / Reject modal state
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchApprovals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getApprovals({
        stage_id: stageFilter !== 'all' ? stageFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search.trim() || undefined,
      });
      setRequests(res.requests || []);
      const s = res.stats || (res as any).summary;
      if (s) {
        setStats({
          total_requests: Number(s.total_requests || 0),
          pending_approval: Number(s.pending_approval || 0),
          approved: Number(s.approved || 0),
          rejected: Number(s.rejected || 0),
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load stage modification requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [stageFilter, statusFilter]);

  // Handle URL request_id parameter on initial load
  useEffect(() => {
    if (initialRequestId) {
      const numId = parseInt(initialRequestId, 10);
      if (!isNaN(numId)) {
        openRequestDetail(numId);
      }
    }
  }, [initialRequestId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchApprovals();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStageFilter('all');
    setStatusFilter('all');
  };

  const openRequestDetail = async (id: number) => {
    setLoadingDetail(true);
    try {
      const res = await api.getApproval(id);
      setSelectedRequest(res.request || res);
      setActionRemarks('');
      setActionError('');
      setActionType(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch request details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest || !actionType) return;

    if (actionType === 'reject' && !actionRemarks.trim()) {
      setActionError('Please provide a mandatory reason for rejecting this modification.');
      return;
    }

    setSubmittingAction(true);
    setActionError('');
    try {
      if (actionType === 'approve') {
        await api.approveModificationRequest(selectedRequest.id, {
          approval_remarks: actionRemarks.trim(),
        });
        setSuccessMsg(`Request ${selectedRequest.request_number} has been approved and active data updated!`);
      } else {
        await api.rejectModificationRequest(selectedRequest.id, {
          rejection_reason: actionRemarks.trim(),
        });
        setSuccessMsg(`Request ${selectedRequest.request_number} has been rejected.`);
      }

      setActionType(null);
      setSelectedRequest(null);
      fetchApprovals();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setActionError(err.message || `Failed to ${actionType} request`);
    } finally {
      setSubmittingAction(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Approved
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            Pending Approval
          </span>
        );
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === 'Role 1') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          Role 1
        </span>
      );
    }
    if (role === 'Role 2') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          Role 2
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
        {role || 'User'}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="Stage Modification Approvals"
        subtitle="Centralized approval workflow for production stage modifications across all 10 stages (Option A: changes apply only after explicit Admin approval)."
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => fetchApprovals()}
          >
            Refresh
          </Button>
        }
      />

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Requests</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-sans">{stats.total_requests}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across all 10 production stages</p>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/20 p-4 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Approval</span>
            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
          </div>
          <div className="text-2xl font-bold text-amber-700 font-sans">{stats.pending_approval}</div>
          <p className="text-[11px] text-amber-600/80 mt-1">Requires Admin decision</p>
        </div>

        {/* Approved */}
        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 font-sans">{stats.approved}</div>
          <p className="text-[11px] text-emerald-600/80 mt-1">Live data synchronized</p>
        </div>

        {/* Rejected */}
        <div className="bg-white rounded-xl border border-rose-200 bg-rose-50/20 p-4 shadow-xs">
          <div className="flex items-center justify-between text-rose-700 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-700 font-sans">{stats.rejected}</div>
          <p className="text-[11px] text-rose-600/80 mt-1">Active data preserved</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Order #, Title, Request ID, Requester..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>

          {/* Stage Filter */}
          <div className="md:col-span-3">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
            >
              <option value="all">All Stages (1-10)</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Actions */}
          <div className="md:col-span-2 flex items-center gap-2">
            <Button type="submit" variant="primary" className="w-full text-xs py-2">
              Filter
            </Button>
            {(search || stageFilter !== 'all' || statusFilter !== 'all') && (
              <Button type="button" variant="outline" onClick={handleResetFilters} className="text-xs py-2 px-3">
                Reset
              </Button>
            )}
          </div>
        </form>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase font-semibold tracking-wider">
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Order # & Title</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Requested By</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
                      <span>Loading stage modification requests...</span>
                    </div>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShieldCheck className="w-8 h-8 text-slate-300" />
                      <p className="font-medium text-slate-600">No modification requests found</p>
                      <p className="text-[11px] text-slate-400 max-w-sm">
                        When Role 1 or Role 2 submit edits for their permitted production stages, they will appear here for Admin approval.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Request ID */}
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      <div className="flex items-center gap-1.5 font-mono text-brand-700">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        {req.request_number}
                      </div>
                    </td>

                    {/* Order */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800">{req.order_number}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{req.order_title}</div>
                      {req.buyer_name && (
                        <div className="text-[10px] text-slate-400 font-medium">Buyer: {req.buyer_name}</div>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <Layers className="w-3 h-3 text-slate-500" />
                        {req.stage_name}
                      </span>
                    </td>

                    {/* Requested By */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {req.requested_by_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{req.requested_by_name}</div>
                          <div>{getRoleBadge(req.requested_by_role)}</div>
                        </div>
                      </div>
                    </td>

                    {/* Submitted At */}
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{req.requested_at ? new Date(req.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {req.requested_at ? new Date(req.requested_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(req.status)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openRequestDetail(req.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Detail & Comparison Modal */}
      {selectedRequest && (
        <Modal
          isOpen={true}
          onClose={() => {
            setSelectedRequest(null);
            setActionType(null);
          }}
          title={`Stage Modification Request: ${selectedRequest.request_number}`}
          subtitle={`${selectedRequest.stage_name} for Order ${selectedRequest.order_number}`}
          size="4xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-slate-500">
                Current Status: {getStatusBadge(selectedRequest.status)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRequest(null);
                    setActionType(null);
                  }}
                >
                  Close
                </Button>

                {selectedRequest.status === 'Pending Approval' && (
                  <>
                    <Button
                      variant="danger"
                      icon={<XCircle className="w-4 h-4" />}
                      onClick={() => {
                        setActionType('reject');
                        setActionRemarks('');
                        setActionError('');
                      }}
                    >
                      Reject Request
                    </Button>
                    <Button
                      variant="primary"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                      onClick={() => {
                        setActionType('approve');
                        setActionRemarks('');
                        setActionError('');
                      }}
                    >
                      Approve & Apply
                    </Button>
                  </>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Order Overview Header Card */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Order Number:</span>
                <span className="font-bold text-slate-800 text-sm">{selectedRequest.order_number}</span>
                <span className="block text-[11px] text-slate-500 truncate">{selectedRequest.order_title}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Buyer:</span>
                <span className="font-semibold text-slate-800">{selectedRequest.buyer_name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Current Order Stage:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                  <Layers className="w-3.5 h-3.5 text-brand-600" />
                  {selectedRequest.order_current_stage_name || 'In Production'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Target Delivery:</span>
                <span className="font-semibold text-slate-800">
                  {selectedRequest.order_delivery_date ? new Date(selectedRequest.order_delivery_date).toLocaleDateString('en-IN') : 'N/A'}
                </span>
              </div>
            </div>

            {/* Request Meta & Reason Card */}
            <div className="bg-amber-50/40 rounded-xl p-4 border border-amber-200 text-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-900">Submitted by:</span>
                  <span className="font-medium text-slate-800">{selectedRequest.requested_by_name}</span>
                  {getRoleBadge(selectedRequest.requested_by_role)}
                </div>
                <div className="text-amber-800 text-[11px]">
                  Submitted on: {new Date(selectedRequest.requested_at).toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <span className="text-amber-900 font-bold block mb-1">Reason for Modification:</span>
                <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-amber-200 font-medium whitespace-pre-wrap">
                  "{selectedRequest.modification_reason}"
                </p>
              </div>

              {/* Review audit if completed */}
              {selectedRequest.status !== 'Pending Approval' && (
                <div className="mt-3 pt-2 border-t border-amber-100 text-[11px] text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">Reviewed by:</span>
                    <span>{selectedRequest.reviewed_by_name || 'Admin'}</span>
                    <span>on {selectedRequest.reviewed_at ? new Date(selectedRequest.reviewed_at).toLocaleString('en-IN') : '—'}</span>
                  </div>
                  {selectedRequest.status === 'Approved' && selectedRequest.approval_remarks && (
                    <p className="mt-1 text-emerald-800">
                      <strong>Approval Remarks:</strong> {selectedRequest.approval_remarks}
                    </p>
                  )}
                  {selectedRequest.status === 'Rejected' && selectedRequest.rejection_reason && (
                    <p className="mt-1 text-rose-800">
                      <strong>Rejection Reason:</strong> {selectedRequest.rejection_reason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Downstream Stage Safety Note */}
            <div className="bg-blue-50/60 rounded-xl p-3 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900">
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Strict Transaction Safety (Option A):</strong>
                <span>
                  The active database records for this order have not been touched. Once you click "Approve & Apply", changes will be atomically committed to active stage tables. If rejected, original active data remains completely intact.
                </span>
              </div>
            </div>

            {/* Side-by-Side Comparison Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-600" />
                  Side-by-Side Comparison: Current Approved Data vs Proposed Changes
                </h3>
              </div>

              {selectedRequest.changes_diff && selectedRequest.changes_diff.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 font-semibold text-slate-600">
                        <th className="py-2.5 px-3 w-1/4">Field / Entity</th>
                        <th className="py-2.5 px-3 w-3/8 bg-slate-50">Currently Approved Value</th>
                        <th className="py-2.5 px-3 w-3/8 bg-brand-50/40 text-brand-900">Proposed New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRequest.changes_diff.map((diff, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {diff.label}
                            {diff.type === 'modified' && (
                              <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-normal">
                                Changed
                              </span>
                            )}
                            {diff.type === 'added' && (
                              <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-normal">
                                Added
                              </span>
                            )}
                            {diff.type === 'removed' && (
                              <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-normal">
                                Removed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 bg-slate-50/40 text-slate-600 font-mono">
                            {typeof diff.original === 'object' && diff.original !== null
                              ? JSON.stringify(diff.original, null, 1)
                              : String(diff.original ?? '—')}
                          </td>
                          <td className="py-2.5 px-3 bg-brand-50/20 text-brand-900 font-mono font-semibold">
                            {typeof diff.proposed === 'object' && diff.proposed !== null
                              ? JSON.stringify(diff.proposed, null, 1)
                              : String(diff.proposed ?? '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Fallback raw JSON snapshot comparison if no structured diff generated */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <span className="font-semibold text-slate-700 block mb-2 text-xs">Original Active Snapshot</span>
                    <pre className="text-[11px] font-mono bg-white p-2.5 rounded border border-slate-200 max-h-60 overflow-y-auto text-slate-600">
                      {JSON.stringify(selectedRequest.original_data_snapshot, null, 2)}
                    </pre>
                  </div>
                  <div className="border border-brand-200 rounded-xl p-3 bg-brand-50/20">
                    <span className="font-semibold text-brand-900 block mb-2 text-xs">Proposed Modifications</span>
                    <pre className="text-[11px] font-mono bg-white p-2.5 rounded border border-brand-200 max-h-60 overflow-y-auto text-brand-900 font-medium">
                      {JSON.stringify(selectedRequest.proposed_data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Action Dialog Confirmation (Approve / Reject Input) */}
            {actionType && (
              <div
                className={`p-4 rounded-xl border ${
                  actionType === 'approve'
                    ? 'bg-emerald-50/50 border-emerald-300'
                    : 'bg-rose-50/50 border-rose-300'
                } space-y-3`}
              >
                <div className="flex items-center gap-2">
                  {actionType === 'approve' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600" />
                  )}
                  <h4 className="font-bold text-sm text-slate-900">
                    {actionType === 'approve'
                      ? 'Confirm Modification Approval'
                      : 'Confirm Modification Rejection'}
                  </h4>
                </div>

                <p className="text-xs text-slate-600">
                  {actionType === 'approve'
                    ? 'Approving will immediately write the proposed modifications into active production tables and notify the requesting user.'
                    : 'Rejecting will discard the proposed changes, preserve original active records, and notify the user with your stated reason.'}
                </p>

                {actionError && (
                  <div className="p-2.5 bg-rose-100/70 border border-rose-300 rounded text-rose-800 text-xs font-medium">
                    {actionError}
                  </div>
                )}

                <FormField
                  label={actionType === 'approve' ? 'Approval Remarks (Optional)' : 'Rejection Reason (Mandatory) *'}
                >
                  <textarea
                    rows={3}
                    value={actionRemarks}
                    onChange={(e) => setActionRemarks(e.target.value)}
                    placeholder={
                      actionType === 'approve'
                        ? 'e.g., Reviewed against buyer email confirmation. Approved.'
                        : 'e.g., Target date cannot be extended due to buyer shipment slot.'
                    }
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 bg-white"
                  />
                </FormField>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setActionType(null);
                      setActionError('');
                    }}
                    disabled={submittingAction}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={actionType === 'approve' ? 'primary' : 'danger'}
                    onClick={handleConfirmAction}
                    disabled={submittingAction}
                    icon={<Check className="w-4 h-4" />}
                  >
                    {submittingAction
                      ? 'Processing...'
                      : actionType === 'approve'
                      ? 'Confirm & Apply Changes'
                      : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

