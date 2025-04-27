import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  ProgressBar,
} from "react-bootstrap";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import WeeklyHighlights from "../components/WeeklyHighlights";
import WeatherForecast from "../components/WeatherForcasts";
import logo from "../images/emeq-hefer-banner.png";
import axios from "axios";
import coordinates from "../../data/coordinates.js";

const latitude = 32.3833;
const longitude = 34.9167;

const settlements = coordinates;

const containerStyle = {
  width: "100%",
  height: "60vh",
};

const center = {
  lat: latitude,
  lng: longitude,
};

const getWeatherIcon = (precipitation) => {
  if (precipitation > 5) return "🌧️";
  if (precipitation > 0) return "🌦️";
  return "☀️";
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMarker, setActiveMarker] = useState(null);
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
          ).toFixed(1); // עיגול קל
          setTodayTemp(avgTempToday);
          setTodayDate(todayString);
        } else {
          console.warn("לא נמצאה תחזית מזג אוויר ליום הנוכחי.");
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

      <Row>
        <Col>
          <WeeklyHighlights predictions={predictions} total={totalPredicted} />
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <Card className="shadow-sm p-3 mb-4">
            <Card.Title>סטטוס בפניות טיפול</Card.Title>
            {inProgressCount !== null ? (
              <div>
                <p
                  style={{
                    fontSize: "22px",
                    fontWeight: "bold",
                    color: "green",
                    marginBottom: "10px",
                  }}
                >
                  פניות ללא חריגה: {inProgressCount.in_progress_no_exceed_count}
                </p>
                <p
                  style={{
                    fontSize: "22px",
                    fontWeight: "bold",
                    color: "red",
                  }}
                >
                  פניות עם חריגה: {inProgressCount.in_progress_exceed_count}
                </p>
                <p
                  style={{ marginTop: "10px", fontSize: "16px", color: "#555" }}
                >
                  סה"כ פניות בטיפול:{" "}
                  {inProgressCount.in_progress_requests_count}
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
              </div>
            ) : (
              <Spinner animation="border" variant="primary" />
            )}
          </Card>
        </Col>
      </Row>

      <Row className="mt-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={12}
              >
                {settlements.map((settlement) => {
                  const prediction = predictions.find(
                    (p) => p.settlement === settlement.name
                  );

                  return (
                    <Marker
                      key={settlement.name}
                      position={{ lat: settlement.lat, lng: settlement.lng }}
                      onMouseOver={() => setActiveMarker(settlement.name)}
                      onMouseOut={() => setActiveMarker(null)}
                      onClick={() =>
                        navigate(
                          `/settlement/${encodeURIComponent(settlement.name)}`
                        )
                      }
                    >
                      {activeMarker === settlement.name && (
                        <InfoWindow
                          position={{
                            lat: settlement.lat,
                            lng: settlement.lng,
                          }}
                          onCloseClick={() => setActiveMarker(null)}
                        >
                          <div style={{ minWidth: "140px" }}>
                            <h6 className="mb-1">{settlement.name}</h6>
                            {prediction ? (
                              <p className="mb-0">
                                פניות חזויות: {prediction.predicted_complaints}
                              </p>
                            ) : (
                              <p className="mb-0">אין תחזית זמינה</p>
                            )}
                          </div>
                        </InfoWindow>
                      )}
                    </Marker>
                  );
                })}
              </GoogleMap>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
