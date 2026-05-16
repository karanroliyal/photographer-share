import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/api'
import toast from 'react-hot-toast'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [showPass, setShowPass] = useState(false)
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => authApi.resetPassword(token, password),
    onSuccess: () => {
      toast.success('Password reset successfully!')
      navigate('/login')
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Reset failed'),
  })

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Invalid reset link.</p>
        <Link to="/forgot-password" className="btn-primary mt-4 inline-flex">Request new link</Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Set new password</h2>
      <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
        Choose a strong password for your account.
      </p>
      <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>New password</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} className="input-field pr-12"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            <button type="button" onClick={() => setShowPass(!showPass)}
              className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full justify-center py-3" disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 size={16} className="animate-spin" /> Resetting...</> : <><KeyRound size={16} /> Reset password</>}
        </button>
      </form>
    </div>
  )
}
