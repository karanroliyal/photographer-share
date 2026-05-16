import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Upload, Plus, FolderOpen, Image, Share2,
  Link2, Eye, Loader2, MoreVertical, Trash2, Archive,
  Calendar, Users, CheckCircle
} from 'lucide-react'
import { projectApi, albumApi, galleryApi, mediaApi, downloadApi } from '@/api'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [showCreateAlbum, setShowCreateAlbum] = useState(false)
  const [showCreateGallery, setShowCreateGallery] = useState(false)
  const [albumName, setAlbumName] = useState('')
  const [galleryForm, setGalleryForm] = useState({ client_name: '', client_email: '', max_selections: '' })
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectApi.get(id!).then(r => r.data.data),
  })

  const { data: galleriesData } = useQuery({
    queryKey: ['galleries', id],
    queryFn: () => galleryApi.listAll({ projectId: id }).then(r => r.data),
  })

  const createAlbumMutation = useMutation({
    mutationFn: () => albumApi.create({ project_id: id, name: albumName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Album created!'); setAlbumName(''); setShowCreateAlbum(false)
    },
  })

  const deleteAlbumMutation = useMutation({
    mutationFn: (albumId: string) => albumApi.delete(albumId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); toast.success('Album deleted') },
  })

  const createGalleryMutation = useMutation({
    mutationFn: () => galleryApi.create({
      project_id: id,
      client_name: galleryForm.client_name || undefined,
      client_email: galleryForm.client_email || undefined,
      max_selections: galleryForm.max_selections ? Number(galleryForm.max_selections) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['galleries', id] })
      toast.success('Gallery link created!'); setShowCreateGallery(false)
    },
  })

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="shimmer h-8 w-48 mb-4 rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="shimmer h-32 rounded-xl" />)}
        </div>
      </div>
    )
  }

  const galleries = galleriesData?.data ?? []

  return (
    <div className="page-container">
      {/* Back + title */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/projects" className="btn-secondary py-2 px-3"><ArrowLeft size={15} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{project?.name}</h1>
          {project?.description && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{project.description}</p>
          )}
        </div>
        <Link to={`/projects/${id}/upload`} className="btn-primary">
          <Upload size={15} /> Upload
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Albums', value: project?.albums?.length ?? 0, icon: FolderOpen, color: '#6c63ff' },
          { label: 'Galleries', value: project?._count?.client_galleries ?? 0, icon: Users, color: '#22c55e' },
          { label: 'Share Links', value: project?._count?.share_links ?? 0, icon: Link2, color: '#f59e0b' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${color}12`, border: `1px solid ${color}20` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Albums section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Albums</h2>
          <button className="btn-secondary py-2 px-3 text-sm" onClick={() => setShowCreateAlbum(true)}>
            <Plus size={14} /> New Album
          </button>
        </div>

        {showCreateAlbum && (
          <div className="glass-card p-4 mb-4 flex gap-3">
            <input className="input-field flex-1 py-2" placeholder="Album name"
              value={albumName} onChange={e => setAlbumName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && albumName && createAlbumMutation.mutate()}
              autoFocus />
            <button className="btn-primary py-2" onClick={() => createAlbumMutation.mutate()}
              disabled={!albumName || createAlbumMutation.isPending}>
              {createAlbumMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Create'}
            </button>
            <button className="btn-secondary py-2" onClick={() => setShowCreateAlbum(false)}>Cancel</button>
          </div>
        )}

        {project?.albums?.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <FolderOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No albums yet. Create one to organize photos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {project?.albums?.map((album: any, i: number) => (
              <motion.div key={album.id} className="glass-card-hover p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setSelectedAlbumId(album.id)}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(108,99,255,0.1)' }}>
                    <Image size={15} style={{ color: '#6c63ff' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{album.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {album._count?.media_files ?? 0} files
                    </p>
                  </div>
                </div>
                <button className="p-1.5 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => confirm('Delete album?') && deleteAlbumMutation.mutate(album.id)}>
                  <Trash2 size={13} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Client Galleries */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Client Galleries</h2>
          <button className="btn-secondary py-2 px-3 text-sm" onClick={() => setShowCreateGallery(true)}>
            <Plus size={14} /> Create Gallery
          </button>
        </div>

        {showCreateGallery && (
          <motion.div className="glass-card p-5 mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>New Client Gallery</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Client name</label>
                <input className="input-field py-2 text-sm" placeholder="Optional"
                  value={galleryForm.client_name} onChange={e => setGalleryForm({ ...galleryForm, client_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Client email</label>
                <input className="input-field py-2 text-sm" type="email" placeholder="Optional"
                  value={galleryForm.client_email} onChange={e => setGalleryForm({ ...galleryForm, client_email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Max selections</label>
                <input className="input-field py-2 text-sm" type="number" placeholder="Unlimited"
                  value={galleryForm.max_selections} onChange={e => setGalleryForm({ ...galleryForm, max_selections: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1 justify-center" onClick={() => createGalleryMutation.mutate()}
                disabled={createGalleryMutation.isPending}>
                {createGalleryMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <><Share2 size={14} /> Create Link</>}
              </button>
              <button className="btn-secondary" onClick={() => setShowCreateGallery(false)}>Cancel</button>
            </div>
          </motion.div>
        )}

        {galleries.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Share2 size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No galleries yet. Create one to share with clients.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {galleries.map((g: any) => (
              <div key={g.id} className="glass-card p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {g.client_name || 'Client Gallery'}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {g.view_count} views • {g._count?.selections ?? 0} selections
                    </span>
                    {g.is_submitted && <span className="badge badge-green"><CheckCircle size={10} /> Submitted</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ZipLinkButton galleryId={g.id} />
                  <button
                    className="btn-secondary py-1.5 px-3 text-xs"
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/gallery/${g.token}`); toast.success('Link copied!') }}
                  >
                    <Link2 size={12} /> Copy Link
                  </button>
                  <a href={`/gallery/${g.token}`} target="_blank" rel="noreferrer" className="btn-secondary py-1.5 px-3 text-xs">
                    <Eye size={12} /> Preview
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAlbumId && (
        <AlbumMediaModal 
          albumId={selectedAlbumId} 
          onClose={() => setSelectedAlbumId(null)} 
          albumName={project?.albums?.find((a: any) => a.id === selectedAlbumId)?.name} 
        />
      )}
    </div>
  )
}

