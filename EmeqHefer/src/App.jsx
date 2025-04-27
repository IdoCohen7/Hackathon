import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { LoadScript } from "@react-google-maps/api";
import Dashboard from "../src/assets/pages/dashboard";
import SettlementPage from "../src/assets/pages/SettlementPage";
import GOOGLE_MAPS_API_KEY from "./config/keys.js";
import "bootstrap/dist/css/bootstrap.min.css";

export default function App() {
  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <Router>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settlement/:name" element={<SettlementPage />} />
        </Routes>
      </Router>
    </LoadScript>
  );
}
