import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import TeacherHome from './pages/TeacherHome'
import Dashboard from './pages/Dashboard'
import Demo from './pages/Demo'
import Links from './pages/Links'
import ClassDetail from './pages/ClassDetail'
import SeatPicking from './pages/SeatPicking'
import NoAccess from './pages/NoAccess'
import HealthGate from './health/HealthGate'

export default function App() {
  const { session, role, loading } = useAuth()

  return (
    <Routes>
      {/* 學生選位頁：免登入，永遠可存取 */}
      <Route path="/seat/:code" element={<SeatPicking />} />

      {/*
        學生入口頁：掃 QR code 進來的第一頁，也是印在講義上的網址。
        以前這條直接是登記表單，登記現在搬到 /health/register——
        舊網址沒有失效，只是變成先看到入口。
      */}
      <Route path="/health" element={<HealthGate page="home" />} />

      {/* 健康管理：自行處理登入與身分，不受下方教師路由影響 */}
      <Route path="/health/register" element={<HealthGate page="register" />} />

      {/* 教師紅旗查詢：唯讀，擋人條件在 FlagList 裡（要有帶班級）*/}
      <Route path="/health/teacher" element={<HealthGate page="teacher" />} />
      {/* 班級進度表：只顯示做了沒，可以投影 */}
      <Route path="/health/progress" element={<HealthGate page="progress" />} />
      {/* 學生明細：有分數與填答內容，唯讀，不能投影 */}
      <Route path="/health/detail" element={<HealthGate page="detail" />} />
      {/* SMART 與行動紀錄批改：教師私用，不投影 */}
      <Route path="/health/review" element={<HealthGate page="review" />} />

      <Route path="/health/selfcheck" element={<HealthGate page="selfcheck" />} />
      <Route path="/health/analysis" element={<HealthGate page="analysis" />} />
      <Route path="/health/goal" element={<HealthGate page="goal" />} />
      <Route path="/health/checkin" element={<HealthGate page="checkin" />} />
      <Route path="/health/plate" element={<HealthGate page="plate" />} />

      {/* 教師預覽學生畫面；非教師身分時與上面三條相同 */}
      <Route path="/health/preview" element={<HealthGate page="home" preview />} />
      <Route path="/health/register/preview" element={<HealthGate page="register" preview />} />
      <Route path="/health/selfcheck/preview" element={<HealthGate page="selfcheck" preview />} />
      <Route path="/health/analysis/preview" element={<HealthGate page="analysis" preview />} />
      <Route path="/health/goal/preview" element={<HealthGate page="goal" preview />} />
      <Route path="/health/checkin/preview" element={<HealthGate page="checkin" preview />} />
      <Route path="/health/plate/preview" element={<HealthGate page="plate" preview />} />

      {loading ? (
        <Route path="*" element={<Spinner />} />
      ) : session ? (
        role === 'resolving' ? (
          // 身分還沒查完。這一條以前落在下面的 else，會先閃一下教師後台
          <Route path="*" element={<Spinner />} />
        ) : role === 'student' ? (
          // 學生登入後只有健康頁可用，不要落到教師端
          <Route path="*" element={<Navigate to="/health" replace />} />
        ) : role === 'teacher' ? (
          <>
            <Route path="/" element={<TeacherHome />} />
            <Route path="/classes" element={<Dashboard />} />
            <Route path="/class/:id" element={<ClassDetail />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/links" element={<Links />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          /*
            登入了，但既不在學生名單上、也不在教師白名單上
            （hc_ensure_teacher() 會回 P0011 not_a_teacher）。
            以前這一條會落到教師後台，顯示一個讀不到任何資料的空殼。
          */
          <Route path="*" element={<NoAccess />} />
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
