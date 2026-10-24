// SportWorld API: the mock sports server (simulated match data, demo). Open, no key.
// Docs and a try-it page: /sportworld. Store and simulator: server/utils/mock-sports.ts.
export default defineEventHandler(() => ({
  name: 'SportWorld API',
  version: 'v1',
  note: 'Simulated match data (demo): real results from football-data.org; line-ups, events and stats are generated.',
  docs: '/sportworld',
  competitions: MOCK_SPORTS_COMPETITIONS.map(c => ({ id: c.id, name: c.name })),
  endpoints: [
    'GET /sportworld/api/matches?competition=&since=&limit=',
    'GET /sportworld/api/matches/:id',
    'POST /sportworld/api/generate',
    'DELETE /sportworld/api/matches/:id',
  ],
}))
