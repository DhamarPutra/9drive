export async function getGravatarUrl(email: string | undefined, size: number) {
  const normalized = email?.trim().toLowerCase()
  // Use robohash as a default (d=robohash) for cute, unique robots or monster avatars
  if (!normalized) return `https://www.gravatar.com/avatar/?d=robohash&s=${size}`

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `https://www.gravatar.com/avatar/${hash}?d=robohash&s=${size}`
}
