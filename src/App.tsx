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

      {/* 教師紅旗查詢：唯讀，擋人條件在 FlagList 裡（要有帶班級）*/}
      <Route path="/health/teacher" element={<HealthGate page="teacher" />} />
      {/* 班級進度表：只顯示做了沒，可以投影 */}
      <Route path="/health/progress" element={<HealthGate page="progress" />} />
      {/* 學生明細：有分數與填答內容，唯讀，不能投影 */}
      <Route path="/health/detail" element={<HealthGate page="detail" />} />

      <Route path="/health/selfcheck" element={<HealthGate page="selfcheck" />} />
      <Route path="/health/analysis" element={<HealthGate page="analysis" />} />
      <Route path="/health/goal" element={<HealthGate page="goal" />} />
      <Route path="/health/plate" element={<HealthGate page="plate" />} />

      {/* 教師預覽學生畫面；非教師身分時與上面三條相同 */}
      <Route path="/health/preview" element={<HealthGate preview />} />
      <Route path="/health/selfcheck/preview" element={<HealthGate page="selfcheck" preview />} />
      <Route path="/health/analysis/preview" element={<HealthGate page="analysis" preview />} />
      <Route path="/health/goal/preview" element={<HealthGate page="goal" preview />} />
      <Route path="/health/plate/preview" element={<HealthGate page="plate" preview />} />

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
