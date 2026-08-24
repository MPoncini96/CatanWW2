// Who held what on 1 September 1939.
//
// Boxes are [west, south, east, north] in degrees, tested in order, and the
// FIRST match wins. Order therefore carries as much meaning as the boxes: the
// neutrals are carved out before the empires, and small holdings before the
// continents that would otherwise swallow them. The Soviet Union comes last of
// all in Eurasia, because its box would eat half the list.
//
// Following the Axis & Allies Global 1939 "Midnight Express" setup, the powers
// are the eight belligerents and everyone else is Independent. That variant's
// neutral list is long and it is honoured here: Poland, the Baltic States,
// Norway, Sweden, Switzerland, Spain-Portugal, Eire, Turkey, Persia,
// Afghanistan, Saudi Arabia, the East Indies, Angola and Mozambique, the
// Sahara, the Himalaya, and the whole of Latin America outside the American
// possessions all stay grey.
//
// Independent is not the same as ownerless. Egypt and Iraq are sovereign states
// with British garrisons on them, which is a lean and not an owner; the Belgian
// Congo, the East Indies and Angola are colonies of neutral powers, and belong
// to Belgium, the Netherlands and Portugal rather than to nobody. Sovereignty
// is this field; influence is the Allies/Axis slider in `leanings.js`.
//
// Two departures from the board, both because eight powers were asked for:
// the Dominions are folded into the United Kingdom, though each declared war on
// its own account, and there is no separate Dutch power — the Netherlands and
// their East Indies are neutral, which in September 1939 they still were.

