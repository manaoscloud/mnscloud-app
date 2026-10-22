import { MnsSearchSelectFieldOption } from '../forms/mns-search-select-field/mns-search-select-field';

type TimezoneTuple = readonly [
  value: string,
  label: string,
  detail?: string,
  searchKeywords?: string,
];

const TIMEZONE_ENTRIES: readonly TimezoneTuple[] = [
  // UTC
  ['UTC', 'UTC - Coordinated Universal Time', 'UTC', 'GMT Universal 00:00'],

  // Brazil
  ['America/Sao_Paulo', 'São Paulo, Brazil', 'Brasília / Sul / Sudeste / GO / DF', 'Brasilia Rio de Janeiro Belo Horizonte Curitiba Porto Alegre -03:00'],
  ['America/Manaus', 'Manaus, Brazil', 'Amazonas leste', 'Amazonas AM -04:00'],
  ['America/Belem', 'Belém, Brazil', 'Pará / Amapá', 'Belem Para PA Macapa Amapa AP -03:00'],
  ['America/Fortaleza', 'Fortaleza, Brazil', 'Ceará / Nordeste', 'Ceara CE Teresina Piaui PI Sao Luis Maranhao MA Natal RN Joao Pessoa PB -03:00'],
  ['America/Recife', 'Recife, Brazil', 'Pernambuco / Paraíba', 'Pernambuco PE -03:00'],
  ['America/Bahia', 'Salvador, Brazil', 'Bahia', 'Salvador Bahia BA -03:00'],
  ['America/Cuiaba', 'Cuiabá, Brazil', 'Mato Grosso', 'Cuiaba Mato Grosso MT -04:00'],
  ['America/Campo_Grande', 'Campo Grande, Brazil', 'Mato Grosso do Sul', 'Campo Grande Mato Grosso do Sul MS -04:00'],
  ['America/Porto_Velho', 'Porto Velho, Brazil', 'Rondônia', 'Porto Velho Rondonia RO -04:00'],
  ['America/Boa_Vista', 'Boa Vista, Brazil', 'Roraima', 'Boa Vista Roraima RR -04:00'],
  ['America/Rio_Branco', 'Rio Branco, Brazil', 'Acre', 'Rio Branco Acre AC -05:00'],
  ['America/Maceio', 'Maceió, Brazil', 'Alagoas / Sergipe', 'Maceio Alagoas AL Aracaju Sergipe SE -03:00'],
  ['America/Santarem', 'Santarém, Brazil', 'Pará oeste', 'Santarem Para PA -03:00'],
  ['America/Araguaina', 'Araguaína, Brazil', 'Tocantins', 'Araguaina Palmas Tocantins TO -03:00'],
  ['America/Noronha', 'Fernando de Noronha, Brazil', 'Fernando de Noronha', 'Fernando de Noronha -02:00'],

  // South America & Caribbean
  ['America/Argentina/Buenos_Aires', 'Buenos Aires, Argentina', 'Argentina', 'Buenos Aires Argentina -03:00'],
  ['America/Santiago', 'Santiago, Chile', 'Chile', 'Santiago Chile -04:00 -03:00'],
  ['America/Montevideo', 'Montevideo, Uruguay', 'Uruguay', 'Montevideo Uruguay -03:00'],
  ['America/Asuncion', 'Asunción, Paraguay', 'Paraguay', 'Asuncion Paraguay -04:00 -03:00'],
  ['America/La_Paz', 'La Paz, Bolivia', 'Bolivia', 'La Paz Bolivia -04:00'],
  ['America/Lima', 'Lima, Peru', 'Peru', 'Lima Peru -05:00'],
  ['America/Bogota', 'Bogotá, Colombia', 'Colombia', 'Bogota Colombia -05:00'],
  ['America/Caracas', 'Caracas, Venezuela', 'Venezuela', 'Caracas Venezuela -04:00'],
  ['America/Guayaquil', 'Guayaquil, Ecuador', 'Ecuador', 'Guayaquil Quito Ecuador -05:00'],
  ['America/Panama', 'Panama City, Panama', 'Panama', 'Panama -05:00'],
  ['America/Costa_Rica', 'San José, Costa Rica', 'Costa Rica', 'San Jose Costa Rica -06:00'],

  // North America
  ['America/Mexico_City', 'Mexico City, Mexico', 'Mexico Central', 'Mexico City Ciudad de Mexico -06:00'],
  ['America/Cancun', 'Cancún, Mexico', 'Quintana Roo', 'Cancun Mexico Quintana Roo -05:00'],
  ['America/New_York', 'New York, United States', 'Eastern Time', 'New York Eastern US USA EST EDT -05:00 -04:00'],
  ['America/Chicago', 'Chicago, United States', 'Central Time', 'Chicago Central US USA CST CDT -06:00 -05:00'],
  ['America/Denver', 'Denver, United States', 'Mountain Time', 'Denver Mountain US USA MST MDT -07:00 -06:00'],
  ['America/Phoenix', 'Phoenix, United States', 'Arizona', 'Phoenix Arizona US USA MST -07:00'],
  ['America/Los_Angeles', 'Los Angeles, United States', 'Pacific Time', 'Los Angeles Pacific US USA California PST PDT -08:00 -07:00'],
  ['America/Anchorage', 'Anchorage, United States', 'Alaska', 'Anchorage Alaska US USA AKST AKDT -09:00 -08:00'],
  ['Pacific/Honolulu', 'Honolulu, United States', 'Hawaii', 'Pacific/Honolulu Honolulu Hawaii US USA HST -10:00'],
  ['America/Toronto', 'Toronto, Canada', 'Eastern Canada', 'Toronto Canada Eastern Ontario -05:00 -04:00'],
  ['America/Vancouver', 'Vancouver, Canada', 'Pacific Canada', 'Vancouver Canada Pacific British Columbia -08:00 -07:00'],

  // Europe
  ['Europe/Lisbon', 'Lisbon, Portugal', 'Portugal Continental', 'Lisboa Portugal Lisbon WET WEST 00:00 +01:00'],
  ['Atlantic/Madeira', 'Funchal, Madeira', 'Portugal', 'Funchal Madeira Portugal 00:00 +01:00'],
  ['Atlantic/Azores', 'Ponta Delgada, Azores', 'Portugal', 'Acores Azores Ponta Delgada Portugal -01:00 00:00'],
  ['Europe/Madrid', 'Madrid, Spain', 'Spain', 'Madrid Spain Espana CET CEST +01:00 +02:00'],
  ['Europe/London', 'London, United Kingdom', 'GMT/BST', 'London United Kingdom UK England GMT BST 00:00 +01:00'],
  ['Europe/Paris', 'Paris, France', 'France', 'Paris France CET CEST +01:00 +02:00'],
  ['Europe/Berlin', 'Berlin, Germany', 'Germany', 'Berlin Germany Deutschland CET CEST +01:00 +02:00'],
  ['Europe/Rome', 'Rome, Italy', 'Italy', 'Rome Roma Italy Italia CET CEST +01:00 +02:00'],
  ['Europe/Amsterdam', 'Amsterdam, Netherlands', 'Netherlands', 'Amsterdam Netherlands Holanda CET CEST +01:00 +02:00'],
  ['Europe/Brussels', 'Brussels, Belgium', 'Belgium', 'Brussels Belgium Belgica CET CEST +01:00 +02:00'],
  ['Europe/Zurich', 'Zurich, Switzerland', 'Switzerland', 'Zurich Switzerland Suica CET CEST +01:00 +02:00'],
  ['Europe/Vienna', 'Vienna, Austria', 'Austria', 'Vienna Austria CET CEST +01:00 +02:00'],
  ['Europe/Dublin', 'Dublin, Ireland', 'Ireland', 'Dublin Ireland Irlanda GMT IST 00:00 +01:00'],
  ['Europe/Athens', 'Athens, Greece', 'Greece', 'Athens Greece Grecia EET EEST +02:00 +03:00'],
  ['Europe/Warsaw', 'Warsaw, Poland', 'Poland', 'Warsaw Poland Polonia CET CEST +01:00 +02:00'],
  ['Europe/Stockholm', 'Stockholm, Sweden', 'Sweden', 'Stockholm Sweden Suecia CET CEST +01:00 +02:00'],

  // Africa
  ['Africa/Luanda', 'Luanda, Angola', 'Angola', 'Luanda Angola WAT +01:00'],
  ['Africa/Maputo', 'Maputo, Mozambique', 'Mozambique', 'Maputo Mozambique Mocambique CAT +02:00'],
  ['Atlantic/Cape_Verde', 'Praia, Cape Verde', 'Cape Verde', 'Praia Cabo Verde Cape Verde CVT -01:00'],
  ['Africa/Johannesburg', 'Johannesburg, South Africa', 'South Africa', 'Johannesburg South Africa SAST +02:00'],
  ['Africa/Cairo', 'Cairo, Egypt', 'Egypt', 'Cairo Egypt Egito EET +02:00'],
  ['Africa/Casablanca', 'Casablanca, Morocco', 'Morocco', 'Casablanca Morocco Marrocos +01:00'],
  ['Africa/Nairobi', 'Nairobi, Kenya', 'Kenya', 'Nairobi Kenya EAT +03:00'],

  // Asia / Middle East / Oceania
  ['Asia/Dubai', 'Dubai, United Arab Emirates', 'UAE', 'Dubai UAE United Arab Emirates GST +04:00'],
  ['Asia/Tokyo', 'Tokyo, Japan', 'Japan', 'Tokyo Japan Japao JST +09:00'],
  ['Asia/Shanghai', 'Shanghai, China', 'China', 'Shanghai Beijing China CST +08:00'],
  ['Asia/Hong_Kong', 'Hong Kong', 'Hong Kong', 'Hong Kong HKT +08:00'],
  ['Asia/Singapore', 'Singapore', 'Singapore', 'Singapore SGT +08:00'],
  ['Asia/Seoul', 'Seoul, South Korea', 'South Korea', 'Seoul South Korea Coreia KST +09:00'],
  ['Asia/Kolkata', 'Kolkata, India', 'India', 'Kolkata India IST +05:30'],
  ['Australia/Sydney', 'Sydney, Australia', 'Australia', 'Sydney Australia AEST AEDT +10:00 +11:00'],
  ['Australia/Melbourne', 'Melbourne, Australia', 'Australia', 'Melbourne Australia AEST AEDT +10:00 +11:00'],
  ['Australia/Perth', 'Perth, Australia', 'Australia', 'Perth Australia AWST +08:00'],
  ['Pacific/Auckland', 'Auckland, New Zealand', 'New Zealand', 'Auckland New Zealand Nova Zelandia NZST NZDT +12:00 +13:00'],
];

/**
 * Fixed list of canonical IANA timezones with human-readable labels,
 * prioritized for Brazil, the Americas, Europe, Africa, Asia, and Oceania.
 */
export const CANONICAL_TIMEZONES: readonly MnsSearchSelectFieldOption[] = TIMEZONE_ENTRIES.map(
  ([value, label, detail, searchKeywords]) => ({
    value,
    label,
    description: detail && detail !== value ? `${value} (${detail})` : value,
    searchText: `${value} ${label} ${detail ?? ''} ${searchKeywords ?? ''}`,
  }),
);

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
