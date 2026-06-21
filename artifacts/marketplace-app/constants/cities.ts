export interface CityEntry {
  id: string;
  name: string;
  country: string;
  flag: string;
}

export const ALL_CITIES: CityEntry[] = [
  { id: "lome",          name: "Lomé",          country: "Togo",           flag: "🇹🇬" },
  { id: "kpalime",       name: "Kpalimé",       country: "Togo",           flag: "🇹🇬" },
  { id: "sokode",        name: "Sokodé",        country: "Togo",           flag: "🇹🇬" },
  { id: "cotonou",       name: "Cotonou",       country: "Bénin",          flag: "🇧🇯" },
  { id: "porto-novo",    name: "Porto-Novo",    country: "Bénin",          flag: "🇧🇯" },
  { id: "abidjan",       name: "Abidjan",       country: "Côte d'Ivoire",  flag: "🇨🇮" },
  { id: "bouake",        name: "Bouaké",        country: "Côte d'Ivoire",  flag: "🇨🇮" },
  { id: "dakar",         name: "Dakar",         country: "Sénégal",        flag: "🇸🇳" },
  { id: "saint-louis",   name: "Saint-Louis",   country: "Sénégal",        flag: "🇸🇳" },
  { id: "accra",         name: "Accra",         country: "Ghana",          flag: "🇬🇭" },
  { id: "kumasi",        name: "Kumasi",        country: "Ghana",          flag: "🇬🇭" },
  { id: "yaounde",       name: "Yaoundé",       country: "Cameroun",       flag: "🇨🇲" },
  { id: "douala",        name: "Douala",        country: "Cameroun",       flag: "🇨🇲" },
  { id: "bamako",        name: "Bamako",        country: "Mali",           flag: "🇲🇱" },
  { id: "ouagadougou",   name: "Ouagadougou",   country: "Burkina Faso",   flag: "🇧🇫" },
];

export const CITY_BY_COUNTRY: Record<string, string> = {
  TG: "Lomé",
  BJ: "Cotonou",
  CI: "Abidjan",
  SN: "Dakar",
  GH: "Accra",
  CM: "Yaoundé",
  ML: "Bamako",
  BF: "Ouagadougou",
};
