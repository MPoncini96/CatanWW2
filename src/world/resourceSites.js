// Where the world's materials actually came from in 1939.
//
// Two kinds of entry:
//   SITES  a place — an oil field, a mine, a steelworks, a smelter — with its
//          annual output. Point sources, because that is what they were.
//   ZONES  a producing area spread over a box, for crops that cover ground
//          rather than sitting at a pithead (rubber estates, fisheries).
//
// Outputs are annual, from the 1938-39 figures: oil and iron ore and steel in
// thousand metric tons, aluminium and rubber in tons. They are rounded — the
// aim is the right industrial geography and the right orders of magnitude, not
// four-digit accuracy.
//
// Note on steel and aluminium: neither is dug up. Steel sat where coal met ore
// and capital — the Ruhr, Pittsburgh, the Donbas — and aluminium followed cheap
// hydroelectricity, which is why Norway, Switzerland and Saguenay smelted so
// far out of proportion to their size.

/** @type {Array<[resource: string, name: string, lat: number, lon: number, output: number]>} */
export const SITES = [
  // ======================= OIL (kt/yr) — world ~280,000 =======================
  // The United States alone pumped about 61% of the world's oil.
  ['oil', 'East Texas Field', 32.4, -94.9, 25000],
  ['oil', 'Gulf Coast, Texas', 29.3, -94.8, 18000],
  ['oil', 'Permian Basin', 31.9, -102.3, 12000],
  ['oil', 'Oklahoma City–Seminole', 35.5, -97.3, 20000],
  ['oil', 'Kansas Fields', 37.7, -97.3, 8000],
  ['oil', 'Los Angeles Basin', 33.8, -118.2, 22000],
  ['oil', 'San Joaquin Valley', 35.4, -119.0, 18000],
  ['oil', 'Louisiana Gulf', 30.2, -92.0, 12000],
  ['oil', 'Illinois Basin', 38.5, -88.5, 9000],
  ['oil', 'Wyoming Fields', 43.0, -106.3, 4000],
  ['oil', 'Appalachian Fields', 39.6, -80.5, 3000],
  ['oil', 'Arkansas–Smackover', 33.4, -92.8, 3000],

  ['oil', 'Baku', 40.4, 49.9, 21500],
  ['oil', 'Grozny', 43.3, 45.7, 3000],
  ['oil', 'Maikop', 44.6, 40.1, 1500],
  ['oil', 'Ishimbay (Second Baku)', 53.5, 56.0, 1700],
  ['oil', 'Emba', 47.1, 54.0, 800],
  ['oil', 'Okha, Sakhalin', 53.6, 142.9, 500],

  ['oil', 'Maracaibo Basin', 10.0, -71.5, 27000],
  ['oil', 'Eastern Venezuela', 9.5, -64.0, 4000],
  ['oil', 'Poza Rica', 20.9, -97.4, 4000],
  ['oil', 'Tampico', 22.2, -97.9, 1500],
  ['oil', 'Barrancabermeja', 7.1, -73.9, 3000],
  ['oil', 'Trinidad', 10.2, -61.4, 2700],
  ['oil', 'Comodoro Rivadavia', -45.9, -67.5, 2400],
  ['oil', 'Talara', -4.6, -81.3, 2000],

  ['oil', 'Abadan–Masjed Soleyman', 31.3, 49.5, 10000],
  ['oil', 'Kirkuk', 35.5, 44.4, 4000],
  ['oil', 'Bahrain', 26.0, 50.5, 1000],
  ['oil', 'Dammam', 26.4, 50.1, 60],

  ['oil', 'Ploiești', 44.95, 26.0, 6200],
  ['oil', 'Borysław', 49.3, 23.4, 500],
  ['oil', 'Nienhagen', 52.6, 10.1, 600],
  ['oil', 'Zistersdorf', 48.5, 16.8, 60],
  ['oil', 'Albanian Fields', 40.7, 19.6, 130],

  ['oil', 'Palembang', -3.0, 104.8, 4000],
  ['oil', 'Balikpapan', -1.25, 116.9, 2500],
  ['oil', 'Tarakan', 3.3, 117.6, 1500],
  ['oil', 'Seria, Brunei', 4.6, 114.3, 800],
  ['oil', 'Yenangyaung', 20.5, 94.9, 1000],
  ['oil', 'Digboi', 27.4, 95.6, 250],
  ['oil', 'Akita–Niigata', 39.0, 140.0, 300],
  ['oil', 'Turner Valley', 50.7, -114.3, 1000],
  ['oil', 'Hurghada', 27.3, 33.8, 700],

  // ==================== IRON ORE (kt/yr) — world ~200,000 ====================
  ['iron', 'Mesabi Range', 47.5, -92.5, 41000],
  ['iron', 'Marquette–Menominee', 46.5, -88.0, 6000],
  ['iron', 'Birmingham, Alabama', 33.5, -86.8, 5000],
  ['iron', 'Lorraine Basin', 49.2, 5.9, 33000],
  ['iron', 'Minette, Luxembourg', 49.5, 6.0, 7000],
  ['iron', 'Krivoy Rog', 47.9, 33.4, 18000],
  ['iron', 'Magnitnaya Mountain', 53.4, 59.0, 8000],
  ['iron', 'Kerch', 45.3, 36.5, 2500],
  ['iron', 'Kiruna–Gällivare', 67.8, 20.2, 11000],
  ['iron', 'Grängesberg', 60.1, 15.0, 3000],
  ['iron', 'Salzgitter', 52.1, 10.4, 5000],
  ['iron', 'Siegerland', 50.9, 8.0, 3000],
  ['iron', 'Northamptonshire', 52.4, -0.7, 7000],
  ['iron', 'Cleveland Hills', 54.5, -1.2, 4000],
  ['iron', 'Cumberland', 54.5, -3.5, 1500],
  ['iron', 'Vizcaya', 43.2, -2.9, 2600],
  ['iron', 'Ouenza', 35.9, 8.1, 3000],
  ['iron', 'Singhbhum', 22.6, 85.8, 3000],
  ['iron', 'Anshan', 41.1, 123.0, 5000],
  ['iron', 'Itabira', -19.6, -43.2, 1500],
  ['iron', 'El Tofo', -29.5, -71.3, 1600],
  ['iron', 'Sydvaranger', 69.7, 30.0, 1000],
  ['iron', 'Bell Island', 47.6, -52.9, 1500],
  ['iron', 'Erzberg', 47.5, 14.9, 2000],
  ['iron', 'Rif, Morocco', 34.7, -3.0, 1000],
  ['iron', 'Djerissa', 35.9, 8.6, 800],
  ['iron', 'Marampa', 8.7, -12.5, 800],
  ['iron', 'Częstochowa', 50.8, 19.1, 800],
  ['iron', 'Ljubija', 44.9, 16.4, 700],
  ['iron', 'Larymna', 38.6, 23.3, 500],
  ['iron', 'Mayarí', 20.7, -75.7, 300],

  // ================= CRUDE STEEL (kt/yr) — world ~137,000 ==================
  ['steel', 'Pittsburgh', 40.44, -80.0, 12000],
  ['steel', 'Chicago–Gary', 41.6, -87.3, 11000],
  ['steel', 'Cleveland–Youngstown', 41.1, -80.65, 8000],
  ['steel', 'Bethlehem', 40.6, -75.4, 5000],
  ['steel', 'Sparrows Point', 39.2, -76.5, 3000],
  ['steel', 'Buffalo', 42.9, -78.8, 3000],
  ['steel', 'Detroit Works', 42.3, -83.05, 2500],
  ['steel', 'Birmingham, Alabama', 33.5, -86.8, 2600],

  ['steel', 'Ruhr (Essen–Duisburg)', 51.45, 6.85, 12000],
  ['steel', 'Dortmund', 51.5, 7.47, 3000],
  ['steel', 'Saar', 49.25, 6.98, 2500],
  ['steel', 'Upper Silesia', 50.3, 18.9, 3000],
  ['steel', 'Salzgitter (Reichswerke)', 52.15, 10.35, 1200],
  ['steel', 'Linz–Donawitz', 47.4, 15.1, 900],
  ['steel', 'Ostrava', 49.84, 18.28, 1100],
  ['steel', 'Kladno', 50.15, 14.1, 600],

  ['steel', 'Donbas (Makeyevka)', 48.0, 37.9, 6000],
  ['steel', 'Dnepropetrovsk–Zaporozhye', 48.45, 35.05, 4500],
  ['steel', 'Magnitogorsk', 53.4, 59.0, 3000],
  ['steel', 'Kuznetsk', 53.76, 87.1, 2200],
  ['steel', 'Nizhny Tagil', 57.9, 60.0, 1500],
  ['steel', 'Tula', 54.2, 37.6, 1400],

  ['steel', 'Sheffield', 53.38, -1.47, 2500],
  ['steel', 'South Wales', 51.6, -3.8, 2500],
  ['steel', 'Middlesbrough', 54.57, -1.23, 2800],
  ['steel', 'Motherwell', 55.79, -4.0, 1800],
  ['steel', 'Scunthorpe', 53.59, -0.65, 1500],
  ['steel', 'Black Country', 52.5, -2.0, 2100],

  ['steel', 'Longwy–Thionville', 49.4, 6.1, 5500],
  ['steel', 'Valenciennes', 50.35, 3.5, 1500],
  ['steel', 'Saint-Étienne', 45.44, 4.39, 900],
  ['steel', 'Liège', 50.63, 5.57, 1600],
  ['steel', 'Charleroi', 50.41, 4.44, 1500],
  ['steel', 'Esch-sur-Alzette', 49.5, 5.98, 1800],

  ['steel', 'Yawata', 33.86, 130.8, 3000],
  ['steel', 'Amagasaki', 34.72, 135.4, 1500],
  ['steel', 'Muroran', 42.3, 140.97, 800],
  ['steel', 'Shōwa Works, Anshan', 41.1, 123.0, 1400],

  ['steel', 'Cornigliano', 44.42, 8.85, 800],
  ['steel', 'Terni', 42.56, 12.65, 600],
  ['steel', 'Piombino', 42.93, 10.52, 500],
  ['steel', 'Katowice', 50.26, 19.02, 1400],
  ['steel', 'Domnarvet', 60.5, 15.4, 600],
  ['steel', 'Oxelösund', 58.67, 17.1, 400],
  ['steel', 'Hamilton', 43.26, -79.87, 900],
  ['steel', 'Sydney, Nova Scotia', 46.14, -60.19, 500],
  ['steel', 'Jamshedpur', 22.8, 86.2, 1000],
  ['steel', 'Newcastle, NSW', -32.93, 151.78, 700],
  ['steel', 'Port Kembla', -34.48, 150.9, 500],
  ['steel', 'Bilbao', 43.26, -2.93, 600],
  ['steel', 'Csepel', 47.43, 19.07, 400],
  ['steel', 'Diósgyőr', 48.1, 20.7, 300],
  ['steel', 'Pretoria (Iscor)', -25.75, 28.19, 300],

  // ================== ALUMINIUM (t/yr) — world ~700,000 ====================
  // Germany out-produced everyone, for the Luftwaffe.
  ['aluminium', 'Bitterfeld', 51.62, 12.32, 60000],
  ['aluminium', 'Lauta', 51.45, 14.09, 45000],
  ['aluminium', 'Töging am Inn', 48.26, 12.58, 30000],
  ['aluminium', 'Rheinfelden', 47.55, 7.79, 25000],
  ['aluminium', 'Ranshofen', 48.25, 13.03, 39000],
  ['aluminium', 'Alcoa, Tennessee', 35.79, -83.97, 55000],
  ['aluminium', 'Massena', 44.93, -74.89, 45000],
  ['aluminium', 'Badin', 35.41, -80.11, 28000],
  ['aluminium', 'Vancouver, Washington', 45.63, -122.67, 20000],
  ['aluminium', 'Arvida', 48.43, -71.18, 76000],
  ['aluminium', 'Zaporozhye', 47.84, 35.14, 30000],
  ['aluminium', 'Volkhov', 59.9, 32.34, 15000],
  ['aluminium', 'Kamensk-Uralsky', 56.42, 61.93, 15000],
  ['aluminium', 'Saint-Jean-de-Maurienne', 45.28, 6.35, 25000],
  ['aluminium', 'Chedde', 45.93, 6.72, 15000],
  ['aluminium', 'Auzat', 42.79, 1.49, 13000],
  ['aluminium', 'Porto Marghera', 45.47, 12.24, 18000],
  ['aluminium', 'Bolzano', 46.5, 11.35, 16000],
  ['aluminium', 'Høyanger', 61.22, 6.07, 12000],
  ['aluminium', 'Tyssedal', 60.12, 6.56, 12000],
  ['aluminium', 'Glomfjord', 66.82, 13.94, 7000],
  ['aluminium', 'Niigata', 37.9, 139.0, 15000],
  ['aluminium', 'Ōmuta', 33.03, 130.45, 15000],
  ['aluminium', 'Chippis', 46.28, 7.55, 27000],
  ['aluminium', 'Kinlochleven–Fort William', 56.82, -5.11, 25000],
  ['aluminium', 'Ajka', 47.1, 17.55, 8000],
  ['aluminium', 'Sabiñánigo', 42.52, -0.36, 3000],
  ['aluminium', 'Lozovac', 43.8, 15.95, 2000],

  // Synthetic rubber (t/yr): the Reich's answer to being cut off from Malaya.
  ['rubber', 'Buna-Werke, Schkopau', 51.4, 11.95, 22000],
  ['rubber', 'Yaroslavl SK', 57.6, 39.9, 25000],
  ['rubber', 'Voronezh SK', 51.66, 39.2, 25000],
];

