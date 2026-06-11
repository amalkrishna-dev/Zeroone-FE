import { useState, useEffect } from 'react';
import { FaSync } from 'react-icons/fa';
import apiClient from '../api/client';

export function PlatformAlerts() {
  const [alerts, setAlerts] = useState(null);

  async function fetchAlerts() {
    try {
      const res = await apiClient.get('/global-admin/alerts');
      setAlerts(res.data.data);
    } catch (e) {
      setAlerts(null);
    }
  }

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!alerts) {
    return null;
  }

  const alertGroups = [
    {
      icon: FaSync,
      title: 'OTA Sync Failures',
      color: 'red',
      count: alerts.counts?.ota_dead || 0,
      items: (alerts.banner_alerts || []).filter(a => a.type === 'ota_sync'),
    },
  ];

  const totalAlerts = alertGroups.reduce((sum, g) => sum + g.count, 0);

  if (totalAlerts === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-emerald-700">✓ All Systems Operational</p>
        <p className="text-xs text-emerald-600">No platform alerts in the last 24 hours</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alertGroups.map(({ icon: Icon, title, color, count, items }) => {
        if (count === 0) return null;

        const colorMap = {
          red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100' },
          amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100' },
          rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100' },
        };
        const colors = colorMap[color];

        return (
          <div key={title} className={`${colors.bg} border ${colors.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className={colors.text} size={16} />
                <h3 className={`font-semibold text-sm ${colors.text}`}>{title}</h3>
              </div>
              <span className={`${colors.badge} ${colors.text} text-xs font-bold px-2.5 py-0.5 rounded-full`}>
                {count} {count === 1 ? 'alert' : 'alerts'}
              </span>
            </div>

            {items.length > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs">
                {items.slice(0, 3).map((item, idx) => (
                  <div key={idx} className={`p-2 bg-white bg-opacity-50 rounded text-gray-700`}>
                    <p className="font-mono text-[11px]">
                      {item.organization_name && `[${item.organization_name}] `}
                      {item.message || item.error}
                    </p>
                    {item.timestamp && (
                      <p className="text-gray-500 text-[10px]">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                ))}
                {items.length > 3 && (
                  <p className={`${colors.text} font-semibold text-[11px] p-2`}>+{items.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
