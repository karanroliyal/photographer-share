import { useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import {
  Upload, CloudUpload, CheckCircle, AlertCircle,
  X, Loader2, ArrowLeft, Image, Video, FileImage
} from 'lucide-react'
import { mediaApi } from '@/api'
import toast from 'react-hot-toast'
import axios from 'axios'

interface UploadFile {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  error?: string
}

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const ALLOWED_VIDEO = ['video/mp4', 'video/quicktime']
const ALL_ALLOWED = [...ALLOWED_IMAGE, ...ALLOWED_VIDEO]

export function UploadPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const [albumId, setAlbumId] = useState('')
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => import('@/api').then(({ projectApi }) => projectApi.get(projectId!).then(r => r.data.data)),
  })

  const onDrop = useCallback((accepted: File[]) => {
    const newFiles: UploadFile[] = accepted.map(file => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0,
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/heic': ['.heic'],
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
    },
    multiple: true,
  })

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const uploadAll = async () => {
    if (!albumId) { toast.error('Please select an album first'); return }
    const pending = files.filter(f => f.status === 'pending')
    if (!pending.length) return

    setIsUploading(true)

    for (const uf of pending) {
      setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'uploading', progress: 0 } : f))

      try {
        // 1. Get signed URL
        const { data } = await mediaApi.getUploadUrl({
          album_id: albumId,
          filename: uf.file.name,
          content_type: uf.file.type,
          file_size: uf.file.size,
        })
        const { upload_url, storage_key, upload_job_id } = data.data

        // 2. Upload directly to R2
        await axios.put(upload_url, uf.file, {
          headers: { 'Content-Type': uf.file.type },
          onUploadProgress: (e) => {
            const pct = Math.round((e.loaded / (e.total ?? 1)) * 90)
            setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, progress: pct } : f))
          },
        })

        // 3. Confirm upload
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'processing', progress: 95 } : f))
        await mediaApi.confirmUpload({
          upload_job_id,
          album_id: albumId,
          filename: uf.file.name,
          file_size: uf.file.size,
          content_type: uf.file.type,
        })

        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'done', progress: 100 } : f))
      } catch (err: any) {
        const msg = err.response?.data?.message || 'Upload failed'
        setFiles(prev => prev.map(f => f.id === uf.id ? { ...f, status: 'error', error: msg } : f))
      }
    }

    setIsUploading(false)
    const doneCount = files.filter(f => f.status === 'done').length + pending.length
    toast.success(`${pending.length} file(s) uploaded!`)
  }

  const albums = project?.albums ?? []
  const pendingCount = files.filter(f => f.status === 'pending').length
  const doneCount = files.filter(f => f.status === 'done').length

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  return (
    <div className="page-container max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/projects/${projectId}`} className="btn-secondary py-2 px-3">
          <ArrowLeft size={15} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Upload Media</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{project?.name}</p>
        </div>
      </div>

      {/* Album selector */}
      <div className="glass-card p-5 mb-5">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          Upload to album *
        </label>
        <select
          className="input-field"
          value={albumId}
          onChange={e => setAlbumId(e.target.value)}
        >
          <option value="">Select album...</option>
          {albums.map((a: any) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className="glass-card mb-5 p-12 text-center cursor-pointer transition-all"
        style={{
          borderColor: isDragActive ? 'var(--accent-primary)' : 'var(--border)',
          borderStyle: 'dashed',
          borderWidth: '2px',
          background: isDragActive ? 'rgba(108,99,255,0.05)' : undefined,
        }}
      >
        <input {...getInputProps()} />
        <motion.div
          animate={{ scale: isDragActive ? 1.05 : 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <CloudUpload size={48} className="mx-auto mb-4"
            style={{ color: isDragActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            or click to browse
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['JPG', 'PNG', 'WEBP', 'HEIC', 'MP4', 'MOV'].map(fmt => (
              <span key={fmt} className="badge badge-purple">{fmt}</span>
            ))}
          </div>
        </motion.div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="glass-card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {files.length} file{files.length !== 1 ? 's' : ''} selected
              {doneCount > 0 && <span className="ml-2" style={{ color: '#22c55e' }}>({doneCount} done)</span>}
            </h3>
            <button className="text-xs" style={{ color: 'var(--text-muted)' }}
              onClick={() => setFiles(prev => prev.filter(f => f.status !== 'done'))}>
              Clear done
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map(uf => (
              <div key={uf.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(108,99,255,0.1)' }}>
                  {uf.file.type.startsWith('video') ? <Video size={14} style={{ color: '#6c63ff' }} /> : <Image size={14} style={{ color: '#6c63ff' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{uf.file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatSize(uf.file.size)}</span>
                    {(uf.status === 'uploading' || uf.status === 'processing') && (
                      <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <motion.div className="h-full rounded-full"
                          style={{ width: `${uf.progress}%`, background: 'linear-gradient(90deg, #6c63ff, #8b5cf6)' }} />
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {uf.status === 'pending' && (
                    <button onClick={() => removeFile(uf.id)} className="p-1" style={{ color: 'var(--text-muted)' }}>
                      <X size={14} />
                    </button>
                  )}
                  {(uf.status === 'uploading' || uf.status === 'processing') && (
                    <Loader2 size={14} className="animate-spin" style={{ color: '#6c63ff' }} />
                  )}
                  {uf.status === 'done' && <CheckCircle size={14} color="#22c55e" />}
                  {uf.status === 'error' && (
                    <div className="flex items-center gap-1">
                      <AlertCircle size={14} color="#ef4444" />
                      <span className="text-xs" style={{ color: '#ef4444' }}>{uf.error}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <button
          className="btn-primary w-full justify-center py-3"
          onClick={uploadAll}
          disabled={isUploading || !albumId}
        >
          {isUploading
            ? <><Loader2 size={16} className="animate-spin" /> Uploading {pendingCount} file(s)...</>
            : <><Upload size={16} /> Upload {pendingCount} file(s)</>
          }
        </button>
      )}
    </div>
  )
}
