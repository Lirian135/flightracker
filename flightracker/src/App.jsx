import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";


import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import ReactIcon from "./assets/react.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const rotatedIcon = (heading = 0, isSelected = false) =>
  L.divIcon({
    className: "rotated-icon",
    html: `<div style="
      transform: rotate(${heading}deg);
      border: 2px solid ${isSelected ? 'dodgerblue' : 'transparent'};
      border-radius: 50%;
    ">
      <img src="${ReactIcon}" width="40" height="40" />
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });


const airportIcon = (type = 'origin') => 
  L.divIcon({
    className: "airport-icon",
    html: `<div style="
        background: ${type === 'origin' ? '#22c55e' : '#ef4444'};
        border: 2px solid white;
        border-radius: 50%;
        width: 16px;
        height: 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 10px;
      ">
        ${type === 'origin' ? 'O' : 'D'}
      </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

function BoundsSetter({ onChange }) {
  const map = useMapEvents({
    moveend: () => onChange(map.getBounds()),
    zoomend: () => onChange(map.getBounds()),
  });
  useEffect(() => {
    onChange(map.getBounds());
  }, [map, onChange]);
  return null;
}

export default function App() {
  const [flights, setFlights] = useState([]);
  const [bounds, setBounds] = useState(null);
  const [loading, setLoading] = useState(false);

  const [selected, setSelected] = useState(null);
  const [route, setRoute] = useState({ origin: null, destination: null });
  const [fullRouteData, setFullRouteData] = useState(null);

  const center = [51.505, -0.09];

  useEffect(() => {
    if (!bounds) return;
    let cancelled = false;

    async function loadFlights() {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:3001/api/flights");
        const js = await res.json();
        if (cancelled) return;
        // filter to only those inside the current view
        const visible = js.flights.filter((f) => {
          return bounds.contains(L.latLng(f.lat, f.lon));
        });
        setFlights(visible);
      } catch {
        setFlights([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFlights();
    const iv = setInterval(loadFlights, 10000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [bounds]);


  useEffect(() => {
    if (!selected) {
      setRoute({ origin: null, destination: null });
      setFullRouteData(null);
      return;
    }
    let cancelled = false;
    async function loadRoute() {
      try {
        const cs = selected.callsign.trim();
        if (!cs || cs === "N/A") {
          setRoute({ origin: null, destination: null });
          setFullRouteData(null);
          return;
        }
        const res = await fetch(
          `http://localhost:3001/api/route/${encodeURIComponent(cs)}`
        );
        const js = await res.json();
        if (!cancelled) {
          setRoute({
            origin: js.origin,
            destination: js.destination,
          });
          
          setFullRouteData(js);
        }
      } catch {
        if (!cancelled) {
          setRoute({ origin: null, destination: null });
          setFullRouteData(null);
        }
      }
    }
    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div
        style={{
          width: 280,
          padding: 16,
          background: "#eee",
          borderRight: "1px solid #ccc",
        }}
      >
        <h3>Flight Info</h3>
        {selected ? (
          <>
            <p>
              <strong>Callsign:</strong> {selected.callsign}
            </p>
            <p>
              <strong>Heading:</strong> {selected.heading}°
            </p>
            <p>
              <strong>Speed:</strong> {selected.velocity} m/s
            </p>
            <p>
              <strong>Altitude:</strong>{" "}
              {selected.altitude?.toFixed(2)} km
            </p>
            <p>
              <strong>Origin:</strong>{" "}
              {route.origin || "Not available"}
            </p>
            <p>
              <strong>Destination:</strong>{" "}
              {route.destination || "Not available"}
            </p>
          </>
        ) : (
          <p>Click a plane on the map</p>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <MapContainer
          center={center}
          zoom={5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <BoundsSetter onChange={setBounds} />

          {loading && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                zIndex: 1000,
                background: "white",
                padding: "4px 8px",
                borderRadius: 4,
              }}
            >
              Loading…
            </div>
          )}

          {flights.map((f) => (
            <Marker
              key={`${f.callsign}-${f.lat}-${f.lon}`}
              position={[f.lat, f.lon]}
              icon={rotatedIcon(f.heading, selected === f)}
              eventHandlers={{
                click: () => setSelected(f),
              }}
            />
          ))}

          
          {selected && fullRouteData?.originCoords && (
            <Polyline
              positions={[
                [fullRouteData.originCoords.lat, fullRouteData.originCoords.lon],
                [selected.lat, selected.lon]
              ]}
              color="#22c55e"
              weight={4}
              opacity={0.9}
              dashArray="8, 12"
            />
          )}
          {selected && fullRouteData?.destinationCoords && (
            <Polyline
              positions={[
                [selected.lat, selected.lon],
                [fullRouteData.destinationCoords.lat, fullRouteData.destinationCoords.lon]
              ]}
              color="#ef4444"
              weight={4}
              opacity={0.9}
              dashArray="8, 12"
            />
          )}

          
          {fullRouteData?.originCoords && (
            <Marker
              key="origin-airport"
              position={[fullRouteData.originCoords.lat, fullRouteData.originCoords.lon]}
              icon={airportIcon('origin')}
            />
          )}
          {fullRouteData?.destinationCoords && (
            <Marker
              key="destination-airport"
              position={[fullRouteData.destinationCoords.lat, fullRouteData.destinationCoords.lon]}
              icon={airportIcon('destination')}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}