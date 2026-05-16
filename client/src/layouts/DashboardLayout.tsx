import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard, FolderOpen, CreditCard, Bell, Settings,
  Shield, LogOut, Menu, X, HardDrive, Camera, Zap
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { userApi, authApi } from '@/api'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects',      icon: FolderOpen,      label: 'Projects'  },
  { to: '/billing',       icon: CreditCard,      label: 'Billing'   },
  { to: '/notifications', icon: Bell,            label: 'Notifications' },
  { to: '/settings',      icon: Settings,        label: 'Settings'  },
]

export function DashboardLayout() {
  const { user, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const { data: storageData } = useQuery({
    queryKey: ['storage'],
    queryFn: () => userApi.getStorage().then(r => r.data.data),
    refetchInterval: 60_000,
  })

  const { data: subData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => import('@/api').then(m => m.billingApi.getSubscription()).then(r => r.data.data),
    staleTime: 60_000,
  })

  const handleLogout = async () => {
    try { await authApi.logout() } finally {
      clearAuth(); navigate('/login'); toast.success('Logged out')
    }
  }

  const pct = Math.min(storageData?.percent_used ?? 0, 100)
  const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : '#8b5cf6'
  const planName = subData?.plan?.name ?? user?.subscription?.plan?.name ?? 'Free'

  const pageLabel = navItems.find(n => location.pathname.startsWith(n.to))?.label ?? 'Dashboard'

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'rgba(10, 10, 16, 0.8)', backdropFilter: 'blur(30px)', borderRight: '1px solid var(--border-light)' }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4)' }}>
          <Camera size={20} color="white" />
        </div>
        <div>
          <p className="font-display" style={{ fontSize: '20px', fontWeight: 800, color: 'white', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Photo<span style={{ color: 'var(--accent-secondary)' }}>Select</span>
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '0 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {user?.role === 'ADMIN' ? (
          <NavLink to="/admin" onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Shield size={18} /> Admin Panel
          </NavLink>
        ) : (
          navItems.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/dashboard'} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={18} /> {label}
            </NavLink>
          ))
        )}
      </nav>

      {/* Storage & Plan Box */}
      {storageData && user?.role !== 'ADMIN' && (
        <div style={{ margin: '0 16px 16px', padding: '16px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-light)', borderRadius: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <HardDrive size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>Storage</span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {storageData.storage_used_gb ?? 0}GB / {storageData.storage_limit_gb ?? 5}GB
            </span>
          </div>
          <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(0, 0, 0, 0.3)', overflow: 'hidden', marginBottom: '12px' }}>
            <motion.div style={{ height: '100%', borderRadius: '4px', background: barColor }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{planName} Plan</span>
            {planName === 'Free' && (
              <NavLink to="/billing" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: 'var(--accent-secondary)', textDecoration: 'none', background: 'rgba(139, 92, 246, 0.15)', padding: '4px 8px', borderRadius: '6px' }}>
                <Zap size={12} /> Upgrade
              </NavLink>
            )}
          </div>
        </div>
      )}

      {/* User Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 16px', borderTop: '1px solid var(--border-light)', background: 'rgba(0, 0, 0, 0.2)' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed, #c4b5fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
          {user?.full_name?.charAt(0)?.toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </p>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255, 255, 255, 0.05)', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '10px', color: 'var(--text-secondary)', transition: 'all .2s' }} onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; }}>
          <LogOut size={16} />
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <div className="hidden md:block" style={{ width: '260px', flexShrink: 0, zIndex: 10 }}>
        <SidebarContent />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50, width: '280px' }}>
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <header style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', background: 'rgba(10, 10, 16, 0.5)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border-light)', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="md:hidden" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '8px', color: 'var(--text-primary)' }} onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <h1 className="font-display" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{pageLabel}</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <NavLink to="/notifications" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-light)', color: 'var(--text-primary)', transition: 'all .2s' }} className="hover:bg-white/10">
              <Bell size={18} />
            </NavLink>
          </div>
        </header>

        <main style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
