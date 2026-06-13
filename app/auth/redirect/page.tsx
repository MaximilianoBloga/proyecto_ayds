'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function PaginaRedirectAuth() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      router.replace('/sign-in')
      return
    }

    const rolRaw = (user.publicMetadata as { rol?: string | string[] }).rol
    const rol = Array.isArray(rolRaw) ? rolRaw[0] : rolRaw

    if (rol === 'admin') {
      router.replace('/admin')
      return
    }

    if (rol === 'auxiliar') {
      fetch('/api/auth/complejo-auxiliar')
        .then((r) => r.json())
        .then((data) => {
          router.replace(data.id_complejo ? `/auxiliar/${data.id_complejo}` : '/')
        })
        .catch(() => router.replace('/'))
      return
    }

    router.replace('/home')
  }, [isLoaded, user, router])

  return null
}
