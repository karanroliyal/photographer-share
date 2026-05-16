import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const fieldStyle = {
  width: '100%', padding: '12px 16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '12px', color: '#f0f0ff',
  fontSize: '14px', outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  fontFamily: "'Inter', sans-serif",
}

const fieldFocus = {
  borderColor: 'rgba(108,99,255,0.5)',
  boxShadow: '0 0 0 3px rgba(108,99,255,0.12)',
}
const fieldBlur = { borderColor: 'rgba(255,255,255,0.08)', boxShadow: 'none' }

const labelStyle = {
  display: 'block', fontSize: '13px', fontWeight: 500 as const,
  color: '#8b8ba7', marginBottom: '8px',
}

export function SignupPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', password: '' })

  const signupMutation = useMutation({
    mutationFn: () => authApi.signup(form),
    onSuccess: () => {
      toast.success('Account created! Please verify your email.')
      navigate('/login')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Signup failed')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    signupMutation.mutate()
  }

  // Password strength
  const pw = form.password
  const strength = pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) ? 3
    : pw.length >= 8 ? 2 : pw.length >= 4 ? 1 : 0
  const strengthColors = ['', '#ef4444', '#f59e0b', '#22c55e']
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong']

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 12px', borderRadius: '100px',
          background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)',
          marginBottom: '14px',
        }}>
          <Sparkles size={12} style={{ color: '#a78bfa' }} />
          <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600 }}>Free forever plan included</span>
        </div>
        <h2 style={{
          fontSize: '26px', fontWeight: 700, color: '#f0f0ff',
          letterSpacing: '-0.3px', marginBottom: '8px',
        }}>
          Create your account
        </h2>
        <p style={{ fontSize: '14px', color: '#8b8ba7' }}>
          Start sharing photos with clients for free
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Name */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>Full name</label>
          <input
            type="text"
            placeholder="Your name"
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            required
            style={fieldStyle}
            onFocus={e => Object.assign(e.target.style, fieldFocus)}
            onBlur={e => Object.assign(e.target.style, fieldBlur)}
          />
        </div>

        {/* Email */}
        <div style={{ marginBottom: '18px' }}>
          <label style={labelStyle}>Email address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
            style={fieldStyle}
            onFocus={e => Object.assign(e.target.style, fieldFocus)}
            onBlur={e => Object.assign(e.target.style, fieldBlur)}
          />
        </div>

        {/* Password */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
              style={{ ...fieldStyle, paddingRight: '48px' }}
              onFocus={e => Object.assign(e.target.style, { ...fieldFocus, paddingRight: '48px' })}
              onBlur={e => Object.assign(e.target.style, { ...fieldBlur, paddingRight: '48px' })}
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{
                position: 'absolute', right: '14px', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: '#4a4a6a',
                display: 'flex', alignItems: 'center', padding: '4px',
              }}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {/* Strength bar */}
          {pw.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    flex: 1, height: '3px', borderRadius: '2px',
                    background: i <= strength ? strengthColors[strength] : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>
              <p style={{ fontSize: '12px', color: strengthColors[strength] || '#4a4a6a' }}>
                {pw.length > 0 ? strengthLabels[strength] || 'Too short' : ''}
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <motion.button
          type="submit"
          disabled={signupMutation.isPending}
          whileHover={{ scale: signupMutation.isPending ? 1 : 1.01 }}
          whileTap={{ scale: signupMutation.isPending ? 1 : 0.98 }}
          style={{
            width: '100%', padding: '13px 20px',
            background: signupMutation.isPending
              ? 'rgba(108,99,255,0.5)'
              : 'linear-gradient(135deg, #6c63ff 0%, #8b5cf6 100%)',
            border: 'none', borderRadius: '12px',
            color: 'white', fontSize: '15px', fontWeight: 600,
            cursor: signupMutation.isPending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: signupMutation.isPending ? 'none' : '0 8px 24px rgba(108,99,255,0.35)',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {signupMutation.isPending ? (
            <><Loader2 size={16} className="animate-spin" /> Creating account...</>
          ) : (
            <>Create free account <ArrowRight size={15} /></>
          )}
        </motion.button>

        <p style={{ textAlign: 'center', fontSize: '12px', color: '#4a4a6a', marginTop: '14px' }}>
          By signing up, you agree to our{' '}
          <span style={{ color: '#6c63ff' }}>Terms</span> &{' '}
          <span style={{ color: '#6c63ff' }}>Privacy Policy</span>
        </p>
      </form>

      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0',
      }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
        <span style={{ fontSize: '12px', color: '#4a4a6a' }}>or</span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
      </div>

      <p style={{ textAlign: 'center', fontSize: '14px', color: '#8b8ba7' }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#a78bfa', fontWeight: 600, textDecoration: 'none' }}>
          Sign in →
        </Link>
      </p>
    </div>
  )
}
