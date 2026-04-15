/**
 * utils/api.js
 * Axios instance with Cognito JWT injected automatically.
 */

import axios from 'axios'
import { getCurrentSession } from './cognito'

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim()

function resolveBaseUrl() {
  if (!configuredBaseUrl) return ''

  try {
    const apiUrl = new URL(configuredBaseUrl)
    const pageHost = window.location.hostname
    const isLocalApiHost = apiUrl.hostname === 'localhost' || apiUrl.hostname === '127.0.0.1'
    const isLocalPageHost = pageHost === 'localhost' || pageHost === '127.0.0.1'

    // Avoid shipping a localhost API target into a non-local browser session.
    if (isLocalApiHost && !isLocalPageHost) {
      return ''
    }
  } catch {
    // Keep relative URLs or any other valid axios baseURL strings unchanged.
  }

  return configuredBaseUrl.replace(/\/+$/, '')
}

const api = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 60000,
})

// Inject Bearer token on every request
api.interceptors.request.use(async (config) => {
  const session = await getCurrentSession()
  if (session?.idToken) {
    config.headers.Authorization = `Bearer ${session.idToken}`
  }
  return config
})

// ─── Keys API ────────────────────────────────────────────────────────────────
export const generateKeys = () =>
  api.post('/api/keys/generate').then(r => r.data)

export const zkpProve = (privateKey) =>
  api.post('/api/keys/zkp/prove', { private_key: privateKey }).then(r => r.data)

export const zkpVerify = (proof) =>
  api.post('/api/keys/zkp/verify', { proof }).then(r => r.data)

// ─── Files API ───────────────────────────────────────────────────────────────
export const uploadFile = (formData) =>
  api.post('/api/files/upload', formData).then(r => r.data)

export const downloadFile = (fileId, payload) =>
  api.post(`/api/files/${fileId}/download`, payload).then(r => r.data)

export const listFiles = () =>
  api.get('/api/files/').then(r => r.data)

export const deleteFile = (fileId) =>
  api.delete(`/api/files/${fileId}`).then(r => r.data)

// ─── Share API ───────────────────────────────────────────────────────────────
export const delegateAccess = (payload) =>
  api.post('/api/share/delegate', payload).then(r => r.data)

export const revokeAccess = (payload) =>
  api.post('/api/share/revoke', payload).then(r => r.data)

export const getBundle = (fileId) =>
  api.get(`/api/share/${fileId}/bundle`).then(r => r.data)

// ─── Audit API ───────────────────────────────────────────────────────────────
export const getFileAudit = (fileId) =>
  api.get(`/api/audit/file/${fileId}`).then(r => r.data)

export const getUserAudit = (ethAddress) =>
  api.get(`/api/audit/user/${ethAddress}`).then(r => r.data)

export const getAuditStats = () =>
  api.get('/api/audit/stats').then(r => r.data)

export default api
