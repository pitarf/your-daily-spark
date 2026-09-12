export type ThemePreset = "auto" | "minimal" | "soft" | "bold" | "dark" | "warm";

export type BusinessTheme = {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
};

const THEMES: Record<string, BusinessTheme> = {
  barbearia: {
    primary: "oklch(0.32 0.05 55)",
    primaryForeground: "oklch(0.98 0.01 80)",
    accent: "oklch(0.95 0.02 70)",
    accentForeground: "oklch(0.28 0.04 55)",
    ring: "oklch(0.55 0.08 55)",
  },
  salão: {
    primary: "oklch(0.56 0.18 350)",
    primaryForeground: "oklch(0.99 0.01 350)",
    accent: "oklch(0.95 0.035 350)",
    accentForeground: "oklch(0.34 0.12 350)",
    ring: "oklch(0.68 0.12 350)",
  },
  "nail designer": {
    primary: "oklch(0.62 0.16 12)",
    primaryForeground: "oklch(0.99 0.01 15)",
    accent: "oklch(0.95 0.035 12)",
    accentForeground: "oklch(0.35 0.1 12)",
    ring: "oklch(0.7 0.11 12)",
  },
  sobrancelhas: {
    primary: "oklch(0.58 0.12 72)",
    primaryForeground: "oklch(0.99 0.01 72)",
    accent: "oklch(0.95 0.025 72)",
    accentForeground: "oklch(0.34 0.06 72)",
    ring: "oklch(0.67 0.09 72)",
  },
  estética: {
    primary: "oklch(0.55 0.12 175)",
    primaryForeground: "oklch(0.99 0.01 175)",
    accent: "oklch(0.94 0.035 175)",
    accentForeground: "oklch(0.3 0.07 175)",
    ring: "oklch(0.68 0.08 175)",
  },
  clínica: {
    primary: "oklch(0.52 0.14 235)",
    primaryForeground: "oklch(0.99 0.01 235)",
    accent: "oklch(0.94 0.025 235)",
    accentForeground: "oklch(0.3 0.08 235)",
    ring: "oklch(0.65 0.08 235)",
  },
  consultório: {
    primary: "oklch(0.5 0.14 265)",
    primaryForeground: "oklch(0.99 0.01 265)",
    accent: "oklch(0.94 0.025 265)",
    accentForeground: "oklch(0.29 0.08 265)",
    ring: "oklch(0.63 0.09 265)",
  },
  tatuagem: {
    primary: "oklch(0.21 0.02 270)",
    primaryForeground: "oklch(0.98 0.01 270)",
    accent: "oklch(0.93 0.01 270)",
    accentForeground: "oklch(0.2 0.02 270)",
    ring: "oklch(0.52 0.03 270)",
  },
  outro: {
    primary: "oklch(0.52 0.16 285)",
    primaryForeground: "oklch(0.99 0.01 285)",
    accent: "oklch(0.95 0.025 285)",
    accentForeground: "oklch(0.3 0.09 285)",
    ring: "oklch(0.67 0.09 285)",
  },
};

const PRESETS: Record<Exclude<ThemePreset, "auto">, BusinessTheme> = {
  minimal: {
    primary: "oklch(0.36 0.01 260)",
    primaryForeground: "oklch(0.99 0 0)",
    accent: "oklch(0.95 0.005 260)",
    accentForeground: "oklch(0.25 0.01 260)",
    ring: "oklch(0.58 0.01 260)",
  },
  soft: {
    primary: "oklch(0.64 0.09 330)",
    primaryForeground: "oklch(0.99 0.01 330)",
    accent: "oklch(0.95 0.025 330)",
    accentForeground: "oklch(0.35 0.07 330)",
    ring: "oklch(0.72 0.07 330)",
  },
  bold: {
    primary: "oklch(0.54 0.2 25)",
    primaryForeground: "oklch(0.99 0 0)",
    accent: "oklch(0.94 0.05 25)",
    accentForeground: "oklch(0.3 0.12 25)",
    ring: "oklch(0.66 0.14 25)",
  },
  dark: {
    primary: "oklch(0.72 0.06 90)",
    primaryForeground: "oklch(0.2 0.02 260)",
    accent: "oklch(0.3 0.02 260)",
    accentForeground: "oklch(0.96 0.01 260)",
    ring: "oklch(0.62 0.04 90)",
  },
  warm: {
    primary: "oklch(0.56 0.13 50)",
    primaryForeground: "oklch(0.99 0.01 50)",
    accent: "oklch(0.95 0.035 50)",
    accentForeground: "oklch(0.32 0.08 50)",
    ring: "oklch(0.67 0.08 50)",
  },
};

export function normalizeBusinessType(value: string | null | undefined) {
  return (value ?? "outro").trim().toLocaleLowerCase("pt-BR");
}

export function normalizeThemePreset(value: string | null | undefined): ThemePreset {
  const normalized = (value ?? "auto").trim().toLocaleLowerCase("pt-BR") as ThemePreset;
  return normalized === "minimal" || normalized === "soft" || normalized === "bold" || normalized === "dark" || normalized === "warm" || normalized === "auto"
    ? normalized
    : "auto";
}

export function getBusinessTheme(value: string | null | undefined): BusinessTheme {
  return THEMES[normalizeBusinessType(value)] ?? THEMES["outro"];
}

export function getBusinessThemeWithPreset(
  businessType: string | null | undefined,
  themePreset: string | null | undefined,
): BusinessTheme {
  const preset = normalizeThemePreset(themePreset);
  return preset === "auto" ? getBusinessTheme(businessType) : PRESETS[preset];
}

export function getBusinessTypeLabel(value: string | null | undefined) {
  const normalized = normalizeBusinessType(value);
  const labels: Record<string, string> = {
    barbearia: "Barbearia",
    salão: "Salão de beleza",
    "nail designer": "Nail designer",
    sobrancelhas: "Sobrancelhas",
    estética: "Estética",
    clínica: "Clínica",
    consultório: "Consultório",
    tatuagem: "Estúdio de tatuagem",
    outro: "Serviços",
  };
  return labels[normalized] ?? value?.trim() ?? labels["outro"];
}

export function businessThemeStyle(theme: BusinessTheme): Record<string, string> {
  return {
    "--primary": theme.primary,
    "--primary-foreground": theme.primaryForeground,
    "--accent": theme.accent,
    "--accent-foreground": theme.accentForeground,
    "--ring": theme.ring,
  };
}
