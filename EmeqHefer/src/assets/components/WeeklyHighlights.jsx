import { Card } from "react-bootstrap";

export default function WeeklyHighlights({ highlights }) {
  return (
    <Card className="mb-4 shadow-sm">
      <Card.Body>
        <Card.Title>📋 מסקנות ודגשים לשבוע הקרוב</Card.Title>
        <ul className="list-unstyled mt-3">
          {highlights.map((item, index) => (
            <li key={index} className="mb-2">
              ✅ {item}
            </li>
          ))}
        </ul>
      </Card.Body>
    </Card>
  );
}
