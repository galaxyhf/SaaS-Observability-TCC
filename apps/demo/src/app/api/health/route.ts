export function GET(): Response {
  return Response.json({ service: 'demo-store', status: 'ok' });
}
