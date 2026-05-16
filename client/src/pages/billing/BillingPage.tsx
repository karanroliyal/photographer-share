import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, Zap, HardDrive, Video, Download, BarChart3, Headphones, Loader2, AlertTriangle } from 'lucide-react'
import { billingApi } from '@/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// ── Helpers ──────────────────────────────────────────────────────────────────

declare global {
  interface Window { Razorpay: any }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function FeatureRow({ label, free, basic, pro, enterprise }: {
  label: string; free?: boolean; basic?: boolean; pro?: boolean; enterprise?: boolean
}) {
  const Cell = ({ v }: { v?: boolean }) => (
    <td className="px-4 py-3 text-center">
      {v ? <Check size={16} className="mx-auto" style={{ color: '#22c55e' }} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
    </td>
  )
  return (
    <tr style={{ borderBottom: '1px solid var(--border)' }}>
      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</td>
      <Cell v={free} /><Cell v={basic} /><Cell v={pro} /><Cell v={enterprise} />
    </tr>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BillingPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: () => billingApi.getPlans().then(r => r.data.data),
  })

  const { data: sub } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => billingApi.getSubscription().then(r => r.data.data),
  })

  const { data: payments = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => billingApi.getInvoices({ limit: 5 }).then(r => r.data.data),
  })

  const verifyMutation = useMutation({
    mutationFn: (data: object) => billingApi.verifyRazorpay(data),
    onSuccess: () => {
      toast.success('🎉 Payment successful! Plan activated.')
      qc.invalidateQueries({ queryKey: ['subscription'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Payment verification failed'),
  })

  const cancelMutation = useMutation({
    mutationFn: () => billingApi.cancelSubscription(),
    onSuccess: () => {
      toast.success('Subscription cancelled.')
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Cancel failed'),
  })

  const resumeMutation = useMutation({
    mutationFn: () => billingApi.resumeSubscription(),
    onSuccess: () => {
      toast.success('Subscription resumed!')
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Resume failed'),
  })

  const handleUpgrade = async (plan: any) => {
    if (plan.is_custom) {
      toast('Contact sales for Enterprise plans — enterprise@photoselect.app', { icon: '📧' })
      return
    }
    if (plan.price_inr === 0) {
      toast('You are already on the free plan.', { icon: 'ℹ️' })
      return
    }

    try {
      const loaded = await loadRazorpayScript()
      if (!loaded) { toast.error('Could not load payment gateway'); return }

      const { data } = await billingApi.createRazorpayOrder(plan.id)
      const orderData = data.data

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'PhotoSelect',
        description: `${orderData.plan.name} Plan`,
        order_id: orderData.order_id,
        prefill: orderData.prefill,
        theme: { color: '#6c63ff' },
        handler: (response: any) => {
          verifyMutation.mutate({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            plan_id: plan.id,
          })
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Could not initiate payment')
    }
  }

  const currentPlanSlug = sub?.plan?.slug ?? user?.subscription?.plan?.slug
  const currentPlanName = sub?.plan?.name ?? user?.subscription?.plan?.name ?? 'Free'

  const daysLeft = sub?.current_period_end 
    ? Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="page-container max-w-5xl">
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Billing & Plans</h1>
      <div className="flex items-center flex-wrap gap-2 mb-8 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span>Current plan:</span>
        <span className="font-semibold" style={{ color: '#a78bfa' }}>
          {currentPlanName}
        </span>
        
        {daysLeft !== null && (sub?.status === 'ACTIVE' || sub?.status === 'CANCELED') && (
          <span className="ml-2 badge" style={{ background: 'rgba(108,99,255,0.1)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.2)' }}>
            Expires in {daysLeft} days ({new Date(sub.current_period_end).toLocaleDateString()})
          </span>
        )}

        {sub?.canceled_at && (
          <span className="ml-2 badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle size={10} /> Cancels {new Date(sub.current_period_end).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {plans.map((plan: any, i: number) => {
          const isCurrent = plan.slug === currentPlanSlug
          const price = plan.price_inr > 0
            ? `₹${(plan.price_inr / 100).toLocaleString()}`
            : plan.is_custom ? 'Custom' : 'Free'

          return (
            <motion.div
              key={plan.id}
              className={`glass-card p-5 relative overflow-hidden ${plan.is_featured ? 'glow-purple' : ''}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              style={{ border: plan.is_featured ? '1px solid rgba(108,99,255,0.4)' : undefined }}
            >
              {plan.is_featured && (
                <div className="absolute top-3 right-3">
                  <span className="badge badge-purple"><Zap size={9} /> Popular</span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute top-3 left-3">
                  <span className="badge badge-green"><Check size={9} /> Current</span>
                </div>
              )}

              <div className="mt-4 mb-4">
                <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{plan.description}</p>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold gradient-text">{price}</span>
                  {plan.price_inr > 0 && <span className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>/mo</span>}
                </div>
              </div>

              <div className="space-y-2 mb-5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <div className="flex items-center gap-2">
                  <HardDrive size={12} />
                  {plan.storage_limit_gb === 0 ? 'Unlimited storage' : `${plan.storage_limit_gb} GB storage`}
                </div>
                {plan.allow_video_uploads && <div className="flex items-center gap-2"><Video size={12} /> Video uploads</div>}
                {plan.allow_zip_download && <div className="flex items-center gap-2"><Download size={12} /> ZIP downloads</div>}
                {plan.allow_analytics && <div className="flex items-center gap-2"><BarChart3 size={12} /> Analytics</div>}
                <div className="flex items-center gap-2">
                  <Headphones size={12} /> {plan.support_level.charAt(0) + plan.support_level.slice(1).toLowerCase()} support
                </div>
              </div>

              <button
                className={isCurrent
                  ? 'btn-secondary w-full justify-center py-2 text-sm'
                  : 'btn-primary w-full justify-center py-2 text-sm'}
                disabled={isCurrent || verifyMutation.isPending}
                onClick={() => !isCurrent && handleUpgrade(plan)}
              >
                {verifyMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                {isCurrent ? 'Current Plan' : plan.is_custom ? 'Contact Sales' : plan.price_inr === 0 ? 'Select' : 'Upgrade →'}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Cancel/Resume subscription */}
      {sub && (sub.status === 'ACTIVE' || sub.status === 'CANCELED') && (
        <div className="mb-8 glass-card p-4 flex items-center justify-between">
          {!sub.canceled_at ? (
            <>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Cancel subscription</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Your plan will remain active until the end of the billing period.
                </p>
              </div>
              <button
                className="py-2 px-4 text-sm font-medium rounded-xl transition-all"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
                disabled={cancelMutation.isPending}
                onClick={() => confirm('Cancel your subscription? You will retain access until the end of the billing period.') && cancelMutation.mutate()}
              >
                {cancelMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Cancel Plan'}
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Resume subscription</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Your plan is scheduled to cancel on {new Date(sub.current_period_end).toLocaleDateString()}. Resume to keep your benefits.
                </p>
              </div>
              <button
                className="btn-primary py-2 px-4 text-sm font-medium"
                disabled={resumeMutation.isPending}
                onClick={() => confirm('Resume your subscription? Your auto-renewal will be reactivated.') && resumeMutation.mutate()}
              >
                {resumeMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : 'Resume Plan'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Feature comparison table */}
      <div className="glass-card overflow-hidden mb-8">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Feature</th>
              {['Free', 'Basic', 'Pro', 'Enterprise'].map(p => (
                <th key={p} className="px-4 py-3 text-xs font-semibold text-center" style={{ color: 'var(--text-secondary)' }}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <FeatureRow label="Video uploads" free={false} basic pro enterprise />
            <FeatureRow label="ZIP download" free={false} basic pro enterprise />
            <FeatureRow label="Password links" free={false} basic pro enterprise />
            <FeatureRow label="Watermark removal" free={false} basic={false} pro enterprise />
            <FeatureRow label="Custom domain" free={false} basic={false} pro={false} enterprise />
            <FeatureRow label="White label" free={false} basic={false} pro={false} enterprise />
            <FeatureRow label="Analytics" free={false} basic={false} pro enterprise />
            <FeatureRow label="Webhooks" free={false} basic={false} pro enterprise />
            <FeatureRow label="API access" free={false} basic={false} pro={false} enterprise />
          </tbody>
        </table>
      </div>

      {/* Recent payments */}
      {payments.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Payments</h2>
          <div className="glass-card overflow-hidden">
            {payments.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.invoice?.invoice_number ?? p.provider_payment_id?.slice(0, 20)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(p.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}{p.provider}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {p.currency === 'INR' ? '₹' : '$'}{(p.amount / 100).toLocaleString()}
                  </span>
                  <span className={`badge ${p.status === 'SUCCESS' ? 'badge-green' : 'badge-red'}`}>
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
