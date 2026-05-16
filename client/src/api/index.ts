import api from './client'

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  signup: (data: { email: string; password: string; full_name: string }) =>
    api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  me: () => api.get('/auth/me'),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
}

// ── Users ─────────────────────────────────────────────────────
export const userApi = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data: object) => api.patch('/users/profile', data),
  getStorage: () => api.get('/users/storage'),
  getSessions: () => api.get('/users/sessions'),
  revokeSession: (id: string) => api.delete(`/users/sessions/${id}`),
}

// ── Projects ──────────────────────────────────────────────────
export const projectApi = {
  list: (params?: object) => api.get('/projects', { params }),
  create: (data: object) => api.post('/projects', data),
  get: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, data: object) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  archive: (id: string) => api.post(`/projects/${id}/archive`),
  restore: (id: string) => api.post(`/projects/${id}/restore`),
  duplicate: (id: string) => api.post(`/projects/${id}/duplicate`),
}

// ── Albums ────────────────────────────────────────────────────
export const albumApi = {
  list: (projectId: string) => api.get('/albums', { params: { projectId } }),
  create: (data: object) => api.post('/albums', data),
  update: (id: string, data: object) => api.put(`/albums/${id}`, data),
  delete: (id: string) => api.delete(`/albums/${id}`),
}

// ── Media ─────────────────────────────────────────────────────
export const mediaApi = {
  list: (albumId: string, params?: object) =>
    api.get(`/albums/${albumId}/media`, { params }),
  getUploadUrl: (data: object) => api.post('/media/upload-url', data),
  confirmUpload: (data: object) => api.post('/media/confirm', data),
  getDownloadUrl: (id: string) => api.get(`/media/${id}/download-url`),
  delete: (id: string) => api.delete(`/media/${id}`),
}

// ── Gallery (public) ──────────────────────────────────────────
export const galleryApi = {
  get: (token: string) => api.get(`/gallery/${token}`),
  getMedia: (token: string, params?: object) =>
    api.get(`/gallery/${token}/media`, { params }),
  getSelections: (token: string) => api.get(`/gallery/${token}/selections`),
  saveSelections: (token: string, selections: object[]) =>
    api.post(`/gallery/${token}/selections`, { selections }),
  submit: (token: string) => api.post(`/gallery/${token}/submit`),

  // Photographer — manage galleries
  listAll: (params?: object) => api.get('/gallery', { params }),
  create: (data: object) => api.post('/gallery', data),
}

// ── Share Links ───────────────────────────────────────────────
export const linkApi = {
  list: (projectId: string) => api.get('/links', { params: { projectId } }),
  create: (data: object) => api.post('/links', data),
  revoke: (id: string) => api.delete(`/links/${id}`),
  view: (token: string, password?: string) =>
    api.get(`/links/view/${token}`, { params: password ? { password } : {} }),
}

// ── Downloads ─────────────────────────────────────────────────
export const downloadApi = {
  createZip: (data: object) => api.post('/downloads/zip', data),
  getZipStatus: (jobId: string) => api.get(`/downloads/zip/${jobId}`),
  getZipUrl: (jobId: string) => api.get(`/downloads/zip/${jobId}/url`),
}

// ── Billing ───────────────────────────────────────────────────
export const billingApi = {
  getPlans: () => api.get('/billing/plans'),
  getSubscription: () => api.get('/billing/subscription'),
  getInvoices: (params?: object) => api.get('/billing/invoices', { params }),
  createRazorpayOrder: (planId: string) => api.post('/billing/checkout/razorpay', { plan_id: planId }),
  verifyRazorpay: (data: object) => api.post('/billing/verify/razorpay', data),
  createStripeSession: (planId: string) => api.post('/billing/checkout/stripe', { plan_id: planId }),
  cancelSubscription: () => api.post('/billing/cancel'),
  resumeSubscription: () => api.post('/billing/resume'),
}


// ── Notifications ─────────────────────────────────────────────
export const notificationApi = {
  list: (params?: object) => api.get('/notifications', { params }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
}

// ── Admin ─────────────────────────────────────────────────────
export const adminApi = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: (params?: object) => api.get('/admin/users', { params }),
  updateUserStatus: (id: string, data: object) => api.patch(`/admin/users/${id}/status`, data),
  getPlans: () => api.get('/admin/plans'),
  createPlan: (data: object) => api.post('/admin/plans', data),
  updatePlan: (id: string, data: object) => api.put(`/admin/plans/${id}`, data),
  deletePlan: (id: string) => api.delete(`/admin/plans/${id}`),
  getIntegrations: () => api.get('/admin/integrations'),
  updateIntegration: (provider: string, data: object) =>
    api.put(`/admin/integrations/${provider}`, data),
  getPayments: (params?: object) => api.get('/admin/payments', { params }),
  getAuditLogs: (params?: object) => api.get('/admin/audit-logs', { params }),
}
