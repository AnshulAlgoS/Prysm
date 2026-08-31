// ============================================================================
// Prysm — Weather API Integration (OpenWeatherMap)
// ============================================================================
// Fetches current weather + rainfall data for a given zone.
// Uses OpenWeatherMap Current Weather + 5-day Forecast APIs.
// ============================================================================

const config = require('../../../config/env');
const logger = require('../../../utils/logger');

const API_KEY = config.apis?.openWeatherKey || 'demo_key';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

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

function _simulateWeather(lat, lng) {
  const hash = _hashLatLng(lat, lng);
  const profile = hash % 5;

  let temperature, feels_like, humidity, wind_speed, rainfall_1h, rainfall_3h, snowfall_1h, clouds, visibility, condition, description;

  switch (profile) {
    case 0:
      temperature = 18 + (hash % 8);
      feels_like = temperature + (hash % 3);
      humidity = 70 + (hash % 20);
      wind_speed = 5 + (hash % 10);
      rainfall_1h = 8 + (hash % 15);
      rainfall_3h = rainfall_1h * 2.5 + (hash % 10);
      snowfall_1h = 0;
      clouds = 80 + (hash % 20);
      visibility = 500 + (hash % 2000);
      condition = 'Rain';
      description = rainfall_1h > 15 ? 'heavy intensity rain' : 'moderate rain';
      break;
    case 1:
      temperature = 38 + (hash % 8);
      feels_like = temperature + 3 + (hash % 5);
      humidity = 15 + (hash % 20);
      wind_speed = 8 + (hash % 12);
      rainfall_1h = 0;
      rainfall_3h = 0;
      snowfall_1h = 0;
      clouds = 5 + (hash % 15);
      visibility = 8000 + (hash % 2000);
      condition = 'Clear';
      description = 'extreme heatwave, clear sky';
      break;
    case 2:
      temperature = -5 + (hash % 10);
      feels_like = temperature - (2 + hash % 5);
      humidity = 80 + (hash % 15);
      wind_speed = 10 + (hash % 15);
      rainfall_1h = 0;
      rainfall_3h = 0;
      snowfall_1h = 3 + (hash % 8);
      clouds = 70 + (hash % 25);
      visibility = 800 + (hash % 1500);
      condition = 'Snow';
      description = snowfall_1h > 6 ? 'heavy snow' : 'light snow';
      break;
    case 3:
      temperature = 25 + (hash % 8);
      feels_like = temperature + (hash % 4);
      humidity = 55 + (hash % 20);
      wind_speed = 3 + (hash % 8);
      rainfall_1h = 0;
      rainfall_3h = 0;
      snowfall_1h = 0;
      clouds = 10 + (hash % 25);
      visibility = 9000 + (hash % 1000);
      condition = 'Clear';
      description = 'clear sky';
      break;
    case 4:
    default:
      temperature = 22 + (hash % 8);
      feels_like = temperature + (hash % 3);
      humidity = 60 + (hash % 25);
      wind_speed = 12 + (hash % 18);
      rainfall_1h = 0;
      rainfall_3h = 0;
      snowfall_1h = 0;
      clouds = 40 + (hash % 40);
      visibility = 6000 + (hash % 3000);
      condition = 'Clouds';
      description = clouds > 70 ? 'overcast clouds' : 'scattered clouds';
      break;
  }

  return {
    source: 'simulated',
    temperature: Math.round(temperature * 10) / 10,
    feels_like: Math.round(feels_like * 10) / 10,
    humidity: Math.round(humidity),
    wind_speed: Math.round(wind_speed * 10) / 10,
    rainfall_1h: Math.round(rainfall_1h * 10) / 10,
    rainfall_3h: Math.round(rainfall_3h * 10) / 10,
    snowfall_1h: Math.round(snowfall_1h * 10) / 10,
    clouds: Math.round(clouds),
    visibility: Math.round(visibility),
    condition,
    description,
    timestamp: new Date().toISOString(),
    coordinates: { lat, lng },
  };
}

function _simulateRainfallForecast(lat, lng) {
  const hash = _hashLatLng(lat, lng);
  const profile = hash % 4;
  let total_rainfall_mm, max_3h_rainfall_mm;

  switch (profile) {
    case 0:
      total_rainfall_mm = 80 + (hash % 80);
      max_3h_rainfall_mm = 20 + (hash % 25);
      break;
    case 1:
      total_rainfall_mm = 20 + (hash % 40);
      max_3h_rainfall_mm = 5 + (hash % 10);
      break;
    case 2:
      total_rainfall_mm = 0;
      max_3h_rainfall_mm = 0;
      break;
    case 3:
    default:
      total_rainfall_mm = 5 + (hash % 15);
      max_3h_rainfall_mm = 2 + (hash % 6);
      break;
  }

  return {
    source: 'simulated',
    forecast_hours: 24,
    total_rainfall_mm: Math.round(total_rainfall_mm * 10) / 10,
    max_3h_rainfall_mm: Math.round(max_3h_rainfall_mm * 10) / 10,
    entries: 8,
    timestamp: new Date().toISOString(),
  };
}

