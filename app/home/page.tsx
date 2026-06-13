'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Navbar from '@/src/components/Navbar'
import Footer from '@/src/components/Footer'
import { MapPin, Building2, Search, Loader2 } from 'lucide-react'

type Complejo = {
  id_complejo: number
  nombre: string
  direccion: string
  email_administrador: string
}

const DEPORTES = ['Fútbol 5', 'Fútbol 7', 'Pádel', 'Tenis', 'Básquet', 'Vóley']

export default function PaginaHome() {
  const [complejos, setComplejos] = useState<Complejo[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroDireccion, setFiltroDireccion] = useState('')
  const [filtroDeporte, setFiltroDeporte] = useState('')

  const [complejosFiltrados, setComplejosFiltrados] = useState<Complejo[]>([])
  const [filtrandoDeporte, setFiltrandoDeporte] = useState(false)

  // Caché en memoria por sesión: clave = `${idComplejo}-${deporte}` → tiene canchas
  const cacheDeporte = useRef<Map<string, boolean>>(new Map())

  const cargarComplejos = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const res = await fetch('/api/v1/complejos?limit=100')
      if (!res.ok) throw new Error('Error al cargar los complejos')
      const json = await res.json()
      setComplejos(json.data ?? [])
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarComplejos()
  }, [cargarComplejos])

  const filtrarPorDeporte = useCallback(
    async (lista: Complejo[], deporte: string): Promise<Complejo[]> => {
      const resultados = await Promise.all(
        lista.map(async (c) => {
          const clave = `${c.id_complejo}-${deporte}`
          if (cacheDeporte.current.has(clave)) {
            return cacheDeporte.current.get(clave) ? c : null
          }
          try {
            const res = await fetch(
              `/api/v1/complejos/${c.id_complejo}/canchas?deporte=${encodeURIComponent(deporte)}`
            )
            const tiene = res.ok && ((await res.json()) as unknown[]).length > 0
            cacheDeporte.current.set(clave, tiene)
            return tiene ? c : null
          } catch {
            cacheDeporte.current.set(clave, false)
            return null
          }
        })
      )
      return resultados.filter((c): c is Complejo => c !== null)
    },
    []
  )

  useEffect(() => {
    let cancelado = false

    const porTexto = complejos.filter((c) => {
      const matchN = !filtroNombre || c.nombre.toLowerCase().includes(filtroNombre.toLowerCase())
      const matchD =
        !filtroDireccion || c.direccion.toLowerCase().includes(filtroDireccion.toLowerCase())
      return matchN && matchD
    })

    if (!filtroDeporte) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setComplejosFiltrados(porTexto)
      setFiltrandoDeporte(false)
      return
    }

    setFiltrandoDeporte(true)
    filtrarPorDeporte(porTexto, filtroDeporte).then((resultado) => {
      if (!cancelado) {
        setComplejosFiltrados(resultado)
        setFiltrandoDeporte(false)
      }
    })

    return () => {
      cancelado = true
    }
  }, [complejos, filtroNombre, filtroDireccion, filtroDeporte, filtrarPorDeporte])

  const hayFiltrosActivos = filtroNombre || filtroDireccion || filtroDeporte

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-[#F4F8F3]">
        <div className="max-w-5xl mx-auto px-4 py-12">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#061F03]">Explorá complejos</h1>
            <p className="text-[#3B4F38] mt-1">
              Encontrá el complejo ideal y reservá tu cancha
            </p>
          </div>

          {/* Filtros */}
          <div className="bg-white rounded-2xl border border-[#ACC2AB]/30 p-4 mb-8 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-[#F4F8F3] rounded-xl px-3 py-2.5">
              <Search className="w-4 h-4 text-[#7FB584] shrink-0" />
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={filtroNombre}
                onChange={(e) => setFiltroNombre(e.target.value)}
                className="bg-transparent text-sm text-[#061F03] flex-1 focus:outline-none placeholder:text-[#3B4F38]/50"
              />
            </div>

            <div className="flex-1 flex items-center gap-2 bg-[#F4F8F3] rounded-xl px-3 py-2.5">
              <MapPin className="w-4 h-4 text-[#7FB584] shrink-0" />
              <input
                type="text"
                placeholder="Buscar por dirección..."
                value={filtroDireccion}
                onChange={(e) => setFiltroDireccion(e.target.value)}
                className="bg-transparent text-sm text-[#061F03] flex-1 focus:outline-none placeholder:text-[#3B4F38]/50"
              />
            </div>

            <select
              value={filtroDeporte}
              onChange={(e) => setFiltroDeporte(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#F4F8F3] text-sm text-[#061F03] focus:outline-none focus:ring-2 focus:ring-[#ACC2AB] border-0"
            >
              <option value="">Todos los deportes</option>
              {DEPORTES.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Loading inicial */}
          {cargando && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#ACC2AB] border-t-[#3B4F38] rounded-full" />
            </div>
          )}

          {/* Error */}
          {!cargando && errorCarga && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-4">
              <span>{errorCarga}</span>
              <button onClick={cargarComplejos} className="underline text-sm shrink-0">
                Reintentar
              </button>
            </div>
          )}

          {/* Loading filtro deporte (N+1) */}
          {!cargando && !errorCarga && filtrandoDeporte && (
            <div className="flex items-center gap-3 text-sm text-[#3B4F38] mb-6">
              <Loader2 className="w-4 h-4 animate-spin text-[#7FB584]" />
              Buscando complejos con {filtroDeporte}...
            </div>
          )}

          {/* Sin resultados */}
          {!cargando && !errorCarga && !filtrandoDeporte && complejosFiltrados.length === 0 && complejos.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-14 h-14 text-[#ACC2AB] mb-4" />
              <p className="text-[#061F03] font-semibold mb-1">
                No se encontraron complejos con esos filtros
              </p>
              {hayFiltrosActivos && (
                <button
                  onClick={() => {
                    setFiltroNombre('')
                    setFiltroDireccion('')
                    setFiltroDeporte('')
                  }}
                  className="mt-3 text-sm text-[#3B4F38] underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}

          {/* Sin complejos en el sistema */}
          {!cargando && !errorCarga && complejos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="w-14 h-14 text-[#ACC2AB] mb-4" />
              <p className="text-[#3B4F38]">Todavía no hay complejos registrados en el sistema.</p>
            </div>
          )}

          {/* Grid de complejos */}
          {!cargando && !errorCarga && complejosFiltrados.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {complejosFiltrados.map((complejo) => (
                <TarjetaComplejo key={complejo.id_complejo} complejo={complejo} />
              ))}
            </div>
          )}

        </div>
      </main>
      <Footer />
    </>
  )
}

function TarjetaComplejo({ complejo }: { complejo: Complejo }) {
  return (
    <Link
      href={`/complejos/${complejo.id_complejo}`}
      className="group bg-white rounded-2xl border border-[#ACC2AB]/30 p-6 hover:shadow-md hover:border-[#ACC2AB]/60 transition-all duration-200 flex flex-col gap-3"
    >
      <div className="flex items-start gap-3">
        <div className="bg-[#D7E6D3] rounded-xl p-2.5 shrink-0">
          <Building2 className="w-5 h-5 text-[#3B4F38]" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-[#061F03] group-hover:text-[#3B4F38] transition-colors duration-200 truncate">
            {complejo.nombre}
          </h2>
          <div className="flex items-start gap-1.5 mt-1 text-sm text-[#3B4F38]/70">
            <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#7FB584]" />
            <span className="line-clamp-2">{complejo.direccion}</span>
          </div>
        </div>
      </div>
      <span className="self-end text-xs font-medium text-[#7FB584] group-hover:text-[#3B4F38] transition-colors duration-200">
        Ver canchas →
      </span>
    </Link>
  )
}
