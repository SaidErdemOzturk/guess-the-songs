export const ROUTES = {
  HOME: '/',
  GAME: '/play',
  LEADERBOARD: '/leaderboard',
  SETTINGS: '/settings',
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
