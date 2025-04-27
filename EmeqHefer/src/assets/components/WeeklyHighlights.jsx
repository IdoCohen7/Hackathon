import { Card } from "react-bootstrap";

export default function WeeklyHighlights({ predictions, total }) {
  // מיון ולקיחת טופ 3 יישובים עם הכי הרבה פניות צפויות
  const topPredictions = [...predictions]
    .sort((a, b) => b.predicted_complaints - a.predicted_complaints)
    .slice(0, 3);

  return (
    <Card className="mb-4 shadow-sm">
      <Card.Body>
        <Card.Title>📋 תחזית פניות - טופ 3 יישובים</Card.Title>

        <h5 className="mt-3 mb-4">
          סה"כ פניות חזויות בכלל המועצה:{" "}
          <span style={{ color: "#2c3e50" }}>{total}</span>
        </h5>

        <ul className="list-unstyled mt-3">
          {topPredictions.map((item, index) => (
            <li key={index} className="mb-2">
              ✅ {item.settlement} - {item.predicted_complaints} פניות צפויות
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
}
