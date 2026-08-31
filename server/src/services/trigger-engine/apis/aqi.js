// ============================================================================
// Prysm — Air Quality Index API Integration (WAQI)
// ============================================================================
// Fetches real-time air quality data from the World AQI Project.
// ============================================================================

const config = require('../../../config/env');
const logger = require('../../../utils/logger');

const API_KEY = config.apis?.waqiKey || 'demo';
const BASE_URL = 'https://api.waqi.info';

function _hashLatLng(lat, lng) {
  const str = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function _simulateAQI(lat, lng) {
  const hash = _hashLatLng(lat, lng);
  const profile = hash % 5;

  let aqi, dominant_pollutant;

  switch (profile) {
    case 0:
      aqi = 50 + (hash % 50);
      dominant_pollutant = 'pm25';
      break;
    case 1:
      aqi = 101 + (hash % 49);
      dominant_pollutant = hash % 2 === 0 ? 'pm10' : 'pm25';
      break;
    case 2:
      aqi = 151 + (hash % 49);
      dominant_pollutant = hash % 2 === 0 ? 'no2' : 'pm25';
      break;
    case 3:
      aqi = 201 + (hash % 99);
      dominant_pollutant = hash % 3 === 0 ? 'so2' : (hash % 3 === 1 ? 'o3' : 'pm25');
      break;
    case 4:
    default:
      aqi = 301 + (hash % 150);
      dominant_pollutant = hash % 2 === 0 ? 'pm25' : 'co';
      break;
  }

  const scale = aqi / 200;
  return {
    source: 'simulated',
    aqi: Math.round(aqi),
    dominant_pollutant,
    pollutants: {
      pm25: Math.round(aqi * 0.9 * (0.8 + (hash % 40) / 100)),
      pm10: Math.round(aqi * 1.1 * (0.7 + (hash % 50) / 100)),
      o3: Math.round(40 + scale * 80 + (hash % 30)),
      no2: Math.round(20 + scale * 60 + (hash % 25)),
      so2: Math.round(10 + scale * 40 + (hash % 20)),
      co: Math.round(scale * 10 + (hash % 8) / 10 * 10) / 10,
    },
    station: 'Simulated Station',
    timestamp: new Date().toISOString(),
    coordinates: { lat, lng },
  };
}

const AqiAPI = {
  /**
   * Fetch current AQI for a lat/lng coordinate.
   */
  async getCurrentAQI(lat, lng) {
    if (!API_KEY || API_KEY === 'demo') {
      logger.warn(`AQI API key missing or demo, using simulated fallback for (${lat}, ${lng})`);
      return _simulateAQI(lat, lng);
    }

    try {
      const url = `${BASE_URL}/feed/geo:${lat};${lng}/?token=${API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`AQI API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'ok' || !data.data) {
        return _simulateAQI(lat, lng);
      }

      const d = data.data;
      return {
        source: 'waqi',
        aqi: d.aqi || 0,
        dominant_pollutant: d.dominentpol || 'pm25',
        pollutants: {
          pm25: d.iaqi?.pm25?.v || 0,
          pm10: d.iaqi?.pm10?.v || 0,
          o3: d.iaqi?.o3?.v || 0,
          no2: d.iaqi?.no2?.v || 0,
          so2: d.iaqi?.so2?.v || 0,
          co: d.iaqi?.co?.v || 0,
        },
        station: d.city?.name || 'Unknown',
        timestamp: new Date().toISOString(),
        coordinates: { lat, lng },
      };
    } catch (err) {
      logger.warn(`AQI API failed for (${lat}, ${lng}): ${err.message} — using simulated fallback`);
      return _simulateAQI(lat, lng);
    }
  },

  /**
   * Get AQI severity level.
   */
  getAQILevel(aqi) {
    if (aqi <= 50)  return { level: 'good',           color: 'green',   risk: 0.0 };
    if (aqi <= 100) return { level: 'moderate',        color: 'yellow',  risk: 0.1 };
    if (aqi <= 150) return { level: 'unhealthy_sensitive', color: 'orange', risk: 0.3 };
    if (aqi <= 200) return { level: 'unhealthy',       color: 'red',     risk: 0.6 };
    if (aqi <= 300) return { level: 'very_unhealthy',  color: 'purple',  risk: 0.8 };
    return               { level: 'hazardous',         color: 'maroon',  risk: 1.0 };
  },
};

module.exports = AqiAPI;
