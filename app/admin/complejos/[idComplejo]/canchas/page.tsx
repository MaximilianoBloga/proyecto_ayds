'use client'

import { useUser } from '@clerk/nextjs'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Navbar from '@/src/components/Navbar'
import Footer from '@/src/components/Footer'
import { Plus, Pencil, Trash2, ChevronLeft, Clock, Dumbbell } from 'lucide-react'

type Cancha = {
  idCancha: number
  nombre: string
  deporte: string
  estadoOperativo: string
  horarioApertura: string
  horarioCierre: string
  duracionTurno: number
  idComplejo: number
}

type Complejo = {
  id_complejo: number
  nombre: string
  email_administrador: string
}

type DatosCancha = {
  nombre: string
  deporte: string
  horarioApertura: string
  horarioCierre: string
  duracionTurno: string
  estadoOperativo: string
}

type ErrDatosCancha = Partial<Record<keyof DatosCancha, string>>

const ESTADOS = ['disponible', 'ocupada', 'en mantenimiento'] as const

function etiquetaEstado(estado: string) {
  if (estado === 'disponible') return 'Disponible'
  if (estado === 'ocupada') return 'Ocupada'
  if (estado === 'en mantenimiento') return 'En mantenimiento'
  return estado
}

function clasesEstado(estado: string) {
  if (estado === 'disponible') return 'bg-[#D7E6D3] text-[#3B4F38]'
  if (estado === 'ocupada') return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-600'
}

function esHoraValida(h: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(h)) return false
  return parseInt(h.slice(0, 2)) < 24 && parseInt(h.slice(3, 5)) < 60
}

function horaEnMinutos(h: string): number {
  return parseInt(h.slice(0, 2)) * 60 + parseInt(h.slice(3, 5))
}

const FORM_VACIO: DatosCancha = {
  nombre: '',
  deporte: '',
  horarioApertura: '',
  horarioCierre: '',
  duracionTurno: '',
  estadoOperativo: 'disponible',
}

