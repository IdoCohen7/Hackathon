import { Card, Row, Col } from "react-bootstrap";

export default function WeatherForecast({ forecast }) {
  return (
    <Card className="shadow-sm mb-4">
      <Card.Body>
        <Card.Title>🌤️ תחזית מזג האוויר השבועית</Card.Title>
        <Row className="g-3 text-center mt-3">
          {forecast.map((day, index) => (
            <Col key={index}>
              <div>
                <div style={{ fontSize: "2rem" }}>{day.icon}</div>{" "}
                {/* אייקון */}
                <div>
                  {new Date(day.date).toLocaleDateString("he-IL", {
                    weekday: "short",
                  })}
                </div>{" "}
                {/* שם היום */}
                <div>
                  {day.tempMax}° / {day.tempMin}°
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card.Body>
    </Card>
  );
}
