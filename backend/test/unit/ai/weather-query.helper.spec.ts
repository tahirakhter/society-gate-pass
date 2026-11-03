import {
  extractWeatherLocation,
  parseWeatherQuery,
} from '../../../src/ai/tool-calling/helpers/weather-query.helper';

describe('weather query parser', () => {
  it.each([
    [
      'What is the weather in Islamabad today?',
      { location: 'Islamabad', period: 'today' },
    ],
    [
      'Show me the weather forecast for tomorrow in Lahore',
      { location: 'Lahore', period: 'tomorrow' },
    ],
    ['Karachi weather this week', { location: 'Karachi', period: 'week' }],
    ['weather of Karachi', { location: 'Karachi', period: 'today' }],
    [
      'what is the weather of karachi?',
      { location: 'karachi', period: 'today' },
    ],
    [
      'weather in the city of Karachi',
      { location: 'Karachi', period: 'today' },
    ],
    [
      'temperature at New York day after tomorrow',
      { location: 'New York', period: 'day_after_tomorrow' },
    ],
  ])('parses %s', (message, expected) => {
    expect(parseWeatherQuery(message)).toEqual(expected);
  });

  it.each([
    'Will it rain tomorrow?',
    'weather for tomorrow',
    'What is the temperature right now?',
  ])('does not treat a time period as a location: %s', (message) => {
    expect(extractWeatherLocation(message)).toBeNull();
  });

  it('supports unicode place names', () => {
    expect(extractWeatherLocation('weather in São Paulo today')).toBe(
      'São Paulo',
    );
  });
});
