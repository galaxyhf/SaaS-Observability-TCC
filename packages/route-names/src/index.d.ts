export interface RouteLabel {
  path: string;
  method?: string;
  label?: string;
}
export function validateRoutes(routes?: RouteLabel[]): void;
export function routeMetadata(
  target: unknown,
  method?: string,
  routes?: RouteLabel[],
): Record<string, string>;
