import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Users, Shield, Settings, Package, Search, Plus, Edit2, Trash2, X, Save, Loader2, LayoutDashboard, TrendingUp, FolderOpen, HardDrive, Zap, Clock, Activity, CheckCircle2, CreditCard, Calendar, Filter, ChevronRight, ArrowUpRight } from 'lucide-react'
import { adminApi } from '@/api'
import { formatDistanceToNow, format } from 'date-fns'
import toast from 'react-hot-toast'

const tabs = [
  { key: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { key: 'users', icon: Users, label: 'Users' },
  { key: 'payments', icon: CreditCard, label: 'Payments' },
  { key: 'plans', icon: Package, label: 'Plans' },
  { key: 'integrations', icon: Settings, label: 'Integrations' },
]

function AdminDashboard({ onRevenueClick }: { onRevenueClick: () => void }) {
  const { data: res } = useQuery({ 
    queryKey: ['admin-dashboard'], 
    queryFn: () => adminApi.getDashboard().then(r => r.data.data) 
  })
  
  const { data: logs } = useQuery({ 
    queryKey: ['admin-audit-compact'], 
    queryFn: () => adminApi.getAuditLogs({ limit: 6 }).then(r => r.data.data) 
  })

  const stats = res?.stats
  const trends = res?.trends
  const system = res?.system

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const cards = [
    { label: 'Monthly Revenue', value: stats?.revenue_this_month ? `₹${(stats.revenue_this_month / 100).toLocaleString()}` : '₹0', icon: TrendingUp, color: '#22c55e', trend: trends?.revenue ?? '0%', clickable: true },
    { label: 'Total Photographers', value: stats?.total_photographers ?? '0', icon: Users, color: '#6c63ff', trend: trends?.users ?? '0%' },
    { label: 'Active Projects', value: stats?.total_projects ?? '0', icon: FolderOpen, color: '#f59e0b', trend: trends?.projects ?? '0%' },
    { label: 'Platform Storage', value: formatSize(stats?.total_files_size || 0), icon: HardDrive, color: '#0ea5e9', trend: 'Healthy' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => (
          <motion.div 
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => card.clickable && onRevenueClick()}
            className={`glass-card p-6 relative overflow-hidden group ${card.clickable ? 'cursor-pointer hover:border-purple-500/30' : ''}`}
          >
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-6 translate-x-6 opacity-0 group-hover:opacity-10 transition-opacity" 
              style={{ background: card.color, filter: 'blur(30px)' }} />
            
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${card.color}15` }}>
                <card.icon size={20} style={{ color: card.color }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider" 
                  style={{ background: `${card.color}10`, color: card.color }}>
                  {card.trend}
                </span>
                {card.clickable && <ArrowUpRight size={14} className="text-zinc-500 group-hover:text-purple-400" />}
              </div>
            </div>
            
            <h3 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{card.value}</h3>
            <p className="text-xs font-medium mt-1" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Activity size={18} className="text-purple-500" />
                Recent Platform Activity
              </h3>
              <button className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors">View All Logs</button>
            </div>
            
            <div className="space-y-1">
              {logs?.map((log: any, i: number) => (
                <div key={log.id} className="flex items-center gap-4 py-3 px-2 rounded-xl hover:bg-white/5 transition-colors border-b border-white/[0.03] last:border-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <Clock size={14} className="text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {log.action.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {log.user?.full_name || 'System'} • {log.ip_address}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500 whitespace-nowrap">
                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 bg-gradient-to-br from-purple-600/10 to-transparent">
            <h3 className="font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Zap size={18} className="text-yellow-500" />
              Quick Actions
            </h3>
            <div className="grid gap-2">
              <button className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 flex items-center justify-between group" onClick={() => toast.success('Checking for pending verifications...')}>
                <span className="text-sm font-medium">Verify Pending Users</span>
                <CheckCircle2 size={16} className="text-zinc-500 group-hover:text-green-500 transition-colors" />
              </button>
              <button className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 flex items-center justify-between group" onClick={() => toast.success('Cache cleared!')}>
                <span className="text-sm font-medium">Clear Cache</span>
                <Activity size={16} className="text-zinc-500 group-hover:text-blue-500 transition-colors" />
              </button>
            </div>
          </div>

          <div className="glass-card p-6 border-dashed border-white/10">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">System Status</h3>
            <div className="space-y-3">
              {[
                { name: 'API Server', status: 'Online', color: '#22c55e' },
                { name: 'Database', status: system?.database === 'connected' ? 'Online' : 'Error', color: system?.database === 'connected' ? '#22c55e' : '#ef4444' },
                { name: 'S3 Storage', status: system?.storage === 'healthy' ? 'Healthy' : 'Warning', color: system?.storage === 'healthy' ? '#22c55e' : '#f59e0b' },
                { name: 'App Version', status: `v${system?.version || '1.0'}`, color: '#8b5cf6' },
              ].map(s => (
                <div key={s.name} className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                    <span className="text-[10px] font-bold uppercase" style={{ color: s.color }}>{s.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminUsers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const { data } = useQuery({ queryKey: ['admin-users', search], queryFn: () => adminApi.getUsers({ search: search || undefined, limit: 20 }).then(r => r.data) })
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => adminApi.updateUserStatus(id, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User updated') },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="relative flex-1 max-w-sm group">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
          <input 
            style={{ paddingLeft: '2.75rem' }}
            className="input-field py-2.5 text-sm" 
            placeholder="Search by name or email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>
      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              {['Photographer', 'Active Plan', 'Account Status', 'Joined', 'Actions'].map(h => (
                <th key={h} className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((u: any) => (
              <tr key={u.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-xs">
                      {u.full_name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.full_name}</p>
                      <p className="text-xs text-zinc-500">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${u.subscription?.plan?.is_featured ? 'badge-purple' : 'badge-zinc'}`}>
                    {u.subscription?.plan?.name ?? 'No Plan'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`badge ${u.is_active && !u.is_suspended ? 'badge-green' : 'badge-red'}`}>
                    {u.is_suspended ? 'Suspended' : u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-zinc-400">
                  {format(new Date(u.created_at), 'MMM dd, yyyy')}
                </td>
                <td className="px-6 py-4">
                  <button 
                    onClick={() => actionMutation.mutate({ id: u.id, action: u.is_suspended ? 'unsuspend' : 'suspend' })}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                      u.is_suspended 
                        ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border border-green-500/20' 
                        : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20'
                    }`}
                  >
                    {u.is_suspended ? <CheckCircle2 size={12} /> : <Shield size={12} />}
                    {u.is_suspended ? 'Activate' : 'Suspend'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AdminPayments() {
  const [filters, setFilters] = useState({ userId: '', startDate: '', endDate: '' })
  const { data: users } = useQuery({ queryKey: ['admin-users-list'], queryFn: () => adminApi.getUsers({ limit: 100 }).then(r => r.data.data) })
  const { data: res, isLoading } = useQuery({ 
    queryKey: ['admin-payments', filters], 
    queryFn: () => adminApi.getPayments(filters).then(r => r.data) 
  })

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Professional</label>
            <div className="relative group">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors pointer-events-none">
                <Users size={16} />
              </div>
              <select 
                style={{ paddingLeft: '2.75rem' }}
                className="input-field py-2.5 text-sm appearance-none cursor-pointer" 
                value={filters.userId} 
                onChange={e => setFilters({ ...filters, userId: e.target.value })}
              >
                <option value="">All Photographers</option>
                {users?.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
          </div>

          <div className="min-w-[400px]">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Date Range</label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1 group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors pointer-events-none">
                  <Calendar size={16} />
                </div>
                <input 
                  type="date" 
                  style={{ paddingLeft: '2.75rem' }}
                  className="input-field py-2.5 text-sm" 
                  value={filters.startDate} 
                  onChange={e => setFilters({ ...filters, startDate: e.target.value })} 
                />
              </div>
              <div className="w-4 h-[1px] bg-zinc-800 shrink-0" />
              <div className="relative flex-1 group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors pointer-events-none">
                  <Calendar size={16} />
                </div>
                <input 
                  type="date" 
                  style={{ paddingLeft: '2.75rem' }}
                  className="input-field py-2.5 text-sm" 
                  value={filters.endDate} 
                  onChange={e => setFilters({ ...filters, endDate: e.target.value })} 
                />
              </div>
            </div>
          </div>

          <div className="flex items-end h-full">
            <button 
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all border border-white/5"
              onClick={() => setFilters({ userId: '', startDate: '', endDate: '' })}
              title="Reset Filters"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-20 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-purple-500" size={32} />
            <p className="text-sm text-zinc-500">Loading transactions...</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Photographer', 'Amount', 'Status', 'Date', 'Invoice'].map(h => (
                  <th key={h} className="text-left px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(res?.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <CreditCard size={32} className="mx-auto mb-3 text-zinc-700" />
                    <p className="text-sm text-zinc-500">No payments found matching your filters.</p>
                  </td>
                </tr>
              ) : res.data.map((p: any) => (
                <tr key={p.id} className="border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.user?.full_name}</p>
                    <p className="text-xs text-zinc-500">{p.user?.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                      ₹{(p.amount / 100).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-zinc-500 uppercase">{p.provider}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${p.status === 'SUCCESS' ? 'badge-green' : 'badge-red'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs text-zinc-300">{format(new Date(p.created_at), 'MMM dd, yyyy')}</p>
                    <p className="text-[10px] text-zinc-500">{format(new Date(p.created_at), 'hh:mm a')}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-zinc-400">{p.invoice?.invoice_number || 'N/A'}</span>
                      <ChevronRight size={14} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function AdminPlans() {
  const qc = useQueryClient()
  const { data: plans = [] } = useQuery({ queryKey: ['admin-plans'], queryFn: () => adminApi.getPlans().then(r => r.data.data) })
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (data: any) => data.id ? adminApi.updatePlan(data.id, data) : adminApi.createPlan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-plans'] })
      toast.success(editingPlan?.id ? 'Plan updated' : 'Plan created')
      setIsModalOpen(false)
      setEditingPlan(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to save plan'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.deletePlan(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-plans'] }); toast.success('Plan deleted') },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete plan'),
  })

  const handleEdit = (plan: any) => {
    setEditingPlan(plan)
    setIsModalOpen(true)
  }

  const handleCreate = () => {
    setEditingPlan({
      name: '',
      slug: '',
      description: '',
      price_inr: 0,
      price_usd: 0,
      storage_limit_gb: 5,
      interval: 'MONTHLY',
      is_active: true,
      is_featured: false,
    })
    setIsModalOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Plan Management</h2>
        <button className="btn-primary py-2 px-4 flex items-center gap-2 text-sm" onClick={handleCreate}>
          <Plus size={16} /> Create Plan
        </button>
      </div>

      <div className="grid gap-3">
        {plans.map((p: any) => (
          <div key={p.id} className="glass-card p-4 flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(108,99,255,0.1)' }}>
                <Package size={18} style={{ color: '#6c63ff' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {p.storage_limit_gb === 0 ? 'Unlimited' : `${p.storage_limit_gb}GB`} •
                  {p.price_inr === 0 ? ' Free' : ` ₹${(p.price_inr / 100).toLocaleString()}/mo`} •
                  {p._count?.subscriptions ?? 0} subscribers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
                {p.is_featured && <span className="badge badge-purple">Featured</span>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 hover:bg-white/5 rounded-lg transition-colors" onClick={() => handleEdit(p)} title="Edit Plan">
                  <Edit2 size={14} style={{ color: 'var(--text-secondary)' }} />
                </button>
                <button className="p-2 hover:bg-red-500/10 rounded-lg transition-colors" 
                  onClick={() => confirm('Are you sure you want to delete this plan?') && deleteMutation.mutate(p.id)} title="Delete Plan">
                  <Trash2 size={14} style={{ color: '#ef4444' }} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-lg p-6 relative z-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold">{editingPlan?.id ? 'Edit Plan' : 'New Plan'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-lg">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-zinc-500">Plan Name</label>
                    <input className="input-field py-2" value={editingPlan.name} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} placeholder="e.g. Pro Plan" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-zinc-500">Slug</label>
                    <input className="input-field py-2" value={editingPlan.slug} onChange={e => setEditingPlan({...editingPlan, slug: e.target.value})} placeholder="e.g. pro" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-zinc-500">Description</label>
                  <textarea className="input-field py-2 min-h-[80px]" value={editingPlan.description} onChange={e => setEditingPlan({...editingPlan, description: e.target.value})} placeholder="Marketing description..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-zinc-500">Price (INR Paise)</label>
                    <input type="number" className="input-field py-2" value={editingPlan.price_inr} onChange={e => setEditingPlan({...editingPlan, price_inr: parseInt(e.target.value)})} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-zinc-500">Storage (GB)</label>
                    <input type="number" className="input-field py-2" value={editingPlan.storage_limit_gb} onChange={e => setEditingPlan({...editingPlan, storage_limit_gb: parseFloat(e.target.value)})} />
                  </div>
                </div>

                <div className="flex items-center gap-6 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-purple-600 focus:ring-purple-600/20" 
                      checked={editingPlan.is_active} onChange={e => setEditingPlan({...editingPlan, is_active: e.target.checked})} />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-white/5 text-purple-600 focus:ring-purple-600/20" 
                      checked={editingPlan.is_featured} onChange={e => setEditingPlan({...editingPlan, is_featured: e.target.checked})} />
                    <span className="text-sm font-medium">Featured</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8">
                <button className="btn-secondary py-2 px-6" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button className="btn-primary py-2 px-8 flex items-center gap-2" onClick={() => saveMutation.mutate(editingPlan)} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Plan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AdminIntegrations() {
  const qc = useQueryClient()
  const { data: integrations = [], isLoading } = useQuery({ 
    queryKey: ['admin-integrations'], 
    queryFn: () => adminApi.getIntegrations().then(r => r.data.data) 
  })

  const [editingConfig, setEditingConfig] = useState<any>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data: any) => adminApi.updateIntegration(data.provider, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-integrations'] })
      toast.success('Integration updated successfully')
      setIsModalOpen(false)
      setEditingConfig(null)
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const providers = [
    { name: 'RAZORPAY', icon: CreditCard, color: '#3395ff', description: 'Accept payments in India with Razorpay' },
    { name: 'STRIPE', icon: Shield, color: '#635bff', description: 'Global payments and subscriptions with Stripe' },
    { name: 'R2', icon: HardDrive, color: '#f38020', description: 'Cloudflare R2 Object Storage for media files' },
  ]

  const handleEdit = (providerName: string) => {
    const existing = integrations.find((i: any) => i.provider === providerName)
    setEditingConfig({
      provider: providerName,
      public_key: '', // Secrets are never sent back from server for security
      secret_key: '',
      environment: existing?.environment || 'production',
      is_active: existing?.is_active ?? true,
    })
    setIsModalOpen(true)
  }

  const safeFormatDistance = (date: any) => {
    try {
      if (!date) return 'never'
      const d = new Date(date)
      if (isNaN(d.getTime())) return 'never'
      return formatDistanceToNow(d) + ' ago'
    } catch (e) {
      return 'recently'
    }
  }

  if (isLoading) {
    return (
      <div className="p-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-purple-500" size={32} />
        <p className="text-sm text-zinc-500">Loading configurations...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Integrations & API Keys</h2>
        <p className="text-xs text-zinc-500">Configure your payment gateways and storage providers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map(p => {
          const config = Array.isArray(integrations) ? integrations.find((i: any) => i.provider === p.name) : null
          return (
            <div key={p.name} className="glass-card p-5 group flex flex-col justify-between h-full border-dashed border-white/10 hover:border-solid hover:border-purple-500/30 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${p.color}10` }}>
                    <p.icon size={20} style={{ color: p.color }} />
                  </div>
                  {config ? (
                    <span className={`badge ${config.is_active ? 'badge-green' : 'badge-zinc'}`}>
                      {config.is_active ? 'Connected' : 'Disabled'}
                    </span>
                  ) : (
                    <span className="badge badge-zinc">Not Set</span>
                  )}
                </div>
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>{p.name}</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">{p.description}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-600">
                  {config ? `Updated ${safeFormatDistance(config.updated_at)}` : 'No config found'}
                </span>
                <button 
                  onClick={() => handleEdit(p.name)}
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 group/btn"
                >
                  Configure
                  <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {isModalOpen && editingConfig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-md p-8 relative z-10">
              
              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-1">Configure {editingConfig.provider}</h3>
                <p className="text-sm text-zinc-500">Securely update your integration credentials</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    {editingConfig.provider === 'RAZORPAY' ? 'Key ID' : 'Public Key / API Key'}
                  </label>
                  <input 
                    className="input-field py-2.5 text-sm" 
                    placeholder="Enter your public key..."
                    value={editingConfig.public_key}
                    onChange={e => setEditingConfig({ ...editingConfig, public_key: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                    {editingConfig.provider === 'RAZORPAY' ? 'Key Secret' : 'Secret Key'}
                  </label>
                  <input 
                    type="password"
                    className="input-field py-2.5 text-sm" 
                    placeholder="••••••••••••••••"
                    value={editingConfig.secret_key}
                    onChange={e => setEditingConfig({ ...editingConfig, secret_key: e.target.value })}
                  />
                  <p className="text-[10px] text-zinc-600 mt-2 italic">
                    For security, your existing secret is not shown. Enter a new one to update.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Environment</label>
                    <select 
                      className="input-field py-2.5 text-sm"
                      value={editingConfig.environment}
                      onChange={e => setEditingConfig({ ...editingConfig, environment: e.target.value })}
                    >
                      <option value="test">Test / Sandbox</option>
                      <option value="production">Production</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-purple-600 focus:ring-purple-600/20"
                        checked={editingConfig.is_active}
                        onChange={e => setEditingConfig({ ...editingConfig, is_active: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Active</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-white/5">
                <button className="px-6 py-2.5 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white transition-colors" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button 
                  className="btn-primary py-2.5 px-8 flex items-center gap-2 shadow-xl shadow-purple-500/20" 
                  onClick={() => updateMutation.mutate(editingConfig)}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Config
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState('dashboard')

  return (
    <div className="page-container">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={24} style={{ color: '#6c63ff' }} />
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>Admin Panel</h1>
      </div>

      <div className="flex items-center gap-2 mb-8 bg-white/5 p-1 rounded-xl w-fit border border-white/5">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === t.key ? 'bg-[#6c63ff] text-white shadow-lg' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {activeTab === 'dashboard' && <AdminDashboard onRevenueClick={() => setActiveTab('payments')} />}
        {activeTab === 'users' && <AdminUsers />}
        {activeTab === 'payments' && <AdminPayments />}
        {activeTab === 'plans' && <AdminPlans />}
        {activeTab === 'integrations' && <AdminIntegrations />}
      </motion.div>
    </div>
  )
}
