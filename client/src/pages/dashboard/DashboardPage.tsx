import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { FolderOpen, Image as ImageIcon, HardDrive, CreditCard, Plus, ArrowRight, Camera, Zap, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { projectApi, userApi } from '@/api'
import { formatDistanceToNow } from 'date-fns'

const colors = { purple: '#8b5cf6', green: '#22c55e', amber: '#f59e0b', sky: '#38bdf8' }

function StatCard({ label, value, sub, color, icon: Icon, delay, to }: any) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={to ? 'glass-card-hover' : 'glass-card'}
      style={{ padding: '24px', flex: 1, minWidth: '240px', position: 'relative', overflow: 'hidden' }}
    >
      {/* Background glow orb */}
      <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: color, filter: 'blur(40px)', opacity: 0.15, pointerEvents: 'none' }} />
      
      <div style={{ width: '48px', height: '48px', borderRadius: '14px', marginBottom: '20px', background: `${color}1A`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={24} style={{ color }} />
      </div>
      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        {label}
      </p>
      <p className="font-display" style={{ fontSize: '36px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '8px' }}>{sub}</p>}
    </motion.div>
  )
  return to ? <Link to={to} style={{ textDecoration: 'none', display: 'flex', flex: 1 }}>{content}</Link> : content
}

export function DashboardPage() {
  const { user } = useAuthStore()

  const { data: storage } = useQuery({
    queryKey: ['storage'],
    queryFn: () => userApi.getStorage().then(r => r.data.data),
  })
  
  const { data: subData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => import('@/api').then(m => m.billingApi.getSubscription()).then(r => r.data.data),
    staleTime: 60_000,
  })
  const { data: projectsData } = useQuery({
    queryKey: ['projects', { limit: 4 }],
    queryFn: () => projectApi.list({ limit: 4 }).then(r => r.data),
  })

  const projects = projectsData?.data ?? []
  const totalProjects = projectsData?.pagination?.total ?? 0
  const pct = Math.min(storage?.percent_used ?? 0, 100)
  const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#8b5cf6'

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <motion.div style={{ marginBottom: '40px' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="font-display" style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          {greeting},{' '}
          <span className="gradient-text">{user?.full_name?.split(' ')[0]}</span> 👋
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
          Here's what's happening in your workspace today.
        </p>
      </motion.div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <StatCard label="Projects" value={totalProjects} icon={FolderOpen} color={colors.purple} delay={0.1} to="/projects" />
        <StatCard label="Photos" value={storage?.total_images ?? 0} icon={ImageIcon} color={colors.sky} delay={0.2} />
        <StatCard label="Storage" value={`${storage?.storage_used_gb ?? 0} GB`} sub={`of ${storage?.storage_limit_gb ?? 5} GB limit`} icon={HardDrive} color={colors.amber} delay={0.3} />
        <StatCard label="Plan" value={subData?.plan?.name ?? user?.subscription?.plan?.name ?? 'Free'} sub={subData?.status === 'ACTIVE' || subData?.status === 'CANCELED' ? (subData.canceled_at ? 'Cancels soon' : 'Active Subscription') : 'Upgrade to Pro'} icon={CreditCard} color={colors.green} delay={0.4} to="/billing" />
      </div>

      {/* ── Storage Progress ── */}
      <motion.div className="glass-card" style={{ padding: '24px 32px', marginBottom: '40px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HardDrive size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Storage Usage</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="font-display" style={{ fontSize: '20px', fontWeight: 700, color: barColor }}>{pct}% used</span>
            {(subData?.plan?.name ?? user?.subscription?.plan?.name ?? 'Free') === 'Free' && (
              <Link to="/billing" className="btn-primary">
                <Zap size={16} /> Upgrade Plan
              </Link>
            )}
          </div>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(0,0,0,0.4)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
          <motion.div style={{ height: '100%', borderRadius: '4px', background: `linear-gradient(90deg, ${barColor}, ${barColor}99)` }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.5, ease: 'easeOut', delay: 0.6 }} />
        </div>
      </motion.div>

      {/* ── Recent Projects ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 className="font-display" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>Recent Projects</h2>
          <Link to="/projects" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: 'var(--accent-secondary)', fontWeight: 500, textDecoration: 'none' }}>
            View all <ArrowRight size={16} />
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="glass-card" style={{ padding: '64px 32px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Camera size={32} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <p className="font-display" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>No projects yet</p>
            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '24px' }}>Create your first project to start sharing beautiful galleries with clients.</p>
            <Link to="/projects" className="btn-primary" style={{ display: 'inline-flex', padding: '12px 24px', fontSize: '16px' }}>
              <Plus size={20} /> Create a Project
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {projects.map((p: any, i: number) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.1 }}>
                <Link to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div className="glass-card-hover" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FolderOpen size={24} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="font-display" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>{p.name}</p>
                      <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {p._count?.albums ?? 0} albums · {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <ArrowRight size={16} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
