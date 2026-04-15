/**
 * utils/AuthContext.jsx
 * Global auth state via React context.
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentSession, signOut as cognitoSignOut } from './cognito'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null)   // { idToken, userId, email }
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    getCurrentSession().then(s => {
      setSession(s)
      setLoading(false)
    })
  }, [])

  const logout = () => {
    cognitoSignOut()
    setSession(null)
    // Clear locally stored key material
    localStorage.removeItem('sfs_private_key')
    localStorage.removeItem('sfs_public_key')
    localStorage.removeItem('sfs_eth_address')
    localStorage.removeItem('sfs_eth_private_key')
  }

  const login = (s) => setSession(s)

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
