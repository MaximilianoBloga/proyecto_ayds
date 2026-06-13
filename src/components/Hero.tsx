'use client'

import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import { Building2, Home, Compass } from 'lucide-react'

export default function Hero() {
  const { user, isLoaded } = useUser()

  const meta = user?.publicMetadata as
    | { rol?: string | string[]; id_complejo?: number | string }
    | undefined
  const rolRaw = meta?.rol
  const rol = Array.isArray(rolRaw) ? rolRaw[0] : rolRaw
  const idComplejoMeta = meta?.id_complejo ? Number(meta.id_complejo) : NaN

  return (
    <section className="min-h-screen bg-gradient-to-br from-[#061F03] via-[#3B4F38] to-[#7FB584] flex items-center justify-center px-4 pt-16">
      <div className="text-center max-w-3xl mx-auto py-20">

        <p className="text-[#ACC2AB] text-sm font-semibold uppercase tracking-widest mb-4">
          Reservá tu cancha, jugá sin complicaciones
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-5 leading-tight">
          Encontrá tu{' '}
          <span className="text-[#ACC2AB]">cancha ideal</span>
        </h1>

        <p className="text-base sm:text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
          Reservá turnos en canchas deportivas de complejos cercanos, gestioná
          equipamiento y pagá online en segundos.
        </p>

        {/* CTA según rol */}
        {isLoaded && rol === 'admin' && (
          <Link
            href="/admin/complejos"
            className="inline-flex items-center gap-3 bg-white text-[#061F03] px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#D7E6D3] transition-colors duration-200 shadow-2xl"
          >
            <Building2 className="w-5 h-5" />
            Administración de complejos
          </Link>
        )}

        {isLoaded && rol === 'auxiliar' && (
          <Link
            href={!isNaN(idComplejoMeta) ? `/auxiliar/${idComplejoMeta}` : '/auth/redirect'}
            className="inline-flex items-center gap-3 bg-white text-[#061F03] px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#D7E6D3] transition-colors duration-200 shadow-2xl"
          >
            <Home className="w-5 h-5" />
            Mi complejo
          </Link>
        )}

        {/* Explorar: no logueado o cliente */}
        {(!rol || rol === 'cliente') && (
          <Link
            href="/home"
            className="inline-flex items-center gap-3 bg-white text-[#061F03] px-8 py-4 rounded-2xl font-bold text-lg hover:bg-[#D7E6D3] transition-colors duration-200 shadow-2xl"
          >
            <Compass className="w-5 h-5" />
            Explorar
          </Link>
        )}

      </div>
    </section>
  )
}
