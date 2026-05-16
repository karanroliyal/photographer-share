import { Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, Link2, CheckSquare, Package, Lock } from 'lucide-react'

const features = [
  { icon: Link2,        text: 'Shareable gallery links in seconds' },
  { icon: CheckSquare,  text: 'Client selection with autosave' },
  { icon: Package,      text: 'One-click ZIP download' },
  { icon: Lock,         text: 'Secure, watermarked previews' },
]

export function AuthLayout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#09090f' }}>

      {/* ── Left branding ── */}
      <div
        className="auth-panel"
        style={{
          display: 'none',
          flexDirection: 'column',
          width: '440px',
          flexShrink: 0,
          padding: '48px 44px',
          background: '#0c0c18',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background gradient blob */}
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,111,247,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '100px', right: '-60px',
          width: '240px', height: '240px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,111,247,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '60px', position: 'relative', zIndex: 1 }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'linear-gradient(135deg, #7c6ff7, #9c8ffa)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(124,111,247,0.35)' }}>
            <Camera size={18} color="white" />
          </div>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#f1f1fd', letterSpacing: '-0.3px' }}>
            Photo<span style={{ color: '#a89af9' }}>Select</span>
          </span>
        </div>

        {/* Headline */}
        <motion.div style={{ position: 'relative', zIndex: 1, flex: 1 }}
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <h1 style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.25, color: '#f1f1fd', letterSpacing: '-0.5px', marginBottom: '16px' }}>
            The smarter way to{' '}
            <span style={{ background: 'linear-gradient(135deg, #7c6ff7, #a89af9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              deliver photos
            </span>{' '}
            to clients
          </h1>
          <p style={{ fontSize: '14px', color: '#8e8ea8', lineHeight: 1.7, marginBottom: '36px' }}>
            Upload, share, and let clients select their favourite shots — no logins, no friction.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {features.map(({ icon: Icon, text }, i) => (
              <motion.div
                key={i}
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
              >
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(124,111,247,0.1)', border: '1px solid rgba(124,111,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} style={{ color: '#a89af9' }} />
                </div>
                <span style={{ fontSize: '13.5px', color: '#8e8ea8', fontWeight: 500 }}>{text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Testimonial */}
        <motion.div
          style={{
            position: 'relative', zIndex: 1,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '14px', padding: '18px 20px',
          }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <div style={{ display: 'flex', gap: '3px', marginBottom: '10px' }}>
            {[...Array(5)].map((_, i) => <span key={i} style={{ color: '#f59e0b', fontSize: '13px' }}>★</span>)}
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#8e8ea8', marginBottom: '14px' }}>
            "My clients love how easy it is to select photos. No more back-and-forth emails!"
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c6ff7, #9c8ffa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
              RK
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#f1f1fd' }}>Rahul Kumar</p>
              <p style={{ fontSize: '12px', color: '#484860' }}>Wedding Photographer</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Right form panel ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', background: '#09090f' }}>
        <motion.div
          style={{ width: '100%', maxWidth: '400px' }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          {/* Mobile logo */}
          <div className="auth-mobile-logo" style={{ display: 'none', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, #7c6ff7, #9c8ffa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={16} color="white" />
            </div>
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#f1f1fd' }}>
              Photo<span style={{ color: '#a89af9' }}>Select</span>
            </span>
          </div>

          {/* Card */}
          <div style={{
            background: '#0e0e1a',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '20px',
            padding: '36px 32px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <Outlet />
          </div>
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .auth-panel { display: flex !important; }
          .auth-mobile-logo { display: none !important; }
        }
        @media (max-width: 767px) {
          .auth-mobile-logo { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
