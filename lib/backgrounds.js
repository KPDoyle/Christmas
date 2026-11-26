const existingBackgrounds = [
  "Village Christmas carollers",
  "Victorian Christmas by the fireside",
  "Christmas Eve in London",
  "Dickensian London",
  "Victorian Christmas market",
  "Snowy coaching inn",
  "Cotswold Christmas",
  "Alpine chalets",
  "Paris at Christmas",
  "Dutch canal skating",
  "German market square",
  "Scandinavian harbour",
  "Victorian drawing room",
  "Toymaker workshop",
  "Gingerbread bakery",
  "Midnight cathedral",
  "Tudor Christmas feast",
  "Nutcracker ballet",
  "Christmas steam train",
  "Moonlit sleigh ride",
  "Winter conservatory",
  "Lanterns on the lake",
  "Snowbound lighthouse",
  "Northern lights cabin"
];

const traditional = [
  "Village Christmas carollers",
  "Victorian Christmas by the fireside",
  "Christmas Eve in London",
  "Victorian Christmas market",
  "Cotswold Christmas",
  "Paris at Christmas",
  "Gingerbread bakery",
  "Midnight cathedral",
  "Tudor Christmas feast",
  "Nutcracker ballet",
  "Christmas steam train",
  "Moonlit sleigh ride"
];

const modern = [
  "Manhattan Christmas plaza",
  "Christmas above the skyline",
  "City ice rink",
  "Scandinavian Christmas morning",
  "Golden light tunnel",
  "Pastel Christmas patisserie",
  "Rooftop Christmas party",
  "Alpine chalet fireside",
  "City Christmas night market",
  "Christmas on the promenade",
  "Starlit Christmas concert",
  "Townhouse Christmas tree"
];
export const backgroundGroups={'Traditional Christmas':traditional,'Modern Christmas':modern};
export const backgrounds=[...existingBackgrounds,...modern];
export const calendarBackgrounds=[...traditional,...modern];
export function rotationFor(scene){return Object.values(backgroundGroups).find(group=>group.includes(scene))||existingBackgrounds}
