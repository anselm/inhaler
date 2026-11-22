// Active weather alerts for a point, from the US National Weather Service (api.weather.gov, public
// domain). `url` in the beat file is "lat,lon". An alert leaves the list when it ends, so this
// source lists everything it has each time and an item no longer listed is marked gone.
export async function nwsAlerts(source, get) {
  const r = await get(`https://api.weather.gov/alerts/active?point=${source.url}`, { accept: 'application/geo+json' })
  if (!r.ok) throw Object.assign(new Error(r.error), { retryAfter: r.retryAfter })
  return { items: (JSON.parse(r.text).features || []).map(({ properties: p }) => ({
    key: p.id, url: p['@id'] || `https://alerts.weather.gov/`, title: p.headline || p.event, author: p.senderName,
    text: [p.description, p.instruction].filter(Boolean).join('\n\n'), published: Date.parse(p.sent) / 1000 | 0,
    raw: { event: p.event, severity: p.severity, certainty: p.certainty, onset: p.onset, ends: p.ends || p.expires, area: p.areaDesc } })) }
}
