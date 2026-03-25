exports.handler = async (event) => {
  const { city, type } = event.queryStringParameters || {};

  if (!city) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Parametro "city" mancante.' }),
    };
  }

  const key = process.env.OWM_KEY;
  if (!key) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Chiave OWM non configurata sul server.' }),
    };
  }

  const endpoint = type === 'forecast' ? 'forecast' : 'weather';
  const url = `https://api.openweathermap.org/data/2.5/${endpoint}?q=${encodeURIComponent(city)}&appid=${key}&units=metric&lang=it`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 502,
      body: JSON.stringify({ error: 'Errore contattando OpenWeatherMap.' }),
    };
  }
};