const WeatherAPI = {
  /**
   * Fetch current weather for a lat/lng coordinate.
   * Returns rainfall, temperature, humidity, wind speed, and conditions.
   */
  async getCurrentWeather(lat, lng) {
    // ── HACKATHON DEMO OVERRIDE ──
    // If coords are roughly Bengaluru (lat ~12.9, lng ~77.6), Force Extreme Rain
    if (Math.abs(lat - 12.93) < 0.1 && Math.abs(lng - 77.62) < 0.1) {
      logger.info(`⛈️ DEMO OVERRIDE: Forcing Extreme Rain for Bengaluru (${lat}, ${lng})`);
      return {
        source: 'demo_mock',
        temperature: 24,
        feels_like: 25,
        humidity: 95,
        wind_speed: 15,
        rainfall_1h: 40,   // Triggers 1h threshold
        rainfall_3h: 120,  // Triggers 3h threshold (extreme_rain severe)
        snowfall_1h: 0,
        clouds: 100,
        visibility: 200,
        condition: 'Rain',
        description: 'heavy intensity rain',
        timestamp: new Date().toISOString(),
        coordinates: { lat, lng },
      };
    }

    if (!API_KEY || API_KEY === 'demo_key') {
      logger.warn(`Weather API key missing or demo, using simulated fallback for (${lat}, ${lng})`);
      return _simulateWeather(lat, lng);
    }

    try {
      const url = `${BASE_URL}/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        source: 'openweathermap',
        temperature: data.main?.temp || 0,
        feels_like: data.main?.feels_like || 0,
        humidity: data.main?.humidity || 0,
        wind_speed: data.wind?.speed || 0,
        rainfall_1h: data.rain?.['1h'] || 0,
        rainfall_3h: data.rain?.['3h'] || 0,
        snowfall_1h: data.snow?.['1h'] || 0,
        clouds: data.clouds?.all || 0,
        visibility: data.visibility || 10000,
        condition: data.weather?.[0]?.main || 'Clear',
        description: data.weather?.[0]?.description || '',
        icon: data.weather?.[0]?.icon || '',
        timestamp: new Date().toISOString(),
        coordinates: { lat, lng },
      };
    } catch (err) {
      logger.warn(`Weather API failed for (${lat}, ${lng}): ${err.message} — using simulated fallback`);
      return _simulateWeather(lat, lng);
    }
  },

  /**
   * Fetch rainfall forecast for next 24 hours.
   * Returns expected total rainfall in mm.
   */
  async getRainfallForecast(lat, lng) {
    // ── HACKATHON DEMO OVERRIDE ──
    // If coords are roughly Bengaluru (lat ~12.9, lng ~77.6), Force Extreme Rain Forecast
    if (Math.abs(lat - 12.93) < 0.1 && Math.abs(lng - 77.62) < 0.1) {
      return {
        source: 'demo_mock',
        forecast_hours: 24,
        total_rainfall_mm: 150,
        max_3h_rainfall_mm: 45,
        entries: 8,
        timestamp: new Date().toISOString(),
      };
    }

    if (!API_KEY || API_KEY === 'demo_key') {
      logger.warn(`Forecast API key missing or demo, using simulated fallback for (${lat}, ${lng})`);
      return _simulateRainfallForecast(lat, lng);
    }

    try {
      const url = `${BASE_URL}/forecast?lat=${lat}&lon=${lng}&appid=${API_KEY}&units=metric&cnt=8`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Forecast API error: ${response.status}`);
      }

      const data = await response.json();
      let totalRainfall = 0;
      let maxRainfall = 0;

      for (const entry of (data.list || [])) {
        const rain3h = entry.rain?.['3h'] || 0;
        totalRainfall += rain3h;
        maxRainfall = Math.max(maxRainfall, rain3h);
      }

      return {
        source: 'openweathermap',
        forecast_hours: 24,
        total_rainfall_mm: Math.round(totalRainfall * 10) / 10,
        max_3h_rainfall_mm: Math.round(maxRainfall * 10) / 10,
        entries: (data.list || []).length,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn(`Forecast API failed for (${lat}, ${lng}): ${err.message} — using simulated fallback`);
      return _simulateRainfallForecast(lat, lng);
    }
  },

  /**
   * Check for severe weather alerts.
   */
  async getAlerts(lat, lng) {
    try {
      const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lng}&appid=${API_KEY}&exclude=minutely,hourly,daily`;

      const response = await fetch(url);
      if (!response.ok) {
        return { alerts: [], source: 'simulated' };
      }

      const data = await response.json();
      return {
        source: 'openweathermap',
        alerts: (data.alerts || []).map(a => ({
          event: a.event,
          sender: a.sender_name,
          start: new Date(a.start * 1000).toISOString(),
          end: new Date(a.end * 1000).toISOString(),
          description: a.description,
        })),
      };
    } catch (err) {
      return { alerts: [], source: 'simulated' };
    }
  },
};

module.exports = WeatherAPI;
