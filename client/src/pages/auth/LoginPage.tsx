import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px', color: '#f1f1fd',
  fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
  transition: 'border-color .2s, box-shadow .2s',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: '13px',
  fontWeight: 500, color: '#8e8ea8', marginBottom: '7px',
}
const focus = (e: any) => {
  e.target.style.borderColor = 'rgba(124,111,247,0.5)'
  e.target.style.boxShadow  = '0 0 0 3px rgba(124,111,247,0.08)'
}
const blur = (e: any) => {
  e.target.style.borderColor = 'rgba(255,255,255,0.08)'
  e.target.style.boxShadow  = 'none'
}

export function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const loginMutation = useMutation({
    mutationFn: () => authApi.login(form),
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.accessToken)
      toast.success(`Welcome back, ${res.data.user.full_name}!`)
      navigate(res.data.user.role === 'ADMIN' ? '/admin' : '/dashboard')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Login failed'),
  })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f1fd', letterSpacing: '-0.4px', marginBottom: '6px' }}>
          Welcome back
        </h2>
        <p style={{ fontSize: '13.5px', color: '#8e8ea8' }}>Sign in to your PhotoSelect account</p>
      </div>

      <form onSubmit={e => { e.preventDefault(); loginMutation.mutate() }}>
        <div style={{ marginBottom: '16px' }}>
          <label style={label}>Email address</label>
          <input
            type="email" placeholder="you@example.com"
            value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
            required autoComplete="email" style={inp}
            onFocus={focus} onBlur={blur}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
            <label style={{ ...label, marginBottom: 0 }}>Password</label>
            <Link to="/forgot-password" style={{ fontSize: '13px', color: '#7c6ff7', fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'} placeholder="••••••••"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              required autoComplete="current-password"
              style={{ ...inp, paddingRight: '46px' }}
              onFocus={focus} onBlur={blur}
            />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#484860', display: 'flex' }}>
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <motion.button
          type="submit"
          disabled={loginMutation.isPending}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px',
            background: loginMutation.isPending ? 'rgba(124,111,247,0.5)' : '#7c6ff7',
            color: 'white', border: 'none', fontSize: '14px', fontWeight: 600,
            cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            fontFamily: 'Inter, sans-serif',
            boxShadow: loginMutation.isPending ? 'none' : '0 4px 14px rgba(124,111,247,0.35)',
          }}
        >
          {loginMutation.isPending
            ? <><Loader2 size={15} className="animate-spin" /> Signing in...</>
            : <>Sign in <ArrowRight size={14} /></>
          }
        </motion.button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '24px 0' }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
        <span style={{ fontSize: '12px', color: '#484860' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
      </div>

      <p style={{ textAlign: 'center', fontSize: '13.5px', color: '#8e8ea8' }}>
        Don't have an account?{' '}
        <Link to="/signup" style={{ color: '#a89af9', fontWeight: 600 }}>Sign up free →</Link>
      </p>
    </div>
  )
}