import { X } from 'lucide-react'

function AlbumMediaModal({ albumId, onClose, albumName }: { albumId: string, onClose: () => void, albumName?: string }) {
  const { data: mediaFiles, isLoading } = useQuery({
    queryKey: ['album-media', albumId],
    queryFn: () => mediaApi.list(albumId).then(r => r.data.data),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        onClick={e => e.stopPropagation()}
        className="glass-card w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {albumName || 'Album Photos'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-purple-500" /></div>
          ) : !mediaFiles?.length ? (
            <div className="text-center p-10 text-sm text-gray-400">No photos in this album.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {mediaFiles.map((file: any) => (
                <div key={file.id} className="aspect-square bg-black/20 rounded-xl overflow-hidden border border-white/5">
                  <img src={file.thumb_medium_key ? `/uploads/${file.thumb_medium_key}` : `/uploads/${file.storage_key}`} 
                       alt="" 
                       className="w-full h-full object-cover" 
                       onError={(e) => {
                         // Fallback for missing thumbs/R2 proxy
                         (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM1NTViNmUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiI+PC9yZWN0PjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ij48L2NpcmNsZT48cG9seWxpbmUgcG9pbnRzPSIyMSAxNSAxNiAxMCA1IDIxIj48L3BvbHlsaW5lPjwvc3ZnPg=='
                       }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

function ZipLinkButton({ galleryId }: { galleryId: string }) {
  const [loading, setLoading] = useState(false)
  
  const handleCopyZipLink = async () => {
    try {
      setLoading(true)
      const res = await downloadApi.createZip({ gallery_id: galleryId, selection_state: 'SELECTED' })
      const jobId = res.data.data.zip_job_id
      
      let complete = false
      let attempts = 0
      while (!complete && attempts < 30) {
        await new Promise(r => setTimeout(r, 3000))
        const statusRes = await downloadApi.getZipStatus(jobId)
        if (statusRes.data.data.status === 'COMPLETED') {
           complete = true
        } else if (statusRes.data.data.status === 'FAILED') {
           throw new Error('ZIP generation failed')
        }
        attempts++
      }
      
      if (!complete) throw new Error('ZIP generation timed out')
      
      const urlRes = await downloadApi.getZipUrl(jobId)
      await navigator.clipboard.writeText(urlRes.data.data.download_url)
      toast.success('ZIP link copied to clipboard!')
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Failed to generate ZIP link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button className="btn-secondary py-1.5 px-3 text-xs" onClick={handleCopyZipLink} disabled={loading}>
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
      {loading ? 'Generating...' : 'ZIP Link'}
    </button>
  )
}
