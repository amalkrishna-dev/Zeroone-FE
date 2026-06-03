import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { FaSync, FaCheckCircle, FaExclamationCircle, FaClock } from 'react-icons/fa';
import apiClient from '../api/client';

export function OtaSyncStatus({ propertyId, onRefresh }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function fetchStatus() {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/ops/ota-sync/status?property_id=${propertyId}`);
      setStatus(res.data.data);
    } catch (e) {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [propertyId]);

  async function manualSync() {
    if (!propertyId) return;
    setSyncing(true);
    try {
      await apiClient.post(`/ops/ota-sync/push`, { property_id: propertyId });
      toast.success('Bookings resynced to Aiosell channel manager');
      await fetchStatus();
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to push availability');
    } finally {
      setSyncing(false);
    }
  }

  if (!status) {
    return null;
  }

  const pending = status.pending_count || 0;
  const completed = status.completed_count || 0;
  const failed = status.failed_count || 0;
  const total = pending + completed + failed;

  const getStatusIcon = () => {
    if (failed > 0) return <FaExclamationCircle className="text-red-500" />;
    if (pending > 0) return <FaClock className="text-amber-500 animate-spin" />;
    return <FaCheckCircle className="text-emerald-500" />;
  };

  const getStatusText = () => {
    if (failed > 0) return `${failed} failed`;
    if (pending > 0) return `${pending} syncing`;
    return 'All synced';
  };

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <p className="text-xs font-semibold text-gray-600">Aiosell Channel Manager</p>
            <p className="text-sm font-bold text-gray-900">{getStatusText()}</p>
          </div>
        </div>
        <button onClick={manualSync} disabled={syncing}
          className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center disabled:opacity-50 transition">
          <FaSync size={14} className={syncing ? 'animate-spin' : ''} />
        </button>
      </div>

      {total > 0 && (
        <div className="grid grid-cols-3 gap-2 text-xs bg-gray-50 rounded-lg p-2">
          <div className="text-center">
            <p className="font-bold text-gray-900">{pending}</p>
            <p className="text-gray-600">Pending</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-emerald-600">{completed}</p>
            <p className="text-gray-600">Done</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-red-600">{failed}</p>
            <p className="text-gray-600">Failed</p>
          </div>
        </div>
      )}

      {status.last_sync_at && (
        <p className="text-xs text-gray-500">
          Last sync: {new Date(status.last_sync_at).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