/** @type {Array<{owner: string, name: string, box: [number, number, number, number]}>} */
export const TERRITORIES_1939 = [
  // ============ Islands and enclaves, before the seas around them ===========
  { owner: 'uk', name: 'Hong Kong', box: [113.7, 22.1, 114.6, 23.0] },
  { owner: 'neutral', name: 'Macau', box: [113.5, 22.1, 113.62, 22.22] },
  { owner: 'uk', name: 'Malta', box: [14.1, 35.7, 14.7, 36.1] },
  { owner: 'uk', name: 'Gibraltar', box: [-5.4, 36.0, -5.3, 36.2] },
  { owner: 'uk', name: 'Cyprus', box: [32.2, 34.5, 34.6, 35.7] },
  { owner: 'uk', name: 'Falkland Islands', box: [-61.5, -52.6, -57.7, -50.9] },
  { owner: 'uk', name: 'Bermuda', box: [-65.0, 32.2, -64.6, 32.4] },
  { owner: 'italy', name: 'Dodecanese', box: [26.7, 35.8, 28.3, 37.0] },
  // Ahead of Greece and Yugoslavia, both of which overlap it.
  { owner: 'italy', name: 'Albania', box: [19.2, 39.6, 21.1, 42.4] },
  { owner: 'france', name: 'Corsica', box: [8.5, 41.3, 9.6, 43.1] },
  { owner: 'italy', name: 'Sardinia', box: [8.1, 38.8, 9.9, 41.3] },
  { owner: 'usa', name: 'Hawaii', box: [-161, 18.5, -154.5, 22.5] },
  { owner: 'usa', name: 'Guam', box: [144.5, 13.2, 145.0, 13.7] },
  { owner: 'usa', name: 'Wake Island', box: [166.5, 19.2, 166.8, 19.4] },
  { owner: 'usa', name: 'Puerto Rico', box: [-67.3, 17.9, -65.6, 18.6] },
  { owner: 'usa', name: 'Panama Canal Zone', box: [-80.0, 8.6, -79.4, 9.5] },
  { owner: 'japan', name: 'Mariana Islands', box: [144.5, 14.0, 146.5, 20.6] },
  { owner: 'japan', name: 'Caroline Islands', box: [134, 5, 163, 10.5] },
  { owner: 'japan', name: 'Marshall Islands', box: [163, 4.5, 173, 15] },
  { owner: 'japan', name: 'Karafuto', box: [141.5, 45.9, 145.0, 50.5] },
  { owner: 'france', name: 'New Caledonia', box: [163.5, -22.8, 168.2, -20.0] },
  { owner: 'uk', name: 'Fiji', box: [176.8, -19.3, 180, -16.1] },
  { owner: 'uk', name: 'Solomon Islands', box: [155.5, -11.0, 167.0, -5.0] },

  // Small holdings that sit inside a much larger box and would otherwise be
  // swallowed by it: Ceylon by India, Aden and British Somaliland by the
  // Arabian and Italian blocks, the Guianas by Brazil and Venezuela, and
  // Portuguese Timor by the Netherlands East Indies.
  //
  // The scattered Portuguese and Dutch possessions belong here too. None of
  // them was independent, and each is claimed ahead of the empire whose block
  // would otherwise take it: Goa before India, Portuguese Guinea before the
  // British Gambia box, Cabinda before Angola, Curacao before Venezuela.
  { owner: 'uk', name: 'Ceylon', box: [79.4, 5.8, 82.0, 9.9] },
  { owner: 'uk', name: 'Aden', box: [43.0, 12.4, 53.2, 16.0] },
  { owner: 'uk', name: 'British Somaliland', box: [42.8, 7.9, 49.0, 11.6] },
  { owner: 'uk', name: 'British Guiana', box: [-61.5, 1.1, -57.2, 8.6] },
  { owner: 'france', name: 'French Guiana', box: [-54.6, 2.1, -51.6, 5.8] },
  { owner: 'neutral', name: 'Dutch Guiana', box: [-57.2, 1.8, -53.9, 6.1] },
  { owner: 'neutral', name: 'Portuguese Timor', box: [124.0, -9.6, 127.4, -8.1] },
  { owner: 'neutral', name: 'Goa', box: [73.6, 14.85, 74.35, 15.85] },
  { owner: 'neutral', name: 'Portuguese Guinea', box: [-16.8, 10.85, -13.6, 12.75] },
  { owner: 'neutral', name: 'Cape Verde', box: [-25.4, 14.7, -22.6, 17.3] },
  { owner: 'neutral', name: 'Cabinda', box: [11.9, -5.8, 13.1, -4.3] },
  { owner: 'neutral', name: 'Curacao', box: [-70.2, 11.95, -68.2, 12.6] },

  // These sit ahead of the neutral blocks that would otherwise cover them:
  // Arabia over Palestine and Iraq, the East Indies over Malaya, and Italy over
  // Tunisia across the Sicilian narrows.
  //
  // Iraq is sovereign, and had been since 1932. Britain kept basing rights at
  // Habbaniya and Shaiba and a treaty that let it move troops through, which is
  // a sphere of influence and not ownership - it belongs in the Allied lean and
  // not in the owner field. Its eastern border is stepped, because a rectangle
  // out to 48.8E reaches over the Zagros and takes Kermanshah, Ahvaz and the
  // Abadan refinery - all Persian - along with it.
  { owner: 'uk', name: 'Palestine and Transjordan', box: [34.2, 29.1, 39.4, 33.3] },
  { owner: 'neutral', name: 'Iraq', box: [38.7, 29.0, 45.5, 37.4] },
  { owner: 'neutral', name: 'Iraq (Basra)', box: [45.5, 29.5, 48.0, 34.0] },
  { owner: 'uk', name: 'Kuwait', box: [46.5, 28.4, 48.6, 30.1] },
  { owner: 'uk', name: 'The Trucial Coast and Qatar', box: [50.4, 22.5, 56.5, 26.5] },
  { owner: 'uk', name: 'Malaya', box: [100.1, 4.0, 104.6, 6.8] },
  { owner: 'uk', name: 'Malaya (centre)', box: [100.8, 3.0, 104.6, 4.0] },
  { owner: 'uk', name: 'Malaya (Johore)', box: [102.0, 1.1, 104.6, 3.0] },
  { owner: 'france', name: 'Tunisia', box: [7.5, 30.2, 11.6, 37.5] },
  // Lower Silesia was German until 1945 and lies east of the main German box,
  // so it has to be claimed before Poland. Katowice and Krakow stay Polish
  // just beyond its eastern edge.
  { owner: 'germany', name: 'Silesia', box: [15.1, 49.8, 18.8, 51.9] },
  // The Protectorate of Bohemia and Moravia, annexed in March 1939, and East
  // Prussia with Memel. Both sit inside Poland's box and both were German on 1
  // September, so both are claimed ahead of it.
  { owner: 'germany', name: 'Bohemia and Moravia', box: [12.0, 48.5, 18.4, 51.1] },
  { owner: 'germany', name: 'East Prussia', box: [19.3, 54.0, 23.0, 55.9] },
  // The Ussuri and the Amur: Soviet Primorye, ahead of the Japanese blocks.
  { owner: 'ussr', name: 'Maritime Province', box: [130.5, 42.0, 139.0, 47.0] },
  { owner: 'ussr', name: 'Maritime Province (Amur)', box: [133.2, 47.0, 141.0, 49.0] },

  // ================ Neutrals, carved out before the empires =================
  // Europe. Every one of these was still out of the war on 1 September.
  // Northern Ireland is about one hex across, so it has to be claimed
  // explicitly or Eire's box takes Belfast with it.
  { owner: 'uk', name: 'Northern Ireland', box: [-6.4, 54.1, -5.4, 55.2] },
  { owner: 'neutral', name: 'Eire', box: [-10.7, 51.4, -6.05, 55.4] },
  // Britain, ahead of France. France's north coast runs to 51.1N — the same
  // latitudes as the English south coast — so claimed after France, everything
  // below that line from Cornwall to Sussex comes out French. The southern box
  // stops at 1.5E, short of Calais and Dunkirk on the far side of the Straits.
  { owner: 'uk', name: 'Southern England', box: [-8.3, 49.8, 1.5, 51.5] },
  { owner: 'uk', name: 'United Kingdom', box: [-8.3, 51.5, 2.1, 61.0] },
  { owner: 'neutral', name: 'Iceland', box: [-24.6, 63.2, -13.4, 66.6] },
  // Greenland was Danish, all of it. A single box from 60W left Thule and the
  // north-west to Canada, because Greenland's west coast runs further west the
  // further north you go. Ellesmere's east coast slopes the same way, so both
  // are stepped, and Ellesmere is claimed first: Nares Strait between them is
  // 30 km, a third of a hex, and no rectangle can separate them cleanly.
  { owner: 'uk', name: 'Ellesmere Island', box: [-95.0, 75.5, -73.0, 79.0] },
  { owner: 'uk', name: 'Ellesmere Island (north)', box: [-95.0, 79.0, -61.0, 83.6] },
  { owner: 'neutral', name: 'Greenland (south)', box: [-54.0, 59.0, -36.0, 66.0] },
  { owner: 'neutral', name: 'Greenland (west)', box: [-56.0, 66.0, -20.0, 70.0] },
  { owner: 'neutral', name: 'Greenland (north-west)', box: [-60.0, 70.0, -15.0, 75.0] },
  { owner: 'neutral', name: 'Greenland (Thule)', box: [-73.0, 75.0, -14.0, 79.0] },
  { owner: 'neutral', name: 'Greenland', box: [-61.0, 79.0, -11.0, 84.0] },
  { owner: 'neutral', name: 'Svalbard', box: [10.0, 76.0, 34.0, 81.5] },
  { owner: 'neutral', name: 'Norway', box: [4.0, 57.9, 13.0, 65.0] },
  { owner: 'neutral', name: 'Norway (Arctic)', box: [12.0, 65.0, 16.5, 67.5] },
  { owner: 'neutral', name: 'Norway (Nordland)', box: [14.0, 67.5, 18.8, 69.5] },
  { owner: 'neutral', name: 'Norway (Finnmark)', box: [17.5, 69.0, 30.5, 71.3] },
  { owner: 'neutral', name: 'Sweden', box: [11.0, 55.2, 19.5, 61.0] },
  { owner: 'neutral', name: 'Sweden (Norrland)', box: [12.0, 61.0, 21.2, 65.5] },
  { owner: 'neutral', name: 'Sweden (Lapland)', box: [15.0, 65.0, 24.2, 69.1] },
  { owner: 'neutral', name: 'Finland', box: [19.3, 59.7, 31.6, 70.1] },
  { owner: 'neutral', name: 'Denmark', box: [8.0, 54.5, 12.7, 57.8] },
  // Belgium in two pieces: it only reaches south to the Ardennes in the east,
  // and a single box takes French Valenciennes with it.
  // Belgium's south-western edge stops above Lille, which is French. Lille and
  // Mons are 20 km apart and share a hex; Lille is the larger.
  { owner: 'neutral', name: 'Belgium', box: [2.5, 50.72, 4.6, 51.55] },
  { owner: 'neutral', name: 'Belgium (Ardennes)', box: [4.6, 49.5, 6.05, 51.0] },
  { owner: 'neutral', name: 'Netherlands (south)', box: [3.3, 50.75, 6.25, 52.0] },
  { owner: 'neutral', name: 'Netherlands (north)', box: [3.3, 52.0, 7.25, 53.6] },
  { owner: 'neutral', name: 'Switzerland', box: [5.9, 45.8, 10.5, 47.9] },
  // Spain only reaches east of the Greenwich meridian north of Valencia. Boxed
  // as one rectangle it crosses the Mediterranean and takes the Algerian coast
  // around Algiers with it.
  { owner: 'neutral', name: 'Portugal', box: [-9.6, 36.9, -6.2, 42.2] },
  { owner: 'neutral', name: 'Spain', box: [-10.0, 36.0, 0.0, 44.0] },
  { owner: 'neutral', name: 'Spain (Catalonia)', box: [0.0, 37.5, 3.3, 43.0] },
  // Between the Reich and the Soviet border, tested north to south. The Baltic
  // States come before Poland so Kaunas and Riga are not swallowed, and
  // Slovakia with Carpathian Ruthenia fills the Carpathian gap — left open,
  // that gap falls through to the Soviet box and draws a red strip across
  // Europe. Poland runs east to 26.3E, which is where it still stood on
  // 1 September; the partition was a fortnight away.
  { owner: 'neutral', name: 'Lithuania', box: [20.9, 53.9, 26.9, 56.4] },
  { owner: 'neutral', name: 'Latvia', box: [20.9, 56.4, 27.3, 58.1] },
  { owner: 'neutral', name: 'Estonia', box: [21.5, 57.5, 28.2, 59.8] },
  // Slovakia stops short of 48.2N on purpose. Vienna and Bratislava are 55 km
  // apart and share a hex; reaching far enough south to claim Bratislava takes
  // Vienna with it, and Vienna is fourteen times the size.
  //
  // Hungary was given the southern edge of Slovakia by the First Vienna Award
  // of November 1938 and Carpatho-Ruthenia in March 1939, so all three come
  // ahead of Slovakia: claimed after it, the Slovak box takes Kosice, Uzhhorod
  // and Mukachevo with it. The award line climbs as it runs east, which is why
  // the strip is stepped - Zvolen and Banska Bystrica stayed Slovak, Kosice at
  // 48.7N did not.
  { owner: 'neutral', name: 'Carpathian Ruthenia', box: [22.0, 47.9, 24.3, 49.1] },
  { owner: 'neutral', name: 'Southern Slovakia', box: [17.2, 48.2, 19.4, 48.4] },
  { owner: 'neutral', name: 'Kosice', box: [19.4, 48.2, 22.0, 48.75] },
  { owner: 'neutral', name: 'Slovakia', box: [16.9, 48.2, 22.6, 49.6] },
  { owner: 'neutral', name: 'Hungary', box: [17.2, 45.7, 22.9, 48.2] },
  { owner: 'neutral', name: 'Romania', box: [20.2, 43.6, 29.8, 48.3] },
  { owner: 'neutral', name: 'Poland', box: [16.3, 49.2, 26.3, 55.2] },
  { owner: 'neutral', name: 'Poland (Galicia)', box: [21.8, 48.4, 26.3, 49.2] },
  // Yugoslavia in three steps. One box spanning its full latitude range also
  // spans the Adriatic, and takes Naples and Bari with it; the country narrows
  // to the east as it runs south, so the boxes have to narrow with it.
  { owner: 'neutral', name: 'Yugoslavia', box: [13.9, 44.3, 23.0, 46.9] },
  { owner: 'neutral', name: 'Yugoslavia (Dalmatia)', box: [14.6, 43.4, 15.5, 44.3] },
  { owner: 'neutral', name: 'Yugoslavia (Bosnia and Serbia)', box: [15.5, 42.2, 23.0, 44.3] },
  { owner: 'neutral', name: 'Yugoslavia (Montenegro)', box: [18.4, 40.8, 23.0, 42.2] },
  { owner: 'neutral', name: 'Bulgaria', box: [22.3, 41.0, 28.7, 44.3] },
  { owner: 'neutral', name: 'Greece', box: [19.3, 34.8, 28.3, 41.8] },
  // Hatay voted itself out of French Syria and into Turkey in June 1939, and
  // Syria has to be carved out ahead of Turkey rather than after it: Turkey's
  // box reaches down to 35.5N, which is Aleppo and the Jazira.
  { owner: 'neutral', name: 'Hatay', box: [35.7, 35.8, 36.7, 36.9] },
  { owner: 'france', name: 'Syria and Lebanon', box: [35.0, 32.2, 42.4, 37.1] },
  { owner: 'neutral', name: 'Turkey', box: [25.5, 35.5, 44.9, 42.6] },

  // The Near East and Central Asia.
  { owner: 'neutral', name: 'Persia', box: [45.5, 25.0, 63.5, 39.9] },
  // Iranian Azerbaijan. Turkey stops at 44.9E and Iraq's box does not reach
  // north of 37.4N, so without this the strip around Khoy falls through every
  // box to the Soviet Union's and paints a red wedge south of Ararat. Kept to
  // the north: extending Persia's own box west instead takes the Iraqi desert
  // and a slice of northern Arabia with it.
  { owner: 'neutral', name: 'Persia (Azerbaijan)', box: [44.0, 37.4, 45.5, 39.9] },
  // Afghanistan only reaches east to 75E along the Wakhan corridor, a strip
  // barely a degree tall. Squaring that off puts Kashmir and Srinagar in
  // Afghanistan; British Baluchistan is claimed ahead of it for the same
  // reason, since the Durand Line runs diagonally across the box's corner.
  { owner: 'uk', name: 'British Baluchistan', box: [61.5, 24.5, 70.5, 31.5] },
  { owner: 'neutral', name: 'Afghanistan', box: [60.4, 29.4, 71.5, 38.5] },
  { owner: 'neutral', name: 'Wakhan Corridor', box: [71.5, 36.6, 74.9, 37.6] },
  { owner: 'neutral', name: 'Saudi Arabia and Yemen', box: [40.0, 12.0, 56.5, 32.0] },
  { owner: 'neutral', name: 'Oman', box: [52.0, 16.6, 59.9, 26.5] },

  // Asia.
  { owner: 'neutral', name: 'Thailand', box: [97.3, 5.5, 105.7, 20.5] },
  // The old single box reached down to 26.5N and swallowed Lucknow and the
  // upper Ganges with it. Tibet, Nepal and Bhutan are separate, and the
  // southern edge now follows the Himalayan crest rather than the plain.
  { owner: 'neutral', name: 'Tibet', box: [79.0, 28.2, 97.0, 36.2] },
  { owner: 'neutral', name: 'Nepal', box: [80.2, 27.2, 88.2, 30.4] },
  { owner: 'neutral', name: 'Bhutan', box: [88.7, 26.7, 92.1, 28.4] },
  // Mongolia reaches furthest north in the west, around Khovsgol, and its
  // eastern border stops short of Hulunbuir. A single box to 52.5N and 120E
  // takes Irkutsk, Ulan-Ude, Chita, Urumqi and Hailar along with it.
  // Mongolia reaches 52N only in the middle, around Lake Khovsgol; squared off
  // at that latitude across its whole width it takes Irkutsk, Ulan-Ude and
  // Chita. Its southern edge climbs eastward, away from Chinese Inner Mongolia,
  // and it stops short of Hulunbuir in Manchukuo.
  // Tannu Tuva: a republic of its own on paper from 1921, a Soviet client in
  // fact, and annexed outright in 1944. It is not Mongolian, and it has to be
  // claimed ahead of Mongolia's western box to stay out of it.
  { owner: 'neutral', name: 'Tannu Tuva', box: [88.8, 49.9, 98.9, 52.3] },
  { owner: 'neutral', name: 'Mongolia (west)', box: [89.8, 44.8, 98.0, 50.2] },
  { owner: 'neutral', name: 'Mongolia (Khovsgol)', box: [98.0, 48.0, 102.5, 52.1] },
  { owner: 'neutral', name: 'Mongolia (central)', box: [98.0, 43.0, 108.0, 50.3] },
  { owner: 'neutral', name: 'Mongolia (east)', box: [108.0, 47.0, 116.5, 50.0] },
  { owner: 'neutral', name: 'Mongolia (Dornod)', box: [108.0, 45.0, 119.9, 47.0] },
  { owner: 'neutral', name: 'Mongolia (south-east)', box: [108.0, 42.2, 116.0, 45.0] },
  // Northern Borneo is British: Sarawak under the Brookes, the Brunei
  // protectorate, and British North Borneo under its chartered company. All of
  // it comes ahead of the East Indies box, which reaches to 6N and would
  // otherwise take Kuching, Sibu and Bintulu. The border with Dutch Borneo is a
  // watershed climbing to the north-east, so the boxes climb with it.
  { owner: 'uk', name: 'British Borneo (Kuching)', box: [109.5, 0.9, 111.2, 2.6] },
  { owner: 'uk', name: 'British Borneo (Sarawak)', box: [111.2, 1.6, 113.5, 4.2] },
  { owner: 'uk', name: 'British Borneo (Brunei)', box: [113.5, 2.4, 115.6, 5.2] },
  { owner: 'uk', name: 'British North Borneo', box: [115.0, 3.9, 119.4, 7.4] },
  { owner: 'neutral', name: 'Netherlands East Indies', box: [95.0, -11.0, 141.0, 6.0] },

  // Africa.
  { owner: 'neutral', name: 'Liberia', box: [-11.6, 4.2, -7.3, 8.6] },

  // The Belgian Congo, and the mandate of Ruanda-Urundi with it. Twelve boxes,
  // because the basin is a fan: widest along the Uele in the north, drawn in on
  // the west by the river that is its border with the French Congo, and running
  // south in a single arm to the Katanga copper. Every one of them comes ahead
  // of Angola, Rhodesia, British East Africa and French Equatorial Africa,
  // which are where these cells were before.
  //
  // Leopoldville and Brazzaville face each other across the Pool, 5 km apart,
  // and share a hex. It goes to the Congo, which held the larger city.
  { owner: 'neutral', name: 'Ruanda-Urundi', box: [28.9, -4.55, 31.0, -1.0] },
  { owner: 'neutral', name: 'Belgian Congo (Uele)', box: [19.0, 2.0, 27.8, 4.9] },
  { owner: 'neutral', name: 'Belgian Congo (Ituri)', box: [27.8, 1.0, 30.9, 3.7] },
  { owner: 'neutral', name: 'Belgian Congo (Kivu)', box: [27.8, -1.0, 29.9, 1.0] },
  { owner: 'neutral', name: 'Belgian Congo (Equateur)', box: [17.8, -1.0, 27.8, 2.0] },
  { owner: 'neutral', name: 'Belgian Congo', box: [16.3, -5.2, 29.4, -1.0] },
  { owner: 'neutral', name: 'Belgian Congo (Bas-Congo)', box: [12.2, -6.1, 16.3, -4.2] },
  { owner: 'neutral', name: 'Belgian Congo (Kwango)', box: [16.3, -6.9, 20.0, -5.2] },
  { owner: 'neutral', name: 'Belgian Congo (Kasai)', box: [20.0, -8.0, 24.5, -5.2] },
  { owner: 'neutral', name: 'Belgian Congo (Tanganyika)', box: [27.5, -8.0, 29.9, -5.2] },
  // Katanga in two steps: it meets Angola at 11.4S in the west and reaches
  // 12.4S in the east, around Elisabethville. The pedicle below that - the
  // finger of Congo that separates the Copperbelt from Luapula - is 60 km
  // wide and its tip lies within one hex of Ndola, so it is not drawn.
  { owner: 'neutral', name: 'Belgian Congo (Katanga)', box: [22.0, -11.4, 25.0, -8.0] },
  { owner: 'neutral', name: 'Belgian Congo (Katanga, east)', box: [25.0, -12.4, 30.0, -8.0] },

  { owner: 'neutral', name: 'Angola', box: [11.6, -18.1, 24.1, -4.3] },
  { owner: 'neutral', name: 'Mozambique', box: [30.2, -27.0, 41.0, -10.4] },
  { owner: 'neutral', name: 'Spanish Morocco and Rio de Oro', box: [-17.2, 20.7, -8.6, 27.7] },

  // Latin America, all of it.
  // The Rio Grande runs down from El Paso to Brownsville, so Mexico's northern
  // edge has to step south as it goes east. One box reaching 32.8N would take
  // the East Texas and Gulf Coast oilfields with it.
  { owner: 'neutral', name: 'Mexico (northwest)', box: [-118.5, 22.5, -108.0, 32.8] },
  { owner: 'neutral', name: 'Mexico (centre)', box: [-108.0, 16.0, -100.0, 30.0] },
  { owner: 'neutral', name: 'Mexico (southeast)', box: [-100.0, 14.4, -86.5, 26.5] },
  { owner: 'neutral', name: 'Central America', box: [-92.5, 7.0, -77.0, 18.6] },
  { owner: 'uk', name: 'The Bahamas', box: [-79.5, 22.5, -72.5, 27.2] },
  { owner: 'neutral', name: 'West Indies (Trinidad)', box: [-62.0, 10.0, -60.4, 11.4] },
  { owner: 'neutral', name: 'Venezuela', box: [-73.4, 0.6, -59.8, 12.2] },
  // Colombia reaches 4.2S only in the Leticia corridor on the Amazon. Squared
  // off at that latitude it covers almost all of Ecuador, Quito included, and
  // crosses the Putumayo into Peruvian Loreto.
  { owner: 'neutral', name: 'Colombia', box: [-79.1, 0.8, -75.0, 12.5] },
  { owner: 'neutral', name: 'Colombia (Amazonia)', box: [-75.0, -1.2, -66.9, 12.5] },
  { owner: 'neutral', name: 'Colombia (Putumayo)', box: [-77.6, 0.4, -75.0, 0.8] },
  { owner: 'neutral', name: 'Colombia (Leticia)', box: [-71.5, -4.3, -69.5, -1.2] },
  { owner: 'neutral', name: 'West Indies', box: [-85.0, 9.5, -59.0, 24.0] },
  { owner: 'neutral', name: 'Ecuador', box: [-81.0, -5.0, -75.0, 1.5] },
  // Peru's eastern edge bulges: 69.9W in Loreto, 68.65W where Madre de Dios
  // pushes furthest in, back to 69.4W at Titicaca. Held at 68.7W throughout it
  // reaches over the Andes and takes Cobija and the Bolivian lake shore.
  { owner: 'neutral', name: 'Peru (Loreto)', box: [-81.4, -6.0, -69.9, 0.0] },
  { owner: 'neutral', name: 'Peru (centre)', box: [-81.4, -11.5, -69.5, -6.0] },
  { owner: 'neutral', name: 'Peru (Madre de Dios)', box: [-81.4, -13.5, -68.65, -11.5] },
  { owner: 'neutral', name: 'Peru', box: [-77.0, -18.4, -69.4, -13.5] },
  { owner: 'neutral', name: 'Chile (Atacama)', box: [-70.5, -26.0, -68.6, -17.5] },
  { owner: 'neutral', name: 'Bolivia (Pando)', box: [-69.0, -13.0, -65.0, -10.9] },
  { owner: 'neutral', name: 'Bolivia (Beni)', box: [-69.4, -17.0, -60.0, -13.0] },
  { owner: 'neutral', name: 'Bolivia', box: [-68.6, -20.0, -57.7, -17.0] },
  { owner: 'neutral', name: 'Bolivia (Chaco)', box: [-68.5, -22.9, -62.0, -20.0] },
  { owner: 'neutral', name: 'Paraguay', box: [-62.6, -27.6, -54.3, -19.3] },
  { owner: 'neutral', name: 'Uruguay', box: [-58.2, -35.0, -53.0, -30.0] },
  { owner: 'neutral', name: 'Chile', box: [-73.5, -38.0, -69.8, -26.0] },
  { owner: 'neutral', name: 'Chile (Araucania)', box: [-76.0, -48.0, -71.6, -38.0] },
  { owner: 'neutral', name: 'Chile (Magellan)', box: [-76.0, -56.0, -69.5, -48.0] },
  { owner: 'neutral', name: 'Argentina', box: [-73.6, -55.0, -53.6, -21.8] },
  { owner: 'neutral', name: 'Brazil', box: [-74.0, -34.0, -34.0, 5.3] },

  // ========================= The Axis in Europe =============================
  // The Saar came back to Germany in 1935; Alsace-Lorraine was French until
  // 1940. Both sit inside the German box, so both are claimed ahead of it.
  //
  // Luxembourg has no entry of its own on purpose. The Grand Duchy, the French
  // Briey-Longwy basin and the Luxembourgish Minette all fall on one 125 km
  // hex, so the tile has to belong to somebody: it goes to France, which
  // worked the larger share of that orefield.
  { owner: 'germany', name: 'Saar', box: [6.4, 49.1, 7.4, 49.65] },
  { owner: 'france', name: 'Alsace-Lorraine', box: [5.9, 47.5, 8.3, 49.6] },

  { owner: 'germany', name: 'Germany', box: [5.8, 47.2, 16.3, 55.1] },
  { owner: 'germany', name: 'Austria', box: [9.5, 46.3, 17.2, 49.1] },

  // Italy is a long diagonal boot, and its bounding box takes in Nice and half
  // the French Riviera. Four boxes step down the peninsula instead.
  { owner: 'italy', name: 'Northern Italy', box: [7.0, 43.8, 13.9, 46.7] },
  { owner: 'italy', name: 'Central Italy', box: [9.8, 41.2, 16.3, 43.8] },
  { owner: 'italy', name: 'Southern Italy', box: [13.9, 37.7, 18.6, 41.2] },
  { owner: 'italy', name: 'Sicily', box: [12.2, 36.5, 15.8, 38.4] },
  { owner: 'italy', name: 'Libya', box: [9.3, 19.5, 25.2, 34.0] },

  // ===================== France and the French Empire =======================
  { owner: 'france', name: 'France', box: [-5.2, 42.3, 8.3, 51.1] },
  { owner: 'france', name: 'Algeria', box: [-2.3, 19.0, 9.0, 37.1] },
  { owner: 'france', name: 'Morocco', box: [-13.3, 27.6, -1.0, 36.0] },
  { owner: 'france', name: 'French Somaliland', box: [41.7, 10.9, 43.5, 12.8] },
  { owner: 'france', name: 'Madagascar', box: [43.1, -25.7, 50.6, -11.8] },
  { owner: 'france', name: 'French Indochina', box: [100.0, 8.4, 108.4, 23.4] },
  { owner: 'france', name: 'French Indochina (Annam)', box: [108.4, 10.5, 109.6, 17.0] },

  // ================ The United Kingdom and the Commonwealth =================
  // Africa first, so the British colonies are not absorbed by the French blocks
  // that surround them.
  { owner: 'uk', name: 'The Gambia', box: [-16.9, 13.05, -13.75, 13.85] },
  { owner: 'uk', name: 'Sierra Leone', box: [-13.4, 6.8, -10.25, 10.05] },
  { owner: 'uk', name: 'Gold Coast', box: [-3.3, 4.5, 1.3, 11.2] },
  { owner: 'uk', name: 'Nigeria', box: [2.6, 3.9, 14.0, 13.9] },
  // Egypt is sovereign too, by the treaty of 1936: a British garrison on the
  // Canal, and a king in Cairo. Anglo-Egyptian Sudan below it is a condominium
  // run from London and stays British, as do Palestine, Transjordan and Aden.
  { owner: 'neutral', name: 'Egypt', box: [24.6, 21.9, 36.9, 31.7] },
  { owner: 'uk', name: 'British East Africa', box: [28.9, -11.8, 42.0, 5.2] },
  { owner: 'uk', name: 'Rhodesia and Nyasaland', box: [21.9, -22.5, 33.7, -8.0] },
  { owner: 'uk', name: 'South Africa', box: [15.5, -35.0, 33.2, -21.9] },

  { owner: 'uk', name: 'India', box: [66.0, 6.5, 92.0, 36.5] },
  { owner: 'uk', name: 'Burma', box: [92.0, 9.5, 101.2, 28.6] },
  { owner: 'uk', name: 'Papua and New Guinea', box: [140.5, -11.7, 155.5, -1.0] },
  { owner: 'uk', name: 'Australia', box: [112.5, -44.0, 154.0, -10.0] },
  { owner: 'uk', name: 'New Zealand', box: [166.0, -47.5, 179.9, -34.0] },

  // North America. New England is claimed before the St Lawrence block, and
  // that block before the United States, so that Toronto and Montreal come out
  // Canadian without Maine and Vermont coming out Canadian too.
  { owner: 'uk', name: 'Canada (Ontario)', box: [-83.0, 43.3, -74.5, 52.0] },
  { owner: 'uk', name: 'Canada (Quebec)', box: [-74.5, 45.0, -64.0, 52.0] },
  { owner: 'usa', name: 'New England', box: [-73.5, 41.0, -66.9, 47.5] },
  // Vancouver Island reaches well south of the 49th parallel — Victoria sits at
  // 48.4N — so it has to be claimed before the United States box.
  { owner: 'uk', name: 'Vancouver Island', box: [-128.7, 48.3, -123.2, 51.0] },
  { owner: 'usa', name: 'United States', box: [-125, 24.4, -66.9, 49.0] },
  // The Bering Strait, west to east: Chukotka runs past the dateline into
  // negative longitudes, where a Soviet box measured eastward from 19E cannot
  // follow it, and it has to be claimed before Alaska or Uelen ends up
  // American. St Lawrence Island sits west of Chukotka's edge, so it is claimed
  // ahead of both.
  { owner: 'usa', name: 'St Lawrence Island', box: [-172.0, 62.8, -168.7, 63.9] },
  { owner: 'ussr', name: 'Chukotka', box: [-180.0, 60.0, -169.0, 72.0] },

  // Alaska stops at the 141st meridian, apart from the panhandle, which tapers
  // south-east along the coast with British Columbia and the Yukon just inland.
  // One box out to 129.5W took Whitehorse, Dawson City, Prince Rupert, Haida
  // Gwaii and Inuvik along with it.
  { owner: 'usa', name: 'Alaska', box: [-170, 51, -141.0, 71.6] },
  { owner: 'usa', name: 'Alaska Panhandle (north)', box: [-141.0, 58.2, -133.9, 60.2] },
  { owner: 'usa', name: 'Alaska Panhandle (south)', box: [-137.0, 54.6, -130.4, 58.2] },
  // The Aleutian chain runs past the dateline, where the Soviet box picks it up.
  { owner: 'usa', name: 'Western Aleutians', box: [172.0, 51.0, 180.0, 54.0] },
  { owner: 'uk', name: 'Newfoundland', box: [-59.5, 46.5, -52.5, 51.7] },
  { owner: 'uk', name: 'Canada', box: [-141, 41.7, -52, 83] },

  { owner: 'usa', name: 'Philippines', box: [116.5, 4.5, 127.0, 21.2] },

  // ================== Italian East Africa, after the British ================
  { owner: 'italy', name: 'Italian East Africa', box: [34.5, -1.7, 48.5, 18.1] },
  { owner: 'uk', name: 'Anglo-Egyptian Sudan', box: [21.8, 3.4, 38.6, 22.1] },
  { owner: 'france', name: 'French West Africa', box: [-17.6, 8.5, 4.3, 25.5] },
  { owner: 'france', name: 'French Equatorial Africa', box: [8.5, -5.1, 27.5, 23.5] },

  // ============================ Japan and Asia ==============================
  // Korea's northern border is the Yalu and the Tumen, which climb from 40N on
  // the west coast to 42.5N on the east, so it is stepped the same way. Ahead
  // of Japan, whose Kyushu box otherwise reaches across the strait to Busan.
  { owner: 'japan', name: 'Korea', box: [124.2, 33.9, 129.6, 40.2] },
  { owner: 'japan', name: 'Korea (north-west)', box: [124.2, 40.2, 126.5, 41.1] },
  { owner: 'japan', name: 'Korea (north-centre)', box: [126.5, 40.2, 128.3, 41.9] },
  { owner: 'japan', name: 'Korea (north-east)', box: [128.3, 40.2, 130.8, 42.5] },
  // The home islands, stepped so the box stops at the coast. One rectangle
  // from 128.3E to 146E reaches straight across the Sea of Japan and takes
  // north-east Korea and the Manchurian border country with it.
  { owner: 'japan', name: 'Japan (Kyushu and the west)', box: [128.3, 30.0, 136.0, 36.5] },
  { owner: 'japan', name: 'Japan', box: [134.0, 33.0, 142.5, 41.8] },
  { owner: 'japan', name: 'Japan (Hokkaido)', box: [139.2, 41.3, 146.0, 45.8] },
  { owner: 'japan', name: 'Ryukyu Islands', box: [122.9, 24.0, 131.0, 30.0] },
  { owner: 'japan', name: 'Kuril Islands', box: [145.0, 43.5, 157.0, 51.0] },
  { owner: 'japan', name: 'Formosa', box: [119.5, 21.7, 122.2, 25.4] },
  // Manchukuo is bounded by two rivers and neither runs straight. The Amur
  // falls away south-east, from 53N above Mohe down to 48N at Khabarovsk, so a
  // rectangle to 53.6N hands Manchukuo the whole Soviet Amur bank. The Ussuri
  // closes it in on the east, which the Maritime Province box holds already.
  { owner: 'japan', name: 'Manchukuo (Jehol)', box: [116.5, 40.5, 122.0, 43.5] },
  { owner: 'japan', name: 'Manchukuo (Liaodong)', box: [120.5, 38.7, 131.0, 43.5] },
  { owner: 'japan', name: 'Manchukuo', box: [119.0, 43.5, 133.0, 48.5] },
  { owner: 'japan', name: 'Manchukuo (Hulunbuir)', box: [115.6, 47.0, 125.0, 50.3] },
  { owner: 'japan', name: 'Manchukuo (Amur)', box: [121.0, 48.0, 128.0, 53.4] },
  // The Amur keeps bending: 49.6N at Poyarkovo, 48.9N at Pashkovo. Without
  // these two the river's inside curve falls through to the Soviet Union and
  // draws a red wedge into Heilongjiang.
  { owner: 'japan', name: 'Manchukuo (Amur bend)', box: [128.0, 48.0, 130.0, 49.9] },
  { owner: 'japan', name: 'Manchukuo (Lesser Khingan)', box: [130.0, 48.0, 132.5, 48.9] },
  // Mengjiang: Chahar and Suiyuan under Prince Demchugdongrub, proclaimed in
  // 1939 and Japanese in everything but name. It is not the Mongolian People's
  // Republic, which is independent, Soviet-aligned, and sits north of it - and
  // because the MPR's boxes are claimed with the neutrals, the border between
  // the two falls out of the order rather than having to be drawn. Ahead of
  // North China, which would otherwise take Kalgan and Guisui.
  { owner: 'japan', name: 'Mengjiang', box: [109.5, 40.0, 116.0, 42.4] },

  // Occupied China as the fighting stood on 1 September 1939: the north China
  // plain, the Yangtze up to Wuhan - which fell in October 1938 - Canton and
  // the Pearl River delta, and Hainan, taken that February. Chongqing and the
  // west are Nationalist and stay so.
  { owner: 'japan', name: 'North China', box: [110.0, 32.0, 122.5, 41.5] },
  { owner: 'japan', name: 'Wuhan', box: [113.2, 29.6, 115.0, 32.0] },
  { owner: 'japan', name: 'Lower Yangtze', box: [114.5, 27.5, 122.5, 33.0] },
  { owner: 'japan', name: 'Kwangtung', box: [111.5, 20.8, 117.5, 24.5] },
  { owner: 'japan', name: 'Hainan', box: [108.5, 18.1, 111.1, 20.2] },

  // Free China keeps the interior and the west. Xinjiang reaches well north of
  // the main box — Urumqi sits at 43.8N — so northern Dzungaria is claimed
  // separately, short of Soviet Kazakhstan to the west.
  { owner: 'china', name: 'China', box: [73.0, 20.0, 122.5, 42.5] },
  { owner: 'china', name: 'Northern Xinjiang', box: [79.5, 42.5, 98.0, 49.3] },
  { owner: 'china', name: 'Gansu Corridor', box: [94.0, 42.5, 100.0, 43.6] },
  { owner: 'china', name: 'Inner Mongolia', box: [111.0, 42.5, 119.5, 45.2] },

  // ===================== The Soviet Union, last in Eurasia ==================
  { owner: 'ussr', name: 'Soviet Union', box: [19.0, 35.0, 190.0, 82.0] },
];

/** The territory covering a point, or null where nobody claimed it. */
export function territoryAt(lat, lon) {
  for (let i = 0; i < TERRITORIES_1939.length; i += 1) {
    const [w, s, e, n] = TERRITORIES_1939[i].box;
    if (lon >= w && lon <= e && lat >= s && lat <= n) return TERRITORIES_1939[i];
  }
  return null;
}
