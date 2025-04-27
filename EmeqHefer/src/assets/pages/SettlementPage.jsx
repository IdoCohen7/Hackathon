// pages/SettlementPage.jsx
import { useParams } from "react-router-dom";

export default function SettlementPage() {
  const { name } = useParams();
  console.log("Settlement name:", name);
  return (
    <div className="container mt-4">
      <h2 className="text-2xl font-bold mb-4">
        מידע על היישוב: {decodeURIComponent(name)}
      </h2>
      <p>כאן תוצג תחזית מזג אוויר ונתונים נוספים.</p>
    </div>
  );
}
