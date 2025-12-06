import { BrowserRouter, Route, Routes } from "react-router-dom"
import CreateRFP from "./pages/CreateRFP"
import VenderRfpPages from "./pages/VenderRfpPages"
import VenderResponse from "./pages/VenderResponse"
import Proposal from "./pages/Proposal"
import Dashboard from "./pages/Dashboard"
import Layout from "./components/Layout"
import AiRfpRecommendations from "./pages/AIRfp"
import Setting from "./pages/Setting"


function App() {
  return (
    <>
      <BrowserRouter>

      <Routes>
        {/* Layout route keeps Sidebar + Navbar mounted for all child routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="create" element={<CreateRFP />} />
          <Route path="/venderpage" element={<VenderRfpPages/>}/>
          <Route path="/venderresponse" element={<VenderResponse />}/>
          <Route path="proposal" element={<Proposal />} />
          <Route path="/ai" element={<AiRfpRecommendations />}/>
          <Route path="/setting" element={<Setting />}/>
        </Route>

        {/* Example of routes that should NOT show sidebar/navbar (like login) */}
        {/* <Route path="/login" element={<Login />} /> */}
      </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
