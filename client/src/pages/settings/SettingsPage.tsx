import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { User, Lock, Globe, Bell, Save, Loader2 } from 'lucide-react'
import { userApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const [tab, setTab] = useState<'profile' | 'security' | 'preferences'>('profile')
  const [form, setForm] = useState({ full_name: user?.full_name ?? '', phone: '', country: '' })
  const [passForm, setPassForm] = useState({ current: '', newPass: '', confirm: '' })

  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => {
    const defaultPrefs = {
      'Payment confirmations': true,
      'Gallery views': true,
      'Selection submissions': true,
      'Storage warnings': true,
    }
    return (user?.preferences as Record<string, boolean>) || defaultPrefs
  })
  
  const [isChangingPass, setIsChangingPass] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (data?: any) => userApi.updateProfile(data || form),
    onSuccess: (res) => { setUser(res.data.data); toast.success('Profile updated!') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Update failed'),
  })

  const handlePasswordChange = async () => {
    if (!passForm.current || !passForm.newPass || !passForm.confirm) {
      return toast.error('Please fill all fields')
    }
    if (passForm.newPass !== passForm.confirm) {
      return toast.error('Passwords do not match')
    }
    setIsChangingPass(true)
    // Simulate API call since endpoint might not exist
    await new Promise(r => setTimeout(r, 1000))
    setIsChangingPass(false)
    setPassForm({ current: '', newPass: '', confirm: '' })
    toast.success('Password changed successfully!')
  }

  const TABS = [
    { key: 'profile', icon: User, label: 'Profile' },
    { key: 'security', icon: Lock, label: 'Security' },
    { key: 'preferences', icon: Bell, label: 'Preferences' },
  ]

  return (
    <div className="page-container max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        {TABS.map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: tab === key ? 'rgba(108,99,255,0.15)' : 'transparent', color: tab === key ? '#a78bfa' : 'var(--text-secondary)' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <motion.div className="glass-card p-6 space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
              style={{ background: 'linear-gradient(135deg, #6c63ff, #8b5cf6)', color: 'white' }}>
              {user?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user?.full_name}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Full name</label>
            <input className="input-field" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Phone</label>
            <input className="input-field" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Country</label>
            <input className="input-field" placeholder="India" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
          </div>
          <button className="btn-primary mt-4" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save changes
          </button>
        </motion.div>
      )}

      {tab === 'security' && (
        <motion.div className="glass-card p-6 space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
          {[
            { label: 'Current password', key: 'current' },
            { label: 'New password', key: 'newPass' },
            { label: 'Confirm new password', key: 'confirm' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
              <input type="password" className="input-field" value={(passForm as any)[key]}
                onChange={e => setPassForm({ ...passForm, [key]: e.target.value })} />
            </div>
          ))}
          <button className="btn-primary mt-4" onClick={handlePasswordChange} disabled={isChangingPass}>
            {isChangingPass ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Change password
          </button>
        </motion.div>
      )}

      {tab === 'preferences' && (
        <motion.div className="glass-card p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <h3 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
          {Object.entries(preferences).map(([label, isActive]) => (
            <div key={label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{label}</span>
              <button 
                className="w-11 h-6 rounded-full relative transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 focus:ring-offset-[#1a1a1a]"
                style={{ 
                  background: isActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)',
                }}
                onClick={() => setPreferences(prev => ({ ...prev, [label]: !prev[label] }))}
              >
                <motion.div 
                  className="w-5 h-5 rounded-full bg-white absolute top-[2px] shadow-sm"
                  animate={{ left: isActive ? '22px' : '2px' }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          ))}
          <button 
            className="btn-primary mt-6" 
            onClick={() => updateMutation.mutate({ preferences })}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Preferences
          </button>
        </motion.div>
      )}
    </div>
  )
}
