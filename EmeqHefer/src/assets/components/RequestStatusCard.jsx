import { Card, ProgressBar, Spinner, Row, Col } from "react-bootstrap";
import { useEffect, useState } from "react";
import axios from "axios";

export default function RequestStatusCard({ inProgressCount }) {
  const [topTopics, setTopTopics] = useState([]);
  const [loadingTopics, setLoadingTopics] = useState(true);

  useEffect(() => {
    const fetchTopTopics = async () => {
      try {
        const response = await axios.get(
          "http://localhost:8000/requests/top-topics"
        );

        if (Array.isArray(response.data.top_topics)) {
          setTopTopics(response.data.top_topics);
        } else {
          console.warn("⚠️ פורמט תגובת השרת לא צפוי:", response.data);
          setTopTopics([]);
        }
      } catch (error) {
        console.error("❌ שגיאה בקבלת נושאים מובילים:", error.message);
      } finally {
        setLoadingTopics(false);
      }
    };

    fetchTopTopics();
  }, []);

  const calculateExceedPercentage = () => {
    if (inProgressCount && inProgressCount.in_progress_requests_count > 0) {
      return (
        (inProgressCount.in_progress_exceed_count /
          inProgressCount.in_progress_requests_count) *
        100
      );
    }
    return 0;
  };

  return (
    <Card className="shadow-sm p-3 mb-4">
      <Card.Title className="text-center mb-4">סטטוס פניות בטיפול</Card.Title>

      {inProgressCount !== null ? (
        <Row>
          {/* עמודה ימין */}
          <Col md={6} className="border-end">
            <p
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "green",
                marginBottom: "10px",
              }}
            >
              פניות ללא חריגה: {inProgressCount.in_progress_no_exceed_count}
            </p>
            <p
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "red",
              }}
            >
              פניות עם חריגה: {inProgressCount.in_progress_exceed_count}
            </p>
            <p style={{ marginTop: "10px", fontSize: "16px", color: "#555" }}>
              סה"כ פניות בטיפול: {inProgressCount.in_progress_requests_count}
            </p>

            <ProgressBar className="mt-3">
              <ProgressBar
                now={100 - calculateExceedPercentage()}
                variant="success"
                label={`${Math.round(
                  100 - calculateExceedPercentage()
                )}% תקינות`}
                key={1}
              />
              <ProgressBar
                now={calculateExceedPercentage()}
                variant="danger"
                label={`${Math.round(calculateExceedPercentage())}% חריגה`}
                key={2}
              />
            </ProgressBar>
          </Col>

          {/* עמודה שמאל */}
          <Col
            md={6}
            className="d-flex flex-column justify-content-center align-items-center"
          >
            <h5 className="mb-3">🔝 נושאים בולטים בחריגה:</h5>

            {loadingTopics ? (
              <Spinner animation="border" variant="secondary" />
            ) : topTopics.length > 0 ? (
              <ul className="list-unstyled">
                {topTopics.map((topic, index) => (
                  <li
                    key={index}
                    style={{ fontSize: "16px", marginBottom: "6px" }}
                  >
                    <strong>{topic.topic}</strong> – {topic.count} פניות
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: "16px" }}>אין נתונים להצגה.</p>
            )}
          </Col>
        </Row>
      ) : (
        <Spinner animation="border" variant="primary" />
      )}
    </Card>
  );
}
