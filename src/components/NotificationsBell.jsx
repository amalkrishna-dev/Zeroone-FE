import { useState, useEffect, useCallback, useRef } from 'react';
import { FaBell, FaCheck } from 'react-icons/fa';
import apiClient from '../api/client';

/**
 * Notification bell + dropdown panel.
 * Polls /api/notifications every 60s while open or for unread count.
 */
export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const res = await apiClient.get('/notifications', { params: { limit: 25 } });
      const data = res.data?.data || [];
      setItems(data);
      setUnread(res.data?.unread_count ?? data.filter(n => !n.is_read).length);
    } catch (e) {
      // Silent - bell shouldn't crash the page.
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const t = setInterval(fetchAll, 60000);
    return () => clearInterval(t);
  }, [fetchAll]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  async function markRead(id) {
    try {
      await apiClient.post(`/notifications/${id}/read`);
      setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnread(c => Math.max(0, c - 1));
    } catch { }
  }

  async function markAll() {
    try {
      await apiClient.post('/notifications/read-all');
      setItems(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(o => !o)}
        className="relative h-9 w-9 rounded-full bg-white border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition"
        title="Notifications">
        <FaBell size={14} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
            <p className="text-sm font-black text-gray-900">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-semibold text-rose-500 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">No notifications yet</div>
            ) : (
              items.map(n => (
                <div key={n.id}
                  className={`px-4 py-3 border-b border-gray-50 last:border-0 ${n.is_read ? 'opacity-70' : 'bg-rose-50/30'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.is_read && (
                      <button onClick={() => markRead(n.id)}
                        className="flex-shrink-0 h-7 w-7 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center"
                        title="Mark read">
                        <FaCheck size={10} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
