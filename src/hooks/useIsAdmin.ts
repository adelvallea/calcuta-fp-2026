'use client'

import { useEffect, useState } from 'react'

/**
 * Devuelve true si el usuario tiene la cookie de sesión de moderador.
 * Usado para mostrar/ocultar botones de acción sin bloquear la vista.
 */
export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // La cookie mod_session es httpOnly, no accesible desde JS.
    // Verificamos contra la API que retorna el estado.
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin === true))
      .catch(() => setIsAdmin(false))
  }, [])

  return isAdmin
}
