import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import WeatherPage from "./pages/WeatherPage";
import MapPage from "./pages/MapPage";
import RecommendationsPage from "./pages/RecommendationsPage";
import StatsPage from "./pages/StatsPage";

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </Router>
  );
}
