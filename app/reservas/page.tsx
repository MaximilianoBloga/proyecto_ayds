'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import Navbar from '@/src/components/Navbar'
import Footer from '@/src/components/Footer'
import { Calendar, Clock, ChevronLeft, AlertTriangle, CheckCircle2 } from 'lucide-react'

type Reserva = {
  idReserva: number
  fecha: string
  hora: string
  estado: string
  tipoPartido: string
  cuposDisponibles: number | null
  idCancha: number
  emailCliente: string
}

type InfoCancha = {
  idCancha: number
  nombre: string
  deporte: string
  idComplejo: number
}

function clasesEstado(estado: string) {
  if (estado === 'pagada') return 'bg-[#D7E6D3] text-[#3B4F38]'
  if (estado === 'pendiente') return 'bg-blue-50 text-blue-700'
  if (estado === 'cancelada') return 'bg-gray-100 text-gray-500'
  if (estado === 'ausente') return 'bg-red-100 text-red-600'
  return 'bg-gray-100 text-gray-600'
}

function etiquetaEstado(estado: string) {
  const map: Record<string, string> = {
    pagada: 'Pagada', pendiente: 'Pendiente', cancelada: 'Cancelada', ausente: 'Ausente',
  }
  return map[estado] ?? estado
}

function formatFecha(fecha: string) {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

function esCancelable(estado: string, fecha: string, hora: string): boolean {
  if (estado !== 'pendiente' && estado !== 'pagada') return false
  const fechaHora = new Date(`${fecha}T${hora}:00.000Z`)
  return fechaHora.getTime() - Date.now() > 2 * 60 * 60 * 1000
}

export default function PaginaMisReservas() {
  const { user, isLoaded } = useUser()
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [infoCancha, setInfoCancha] = useState<Map<number, InfoCancha>>(new Map())
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState<number | null>(null)
  const [errorCancelar, setErrorCancelar] = useState<string | null>(null)

  const cacheCancha = useRef<Map<number, InfoCancha>>(new Map())

  const cargarCanchaInfo = useCallback(async (idCancha: number): Promise<InfoCancha | null> => {
    if (cacheCancha.current.has(idCancha)) return cacheCancha.current.get(idCancha)!
    try {
      const res = await fetch(`/api/v1/canchas/${idCancha}`)
      if (!res.ok) return null
      const data = await res.json()
      const info: InfoCancha = {
        idCancha: data.idCancha, nombre: data.nombre, deporte: data.deporte, idComplejo: data.idComplejo,
      }
      cacheCancha.current.set(idCancha, info)
      return info
    } catch {
      return null
    }
  }, [])

  const cargarReservas = useCallback(async () => {
    setCargando(true)
    setErrorCarga(null)
    try {
      const res = await fetch('/api/v1/reservas')
      if (!res.ok) throw new Error('Error al cargar las reservas')
      const lista = await res.json() as Reserva[]
      setReservas(lista)

      const idsUnicos = [...new Set(lista.map((r) => r.idCancha))]
      const infos = await Promise.all(idsUnicos.map(cargarCanchaInfo))
      const mapa = new Map<number, InfoCancha>()
      infos.forEach((info) => { if (info) mapa.set(info.idCancha, info) })
      setInfoCancha(mapa)
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [cargarCanchaInfo])

  useEffect(() => {
    if (!isLoaded || !user) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarReservas()
  }, [isLoaded, user, cargarReservas])

  async function cancelarReserva(idReserva: number) {
    setCancelando(idReserva)
    setErrorCancelar(null)
    try {
      const res = await fetch(`/api/v1/reservas/${idReserva}`, { method: 'DELETE' })
      if (res.status === 204) {
        setReservas((prev) =>
          prev.map((r) => r.idReserva === idReserva ? { ...r, estado: 'cancelada' } : r)
        )
      } else {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: { message?: string } })?.error?.message ?? 'No se pudo cancelar')
      }
    } catch (e) {
      setErrorCancelar(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCancelando(null)
    }
  }

  if (!isLoaded) {
    return (
      <>
        <Navbar />
        <main className="pt-16 min-h-screen bg-[#F4F8F3] flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#ACC2AB] border-t-[#3B4F38] rounded-full" />
        </main>
        <Footer />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="pt-16 min-h-screen bg-[#F4F8F3] flex flex-col items-center justify-center gap-4">
          <Calendar className="w-14 h-14 text-[#ACC2AB]" />
          <p className="text-[#061F03] text-lg font-semibold">Necesitás iniciar sesión</p>
          <Link
            href="/sign-in"
            className="bg-[#3B4F38] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#061F03] transition-colors"
          >
            Iniciar sesión
          </Link>
        </main>
        <Footer />
      </>
    )
  }

  const proximas = reservas.filter((r) => r.estado === 'pendiente' || r.estado === 'pagada')
  const pasadas = reservas.filter((r) => r.estado !== 'pendiente' && r.estado !== 'pagada')

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-[#F4F8F3]">
        <div className="max-w-4xl mx-auto px-4 py-12">

          <Link
            href="/home"
            className="inline-flex items-center gap-1.5 text-sm text-[#3B4F38] hover:text-[#061F03] mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Explorar complejos
          </Link>

          <h1 className="text-3xl font-bold text-[#061F03] mb-8">Mis reservas</h1>

          {cargando && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#ACC2AB] border-t-[#3B4F38] rounded-full" />
            </div>
          )}

          {!cargando && errorCarga && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-4">
              <span>{errorCarga}</span>
              <button onClick={cargarReservas} className="underline text-sm shrink-0">Reintentar</button>
            </div>
          )}

          {!cargando && !errorCarga && errorCancelar && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 mb-5 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errorCancelar}
            </div>
          )}

          {!cargando && !errorCarga && reservas.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#ACC2AB]/30 p-12 text-center">
              <Calendar className="w-14 h-14 text-[#ACC2AB] mx-auto mb-4" />
              <p className="text-[#061F03] font-semibold mb-1">No tenés reservas</p>
              <p className="text-[#3B4F38] text-sm mb-5">Explorá complejos y reservá tu cancha</p>
              <Link
                href="/home"
                className="inline-flex items-center gap-2 bg-[#3B4F38] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#061F03] transition-colors"
              >
                Explorar complejos
              </Link>
            </div>
          )}

          {!cargando && !errorCarga && proximas.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-[#061F03] mb-4">Próximas</h2>
              <div className="flex flex-col gap-3">
                {proximas.map((r) => (
                  <TarjetaReserva
                    key={r.idReserva}
                    reserva={r}
                    cancha={infoCancha.get(r.idCancha)}
                    onCancelar={cancelarReserva}
                    cancelando={cancelando === r.idReserva}
                  />
                ))}
              </div>
            </section>
          )}

          {!cargando && !errorCarga && pasadas.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-[#061F03] mb-4">Historial</h2>
              <div className="flex flex-col gap-3">
                {pasadas.map((r) => (
                  <TarjetaReserva
                    key={r.idReserva}
                    reserva={r}
                    cancha={infoCancha.get(r.idCancha)}
                    onCancelar={cancelarReserva}
                    cancelando={cancelando === r.idReserva}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      </main>
      <Footer />
    </>
  )
}

function TarjetaReserva({
  reserva,
  cancha,
  onCancelar,
  cancelando,
}: {
  reserva: Reserva
  cancha: InfoCancha | undefined
  onCancelar: (id: number) => void
  cancelando: boolean
}) {
  const cancelable = esCancelable(reserva.estado, reserva.fecha, reserva.hora)
  const [confirmando, setConfirmando] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-[#ACC2AB]/30 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <p className="font-bold text-[#061F03]">
          {cancha?.nombre ?? `Cancha #${reserva.idCancha}`}
          {cancha?.deporte && (
            <span className="text-[#7FB584] font-normal text-sm"> — {cancha.deporte}</span>
          )}
        </p>

        <div className="flex items-center gap-3 text-sm text-[#3B4F38]">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-[#7FB584]" />
            {formatFecha(reserva.fecha)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#7FB584]" />
            {reserva.hora}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${clasesEstado(reserva.estado)}`}>
            {etiquetaEstado(reserva.estado)}
          </span>
          <span className="text-[#3B4F38]/60 text-xs capitalize">
            Partido {reserva.tipoPartido}
            {reserva.cuposDisponibles != null && ` · ${reserva.cuposDisponibles} cupos`}
          </span>
        </div>
      </div>

      {reserva.estado === 'cancelada' && (
        <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0 hidden sm:flex">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Cancelada
        </span>
      )}

      {cancelable && !confirmando && (
        <button
          onClick={() => setConfirmando(true)}
          className="shrink-0 text-sm text-red-600 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors"
        >
          Cancelar reserva
        </button>
      )}

      {cancelable && confirmando && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="text-xs text-[#3B4F38]">¿Confirmás?</span>
          <button
            onClick={() => { onCancelar(reserva.idReserva); setConfirmando(false) }}
            disabled={cancelando}
            className="text-sm bg-red-600 text-white rounded-xl px-4 py-2 hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {cancelando ? 'Cancelando...' : 'Sí, cancelar'}
          </button>
          <button
            onClick={() => setConfirmando(false)}
            className="text-sm text-[#3B4F38] border border-[#ACC2AB]/50 rounded-xl px-3 py-2 hover:bg-[#F4F8F3] transition-colors"
          >
            No
          </button>
        </div>
      )}
    </div>
  )
}
