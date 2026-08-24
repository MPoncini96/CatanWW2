// Which way the neutrals leaned, on 1 September 1939.
//
// One number per independent country: the percentage leaning towards the
// Allies, so 50 is evenly balanced and the Axis share is the remainder. It is a
// starting position, not a verdict — like ownership, this is meant to move.
//
// The numbers are deliberately kept off the ends. On the day the war began no
// neutral had committed, and most had reasons pulling both ways: Romania held a
// British guarantee and sold its oil to Germany; Finland feared the Soviet Union
// that the Allies would soon be allied to; Argentina's army admired Germany
// while its trade ran to Britain. Only a country already acting as a belligerent
// or a client sits near 0 or 100, and nothing sits at either.
//
// The eight powers are not listed. They had already chosen.

/** Country name -> percentage leaning Allied. The rest of the 100 is Axis. */
export const LEANINGS_1939 = {
  // ===================== Europe, about to be overrun ======================
  // Poland had signed the Anglo-Polish alliance a week earlier and was invaded
  // the day this board starts. It is neutral here only in the sense that it is
  // not one of the eight.
  Poland: 92,
  // The Low Countries and Scandinavia all held to a strict neutrality that had
  // served them in 1914, while their sympathies and their trade ran west.
  Belgium: 63,
  Netherlands: 60,
  Norway: 62,
  // Denmark had signed a non-aggression pact with Germany that May, and had no
  // means to resist anyone.
  Denmark: 55,
  Sweden: 55,
  Switzerland: 52,

  // ========================== Europe, leaning Axis =========================
  // A German client since March, whose troops marched into Poland alongside
  // the Wehrmacht.
  Slovakia: 8,
  // Revisionist and rewarded for it — the Felvidek and Carpatho-Ukraine came
  // from Berlin — and in the Anti-Comintern Pact since February.
  Hungary: 25,
  Bulgaria: 35,
  // Franco owed his victory to German and Italian arms, but Spain was wrecked
  // and could not have fought for anyone.
  Spain: 25,
  'Spanish Morocco': 25,
  // Guaranteed by Britain and France in April, selling its oil to Germany, and
  // about to lose Bessarabia to the Soviet Union. Genuinely torn.
  Romania: 45,
  // Anti-Soviet feeling cut against an Allied camp that would shortly include
  // the USSR. The Baltics had already been assigned to the Soviet sphere by the
  // secret protocol of the Molotov-Ribbentrop pact.
  Finland: 45,
  Estonia: 40,
  Latvia: 40,
  Lithuania: 40,

  // ======================== Europe, leaning Allied =========================
  Yugoslavia: 60,
  Greece: 70,
  // The Anglo-French-Turkish treaty of mutual assistance came that October.
  Turkey: 65,
  // The alliance of 1373, the oldest in force anywhere, against a scrupulous
  // Salazarist neutrality.
  Portugal: 75,
  // De Valera's neutrality was partly an assertion of independence from London;
  // tens of thousands volunteered for British service regardless. Keyed by the
  // country name, not the territory's: the box is called Eire, the country
  // Ireland, and keying on the wrong one silently drops the entry.
  Ireland: 55,
  Iceland: 70,
  Greenland: 78,

  // ============================ The Near East ==============================
  // Reza Shah cultivated German trade and advisers as a counterweight to the
  // British and the Russians, who between them occupied Iran in 1941.
  Persia: 40,
  Afghanistan: 45,
  // Ibn Saud kept his British subsidies while hearing out the Axis.
  'Saudi Arabia': 60,
  Oman: 78,

  // ================================= Asia ==================================
  // Irredentist towards French Indochina and drifting Japan's way; it let the
  // Japanese in and declared war on the Allies in 1941.
  Thailand: 30,
  Tibet: 50,
  // Both bound to Britain by treaty, and Nepal by the Gurkha regiments.
  Nepal: 85,
  Bhutan: 75,
  // A Soviet satellite whose army had fought beside the Red Army at Khalkhin
  // Gol that same summer.
  Mongolia: 88,
  'Netherlands East Indies': 65,
  Borneo: 65,
  'Portuguese Timor': 70,

  // ================================ Africa =================================
  Liberia: 75,
  Angola: 72,
  Mozambique: 72,

  // =============================== The Americas ============================
  // The Panama Declaration that October drew a neutrality zone around the whole
  // hemisphere. Sympathies ran Allied nearly everywhere, but nobody was in it
  // yet, and the German communities of the southern cone were substantial.
  Mexico: 65,
  'Central America': 70,
  'West Indies': 72,
  Venezuela: 65,
  Colombia: 68,
  Ecuador: 65,
  Peru: 60,
  'Dutch Guiana': 65,
  // Vargas played both sides until 1942, then sent a division to Italy.
  Brazil: 60,
  // Large German settlements in the south; the last country in the hemisphere
  // to break with the Axis.
  Chile: 50,
  // A German-trained army against tin that all went to the Allies.
  Bolivia: 50,
  Paraguay: 45,
  Uruguay: 70,
  // The holdout: a pro-Axis current in the officer corps, British-dominated
  // trade, and no declaration of war until March 1945.
  Argentina: 40,
};

/**
 * Attach the starting lean to every independent country.
 *
 * Belligerents are left alone — their side is already their answer.
 */
export function attachLeanings(countries) {
  for (const country of countries) {
    if (country.power !== 0) continue; // 0 is NEUTRAL
    const allied = LEANINGS_1939[country.name];
    if (allied === undefined) continue;
    country.leanAllied = allied;
  }
  return countries;
}
