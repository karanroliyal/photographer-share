import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, CheckCircle, Bookmark, ThumbsDown, Send, Loader2, Camera, X, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { galleryApi, downloadApi } from '@/api'
import toast from 'react-hot-toast'

const STATES = {
  SELECTED: { icon: CheckCircle, color: '#22c55e', label: 'Select' },
  FAVORITE: { icon: Heart, color: '#ef4444', label: 'Fave' },
  SHORTLISTED: { icon: Bookmark, color: '#f59e0b', label: 'Short' },
  REJECTED: { icon: ThumbsDown, color: '#4a4a6a', label: 'Skip' },
}

export function GalleryPage() {
  const { token } = useParams<{ token: string }>()
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'IMAGE' | 'VIDEO' | 'SELECTED'>('ALL')
  const [saveTimer, setSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const { data: gallery, isLoading: galleryLoading } = useQuery({
    queryKey: ['gallery', token],
    queryFn: () => galleryApi.get(token!).then(r => r.data.data),
    enabled: !!token,
  })

  const { data: media = [], isLoading: mediaLoading } = useQuery({
    queryKey: ['gallery-media', token],
    queryFn: () => galleryApi.getMedia(token!, { limit: 200 }).then(r => r.data.data),
    enabled: !!token,
  })

  useQuery({
    queryKey: ['gallery-selections', token],
    queryFn: () => galleryApi.getSelections(token!).then(r => r.data.data),
    enabled: !!token,
    onSuccess: (data: any[]) => {
      const map: Record<string, string> = {}
      data.forEach(s => { map[s.media_file_id] = s.state })
      setSelections(map)
    },
  } as any)

  const saveMutation = useMutation({
    mutationFn: (sels: object[]) => galleryApi.saveSelections(token!, sels),
  })

  const submitMutation = useMutation({
    mutationFn: () => galleryApi.submit(token!),
    onSuccess: () => toast.success('🎉 Selections submitted to your photographer!'),
    onError: (e: any) => toast.error(e.response?.data?.message || 'Submit failed'),
  })

  const zipMutation = useMutation({
    mutationFn: () => downloadApi.createZip({ gallery_id: gallery?.gallery_id }),
    onSuccess: () => toast.success('ZIP is being prepared!'),
  })

  const selectedCount = Object.values(selections).filter(s => ['SELECTED', 'FAVORITE'].includes(s)).length

  const toggle = (fileId: string, state: string) => {
    // Check selection limit before updating
    if (['SELECTED', 'FAVORITE'].includes(state)) {
      const isCurrentlySelected = ['SELECTED', 'FAVORITE'].includes(selections[fileId])
      const max = gallery?.settings?.max_selections
      if (!isCurrentlySelected && max && selectedCount >= max) {
        toast.error(`You can only select up to ${max} photos.`)
        return
      }
    }

    setSelections(prev => {
      const next = { ...prev }
      if (prev[fileId] === state) delete next[fileId]
      else next[fileId] = state
      if (saveTimer) clearTimeout(saveTimer)
      const t = setTimeout(() => {
        const arr = Object.entries(next).map(([media_file_id, s]) => ({ media_file_id, state: s }))
        if (arr.length) saveMutation.mutate(arr)
      }, 2000)
      setSaveTimer(t)
      return next
    })
  }

  const filtered = (media as any[]).filter(f => {
    if (filter === 'IMAGE') return f.media_type === 'IMAGE'
    if (filter === 'VIDEO') return f.media_type === 'VIDEO'
    if (filter === 'SELECTED') return ['SELECTED', 'FAVORITE'].includes(selections[f.id])
    return true
  })

  if (galleryLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <Camera size={40} className="animate-pulse" style={{ color: 'var(--accent-primary)' }} />
    </div>
  )

  if (!gallery) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <div className="glass-card p-12 text-center max-w-sm mx-4">
        <X size={40} className="mx-auto mb-4" style={{ color: '#ef4444' }} />
        <h2 className="font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Gallery not found</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This link may have expired.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 px-6 py-3" style={{ background: 'rgba(10,10,15,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>{gallery.project.name}</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>by {gallery.photographer?.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {saveMutation.isPending && <Loader2 size={13} className="animate-spin" style={{ color: 'var(--text-muted)' }} />}
            <div className="px-3 py-1.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(108,99,255,0.12)', color: '#a78bfa' }}>
              {selectedCount}{gallery.settings.max_selections ? `/${gallery.settings.max_selections}` : ''} selected
            </div>
            {gallery.settings.allow_download && (
              <button className="btn-secondary py-1.5 px-3 text-sm" onClick={() => zipMutation.mutate()} disabled={selectedCount === 0}>
                <Download size={13} /> ZIP
              </button>
            )}
            {!gallery.is_submitted && (
              <button 
                className="btn-primary py-2 px-4" 
                onClick={() => submitMutation.mutate()} 
                disabled={
                  submitMutation.isPending || 
                  selectedCount === 0 || 
                  (!!gallery.settings.max_selections && selectedCount > gallery.settings.max_selections) ||
                  (!!gallery.settings.min_selections && selectedCount < gallery.settings.min_selections)
                }
              >
                {submitMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Submit
              </button>
            )}
            {gallery.is_submitted && (
              <span className="badge badge-green"><CheckCircle size={11} /> Submitted</span>
            )}
          </div>
        </div>
        {/* Filter tabs */}
        <div className="max-w-7xl mx-auto flex gap-2 mt-2">
          {(['ALL', 'IMAGE', 'VIDEO', 'SELECTED'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="text-xs px-3 py-1 rounded-lg transition-all"
              style={{ background: filter === f ? 'rgba(108,99,255,0.15)' : 'transparent', color: filter === f ? '#a78bfa' : 'var(--text-muted)' }}>
              {f === 'SELECTED' ? `Selected (${selectedCount})` : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-6 py-5">
        {mediaLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...Array(15)].map((_, i) => <div key={i} className="aspect-square shimmer rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {filtered.map((file: any, idx: number) => {
              const state = selections[file.id]
              const cfg = state ? STATES[state as keyof typeof STATES] : null
              return (
                <motion.div
                  key={file.id}
                  className="relative group aspect-square rounded-xl overflow-hidden cursor-pointer"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(idx * 0.015, 0.5) }}
                  style={{ border: cfg ? `2px solid ${cfg.color}` : '2px solid transparent', boxShadow: cfg ? `0 0 16px ${cfg.color}30` : 'none' }}
                >
                  {file.thumb_url ? (
                    <img
                      src={file.thumb_url}
                      alt={file.original_filename}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                      onClick={() => setLightboxIdx(idx)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: 'rgba(108,99,255,0.08)' }}
                      onClick={() => setLightboxIdx(idx)}>
                      <Camera size={24} style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                  {cfg && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: cfg.color }}>
                      <cfg.icon size={12} color="white" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <div className="flex gap-1 w-full">
                      {Object.entries(STATES).map(([key, c]) => (
                        <button key={key} onClick={e => { e.stopPropagation(); toggle(file.id, key) }}
                          className="flex-1 flex items-center justify-center py-1.5 rounded-lg text-white text-xs transition-all"
                          style={{ background: selections[file.id] === key ? c.color : 'rgba(255,255,255,0.1)' }}
                          title={c.label}>
                          <c.icon size={12} />
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.95)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setLightboxIdx(null)}>
            <button className="absolute top-4 right-4 p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }} onClick={() => setLightboxIdx(null)}>
              <X size={18} color="white" />
            </button>
            <button className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? (i - 1 + filtered.length) % filtered.length : 0) }}>
              <ChevronLeft size={20} color="white" />
            </button>
            <button className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}
              onClick={e => { e.stopPropagation(); setLightboxIdx(i => i !== null ? (i + 1) % filtered.length : 0) }}>
              <ChevronRight size={20} color="white" />
            </button>
            <motion.img key={lightboxIdx} src={filtered[lightboxIdx]?.large_url || filtered[lightboxIdx]?.thumb_url || ''}
              className="max-w-5xl max-h-[80vh] object-contain rounded-xl" onClick={e => e.stopPropagation()}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} />
            <div className="absolute bottom-6 flex gap-2">
              {Object.entries(STATES).map(([key, c]) => (
                <button key={key} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all"
                  style={{ background: selections[filtered[lightboxIdx]?.id] === key ? c.color : 'rgba(255,255,255,0.1)' }}
                  onClick={e => { e.stopPropagation(); toggle(filtered[lightboxIdx]?.id, key) }}>
                  <c.icon size={13} /> {c.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
