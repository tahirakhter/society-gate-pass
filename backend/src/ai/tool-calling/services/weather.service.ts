import { Injectable, Logger } from '@nestjs/common';
import type { WeatherToolArgs } from '../schemas/weather.schema';
import { AiSettingsService } from '../../config/ai-settings.service';

export interface WeatherLocation {
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

interface WeatherForecast {
  current_weather?: {
    temperature: number;
    windspeed: number;
    weathercode: number;
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    weathercode: number[];
  };
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  constructor(private readonly settings: AiSettingsService) {}

  async getWeather(args: WeatherToolArgs) {
    const location = await this.geocode(args.location);
    if (!location) {
      return {
        success: false,
        status: 'LOCATION_NOT_FOUND',
        message: `I could not find weather data for "${args.location}". Please try a different city or location.`,
      };
    }

    const forecast = await this.fetchForecast(location);
    if (!forecast) {
      return {
        success: false,
        status: 'WEATHER_FETCH_FAILED',
        message:
          'Unable to fetch weather data right now. Please try again in a few moments.',
      };
    }

    return {
      success: true,
      status: 'COMPLETED',
      message: buildWeatherSummary(location, forecast, args.period),
      data: { location, period: args.period },
    };
  }

  private async geocode(location: string): Promise<WeatherLocation | null> {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.search = new URLSearchParams({
      name: location,
      count: '1',
      language: 'en',
      format: 'json',
    }).toString();

    const payload = await this.fetchJson<{ results?: WeatherLocation[] }>(
      url,
      'Weather geocoding',
    );

    return payload?.results?.[0] ?? null;
  }

  private fetchForecast(location: WeatherLocation) {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current_weather: 'true',
      daily:
        'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum',
      timezone: location.timezone,
    }).toString();

    return this.fetchJson<WeatherForecast>(url, 'Weather forecast');
  }

  private async fetchJson<T>(url: URL, operation: string): Promise<T | null> {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.settings.weatherTimeoutMs),
      });

      if (!response.ok) {
        this.logger.warn(`${operation} returned HTTP ${response.status}`);
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      this.logger.error(`${operation} failed`, error as Error);
      return null;
    }
  }
}

function buildWeatherSummary(
  location: Pick<WeatherLocation, 'name' | 'country'>,
  forecast: WeatherForecast,
  period: WeatherToolArgs['period'],
): string {
  const label = `${location.name}, ${location.country}`;
  const daily = forecast.daily;
  const current = forecast.current_weather;

  if (period === 'week' && daily) {
    const days = daily.time.slice(0, 7).map((date, index) => {
      const description = describeWeatherCode(daily.weathercode[index]);
      return `${date}: ${description}, ${daily.temperature_2m_max[index]}°C / ${daily.temperature_2m_min[index]}°C`;
    });
    return `Weather for ${label} over the next ${days.length} days: ${days.join('; ')}.`;
  }

  const targetIndex =
    period === 'tomorrow' ? 1 : period === 'day_after_tomorrow' ? 2 : 0;
  if (daily?.time[targetIndex]) {
    const when =
      period === 'today'
        ? 'today'
        : period === 'tomorrow'
          ? 'tomorrow'
          : 'the day after tomorrow';
    const precipitation = daily.precipitation_sum[targetIndex];
    let summary = `The weather in ${label} ${when} is ${describeWeatherCode(daily.weathercode[targetIndex])} with a high of ${daily.temperature_2m_max[targetIndex]}°C and a low of ${daily.temperature_2m_min[targetIndex]}°C.`;

    if (Number.isFinite(precipitation)) {
      summary += ` Expected precipitation is ${precipitation} mm.`;
    }
    if (period === 'today' && current) {
      summary += ` Current temperature is ${current.temperature}°C with wind ${current.windspeed} km/h.`;
    }
    return summary;
  }

  if (current) {
    return `Current weather in ${label} is ${describeWeatherCode(current.weathercode)} with ${current.temperature}°C temperature and wind ${current.windspeed} km/h.`;
  }

  return `I found ${label}, but could not summarize its forecast right now.`;
}

function describeWeatherCode(code: number | undefined): string {
  const descriptions: Record<number, string> = {
    0: 'clear sky',
    1: 'mainly clear',
    2: 'partly cloudy',
    3: 'overcast',
    45: 'fog',
    48: 'rime fog',
    51: 'light drizzle',
    53: 'moderate drizzle',
    55: 'dense drizzle',
    56: 'freezing drizzle',
    57: 'dense freezing drizzle',
    61: 'light rain',
    63: 'moderate rain',
    65: 'heavy rain',
    66: 'freezing rain',
    67: 'heavy freezing rain',
    71: 'light snow',
    73: 'moderate snow',
    75: 'heavy snow',
    77: 'snow grains',
    80: 'rain showers',
    81: 'moderate rain showers',
    82: 'violent rain showers',
    85: 'snow showers',
    86: 'heavy snow showers',
    95: 'thunderstorm',
    96: 'thunderstorm with slight hail',
    99: 'thunderstorm with heavy hail',
  };

  return code === undefined
    ? 'unknown conditions'
    : (descriptions[code] ?? 'moderate conditions');
}