/**
 * Producing areas rather than points. Output is the zone total, divided among
 * the tiles inside it that suit the crop (or, for fisheries, the sea tiles).
 *
 * @type {Array<{resource: string, name: string, box: [number, number, number, number], output: number, sea?: boolean}>}
 */
export const ZONES = [
  // =============== NATURAL RUBBER (t/yr) — world ~1,100,000 ===============
  // Over 90% of it grew within a few degrees of the equator in South-East Asia.
  { resource: 'rubber', name: 'Malayan estates', box: [99.5, 1, 105, 7], output: 400000 },
  { resource: 'rubber', name: 'Sumatra estates', box: [95, -6, 107, 6], output: 220000 },
  { resource: 'rubber', name: 'Borneo estates', box: [108, -4, 119, 7], output: 90000 },
  { resource: 'rubber', name: 'Java estates', box: [105, -9, 115.5, -5.5], output: 60000 },
  { resource: 'rubber', name: 'Ceylon estates', box: [79, 5.5, 82, 10], output: 60000 },
  { resource: 'rubber', name: 'Indochina plantations', box: [104, 9, 109, 14], output: 60000 },
  { resource: 'rubber', name: 'Siamese estates', box: [98, 5.5, 102, 12], output: 40000 },
  { resource: 'rubber', name: 'Travancore estates', box: [75, 8, 78, 13], output: 15000 },
  { resource: 'rubber', name: 'Amazon wild rubber', box: [-70, -8, -50, 2], output: 15000 },
  { resource: 'rubber', name: 'Burmese estates', box: [94, 14, 99, 22], output: 10000 },
  { resource: 'rubber', name: 'Firestone, Liberia', box: [-11.5, 4.3, -7.4, 8.5], output: 10000 },
  { resource: 'rubber', name: 'West African estates', box: [-3, 4, 10, 8], output: 5000 },

  // ================== FISHERIES (kt/yr) — world ~20,000 ==================
  // Japan was the largest fishing nation on earth in 1939.
  { resource: 'food', name: 'Japanese fisheries', box: [128, 30, 150, 46], output: 3500, sea: true },
  { resource: 'food', name: 'Yellow & East China Sea', box: [118, 25, 128, 41], output: 1600, sea: true },
  { resource: 'food', name: 'North Sea & Dogger Bank', box: [-4, 51, 9, 61], output: 1900, sea: true },
  { resource: 'food', name: 'Norwegian Sea', box: [0, 62, 20, 71], output: 1100, sea: true },
  { resource: 'food', name: 'Icelandic grounds', box: [-25, 62, -13, 67], output: 500, sea: true },
  { resource: 'food', name: 'Barents Sea', box: [20, 68, 45, 78], output: 400, sea: true },
  { resource: 'food', name: 'Grand Banks', box: [-55, 43, -48, 49], output: 500, sea: true },
  { resource: 'food', name: 'Georges Bank', box: [-71, 40, -65, 44], output: 400, sea: true },
  { resource: 'food', name: 'California sardine', box: [-125, 32, -117, 40], output: 600, sea: true },
  { resource: 'food', name: 'Humboldt Current', box: [-80, -40, -70, -5], output: 300, sea: true },
  { resource: 'food', name: 'Baltic fisheries', box: [10, 54, 26, 63], output: 300, sea: true },
  { resource: 'food', name: 'Bay of Bengal', box: [79, 8, 95, 22], output: 500, sea: true },
  { resource: 'food', name: 'Arabian Sea', box: [50, 8, 78, 25], output: 350, sea: true },
  { resource: 'food', name: 'South China Sea', box: [105, 2, 122, 23], output: 700, sea: true },
  { resource: 'food', name: 'Iberian & Moroccan', box: [-12, 30, -6, 44], output: 400, sea: true },
  { resource: 'food', name: 'Newfoundland–Nova Scotia', box: [-66, 43, -55, 52], output: 250, sea: true },
  { resource: 'food', name: 'Chilean coast', box: [-76, -45, -70, -25], output: 150, sea: true },
  { resource: 'food', name: 'South African coast', box: [15, -36, 28, -28], output: 150, sea: true },
];

