import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bell, CheckCircle, AlertTriangle, CreditCard, Share2, Package, BellOff } from 'lucide-react'
import { notificationApi } from '@/api'
import { formatDistanceToNow } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const ICONS: Record<string, any> = {
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: AlertTriangle,
  GALLERY_SHARED: Share2,
  SELECTIONS_SUBMITTED: CheckCircle,
  STORAGE_WARNING: Package,
  ZIP_READY: Package,
}

export function NotificationsPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list({ limit: 50 }).then(r => r.data),
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const notifications = data?.data ?? []
  const unread = data?.unread_count ?? 0

  return (
    <div className="page-container max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Notifications</h1>
          {unread > 0 && <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button className="btn-secondary py-2 text-sm" onClick={() => markAllMutation.mutate()}>
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="glass-card p-4 h-16 shimmer" />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <BellOff size={40} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any, i: number) => {
            const Icon = ICONS[n.type] ?? Bell
            return (
              <motion.div
                key={n.id}
                className="glass-card p-4 flex items-start gap-3 cursor-pointer transition-all"
                style={{ opacity: n.is_read ? 0.6 : 1 }}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: n.is_read ? 0.6 : 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => !n.is_read && markReadMutation.mutate(n.id)}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: n.is_read ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.12)', border: '1px solid rgba(108,99,255,0.2)' }}>
                  <Icon size={16} style={{ color: n.is_read ? 'var(--text-muted)' : '#a78bfa' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{n.body}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ background: '#6c63ff' }} />
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
