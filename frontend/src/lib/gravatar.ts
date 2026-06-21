// Generates a fun, unique avatar URL for a user based on their email.
// Uses DiceBear "bottts" style (cute robots) as the default when no Gravatar is set.
// Falls back to a random avatar when no email is provided.
export async function getGravatarUrl(email: string | undefined, size: number) {
  const normalized = email?.trim().toLowerCase()

  // Hash the email for Gravatar lookup + as DiceBear seed
  const seed = normalized ?? 'default-user'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed))
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')

  // Try Gravatar first; fallback to DiceBear bottts (cute robots)
  // d=404 means Gravatar returns 404 if no image → we catch and fall through to DiceBear
  if (normalized) {
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`
    try {
      const res = await fetch(gravatarUrl, { method: 'HEAD' })
      if (res.ok) return gravatarUrl
    } catch {
      // Network error → fall through
    }
  }

  // DiceBear bottts — cute, colorful robot avatars
  return `https://api.dicebear.com/8.x/bottts/svg?seed=${encodeURIComponent(hash)}&size=${size}&backgroundColor=b6e3f4,c0aede,d1f4cc,ffdfbf,ffd5dc`
}
