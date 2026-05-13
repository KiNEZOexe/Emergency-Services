//DO NOT TOUCH THIS SCRIPT, CSS LANG GAGAWIN NIYO

//openstreetmap DO NOT TOUCH
let map = L.map("map").setView([15.144, 120.591], 10);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

// ONLY USER MARKER
let userMarker = null;

// search button connection
document.getElementById("searchbtn").addEventListener("click", async () => {
  let query = document.getElementById("locate").value;

  if (query) {
    let coords = await geocodeLocation(query);

    if (coords) {
      loadEmergencyServices(coords.lat, coords.lng, 20000); // 1km = 1000 for radius, EDITABLE
    }
  }
});

// GEOCODING location lat n lng DO NOT TOUCH
async function geocodeLocation(locationName) {
  try {
    let response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName + ", Philippines")}`,
    );

    let data = await response.json();

    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    } else {
      alert("Location not found.");
      return null;
    }
  } catch (err) {
    console.error(err);
    return null;
  }
}

// fetches data of emergency services, api for overpass DO NOT TOUCH
async function fetchEmergency(lat, lng, radiusMeters, type) {
  const query = `
    [out:json];
    (
      node["amenity"="${type}"](around:${radiusMeters},${lat},${lng});
      way["amenity"="${type}"](around:${radiusMeters},${lat},${lng});
      relation["amenity"="${type}"](around:${radiusMeters},${lat},${lng});
    );
    out center;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: query,
  });

  const data = await response.json();
  return data.elements;
}

// distance finder
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// main
async function loadEmergencyServices(lat, lng, radius) {
  if (userMarker) {
    map.removeLayer(userMarker);
  }

  map.setView([lat, lng], 13);

  // user marker only
  userMarker = L.marker([lat, lng]).addTo(map);

  // clear list
  let list = document.getElementById("serviceList");
  list.innerHTML = "";

  // fetch data
  let hospitals = await fetchEmergency(lat, lng, radius, "hospital");
  let fire = await fetchEmergency(lat, lng, radius, "fire_station");
  let police = await fetchEmergency(lat, lng, radius, "police");

  // merge all results
  let all = [
    ...hospitals.map((e) => ({ ...e, type: "Hospital" })),
    ...fire.map((e) => ({ ...e, type: "Fire Station" })),
    ...police.map((e) => ({ ...e, type: "Police Station" })),
  ];

  // compute distance
  all = all.map((service) => {
    const slat = service.lat || service.center?.lat;
    const slng = service.lon || service.center?.lon;

    return {
      ...service,
      slat,
      slng,
      distance: getDistance(lat, lng, slat, slng),
    };
  });

  // sort + KEEP ONLY NEAREST 5
  all = all.sort((a, b) => a.distance - b.distance).slice(0, 10);

  // display list
  all.forEach((service, index) => {
    let name = service.tags?.name || service.type;

    let phone =
      service.tags?.phone ||
      service.tags?.["contact:phone"] ||
      service.tags?.["phone:emergency"] ||
      "No contact number available";

    let li = document.createElement("li");

    li.innerHTML =
      `${name} (${service.type}) - ${service.distance.toFixed(1)} km<br>` +
      `${phone}`;

    list.appendChild(li);
  });
}

document.getElementById("locbtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      let lat = position.coords.latitude;
      let lng = position.coords.longitude;

      loadEmergencyServices(lat, lng, 20000); // same radius as your search
    },
    (error) => {
      alert("Unable to get your location");
      console.log(error);
    },
  );
});
