import { GoogleMap, Marker, InfoWindow } from "@react-google-maps/api";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const containerStyle = {
  width: "100%",
  height: "60vh",
};

const center = {
  lat: 32.3833,
  lng: 34.9167,
};

const getMarkerIcon = (predictedComplaints) => {
  if (predictedComplaints <= 5) {
    return "http://maps.google.com/mapfiles/ms/icons/green-dot.png";
  } else if (predictedComplaints <= 15) {
    return "http://maps.google.com/mapfiles/ms/icons/yellow-dot.png";
  } else if (predictedComplaints <= 30) {
    return "http://maps.google.com/mapfiles/ms/icons/orange-dot.png";
  } else {
    return "http://maps.google.com/mapfiles/ms/icons/red-dot.png";
  }
};

export default function ComplaintMap({ settlements, predictions }) {
  const [activeMarker, setActiveMarker] = useState(null);
  const navigate = useNavigate();

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={12}>
      {settlements.map((settlement) => {
        const prediction = predictions.find(
          (p) => p.settlement === settlement.name
        );

        return (
          <Marker
            key={settlement.name}
            position={{ lat: settlement.lat, lng: settlement.lng }}
            icon={{
              url: getMarkerIcon(
                prediction ? prediction.predicted_complaints : 0
              ),
            }}
            onMouseOver={() => setActiveMarker(settlement.name)}
            onMouseOut={() => setActiveMarker(null)}
            onClick={() =>
              navigate(`/settlement/${encodeURIComponent(settlement.name)}`)
            }
          >
            {activeMarker === settlement.name && (
              <InfoWindow
                position={{ lat: settlement.lat, lng: settlement.lng }}
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
  );
}
