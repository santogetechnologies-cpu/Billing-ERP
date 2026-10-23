import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { presenceService } from '../../services/presenceService';

interface UserPresenceBadgeProps {
  className?: string;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

export const UserPresenceBadge: React.FC<UserPresenceBadgeProps> = ({
  className = '',
  size = 'md',
  showTooltip = true
}) => {
  const { user, session, profile } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (!user || !session) return false;
    const lastSeen = profile?.last_seen_at || profile?.last_activity_at;
    const presenceStatus = profile?.presence_status;
    return presenceService.isUserOnline(lastSeen, presenceStatus);
  });

  useEffect(() => {
    const evaluatePresence = () => {
      if (!user || !session) {
        setIsOnline(false);
        return;
      }

      // Check local presence cache for instant multi-tab sync
      const cached = presenceService.getLocalPresenceCache(user.id);
      const lastSeen = cached?.lastSeenAt || profile?.last_seen_at || profile?.last_activity_at;
      const presenceStatus = cached?.presenceStatus || profile?.presence_status;

      const online = presenceService.isUserOnline(lastSeen, presenceStatus);
      setIsOnline(online);
    };

    evaluatePresence();
    // Re-evaluate every 10 seconds to respond reliably to heartbeat freshness or session timeouts
    const interval = setInterval(evaluatePresence, 10000);
    return () => clearInterval(interval);
  }, [user?.id, session, profile?.last_seen_at, profile?.presence_status]);

  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-2.5 py-1 text-xs';

  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  if (isOnline) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/90 shadow-2xs select-none transition-all ${sizeClasses} ${className}`}
        title={showTooltip ? 'Current User: Active • Session valid & heartbeat synced' : undefined}
      >
        <span className={`${dotSize} rounded-full bg-emerald-500 animate-pulse shrink-0`} />
        <span>Active</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-600 border border-slate-200/90 shadow-2xs select-none transition-all ${sizeClasses} ${className}`}
      title={showTooltip ? 'Current User: Inactive • Session ended or heartbeat expired' : undefined}
    >
      <span className={`${dotSize} rounded-full bg-slate-400 shrink-0`} />
      <span>Inactive</span>
    </div>
  );
};
