import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ClassDetail from './pages/ClassDetail'
import SeatPicking from './pages/SeatPicking'

export default function App() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      {/* 學生選位頁：免登入，永遠可存取 */}
      <Route path="/seat/:code" element={<SeatPicking />} />

      {loading ? (
        <Route path="*" element={<Spinner />} />
      ) : session ? (
        <>
          <Route path="/" element={<Dashboard />} />
          <Route path="/class/:id" element={<ClassDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  )
}