export default function PaginaCanchas() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const rawParams = useParams()
  const idComplejoStr = Array.isArray(rawParams.idComplejo)
    ? rawParams.idComplejo[0]
    : rawParams.idComplejo ?? ''
  const idComplejo = parseInt(idComplejoStr)

  const [complejo, setComplejo] = useState<Complejo | null>(null)
  const [noEsPropietario, setNoEsPropietario] = useState(false)
  const [canchas, setCanchas] = useState<Cancha[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [filtroDeporte, setFiltroDeporte] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const [modalAbierto, setModalAbierto] = useState(false)
  const [canchaEditando, setCanchaEditando] = useState<Cancha | null>(null)
  const [form, setForm] = useState<DatosCancha>(FORM_VACIO)
  const [erroresForm, setErroresForm] = useState<ErrDatosCancha>({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  const [confirmEliminar, setConfirmEliminar] = useState<Cancha | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const emailUsuario = user?.primaryEmailAddress?.emailAddress

  // Verificación de rol
  useEffect(() => {
    if (!isLoaded) return
    if (!user) { router.replace('/sign-in'); return }
    const rolRaw = (user.publicMetadata as { rol?: string | string[] }).rol
    const rol = Array.isArray(rolRaw) ? rolRaw[0] : rolRaw
    if (rol !== 'admin') router.replace('/')
  }, [isLoaded, user, router])

  const cargarDatos = useCallback(async () => {
    if (!emailUsuario || isNaN(idComplejo)) return
    setCargando(true)
    setErrorCarga(null)
    try {
      const [resComplejo, resCanchas] = await Promise.all([
        fetch(`/api/v1/complejos/${idComplejo}`),
        fetch(`/api/v1/complejos/${idComplejo}/canchas`),
      ])

      if (resComplejo.status === 404) {
        setErrorCarga('Complejo no encontrado')
        return
      }
      if (!resComplejo.ok) throw new Error('Error al cargar el complejo')

      const complejoData: Complejo = await resComplejo.json()
      setComplejo(complejoData)

      if (complejoData.email_administrador !== emailUsuario) {
        setNoEsPropietario(true)
        return
      }

      if (!resCanchas.ok) throw new Error('Error al cargar canchas')
      const canchasData: Cancha[] = await resCanchas.json()
      setCanchas(canchasData)
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [emailUsuario, idComplejo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLoaded && emailUsuario) cargarDatos()
  }, [isLoaded, emailUsuario, cargarDatos])

  const deportesDisponibles = [...new Set(canchas.map((c) => c.deporte))].sort()

  const canchasFiltradas = canchas.filter((c) => {
    if (filtroDeporte && c.deporte !== filtroDeporte) return false
    if (filtroEstado && c.estadoOperativo !== filtroEstado) return false
    return true
  })

  function abrirCrear() {
    setCanchaEditando(null)
    setForm(FORM_VACIO)
    setErroresForm({})
    setErrorGuardado(null)
    setModalAbierto(true)
  }

  function abrirEditar(cancha: Cancha) {
    setCanchaEditando(cancha)
    setForm({
      nombre: cancha.nombre,
      deporte: cancha.deporte,
      horarioApertura: cancha.horarioApertura,
      horarioCierre: cancha.horarioCierre,
      duracionTurno: String(cancha.duracionTurno),
      estadoOperativo: cancha.estadoOperativo,
    })
    setErroresForm({})
    setErrorGuardado(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setCanchaEditando(null)
    setGuardando(false)
    setErrorGuardado(null)
  }

  function validarForm(): boolean {
    const e: ErrDatosCancha = {}
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido'
    else if (form.nombre.length > 100) e.nombre = 'Máximo 100 caracteres'
    if (!form.deporte.trim()) e.deporte = 'El deporte es requerido'
    else if (form.deporte.length > 50) e.deporte = 'Máximo 50 caracteres'
    if (!form.horarioApertura || !esHoraValida(form.horarioApertura))
      e.horarioApertura = 'Horario de apertura inválido'
    if (!form.horarioCierre || !esHoraValida(form.horarioCierre))
      e.horarioCierre = 'Horario de cierre inválido'
    if (!e.horarioApertura && !e.horarioCierre) {
      if (horaEnMinutos(form.horarioCierre) <= horaEnMinutos(form.horarioApertura))
        e.horarioCierre = 'El cierre debe ser posterior a la apertura'
    }
    const dur = Number(form.duracionTurno)
    if (!form.duracionTurno || !Number.isInteger(dur) || dur <= 0)
      e.duracionTurno = 'Debe ser un número entero positivo'
    setErroresForm(e)
    return Object.keys(e).length === 0
  }

  async function guardar() {
    if (!validarForm()) return
    setGuardando(true)
    setErrorGuardado(null)
    try {
      const body: Record<string, unknown> = {
        nombre: form.nombre.trim(),
        deporte: form.deporte.trim(),
        horarioApertura: form.horarioApertura,
        horarioCierre: form.horarioCierre,
        duracionTurno: Number(form.duracionTurno),
      }
      if (canchaEditando) body.estadoOperativo = form.estadoOperativo

      const url = canchaEditando
        ? `/api/v1/canchas/${canchaEditando.idCancha}`
        : `/api/v1/complejos/${idComplejo}/canchas`
      const method = canchaEditando ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: { message?: string } })?.error?.message ?? 'Error al guardar')
      }

      cerrarModal()
      await cargarDatos()
    } catch (e) {
      setErrorGuardado(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!confirmEliminar) return
    setEliminando(true)
    try {
      const res = await fetch(`/api/v1/canchas/${confirmEliminar.idCancha}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: { message?: string } })?.error?.message ?? 'Error al eliminar')
      }
      setConfirmEliminar(null)
      await cargarDatos()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setEliminando(false)
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

  if (noEsPropietario) {
    return (
      <>
        <Navbar />
        <main className="pt-16 min-h-screen bg-[#F4F8F3] flex flex-col items-center justify-center gap-4">
          <p className="text-xl font-semibold text-[#061F03]">Acceso denegado</p>
          <p className="text-[#3B4F38]">No sos el administrador de este complejo.</p>
          <Link href="/admin/complejos" className="text-[#3B4F38] underline hover:text-[#061F03]">
            Volver a Mis Complejos
          </Link>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-[#F4F8F3]">
        <div className="max-w-5xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <Link
            href="/admin/complejos"
            className="inline-flex items-center gap-1.5 text-sm text-[#3B4F38] hover:text-[#061F03] mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Mis Complejos
          </Link>

          <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-[#061F03]">
                {complejo ? complejo.nombre : ''}
              </h1>
              <p className="text-[#3B4F38] mt-1">Gestión de canchas</p>
            </div>
            <button
              onClick={abrirCrear}
              className="flex items-center gap-2 bg-[#3B4F38] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#061F03] transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              Agregar cancha
            </button>
          </div>

          {/* Filtros */}
          {!cargando && !errorCarga && canchas.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-6">
              <select
                value={filtroDeporte}
                onChange={(e) => setFiltroDeporte(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#ACC2AB]/50 text-sm text-[#3B4F38] bg-white focus:outline-none focus:ring-2 focus:ring-[#ACC2AB]"
              >
                <option value="">Todos los deportes</option>
                {deportesDisponibles.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#ACC2AB]/50 text-sm text-[#3B4F38] bg-white focus:outline-none focus:ring-2 focus:ring-[#ACC2AB]"
              >
                <option value="">Todos los estados</option>
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>{etiquetaEstado(s)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Loading */}
          {cargando && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#ACC2AB] border-t-[#3B4F38] rounded-full" />
            </div>
          )}

          {/* Error */}
          {!cargando && errorCarga && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 flex items-center gap-4">
              <span>{errorCarga}</span>
              <button onClick={cargarDatos} className="underline text-sm shrink-0">
                Reintentar
              </button>
            </div>
          )}

          {/* Empty state */}
          {!cargando && !errorCarga && canchas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Dumbbell className="w-16 h-16 text-[#ACC2AB] mb-4" />
              <h2 className="text-xl font-semibold text-[#061F03] mb-2">No hay canchas todavía</h2>
              <p className="text-[#3B4F38] mb-6">
                Agregá la primera cancha a este complejo.
              </p>
              <button
                onClick={abrirCrear}
                className="flex items-center gap-2 bg-[#3B4F38] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#061F03] transition-colors duration-200"
              >
                <Plus className="w-4 h-4" />
                Agregar cancha
              </button>
            </div>
          )}

          {/* Empty filtered state */}
          {!cargando && !errorCarga && canchas.length > 0 && canchasFiltradas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[#3B4F38]">No hay canchas que coincidan con los filtros aplicados.</p>
              <button
                onClick={() => { setFiltroDeporte(''); setFiltroEstado('') }}
                className="mt-3 text-sm text-[#3B4F38] underline"
              >
                Limpiar filtros
              </button>
            </div>
          )}

          {/* Cards */}
          {!cargando && !errorCarga && canchasFiltradas.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {canchasFiltradas.map((cancha) => (
                <TarjetaCancha
                  key={cancha.idCancha}
                  cancha={cancha}
                  onEditar={() => abrirEditar(cancha)}
                  onEliminar={() => setConfirmEliminar(cancha)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {modalAbierto && (
        <ModalFormulario
          editando={canchaEditando}
          form={form}
          errores={erroresForm}
          guardando={guardando}
          errorGuardado={errorGuardado}
          onChange={(campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }))}
          onGuardar={guardar}
          onCerrar={cerrarModal}
        />
      )}

      {confirmEliminar && (
        <ModalConfirmarEliminar
          cancha={confirmEliminar}
          eliminando={eliminando}
          onConfirmar={eliminar}
          onCancelar={() => setConfirmEliminar(null)}
        />
      )}
    </>
  )
}

function TarjetaCancha({
  cancha,
  onEditar,
  onEliminar,
}: {
  cancha: Cancha
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ACC2AB]/30 p-6 hover:shadow-md transition-shadow duration-200 flex flex-col gap-4">
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-bold text-[#061F03] text-lg leading-tight">{cancha.nombre}</h2>
          <span
            className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${clasesEstado(cancha.estadoOperativo)}`}
          >
            {etiquetaEstado(cancha.estadoOperativo)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-[#3B4F38] mb-2">
          <Dumbbell className="w-4 h-4 shrink-0 text-[#7FB584]" />
          <span>{cancha.deporte}</span>
        </div>

        <div className="flex items-center gap-1.5 text-sm text-[#3B4F38] mb-1">
          <Clock className="w-4 h-4 shrink-0 text-[#7FB584]" />
          <span>
            {cancha.horarioApertura} – {cancha.horarioCierre}
          </span>
        </div>

        <p className="text-xs text-[#3B4F38]/70 ml-5.5">
          Turnos de {cancha.duracionTurno} min
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onEditar}
          className="flex items-center gap-1.5 text-sm font-medium bg-[#ACC2AB]/30 text-[#3B4F38] px-3 py-2 rounded-lg hover:bg-[#ACC2AB]/50 transition-colors duration-200"
        >
          <Pencil className="w-3.5 h-3.5" />
          Editar
        </button>
        <button
          onClick={onEliminar}
          className="flex items-center gap-1.5 text-sm font-medium bg-red-50 text-red-600 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors duration-200"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Eliminar
        </button>
      </div>
    </div>
  )
}

function CampoTexto({
  label,
  valor,
  onChange,
  error,
  placeholder,
  maxLength,
  required,
}: {
  label: string
  valor: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  maxLength?: number
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#3B4F38] mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-lg border text-[#061F03] focus:outline-none focus:ring-2 focus:ring-[#ACC2AB] ${
          error ? 'border-red-400' : 'border-[#ACC2AB]/50'
        }`}
      />
      <div className="flex justify-between mt-1">
        {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
        {maxLength && (
          <p className="text-xs text-[#3B4F38]/50">{valor.length}/{maxLength}</p>
        )}
      </div>
    </div>
  )
}

function ModalFormulario({
  editando,
  form,
  errores,
  guardando,
  errorGuardado,
  onChange,
  onGuardar,
  onCerrar,
}: {
  editando: Cancha | null
  form: DatosCancha
  errores: ErrDatosCancha
  guardando: boolean
  errorGuardado: string | null
  onChange: (campo: keyof DatosCancha, valor: string) => void
  onGuardar: () => void
  onCerrar: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 my-4">
        <h2 className="text-xl font-bold text-[#061F03] mb-6">
          {editando ? 'Editar cancha' : 'Agregar cancha'}
        </h2>

        <div className="flex flex-col gap-4">
          <CampoTexto
            label="Nombre"
            valor={form.nombre}
            onChange={(v) => onChange('nombre', v)}
            error={errores.nombre}
            placeholder="Ej: Cancha 1"
            maxLength={100}
            required
          />
          <CampoTexto
            label="Deporte"
            valor={form.deporte}
            onChange={(v) => onChange('deporte', v)}
            error={errores.deporte}
            placeholder="Ej: Fútbol 5"
            maxLength={50}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#3B4F38] mb-1">
                Apertura <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.horarioApertura}
                onChange={(e) => onChange('horarioApertura', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-[#061F03] focus:outline-none focus:ring-2 focus:ring-[#ACC2AB] ${
                  errores.horarioApertura ? 'border-red-400' : 'border-[#ACC2AB]/50'
                }`}
              />
              {errores.horarioApertura && (
                <p className="text-xs text-red-500 mt-1">{errores.horarioApertura}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#3B4F38] mb-1">
                Cierre <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={form.horarioCierre}
                onChange={(e) => onChange('horarioCierre', e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-[#061F03] focus:outline-none focus:ring-2 focus:ring-[#ACC2AB] ${
                  errores.horarioCierre ? 'border-red-400' : 'border-[#ACC2AB]/50'
                }`}
              />
              {errores.horarioCierre && (
                <p className="text-xs text-red-500 mt-1">{errores.horarioCierre}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3B4F38] mb-1">
              Duración del turno (min) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={form.duracionTurno}
              onChange={(e) => onChange('duracionTurno', e.target.value)}
              placeholder="Ej: 60"
              className={`w-full px-3 py-2 rounded-lg border text-[#061F03] focus:outline-none focus:ring-2 focus:ring-[#ACC2AB] ${
                errores.duracionTurno ? 'border-red-400' : 'border-[#ACC2AB]/50'
              }`}
            />
            {errores.duracionTurno && (
              <p className="text-xs text-red-500 mt-1">{errores.duracionTurno}</p>
            )}
          </div>

          {editando && (
            <div>
              <label className="block text-sm font-medium text-[#3B4F38] mb-1">
                Estado <span className="text-red-500">*</span>
              </label>
              <select
                value={form.estadoOperativo}
                onChange={(e) => onChange('estadoOperativo', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#ACC2AB]/50 text-[#061F03] bg-white focus:outline-none focus:ring-2 focus:ring-[#ACC2AB]"
              >
                {ESTADOS.map((s) => (
                  <option key={s} value={s}>{etiquetaEstado(s)}</option>
                ))}
              </select>
            </div>
          )}

          {errorGuardado && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm">
              {errorGuardado}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onCerrar}
            disabled={guardando}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#ACC2AB]/50 text-[#3B4F38] font-medium hover:bg-[#F4F8F3] transition-colors duration-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={guardando}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#3B4F38] text-white font-semibold hover:bg-[#061F03] transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {guardando ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                Guardando...
              </>
            ) : editando ? (
              'Guardar cambios'
            ) : (
              'Agregar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalConfirmarEliminar({
  cancha,
  eliminando,
  onConfirmar,
  onCancelar,
}: {
  cancha: Cancha
  eliminando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-[#061F03] mb-3">Eliminar cancha</h2>
        <p className="text-[#3B4F38] mb-1">¿Estás seguro de que querés eliminar</p>
        <p className="font-semibold text-[#061F03] mb-1">&quot;{cancha.nombre}&quot;?</p>
        <p className="text-sm text-red-600 mb-6">Esta acción no se puede deshacer.</p>

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={eliminando}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#ACC2AB]/50 text-[#3B4F38] font-medium hover:bg-[#F4F8F3] transition-colors duration-200 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={eliminando}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {eliminando ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white/40 border-t-white rounded-full" />
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