/**
 * Farming regions that produced far above what their land and population alone
 * would suggest — the export breadbaskets, the irrigated deltas, and the
 * intensively worked plains of western Europe. Multiplies farm output inside
 * the box.
 */
export const FARM_ZONES = [
  { name: 'US Corn Belt', box: [-97, 37, -82, 45], factor: 2.4 },
  { name: 'US Great Plains', box: [-104, 33, -95, 49], factor: 1.9 },
  { name: 'California Central Valley', box: [-122, 35, -118.5, 40], factor: 1.8 },
  { name: 'Canadian Prairies', box: [-114, 49, -96, 55], factor: 2.0 },
  { name: 'Argentine Pampas', box: [-64, -39, -57, -31], factor: 2.3 },
  { name: 'Ukrainian black earth', box: [26, 46, 42, 52], factor: 2.0 },
  { name: 'Danube basin', box: [16, 43, 29, 48], factor: 1.7 },
  { name: 'North-west Europe', box: [-5, 47, 12, 55], factor: 1.6 },
  { name: 'Po valley', box: [8, 44.5, 12.5, 46], factor: 1.7 },
  { name: 'Nile', box: [30, 24, 32.5, 31.6], factor: 2.0 },
  { name: 'Punjab canal colonies', box: [71, 28, 77, 33], factor: 1.8 },
  { name: 'Gangetic rice', box: [77, 22, 90.5, 30], factor: 1.5 },
  { name: 'North China plain', box: [112, 31, 122, 41], factor: 1.5 },
  { name: 'Yangtze rice', box: [106, 27, 122, 33], factor: 1.6 },
  { name: 'Irrawaddy delta', box: [94, 15, 97.5, 19], factor: 2.2 },
  { name: 'Chao Phraya delta', box: [99, 13, 101.5, 16], factor: 2.2 },
  { name: 'Mekong delta', box: [104.5, 8.5, 107, 11.5], factor: 2.2 },
  { name: 'Java sawah', box: [105, -9, 115.5, -5.5], factor: 1.9 },
  { name: 'Japanese paddy', box: [130, 31, 142, 42], factor: 1.5 },
  { name: 'Australian wheat belt', box: [115, -37, 151, -27], factor: 1.6 },
  { name: 'New Zealand pasture', box: [166, -47, 179.9, -34], factor: 1.7 },
];
