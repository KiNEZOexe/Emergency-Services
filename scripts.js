//creates map, then sets the starting coordinates, map is a leaflet object
let map = L.map("map").setView([15.144, 120.591], 10);

//tiles are the map graphics
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  //ZXY is zoom and horizontal+vertical tile that leaflet automatically replaces
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors", //this is for the required credit
}).addTo(map);

// store the user's marker or entered position
let userMarker = null;

//process dialogue text
let processText = document.getElementById("ProcessDialogue");

// search button connection
//addeventlistener for click event
document.getElementById("searchbtn").addEventListener("click", async () => {
  processText.innerHTML = "";
  processText.innerHTML += "STEP 1: User entered a location.<br>";

  let query = document.getElementById("locate").value;
  //gets the input from "locate" search bar

  //checks if may input
  if (query) {
    processText.innerHTML +=
      "STEP 2: Converting location into coordinates using Geocoding.<br>";

    let coords = await geocodeLocation(query);

    if (coords) {
      processText.innerHTML += "STEP 3: Coordinates found successfully.<br>";

      loadEmergencyServices(coords.lat, coords.lng, 20000); // 1km = 1000 for radius, EDITABLE
    }
  }
});

// GEOCODING location lat n lng DO NOT TOUCH
//converts the locationname into latitude+longitude
async function geocodeLocation(locationName) {
  try {
    //attempts code
    let response = await fetch(
      //fetch- sends the http request to the api of nominatim
      //await-pause the function until request is done
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName + ", Philippines")}`,
    );

    let data = await response.json();
    //converts server response into javascript objects/arrays.

    if (data.length > 0) {
      //Checks if results exist.
      return {
        //returns coordinates
        lat: parseFloat(data[0].lat), //converts the lat and long into number types
        lng: parseFloat(data[0].lon),
      };
    } else {
      alert("Location not found.");
      return null;
    }
  } catch (err) {
    //handles if 'try' code fails
    console.error(err);
    return null;
  }
}

// fetches data of emergency services, api for overpass DO NOT TOUCH
async function fetchEmergency(lat, lng, radiusMeters, type) {
  //this is Overpass QL language. it searches OpenStreetMap database.
  const query = `
    [out:json];
    ( 
      node["amenity"="${type}"](around:${radiusMeters},${lat},${lng});
      way["amenity"="${type}"](around:${radiusMeters},${lat},${lng});
      relation["amenity"="${type}"](around:${radiusMeters},${lat},${lng});
    ); 
    out center;
  `; //(around:${radiusMeters},${lat},${lng}) SEARCHES AROUND RADIUS OF THE COORDINATES

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    //send "query" to overpass server
    method: "POST",
    body: query,
  });

  const data = await response.json();
  return data.elements;
}

// calculate distance between two coordinates using haversine formula
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // earth radius in km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  //Math.PI) / 180) -degrees to radians
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  /**Math Functions:
-Math.sin()
-Sine
-Math.cos()
-Cosine
-Math.atan2()
-Arc tangent
-Math.sqrt()
-Square root
-These are used in the Haversine formula. */

  return R * c;
}

// MAIN FUNCTION
/**
-updates map
-fetches services
-calculates distances
-sorts results
-displays them */
async function loadEmergencyServices(lat, lng, radius) {
  if (userMarker) {
    //remove old marker to prevent duplicates
    map.removeLayer(userMarker);
  }

  map.setView([lat, lng], 13); //move camera to searched or current location

  // creates the pin on map
  userMarker = L.marker([lat, lng]).addTo(map);

  processText.innerHTML +=
    "STEP 4: Updating map and preparing emergency service search.<br>";

  let list = document.getElementById("serviceList");
  list.innerHTML = ""; //clear old results

  processText.innerHTML +=
    "STEP 5: Fetching nearby hospitals, fire stations, and police stations from OpenStreetMap.<br>";

  // fetch data
  let hospitals = await fetchEmergency(lat, lng, radius, "hospital");
  let fire = await fetchEmergency(lat, lng, radius, "fire_station");
  let police = await fetchEmergency(lat, lng, radius, "police");

  // merge all results
  let all = [
    ...hospitals.map((e) => ({ ...e, type: "Hospital" })), //"..." - expands array
    ...fire.map((e) => ({ ...e, type: "Fire Station" })), //".map" - transform every item in array
    ...police.map((e) => ({ ...e, type: "Police Station" })), //e, type: "Police Station" - copies objects and adds type
  ];

  processText.innerHTML +=
    "STEP 6: Calculating distances using the Haversine Formula.<br>";

  // compute distance
  all = all.map((service) => {
    const slat = service.lat || service.center?.lat; //prevents errors
    const slng = service.lon || service.center?.lon;

    return {
      ...service,
      slat,
      slng,
      distance: getDistance(lat, lng, slat, slng), //add computed distance
    };
  });

  processText.innerHTML +=
    "STEP 7: Applying Greedy Algorithm to prioritize nearest emergency services.<br>";

  // sort + KEEP ONLY NEAREST 10
  all = all.sort((a, b) => a.distance - b.distance).slice(0, 10); //<--ung 10

  processText.innerHTML +=
    "STEP 8: Top 10 nearest emergency services selected.<br>";

  // display list
  //"all.forEach" - loops through every services
  all.forEach((service, index) => {
    let name = service.tags?.name || service.type; //use actual name if available otherwise use generic type

    let phone =
      service.tags?.phone ||
      service.tags?.["contact:phone"] ||
      service.tags?.["phone:emergency"] ||
      "No contact number available";

    let li = document.createElement("li"); //creates the <li> in HTML (list items)

    li.innerHTML =
      `${name} (${service.type}) - ${service.distance.toFixed(1)} km<br>` +
      `${phone}`;

    list.appendChild(li); //add list item into the list in HTML
  });

  processText.innerHTML += "STEP 9: Emergency services displayed successfully.";
}

//runs when locbtn is clicked
document.getElementById("locbtn").addEventListener("click", () => {
  processText.innerHTML = "";
  processText.innerHTML += "STEP 1: Requesting current device location.<br>";

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  //built in browser gps or location system
  //getCurrentPosition gets USER lng and lat
  navigator.geolocation.getCurrentPosition(
    (position) => {
      //runs if getting location succeeds

      processText.innerHTML +=
        "STEP 2: Current location acquired successfully.<br>";

      let lat = position.coords.latitude;
      let lng = position.coords.longitude;

      loadEmergencyServices(lat, lng, 20000);
    },
    (error) => {
      //error callback
      alert("Unable to get your location");
      console.log(error);
    },
  );
});
