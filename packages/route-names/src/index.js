/* global URL */
// Only this public route vocabulary is retained automatically. Application-specific
// static segments must be declared as templates; opaque values never leave the SDK.
const vocabulary = new Set(
  'api v1 v2 v3 auth login logout register signup signin signout callback dashboard editor sql-editor connections connection databases database schemas tables queries query users user me profile settings account accounts projects project products product orders order checkout cart search reports report health status metrics events notifications files upload download agent sessions session conexoes bancos consultas usuarios produtos pedidos relatorios configuracoes painel home index _next static data image'.split(
    ' ',
  ),
);
const methods = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/;
export function validateRoutes(routes = []) {
  if (!Array.isArray(routes) || routes.length > 100)
    throw new Error('Informe até 100 rotas.');
  for (const route of routes) {
    if (
      !route ||
      typeof route.path !== 'string' ||
      (!/^\/(?:[a-zA-Z][a-zA-Z0-9_-]*|:[a-zA-Z][a-zA-Z0-9_]*|\*)(?:\/(?:[a-zA-Z][a-zA-Z0-9_-]*|:[a-zA-Z][a-zA-Z0-9_]*|\*))*\/?$/.test(
        route.path,
      ) &&
        route.path !== '/')
    )
      throw new Error(
        'Use templates de rota sem query, fragmento ou valores pessoais.',
      );
    if (route.method !== undefined && !methods.test(route.method))
      throw new Error('Método HTTP inválido.');
    if (
      route.label !== undefined &&
      (typeof route.label !== 'string' ||
        !route.label.trim() ||
        route.label.length > 120 ||
        /[\r\n<>]/.test(route.label))
    )
      throw new Error('Rótulo inválido.');
  }
}
export function routeMetadata(target, method = '', routes = []) {
  if (typeof target !== 'string' || !target) return {};
  let url;
  try {
    url = new URL(target, 'http://route.local');
  } catch {
    return {};
  }
  const segments = url.pathname.split('/').filter(Boolean);
  const match = routes.find((route) => {
    if (route.method && route.method !== method) return false;
    const parts = route.path.split('/').filter(Boolean);
    return (
      parts.length === segments.length &&
      parts.every(
        (part, index) =>
          part === '*' || part.startsWith(':') || part === segments[index],
      )
    );
  });
  const path =
    match?.path.replace(/\/$/, '') ||
    '/' +
      segments
        .slice(0, 12)
        .map((part) => (vocabulary.has(part) ? part : ':id'))
        .join('/');
  return {
    'http.route': path || '/',
    ...(match?.label ? { 'obs.operation.label': match.label.trim() } : {}),
    ...(url.pathname.startsWith('/_next/') || url.searchParams.has('_rsc')
      ? { 'obs.request.type': 'framework' }
      : {}),
  };
}
