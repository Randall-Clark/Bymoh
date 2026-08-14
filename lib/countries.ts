// lib/countries.ts
export interface Country {
  code:        string;
  name:        string;
  flag:        string;
  timezone:    string;
  dialCode:    string;
  phoneDigits: number;
  placeholder: string;
}

export const COUNTRIES: Country[] = [
  {
    code:        'BJ',
    name:        'Bénin',
    flag:        '🇧🇯',
    timezone:    'Africa/Porto-Novo',
    dialCode:    '+229',
    phoneDigits: 10,
    placeholder: '01 97 55 73 53',
  },
  {
    code:        'CI',
    name:        "Côte d'Ivoire",
    flag:        '🇨🇮',
    timezone:    'Africa/Abidjan',
    dialCode:    '+225',
    phoneDigits: 10,
    placeholder: '07 12 34 56 78',
  },
  {
    code:        'SN',
    name:        'Sénégal',
    flag:        '🇸🇳',
    timezone:    'Africa/Dakar',
    dialCode:    '+221',
    phoneDigits: 9,
    placeholder: '77 123 45 67',
  },
  {
    code:        'TG',
    name:        'Togo',
    flag:        '🇹🇬',
    timezone:    'Africa/Lome',
    dialCode:    '+228',
    phoneDigits: 8,
    placeholder: '90 12 34 56',
  },
];

export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function getTimezone(countryCode: string): string {
  return getCountryByCode(countryCode)?.timezone ?? 'Africa/Porto-Novo';
}

/**
 * Compose le numéro E.164 — aucune modification du numéro local.
 * Ex: Bénin : '0197557353' + '+229' → '+2290197557353'
 */
export function buildFullPhone(localNumber: string, country: Country): string {
  const digits = localNumber.replace(/\D/g, '');
  return `${country.dialCode}${digits}`;
}
