import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2, ArrowLeft, Mail } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api'
import toast from 'react-hot-toast'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  const mutation = useMutation({
    mutationFn: () => authApi.forgotPassword({ email }),
    onSuccess: () => setSent(true),
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to send reset email'),
  })

  if (sent) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{ textAlign: 'center', padding: '8px 0' }}
      >
        <div style={{
          width: '64px', height: '64px', borderRadius: '20px',
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <Mail size={28} style={{ color: '#22c55e' }} />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#f0f0ff', marginBottom: '10px' }}>
          Check your inbox
        </h2>
        <p style={{ fontSize: '14px', color: '#8b8ba7', lineHeight: 1.7, marginBottom: '28px' }}>
          We sent a password reset link to<br />
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>{email}</span>
        </p>
        <p style={{ fontSize: '13px', color: '#4a4a6a' }}>
          Didn't receive it?{' '}
          <button
            onClick={() => setSent(false)}
            style={{ color: '#6c63ff', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            Try again
          </button>
        </p>
      </motion.div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '26px', fontWeight: 700, color: '#f0f0ff',
          letterSpacing: '-0.3px', marginBottom: '8px',
        }}>
          Reset your password
        </h2>
        <p style={{ fontSize: '14px', color: '#8b8ba7', lineHeight: 1.5 }}>
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); mutation.mutate() }}>
        <div style={{ marginBottom: '24px' }}>
          <label style={{
            display: 'block', fontSize: '13px', fontWeight: 500,
            color: '#8b8ba7', marginBottom: '8px',
          }}>
            Email address
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={{
              width: '100%', padding: '12px 16px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px', color: '#f0f0ff',
              fontSize: '14px', outline: 'none',
              fontFamily: "'Inter', sans-serif",
            }}
            onFocus={e => {
              e.target.style.borderColor = 'rgba(108,99,255,0.5)'
              e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.12)'
            }}
            onBlur={e => {
              e.target.style.borderColor = 'rgba(255,255,255,0.08)'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        <motion.button
          type="submit"
          disabled={mutation.isPending}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%', padding: '13px 20px',
            background: mutation.isPending ? 'rgba(108,99,255,0.5)' : 'linear-gradient(135deg, #6c63ff, #8b5cf6)',
            border: 'none', borderRadius: '12px',
            color: 'white', fontSize: '15px', fontWeight: 600,
            cursor: mutation.isPending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: mutation.isPending ? 'none' : '0 8px 24px rgba(108,99,255,0.35)',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Sending...</> : 'Send reset link'}
        </motion.button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '28px' }}>
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          color: '#8b8ba7', fontSize: '14px', textDecoration: 'none',
          fontWeight: 500,
        }}>
          <ArrowLeft size={14} /> Back to sign in
        </Link>
      </div>
    </div>
  )
}
