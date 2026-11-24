'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

const sharedCookieDomain = 'amcdesk.com'
const sharedCookieMaxAge = 60 * 60 * 24 * 365
const sharedCookieChunkSize = 3000

function usesSharedAuthCookie() {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') return false
  const hostname = window.location.hostname.toLowerCase()
  return hostname === sharedCookieDomain || hostname.endsWith(`.${sharedCookieDomain}`)
}

function cookieNameForStorageKey(key: string) {
  const encodedKey = key.replace(/[^a-zA-Z0-9]/g, (character) => `_${character.charCodeAt(0).toString(16)}_`)
  return `amcdesk_auth_${encodedKey}`
}

function readCookie(name: string) {
  const prefix = `${name}=`
  const entry = document.cookie.split(';').map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(prefix))
  return entry?.slice(prefix.length) ?? null
}

function cookieChunkCount(cookieName: string) {
  const count = Number(readCookie(`${cookieName}_count`))
  return Number.isInteger(count) && count > 0 && count <= 100 ? count : 0
}

function writeSharedCookie(name: string, value: string, maxAge = sharedCookieMaxAge) {
  document.cookie = `${name}=${value}; Path=/; Domain=${sharedCookieDomain}; SameSite=Lax; Secure; Max-Age=${maxAge}`
}

const authStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null
    if (!usesSharedAuthCookie()) return window.localStorage.getItem(key)

    const cookieName = cookieNameForStorageKey(key)
    const chunkCount = cookieChunkCount(cookieName)
    if (chunkCount > 0) {
      const chunks = Array.from({ length: chunkCount }, (_, index) => readCookie(`${cookieName}_${index}`))
      if (chunks.every((chunk) => chunk !== null)) return decodeURIComponent(chunks.join(''))
    }

    const localValue = window.localStorage.getItem(key)
    if (localValue !== null) {
      authStorage.setItem(key, localValue)
      return localValue
    }
    return null
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return
    if (!usesSharedAuthCookie()) {
      window.localStorage.setItem(key, value)
      return
    }

    const cookieName = cookieNameForStorageKey(key)
    const encodedValue = encodeURIComponent(value)
    const chunks = encodedValue.match(new RegExp(`.{1,${sharedCookieChunkSize}}`, 'g')) ?? ['']
    if (chunks.length > 100) throw new Error('Supabase authentication state is too large to share across company subdomains.')
    const oldChunkCount = cookieChunkCount(cookieName)
    chunks.forEach((chunk, index) => writeSharedCookie(`${cookieName}_${index}`, chunk))
    for (let index = chunks.length; index < oldChunkCount; index += 1) {
      writeSharedCookie(`${cookieName}_${index}`, '', 0)
    }
    writeSharedCookie(`${cookieName}_count`, String(chunks.length))
    window.localStorage.removeItem(key)
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
    if (!usesSharedAuthCookie()) return

    const cookieName = cookieNameForStorageKey(key)
    const chunkCount = cookieChunkCount(cookieName)
    for (let index = 0; index < chunkCount; index += 1) {
      writeSharedCookie(`${cookieName}_${index}`, '', 0)
    }
    writeSharedCookie(`${cookieName}_count`, '', 0)
  },
}

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) return null
  client ??= createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: authStorage,
    },
  })

  return client
}

export const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
    .format(Number(value ?? 0))
