import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ClassDetail from './pages/ClassDetail'
import SeatPicking from './pages/SeatPicking'
import HealthGate from './health/HealthGate'

export default function App() {
  const { session, role, loading } = useAuth()

  return (
    <Routes>
      {/* 學生選位頁：免登入，永遠可存取 */}
      <Route path="/seat/:code" element={<SeatPicking />} />

      {/* 健康管理：自行處理登入與身分，不受下方教師路由影響 */}
      <Route path="/health" element={<HealthGate />} />

      {loading ? (
        <Route path="*" element={<Spinner />} />
      ) : session ? (
        role === 'student' ? (
          // 學生登入後只有健康頁可用，不要落到教師端
          <Route path="*" element={<Navigate to="/health" replace />} />
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/class/:id" element={<ClassDetail />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )
      ) : (
        <>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  )
}
