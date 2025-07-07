import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
const PORT = 3001;


//from opensky api
const CLIENT_ID = "CLIENTID";
const CLIENT_SECRET = "CLIENTSECRET";

let oskToken = "";
let oskExpires = 0;

async function getOpenSkyToken() {
  const now = Date.now();
  if (oskToken && now < oskExpires) return oskToken;

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);

  const res = await fetch(
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    }
  );
  const data = await res.json();
  oskToken = data.access_token;

  oskExpires = now + (data.expires_in - 30) * 1000;
  return oskToken;
}

app.use(cors());


app.get("/api/flights", async (req, res) => {
  try {
    const token = await getOpenSkyToken();
    const r = await fetch("https://opensky-network.org/api/states/all", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return res.status(r.status).json({ error: "OpenSky failed" });
    const js = await r.json();
    
    const flights = js.states
      .map((f) => ({
        callsign: (f[1] || "").trim() || "N/A",
        lat: f[6],
        lon: f[5],
        altitude: f[7] != null ? f[7] / 1000 : null,
        velocity: f[9],
        heading: f[10],
      }))
      .filter((f) => f.lat != null && f.lon != null);
    res.json({ flights });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});


app.get("/api/route/:cs", async (req, res) => {
  const callsign = req.params.cs.trim();
  if (!callsign) return res.json({ origin: null, destination: null });

  try {
    const r = await fetch(
      `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`
    );
    if (r.status === 404) {
      return res.json({ origin: null, destination: null });
    }
    if (!r.ok) return res.status(r.status).json({ error: "ADSBdb failed" });
    const js = await r.json();
    const route = js.response?.flightroute || null;
    if (!route) return res.json({ origin: null, destination: null });

    const originName = route.origin?.name || "Unknown";
    const destName = route.destination?.name || "Unknown";
    const originCode =
      route.origin?.iata_code || route.origin?.icao_code || "N/A";
    const destCode =
      route.destination?.iata_code || route.destination?.icao_code || "N/A";

    const originCountry = route.origin?.country_name || "Unknown";
    const destCountry = route.destination?.country_name || "Unknown";

    
    const originCoords = route.origin?.latitude && route.origin?.longitude
      ? { lat: route.origin.latitude, lon: route.origin.longitude }
      : null;
    
    const destinationCoords = route.destination?.latitude && route.destination?.longitude
      ? { lat: route.destination.latitude, lon: route.destination.longitude }
      : null;

    res.json({
      origin: `${originName} (${originCode}) - ${originCountry}`,
      destination: `${destName} (${destCode}) - ${destCountry}`,
      originCoords,
      destinationCoords,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ origin: null, destination: null });
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
