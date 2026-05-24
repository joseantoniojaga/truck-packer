// Helper para colores con transparencia basados en tokens CSS.
//
// Reemplaza el patrón anterior de concatenar alpha-hex (e.g. COLORS.amber + "44")
// con color-mix(), que sí funciona con CSS variables.
//
//   alpha('--warning', 27)
//     → 'color-mix(in srgb, var(--warning) 27%, transparent)'
//
// Mapeo de los hex-alpha usados antes del refactor:
//   "22" ≈ 13%   "44" ≈ 27%   "88" ≈ 53%   "CC" ≈ 80%
export const alpha = (token, percent) =>
  `color-mix(in srgb, var(${token}) ${percent}%, transparent)`;
