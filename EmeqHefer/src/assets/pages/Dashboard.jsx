import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Row, Col, Card, Spinner } from "react-bootstrap";
import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api"; // שים לב שהוספתי גם InfoWindow
import WeeklyHighlights from "../components/WeeklyHighlights";
import WeatherForecast from "../components/WeatherForcasts";
import logo from "../images/emeq-hefer-banner.png";
import axios from "axios";
import coordinates from "../../data/coordinates.js";

// קואורדינטות של מרכז המפה
const latitude = 32.3833;
const longitude = 34.9167;

// נקודות יישובים
const settlements = coordinates;

const containerStyle = {
  width: "100%",
  height: "60vh",
};

const center = {
  lat: latitude,
  lng: longitude,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeMarker, setActiveMarker] = useState(null); // 🆕 משתנה לניהול InfoWindow פתוח

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
      } catch (error) {
        console.error("בעיה בשליפת תחזית מזג האוויר:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  // אייקונים לפי משקעים
  const getWeatherIcon = (precipitation) => {
    if (precipitation > 5) return "🌧️";
    if (precipitation > 0) return "🌦️";
    return "☀️";
  };

  // דגשים
  const highlights = [
    "גשם צפוי ביום רביעי - חשוב לתגבר ניקוז!",
    "עומס פניות צפוי בתחומי תברואה ביום ראשון.",
    "עומס קל צפוי בבת חפר - טיפול רגיל.",
  ];

  return (
    <Container className="mt-4 text-center">
      {/* לוגו וכותרת */}
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

      {/* תחזית שבועית */}
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

      {/* מסקנות ודגשים */}
      <Row>
        <Col>
          <WeeklyHighlights highlights={highlights} />
        </Col>
      </Row>

      {/* מפת יישובים */}
      <Row className="mt-4">
        <Col>
          <Card className="shadow-sm">
            <Card.Body>
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={12}
              >
                {settlements.map((settlement) => (
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
                        position={{ lat: settlement.lat, lng: settlement.lng }}
                        onCloseClick={() => setActiveMarker(null)}
                      >
                        <div style={{ minWidth: "120px" }}>
                          <h6 className="mb-1">{settlement.name}</h6>
                          <p className="mb-0">מידע קצר על היישוב</p>
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                ))}
              </GoogleMap>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
