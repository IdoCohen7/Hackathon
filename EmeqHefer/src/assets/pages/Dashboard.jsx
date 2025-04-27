import { useEffect, useState } from "react";
import { Container, Row, Col, Card, Spinner } from "react-bootstrap";
import WeatherForecast from "../components/WeatherForcasts";
import WeeklyHighlights from "../components/WeeklyHighlights";
import ComplaintMap from "../components/ComplaintMap";
import RequestStatusCard from "../components/RequestStatusCard";
import logo from "../images/emeq-hefer-banner.png";
import axios from "axios";
import coordinates from "../../data/coordinates.js";

const latitude = 32.3833;
const longitude = 34.9167;

const settlements = coordinates;

const getWeatherIcon = (precipitation) => {
  if (precipitation > 5) return "🌧️";
  if (precipitation > 0) return "🌦️";
  return "☀️";
};

export default function Dashboard() {
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inProgressCount, setInProgressCount] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [totalPredicted, setTotalPredicted] = useState(0);
  const [todayTemp, setTodayTemp] = useState(null);
  const [todayDate, setTodayDate] = useState(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await axios.get(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia/Jerusalem`
        );
        const daily = response.data.daily;
        const dailyForecast = daily.time.map((date, index) => ({
          date,
          tempMax: daily.temperature_2m_max[index],
          tempMin: daily.temperature_2m_min[index],
          precipitation: daily.precipitation_sum[index],
          icon: getWeatherIcon(daily.precipitation_sum[index]),
        }));
        setForecast(dailyForecast);

        const today = new Date();
        const todayString = today.toISOString().split("T")[0];
        const todayIndex = daily.time.findIndex((d) => d === todayString);

        if (todayIndex !== -1) {
          const avgTempToday = (
            (daily.temperature_2m_max[todayIndex] +
              daily.temperature_2m_min[todayIndex]) /
            2
          ).toFixed(1);
          setTodayTemp(avgTempToday);
          setTodayDate(todayString);
        } else {
          console.warn(
            "לא נמצאה תחזית מדויקת ליום הנוכחי — נבחר את הקרובה ביותר."
          );
          if (dailyForecast.length > 0) {
            const firstForecast = dailyForecast[0];
            const avgTempClosest = (
              (firstForecast.tempMax + firstForecast.tempMin) /
              2
            ).toFixed(1);
            setTodayTemp(avgTempClosest);
            setTodayDate(firstForecast.date);
          }
        }
      } catch (error) {
        console.error("בעיה בשליפת תחזית מזג האוויר:", error);
      } finally {
        setLoading(false);
      }
    };

    const fetchInProgressCount = async () => {
      try {
        const response = await axios.get(
          "http://localhost:8000/requests/in-progress/count"
        );
        setInProgressCount(response.data);
      } catch (error) {
        console.error("❌ שגיאה בקבלת מספר פניות בטיפול:", error.message);
      }
    };

    fetchWeather();
    fetchInProgressCount();
  }, []);

  useEffect(() => {
    const fetchAllPredictions = async () => {
      if (todayTemp === null || todayDate === null) {
        console.warn("אין מידע מלא על תאריך או טמפרטורה לחיזוי.");
        return;
      }

      try {
        const response = await axios.post(
          `http://localhost:8000/predict/all?temp=${todayTemp}&predict_date=${todayDate}`
        );
        setPredictions(response.data.predictions);
        setTotalPredicted(response.data.total_predicted_complaints);
      } catch (error) {
        console.error(
          "❌ שגיאה בקבלת תחזיות:",
          error.response?.data || error.message
        );
      }
    };

    if (todayTemp !== null && todayDate !== null) {
      fetchAllPredictions();
    }
  }, [todayTemp, todayDate]);

  return (
    <Container className="mt-4 text-center">
      <Row className="mb-4">
        <Col>
          <img
            src={logo}
            alt="עמק חפר"
            className="logo-hover"
            style={{ height: "140px", margin: "20px" }}
          />
        </Col>
      </Row>

      <Row>
        <Col>
          {loading ? (
            <div className="text-center my-4">
              <Spinner animation="border" variant="primary" />
              <p>טוען תחזית מזג אוויר...</p>
            </div>
          ) : (
            <WeatherForecast forecast={forecast} />
          )}
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <RequestStatusCard inProgressCount={inProgressCount} />
        </Col>
      </Row>

      <Row>
        <Col>
          <WeeklyHighlights predictions={predictions} total={totalPredicted} />
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              {/* 🗺️ מקרא צבעים */}
              <div style={{ marginBottom: "10px", textAlign: "center" }}>
                <small>
                  <span style={{ color: "green", fontWeight: "bold" }}>●</span>{" "}
                  עד 5 פניות &nbsp;
                  <span style={{ color: "gold", fontWeight: "bold" }}>
                    ●
                  </span>{" "}
                  6-15 פניות &nbsp;
                  <span style={{ color: "orange", fontWeight: "bold" }}>
                    ●
                  </span>{" "}
                  16-30 פניות &nbsp;
                  <span style={{ color: "red", fontWeight: "bold" }}>
                    ●
                  </span>{" "}
                  מעל 30 פניות
                </small>
              </div>

              <ComplaintMap
                settlements={settlements}
                predictions={predictions}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
