import { MnsSearchSelectFieldOption } from '../forms/mns-search-select-field/mns-search-select-field';

export interface TimezoneOptionDefinition {
  value: string;
  label: string;
  country?: string;
}

/**
 * Fixed list of canonical IANA timezones with human-readable labels,
 * prioritized for Brazil, the Americas, Europe, Africa, Asia, and Oceania.
 */
export const CANONICAL_TIMEZONES: readonly MnsSearchSelectFieldOption[] = [
  // UTC
  {
    value: 'UTC',
    label: 'UTC - Coordinated Universal Time',
    description: 'UTC',
    searchText: 'UTC GMT Universal 00:00',
  },

  // Brazil
  {
    value: 'America/Sao_Paulo',
    label: 'São Paulo, Brazil',
    description: 'America/Sao_Paulo (Brasília / Sul / Sudeste / GO / DF)',
    searchText: 'America/Sao_Paulo Sao Paulo Brasilia Rio de Janeiro Belo Horizonte Curitiba Porto Alegre -03:00',
  },
  {
    value: 'America/Manaus',
    label: 'Manaus, Brazil',
    description: 'America/Manaus (Amazonas leste)',
    searchText: 'America/Manaus Amazonas AM -04:00',
  },
  {
    value: 'America/Belem',
    label: 'Belém, Brazil',
    description: 'America/Belem (Pará / Amapá)',
    searchText: 'America/Belem Belem Para PA Macapa Amapa AP -03:00',
  },
  {
    value: 'America/Fortaleza',
    label: 'Fortaleza, Brazil',
    description: 'America/Fortaleza (Ceará / Nordeste)',
    searchText: 'America/Fortaleza Ceara CE Teresina Piaui PI Sao Luis Maranhao MA Natal RN Joao Pessoa PB -03:00',
  },
  {
    value: 'America/Recife',
    label: 'Recife, Brazil',
    description: 'America/Recife (Pernambuco / Paraíba)',
    searchText: 'America/Recife Pernambuco PE -03:00',
  },
  {
    value: 'America/Bahia',
    label: 'Salvador, Brazil',
    description: 'America/Bahia (Bahia)',
    searchText: 'America/Bahia Salvador Bahia BA -03:00',
  },
  {
    value: 'America/Cuiaba',
    label: 'Cuiabá, Brazil',
    description: 'America/Cuiaba (Mato Grosso)',
    searchText: 'America/Cuiaba Cuiaba Mato Grosso MT -04:00',
  },
  {
    value: 'America/Campo_Grande',
    label: 'Campo Grande, Brazil',
    description: 'America/Campo_Grande (Mato Grosso do Sul)',
    searchText: 'America/Campo_Grande Campo Grande Mato Grosso do Sul MS -04:00',
  },
  {
    value: 'America/Porto_Velho',
    label: 'Porto Velho, Brazil',
    description: 'America/Porto_Velho (Rondônia)',
    searchText: 'America/Porto_Velho Porto Velho Rondonia RO -04:00',
  },
  {
    value: 'America/Boa_Vista',
    label: 'Boa Vista, Brazil',
    description: 'America/Boa_Vista (Roraima)',
    searchText: 'America/Boa_Vista Boa Vista Roraima RR -04:00',
  },
  {
    value: 'America/Rio_Branco',
    label: 'Rio Branco, Brazil',
    description: 'America/Rio_Branco (Acre)',
    searchText: 'America/Rio_Branco Rio Branco Acre AC -05:00',
  },
  {
    value: 'America/Maceio',
    label: 'Maceió, Brazil',
    description: 'America/Maceio (Alagoas / Sergipe)',
    searchText: 'America/Maceio Maceio Alagoas AL Aracaju Sergipe SE -03:00',
  },
  {
    value: 'America/Santarem',
    label: 'Santarém, Brazil',
    description: 'America/Santarem (Pará oeste)',
    searchText: 'America/Santarem Santarem Para PA -03:00',
  },
  {
    value: 'America/Araguaina',
    label: 'Araguaína, Brazil',
    description: 'America/Araguaina (Tocantins)',
    searchText: 'America/Araguaina Araguaina Palmas Tocantins TO -03:00',
  },
  {
    value: 'America/Noronha',
    label: 'Fernando de Noronha, Brazil',
    description: 'America/Noronha',
    searchText: 'America/Noronha Fernando de Noronha -02:00',
  },

  // South America & Caribbean
  {
    value: 'America/Argentina/Buenos_Aires',
    label: 'Buenos Aires, Argentina',
    description: 'America/Argentina/Buenos_Aires',
    searchText: 'America/Argentina/Buenos_Aires Buenos Aires Argentina -03:00',
  },
  {
    value: 'America/Santiago',
    label: 'Santiago, Chile',
    description: 'America/Santiago',
    searchText: 'America/Santiago Santiago Chile -04:00 -03:00',
  },
  {
    value: 'America/Montevideo',
    label: 'Montevideo, Uruguay',
    description: 'America/Montevideo',
    searchText: 'America/Montevideo Montevideo Uruguay -03:00',
  },
  {
    value: 'America/Asuncion',
    label: 'Asunción, Paraguay',
    description: 'America/Asuncion',
    searchText: 'America/Asuncion Asuncion Paraguay -04:00 -03:00',
  },
  {
    value: 'America/La_Paz',
    label: 'La Paz, Bolivia',
    description: 'America/La_Paz',
    searchText: 'America/La_Paz La Paz Bolivia -04:00',
  },
  {
    value: 'America/Lima',
    label: 'Lima, Peru',
    description: 'America/Lima',
    searchText: 'America/Lima Lima Peru -05:00',
  },
  {
    value: 'America/Bogota',
    label: 'Bogotá, Colombia',
    description: 'America/Bogota',
    searchText: 'America/Bogota Bogota Colombia -05:00',
  },
  {
    value: 'America/Caracas',
    label: 'Caracas, Venezuela',
    description: 'America/Caracas',
    searchText: 'America/Caracas Caracas Venezuela -04:00',
  },
  {
    value: 'America/Guayaquil',
    label: 'Guayaquil, Ecuador',
    description: 'America/Guayaquil',
    searchText: 'America/Guayaquil Guayaquil Quito Ecuador -05:00',
  },
  {
    value: 'America/Panama',
    label: 'Panama City, Panama',
    description: 'America/Panama',
    searchText: 'America/Panama Panama -05:00',
  },
  {
    value: 'America/Costa_Rica',
    label: 'San José, Costa Rica',
    description: 'America/Costa_Rica',
    searchText: 'America/Costa_Rica San Jose Costa Rica -06:00',
  },

  // North America
  {
    value: 'America/Mexico_City',
    label: 'Mexico City, Mexico',
    description: 'America/Mexico_City',
    searchText: 'America/Mexico_City Mexico City Ciudad de Mexico -06:00',
  },
  {
    value: 'America/Cancun',
    label: 'Cancún, Mexico',
    description: 'America/Cancun',
    searchText: 'America/Cancun Cancun Mexico Quintana Roo -05:00',
  },
  {
    value: 'America/New_York',
    label: 'New York, United States',
    description: 'America/New_York (Eastern Time)',
    searchText: 'America/New_York New York Eastern US USA EST EDT -05:00 -04:00',
  },
  {
    value: 'America/Chicago',
    label: 'Chicago, United States',
    description: 'America/Chicago (Central Time)',
    searchText: 'America/Chicago Chicago Central US USA CST CDT -06:00 -05:00',
  },
  {
    value: 'America/Denver',
    label: 'Denver, United States',
    description: 'America/Denver (Mountain Time)',
    searchText: 'America/Denver Denver Mountain US USA MST MDT -07:00 -06:00',
  },
  {
    value: 'America/Phoenix',
    label: 'Phoenix, United States',
    description: 'America/Phoenix (Arizona)',
    searchText: 'America/Phoenix Phoenix Arizona US USA MST -07:00',
  },
  {
    value: 'America/Los_Angeles',
    label: 'Los Angeles, United States',
    description: 'America/Los_Angeles (Pacific Time)',
    searchText: 'America/Los_Angeles Los Angeles Pacific US USA California PST PDT -08:00 -07:00',
  },
  {
    value: 'America/Anchorage',
    label: 'Anchorage, United States',
    description: 'America/Anchorage (Alaska)',
    searchText: 'America/Anchorage Anchorage Alaska US USA AKST AKDT -09:00 -08:00',
  },
  {
    value: 'Pacific/Honolulu',
    label: 'Honolulu, United States',
    description: 'Pacific/Honolulu (Hawaii)',
    searchText: 'Pacific/Honolulu Honolulu Hawaii US USA HST -10:00',
  },
  {
    value: 'America/Toronto',
    label: 'Toronto, Canada',
    description: 'America/Toronto (Eastern Canada)',
    searchText: 'America/Toronto Toronto Canada Eastern Ontario -05:00 -04:00',
  },
  {
    value: 'America/Vancouver',
    label: 'Vancouver, Canada',
    description: 'America/Vancouver (Pacific Canada)',
    searchText: 'America/Vancouver Vancouver Canada Pacific British Columbia -08:00 -07:00',
  },

  // Europe
  {
    value: 'Europe/Lisbon',
    label: 'Lisbon, Portugal',
    description: 'Europe/Lisbon (Portugal Continental)',
    searchText: 'Europe/Lisbon Lisboa Portugal Lisbon WET WEST 00:00 +01:00',
  },
  {
    value: 'Atlantic/Madeira',
    label: 'Funchal, Madeira',
    description: 'Atlantic/Madeira (Portugal)',
    searchText: 'Atlantic/Madeira Funchal Madeira Portugal 00:00 +01:00',
  },
  {
    value: 'Atlantic/Azores',
    label: 'Ponta Delgada, Azores',
    description: 'Atlantic/Azores (Portugal)',
    searchText: 'Atlantic/Azores Acores Azores Ponta Delgada Portugal -01:00 00:00',
  },
  {
    value: 'Europe/Madrid',
    label: 'Madrid, Spain',
    description: 'Europe/Madrid',
    searchText: 'Europe/Madrid Madrid Spain Espana CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/London',
    label: 'London, United Kingdom',
    description: 'Europe/London (GMT/BST)',
    searchText: 'Europe/London London United Kingdom UK England GMT BST 00:00 +01:00',
  },
  {
    value: 'Europe/Paris',
    label: 'Paris, France',
    description: 'Europe/Paris',
    searchText: 'Europe/Paris Paris France CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Berlin',
    label: 'Berlin, Germany',
    description: 'Europe/Berlin',
    searchText: 'Europe/Berlin Berlin Germany Deutschland CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Rome',
    label: 'Rome, Italy',
    description: 'Europe/Rome',
    searchText: 'Europe/Rome Rome Roma Italy Italia CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Amsterdam',
    label: 'Amsterdam, Netherlands',
    description: 'Europe/Amsterdam',
    searchText: 'Europe/Amsterdam Amsterdam Netherlands Holanda CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Brussels',
    label: 'Brussels, Belgium',
    description: 'Europe/Brussels',
    searchText: 'Europe/Brussels Brussels Belgium Belgica CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Zurich',
    label: 'Zurich, Switzerland',
    description: 'Europe/Zurich',
    searchText: 'Europe/Zurich Zurich Switzerland Suica CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Vienna',
    label: 'Vienna, Austria',
    description: 'Europe/Vienna',
    searchText: 'Europe/Vienna Vienna Austria CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Dublin',
    label: 'Dublin, Ireland',
    description: 'Europe/Dublin',
    searchText: 'Europe/Dublin Dublin Ireland Irlanda GMT IST 00:00 +01:00',
  },
  {
    value: 'Europe/Athens',
    label: 'Athens, Greece',
    description: 'Europe/Athens',
    searchText: 'Europe/Athens Athens Greece Grecia EET EEST +02:00 +03:00',
  },
  {
    value: 'Europe/Warsaw',
    label: 'Warsaw, Poland',
    description: 'Europe/Warsaw',
    searchText: 'Europe/Warsaw Warsaw Poland Polonia CET CEST +01:00 +02:00',
  },
  {
    value: 'Europe/Stockholm',
    label: 'Stockholm, Sweden',
    description: 'Europe/Stockholm',
    searchText: 'Europe/Stockholm Stockholm Sweden Suecia CET CEST +01:00 +02:00',
  },

  // Africa
  {
    value: 'Africa/Luanda',
    label: 'Luanda, Angola',
    description: 'Africa/Luanda',
    searchText: 'Africa/Luanda Luanda Angola WAT +01:00',
  },
  {
    value: 'Africa/Maputo',
    label: 'Maputo, Mozambique',
    description: 'Africa/Maputo',
    searchText: 'Africa/Maputo Maputo Mozambique Mocambique CAT +02:00',
  },
  {
    value: 'Atlantic/Cape_Verde',
    label: 'Praia, Cape Verde',
    description: 'Atlantic/Cape_Verde',
    searchText: 'Atlantic/Cape_Verde Praia Cabo Verde Cape Verde CVT -01:00',
  },
  {
    value: 'Africa/Johannesburg',
    label: 'Johannesburg, South Africa',
    description: 'Africa/Johannesburg',
    searchText: 'Africa/Johannesburg Johannesburg South Africa SAST +02:00',
  },
  {
    value: 'Africa/Cairo',
    label: 'Cairo, Egypt',
    description: 'Africa/Cairo',
    searchText: 'Africa/Cairo Cairo Egypt Egito EET +02:00',
  },
  {
    value: 'Africa/Casablanca',
    label: 'Casablanca, Morocco',
    description: 'Africa/Casablanca',
    searchText: 'Africa/Casablanca Casablanca Morocco Marrocos +01:00',
  },
  {
    value: 'Africa/Nairobi',
    label: 'Nairobi, Kenya',
    description: 'Africa/Nairobi',
    searchText: 'Africa/Nairobi Nairobi Kenya EAT +03:00',
  },

  // Asia / Middle East / Oceania
  {
    value: 'Asia/Dubai',
    label: 'Dubai, United Arab Emirates',
    description: 'Asia/Dubai',
    searchText: 'Asia/Dubai Dubai UAE United Arab Emirates GST +04:00',
  },
  {
    value: 'Asia/Tokyo',
    label: 'Tokyo, Japan',
    description: 'Asia/Tokyo',
    searchText: 'Asia/Tokyo Tokyo Japan Japao JST +09:00',
  },
  {
    value: 'Asia/Shanghai',
    label: 'Shanghai, China',
    description: 'Asia/Shanghai',
    searchText: 'Asia/Shanghai Shanghai Beijing China CST +08:00',
  },
  {
    value: 'Asia/Hong_Kong',
    label: 'Hong Kong',
    description: 'Asia/Hong_Kong',
    searchText: 'Asia/Hong_Kong Hong Kong HKT +08:00',
  },
  {
    value: 'Asia/Singapore',
    label: 'Singapore',
    description: 'Asia/Singapore',
    searchText: 'Asia/Singapore Singapore SGT +08:00',
  },
  {
    value: 'Asia/Seoul',
    label: 'Seoul, South Korea',
    description: 'Asia/Seoul',
    searchText: 'Asia/Seoul Seoul South Korea Coreia KST +09:00',
  },
  {
    value: 'Asia/Kolkata',
    label: 'Kolkata, India',
    description: 'Asia/Kolkata',
    searchText: 'Asia/Kolkata Kolkata India IST +05:30',
  },
  {
    value: 'Australia/Sydney',
    label: 'Sydney, Australia',
    description: 'Australia/Sydney',
    searchText: 'Australia/Sydney Sydney Australia AEST AEDT +10:00 +11:00',
  },
  {
    value: 'Australia/Melbourne',
    label: 'Melbourne, Australia',
    description: 'Australia/Melbourne',
    searchText: 'Australia/Melbourne Melbourne Australia AEST AEDT +10:00 +11:00',
  },
  {
    value: 'Australia/Perth',
    label: 'Perth, Australia',
    description: 'Australia/Perth',
    searchText: 'Australia/Perth Perth Australia AWST +08:00',
  },
  {
    value: 'Pacific/Auckland',
    label: 'Auckland, New Zealand',
    description: 'Pacific/Auckland',
    searchText: 'Pacific/Auckland Auckland New Zealand Nova Zelandia NZST NZDT +12:00 +13:00',
  },
];

/**
 * Builds a search-select options array with an optional fallback option (empty value),
 * the canonical fixed list of timezones, and guarantees any existing record value is
 * selectable so it is never lost or cleared accidentally.
 */
export function buildTimezoneOptions(params?: {
  fallbackLabel?: string;
  currentValue?: string | null;
}): MnsSearchSelectFieldOption[] {
  const result: MnsSearchSelectFieldOption[] = [];

  if (params?.fallbackLabel) {
    result.push({
      value: '',
      label: params.fallbackLabel,
      description: 'Inherits configured parent or system timezone',
      searchText: `${params.fallbackLabel} default fallback inherit herdar padrao`,
    });
  }

  result.push(...CANONICAL_TIMEZONES);

  const current = params?.currentValue?.trim();
  if (current && !result.some((opt) => opt.value === current)) {
    result.push({
      value: current,
      label: current,
      description: current,
      searchText: current,
    });
  }

  return result;
}
