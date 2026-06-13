'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import Navbar from '@/src/components/Navbar'
import Footer from '@/src/components/Footer'
import Link from 'next/link'
import { Plus, Pencil, Trash2, MapPin, Building2 } from 'lucide-react'

type Complejo = {
  id_complejo: number
  nombre: string
  direccion: string
  email_administrador: string
}

type FormData = { nombre: string; direccion: string }
type FormErrors = Partial<FormData>

export default function PaginaComplejos() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  const [complejos, setComplejos] = useState<Complejo[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [complejoEditando, setComplejoEditando] = useState<Complejo | null>(null)
  const [form, setForm] = useState<FormData>({ nombre: '', direccion: '' })
  const [erroresForm, setErroresForm] = useState<FormErrors>({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)

  const [confirmEliminar, setConfirmEliminar] = useState<Complejo | null>(null)
  const [eliminando, setEliminando] = useState(false)

  const emailAdmin = user?.primaryEmailAddress?.emailAddress

  // Verificación de rol
  useEffect(() => {
    if (!isLoaded) return
    if (!user) { router.replace('/sign-in'); return }
    const rolRaw = (user.publicMetadata as { rol?: string | string[] }).rol
    const rol = Array.isArray(rolRaw) ? rolRaw[0] : rolRaw
    if (rol !== 'admin') router.replace('/')
  }, [isLoaded, user, router])

  const cargarComplejos = useCallback(async () => {
    if (!emailAdmin) return
    setCargando(true)
    setErrorCarga(null)
    try {
      const res = await fetch('/api/v1/complejos?limit=100')
      if (!res.ok) throw new Error('Error al cargar complejos')
      const json = await res.json()
      const todos: Complejo[] = json.data ?? []
      setComplejos(todos.filter((c) => c.email_administrador === emailAdmin))
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [emailAdmin])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isLoaded && emailAdmin) cargarComplejos()
  }, [isLoaded, emailAdmin, cargarComplejos])

  function abrirCrear() {
    setComplejoEditando(null)
    setForm({ nombre: '', direccion: '' })
    setErroresForm({})
    setErrorGuardado(null)
    setModalAbierto(true)
  }

  function abrirEditar(complejo: Complejo) {
    setComplejoEditando(complejo)
    setForm({ nombre: complejo.nombre, direccion: complejo.direccion })
    setErroresForm({})
    setErrorGuardado(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    setModalAbierto(false)
    setComplejoEditando(null)
    setGuardando(false)
    setErrorGuardado(null)
  }

  function validarForm(): boolean {
    const errores: FormErrors = {}
    if (!form.nombre.trim()) errores.nombre = 'El nombre es requerido'
    else if (form.nombre.length > 100) errores.nombre = 'Máximo 100 caracteres'
    if (!form.direccion.trim()) errores.direccion = 'La dirección es requerida'
    else if (form.direccion.length > 255) errores.direccion = 'Máximo 255 caracteres'
    setErroresForm(errores)
    return Object.keys(errores).length === 0
  }

  async function guardar() {
    if (!validarForm()) return
    setGuardando(true)
    setErrorGuardado(null)
    try {
      const url = complejoEditando
        ? `/api/v1/complejos/${complejoEditando.id_complejo}`
        : '/api/v1/complejos'
      const method = complejoEditando ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: { message?: string } })?.error?.message ?? 'Error al guardar')
      }

      cerrarModal()
      await cargarComplejos()
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
      const res = await fetch(`/api/v1/complejos/${confirmEliminar.id_complejo}`, {
        method: 'DELETE',
      })
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: { message?: string } })?.error?.message ?? 'Error al eliminar')
      }
      setConfirmEliminar(null)
      await cargarComplejos()
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

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-[#F4F8F3]">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-[#061F03]">Mis Complejos</h1>
              <p className="text-[#3B4F38] mt-1">Gestioná tus complejos deportivos</p>
            </div>
            <button
              onClick={abrirCrear}
              className="flex items-center gap-2 bg-[#3B4F38] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#061F03] transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              Crear complejo
            </button>
          </div>

          {cargando && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-4 border-[#ACC2AB] border-t-[#3B4F38] rounded-full" />
            </div>
          )}

          {!cargando && errorCarga && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 flex items-center gap-4">
              <span>{errorCarga}</span>
              <button onClick={cargarComplejos} className="underline text-sm shrink-0">
                Reintentar
              </button>
            </div>
          )}

          {!cargando && !errorCarga && complejos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Building2 className="w-16 h-16 text-[#ACC2AB] mb-4" />
              <h2 className="text-xl font-semibold text-[#061F03] mb-2">No tenés complejos todavía</h2>
              <p className="text-[#3B4F38] mb-6">
                Creá tu primer complejo para empezar a gestionar canchas.
              </p>
              <button
                onClick={abrirCrear}
                className="flex items-center gap-2 bg-[#3B4F38] text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-[#061F03] transition-colors duration-200"
              >
                <Plus className="w-4 h-4" />
                Crear complejo
              </button>
            </div>
          )}

          {!cargando && !errorCarga && complejos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {complejos.map((complejo) => (
                <TarjetaComplejo
                  key={complejo.id_complejo}
                  complejo={complejo}
                  onEditar={() => abrirEditar(complejo)}
                  onEliminar={() => setConfirmEliminar(complejo)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {modalAbierto && (
        <ModalFormulario
          editando={complejoEditando}
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
          complejo={confirmEliminar}
          eliminando={eliminando}
          onConfirmar={eliminar}
          onCancelar={() => setConfirmEliminar(null)}
        />
      )}
    </>
  )
}

function TarjetaComplejo({
  complejo,
  onEditar,
  onEliminar,
}: {
  complejo: Complejo
  onEditar: () => void
  onEliminar: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#ACC2AB]/30 p-6 hover:shadow-md transition-shadow duration-200 flex flex-col gap-4">
      <div className="flex-1">
        <h2 className="font-bold text-[#061F03] text-lg mb-2">{complejo.nombre}</h2>
        <div className="flex items-start gap-1.5 text-sm text-[#3B4F38]">
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[#7FB584]" />
          <span>{complejo.direccion}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link
          href={`/admin/complejos/${complejo.id_complejo}/canchas`}
          className="flex-1 text-center text-sm font-medium bg-[#D7E6D3] text-[#3B4F38] px-3 py-2 rounded-lg hover:bg-[#ACC2AB]/50 transition-colors duration-200"
        >
          Ver canchas
        </Link>
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
  editando: Complejo | null
  form: FormData
  errores: FormErrors
  guardando: boolean
  errorGuardado: string | null
  onChange: (campo: keyof FormData, valor: string) => void
  onGuardar: () => void
  onCerrar: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-[#061F03] mb-6">
          {editando ? 'Editar complejo' : 'Crear complejo'}
        </h2>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#3B4F38] mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => onChange('nombre', e.target.value)}
              maxLength={100}
              placeholder="Ej: Complejo Palermo"
              className={`w-full px-3 py-2 rounded-lg border text-[#061F03] focus:outline-none focus:ring-2 focus:ring-[#ACC2AB] ${
                errores.nombre ? 'border-red-400' : 'border-[#ACC2AB]/50'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errores.nombre ? (
                <p className="text-xs text-red-500">{errores.nombre}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-[#3B4F38]/50">{form.nombre.length}/100</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#3B4F38] mb-1">
              Dirección <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.direccion}
              onChange={(e) => onChange('direccion', e.target.value)}
              maxLength={255}
              placeholder="Ej: Av. Corrientes 1234, CABA"
              className={`w-full px-3 py-2 rounded-lg border text-[#061F03] focus:outline-none focus:ring-2 focus:ring-[#ACC2AB] ${
                errores.direccion ? 'border-red-400' : 'border-[#ACC2AB]/50'
              }`}
            />
            <div className="flex justify-between mt-1">
              {errores.direccion ? (
                <p className="text-xs text-red-500">{errores.direccion}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-[#3B4F38]/50">{form.direccion.length}/255</p>
            </div>
          </div>

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
              'Crear'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalConfirmarEliminar({
  complejo,
  eliminando,
  onConfirmar,
  onCancelar,
}: {
  complejo: Complejo
  eliminando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-[#061F03] mb-3">Eliminar complejo</h2>
        <p className="text-[#3B4F38] mb-1">¿Estás seguro de que querés eliminar</p>
        <p className="font-semibold text-[#061F03] mb-1">&quot;{complejo.nombre}&quot;?</p>
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
