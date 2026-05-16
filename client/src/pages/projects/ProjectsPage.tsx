import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, FolderOpen, Search, Archive, Trash2, Copy, MoreVertical, Calendar, Image, Loader2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { projectApi } from '@/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

/* ── Create Modal ─────────────────────────────────────────────── */
function CreateProjectModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', description: '', tags: '' })

  const mutation = useMutation({
    mutationFn: () => projectApi.create({ ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [] }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project created!'); onClose() },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed'),
  })

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 13px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '9px', color: '#f1f1fd',
    fontSize: '14px', outline: 'none', fontFamily: 'Inter, sans-serif',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        style={{ width: '100%', maxWidth: '440px', background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px', padding: '28px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#f1f1fd', letterSpacing: '-0.3px' }}>New Project</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#484860', padding: '4px', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); mutation.mutate() }} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#8e8ea8', marginBottom: '7px' }}>Project name *</label>
            <input style={inp} placeholder="e.g. John & Sarah Wedding"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
              onFocus={e => { e.target.style.borderColor = 'rgba(124,111,247,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(124,111,247,0.08)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#8e8ea8', marginBottom: '7px' }}>Description</label>
            <textarea style={{ ...inp, resize: 'none' }} rows={3} placeholder="Optional description"
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              onFocus={e => { e.target.style.borderColor = 'rgba(124,111,247,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(124,111,247,0.08)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 500, color: '#8e8ea8', marginBottom: '7px' }}>Tags</label>
            <input style={inp} placeholder="wedding, portrait (comma separated)"
              value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })}
              onFocus={e => { e.target.style.borderColor = 'rgba(124,111,247,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(124,111,247,0.08)' }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#8e8ea8', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#7c6ff7', border: 'none', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 4px 14px rgba(124,111,247,0.3)' }}>
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

/* ── Projects Page ────────────────────────────────────────────── */
export function ProjectsPage() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', { search, is_archived: showArchived }],
    queryFn: () => projectApi.list({ search: search || undefined, is_archived: showArchived }).then(r => r.data),
  })

  const archiveMutation = useMutation({ mutationFn: (id: string) => projectApi.archive(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Archived') } })
  const restoreMutation = useMutation({ mutationFn: (id: string) => projectApi.restore(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Restored') } })
  const duplicateMutation = useMutation({ mutationFn: (id: string) => projectApi.duplicate(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Duplicated') } })
  const deleteMutation = useMutation({ mutationFn: (id: string) => projectApi.delete(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Deleted') } })

  const projects = data?.data ?? []
  const total = data?.pagination?.total ?? 0

  return (
    <div className="page-container" style={{ maxWidth: '1200px' }}>
      <AnimatePresence>{showCreate && <CreateProjectModal onClose={() => setShowCreate(false)} />}</AnimatePresence>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f1fd', letterSpacing: '-0.4px', marginBottom: '4px' }}>Projects</h1>
          <p style={{ fontSize: '13.5px', color: '#8e8ea8' }}>{total} project{total !== 1 ? 's' : ''} total</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ padding: '9px 16px', fontSize: '13px' }}>
          <Plus size={15} /> New Project
        </button>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#484860', pointerEvents: 'none' }} />
          <input
            className="input-field"
            style={{ paddingLeft: '36px', fontSize: '13.5px' }}
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => setShowArchived(!showArchived)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 14px', borderRadius: '9px', fontSize: '13px', fontWeight: 500,
            background: showArchived ? 'rgba(124,111,247,0.12)' : 'rgba(255,255,255,0.05)',
            border: showArchived ? '1px solid rgba(124,111,247,0.3)' : '1px solid rgba(255,255,255,0.08)',
            color: showArchived ? '#a89af9' : '#8e8ea8',
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          <Archive size={14} /> {showArchived ? 'Archived' : 'Active'}
        </button>
      </div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height: '160px', background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px' }} className="shimmer" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div style={{ background: '#0e0e1a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '15px', background: 'rgba(124,111,247,0.1)', border: '1px solid rgba(124,111,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <FolderOpen size={22} style={{ color: '#7c6ff7' }} />
          </div>
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#f1f1fd', marginBottom: '6px' }}>
            {showArchived ? 'No archived projects' : 'No projects yet'}
          </p>
          <p style={{ fontSize: '13.5px', color: '#8e8ea8', marginBottom: '20px' }}>
            {showArchived ? 'Archived projects will appear here.' : 'Create your first project to start sharing galleries.'}
          </p>
          {!showArchived && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Create project
            </button>
          )}
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {projects.map((p: any, i: number) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  background: '#0e0e1a',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '14px', padding: '20px',
                  position: 'relative',
                  transition: 'border-color .2s, transform .2s, box-shadow .2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'rgba(124,111,247,0.25)', transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }) }}
                onMouseLeave={e => { Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'rgba(255,255,255,0.07)', transform: 'translateY(0)', boxShadow: 'none' }) }}
              >
                {/* Purple top accent line */}
                <div style={{ position: 'absolute', top: 0, left: '20px', right: '20px', height: '2px', background: 'linear-gradient(90deg, #7c6ff7, transparent)', borderRadius: '0 0 4px 4px' }} />

                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: 'rgba(124,111,247,0.1)', border: '1px solid rgba(124,111,247,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FolderOpen size={18} style={{ color: '#7c6ff7' }} />
                  </div>

                  {/* Actions */}
                  <div style={{ position: 'relative' }}>
                    <button
                      style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '7px', padding: '5px 7px', cursor: 'pointer', color: '#484860', display: 'flex', alignItems: 'center' }}
                      onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === p.id ? null : p.id) }}
                    >
                      <MoreVertical size={14} />
                    </button>
                    {activeMenu === p.id && (
                      <div
                        style={{ position: 'absolute', right: 0, top: '32px', zIndex: 20, width: '160px', background: '#141424', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.4)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {[
                          { icon: Copy, label: 'Duplicate', action: () => { duplicateMutation.mutate(p.id); setActiveMenu(null) }, color: '#8e8ea8' },
                          { icon: Archive, label: showArchived ? 'Restore' : 'Archive', action: () => { (showArchived ? restoreMutation : archiveMutation).mutate(p.id); setActiveMenu(null) }, color: '#8e8ea8' },
                          { icon: Trash2, label: 'Delete', action: () => { if (confirm('Delete this project?')) { deleteMutation.mutate(p.id); setActiveMenu(null) } }, color: '#ef4444' },
                        ].map(({ icon: Icon, label, action, color }) => (
                          <button key={label} onClick={action} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', color, fontFamily: 'Inter, sans-serif', textAlign: 'left' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
                          >
                            <Icon size={13} /> {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Link to={`/projects/${p.id}`} style={{ textDecoration: 'none' }}>
                  <h3 style={{ fontSize: '14.5px', fontWeight: 700, color: '#f1f1fd', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.2px' }}>
                    {p.name}
                  </h3>
                  {p.description && (
                    <p style={{ fontSize: '12.5px', color: '#8e8ea8', marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
                      {p.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: p.description ? 0 : '14px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#484860' }}>
                      <Image size={11} /> {p._count?.albums ?? 0} albums
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#484860' }}>
                      <Calendar size={11} /> {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  )
}
