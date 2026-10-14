// Slugs de las guías por país de Plonk It (plonkit.net/<slug>).
// Patrón verificado en la investigación de fuentes (2026-10-11).

export const PLONKIT_SLUGS: Record<string, string> = {
  no: 'norway', se: 'sweden', fi: 'finland', dk: 'denmark', is: 'iceland',
  ee: 'estonia', lv: 'latvia', lt: 'lithuania', pl: 'poland', de: 'germany',
  nl: 'netherlands', be: 'belgium', lu: 'luxembourg', fr: 'france', es: 'spain',
  pt: 'portugal', it: 'italy', ch: 'switzerland', at: 'austria', cz: 'czechia',
  sk: 'slovakia', hu: 'hungary', ro: 'romania', bg: 'bulgaria', gr: 'greece',
  hr: 'croatia', si: 'slovenia', rs: 'serbia', me: 'montenegro', mk: 'north-macedonia',
  al: 'albania', ua: 'ukraine', ru: 'russia', gb: 'united-kingdom', ie: 'ireland',
  // Georgia (ge) no tiene guía en Plonk It: cae al índice general.
  mt: 'malta', cy: 'cyprus', tr: 'turkey', il: 'israel-west-bank',
  jo: 'jordan', ae: 'united-arab-emirates', qa: 'qatar', kz: 'kazakhstan',
  kg: 'kyrgyzstan', mn: 'mongolia', in: 'india', lk: 'sri-lanka', bd: 'bangladesh',
  bt: 'bhutan', np: 'nepal', th: 'thailand', kh: 'cambodia', la: 'laos',
  vn: 'vietnam', my: 'malaysia', sg: 'singapore', id: 'indonesia', ph: 'philippines',
  jp: 'japan', kr: 'south-korea', tw: 'taiwan', hk: 'hong-kong', za: 'south-africa',
  ls: 'lesotho', sz: 'eswatini', bw: 'botswana', ke: 'kenya', ug: 'uganda',
  gh: 'ghana', ng: 'nigeria', sn: 'senegal', tn: 'tunisia', mg: 'madagascar',
  rw: 'rwanda', us: 'united-states', ca: 'canada', mx: 'mexico', gt: 'guatemala',
  do: 'dominican-republic', pa: 'panama', co: 'colombia', ec: 'ecuador',
  pe: 'peru', bo: 'bolivia', br: 'brazil', ar: 'argentina', cl: 'chile',
  uy: 'uruguay', au: 'australia', nz: 'new-zealand',
  tz: 'tanzania', cr: 'costa-rica', om: 'oman', pk: 'pakistan', lb: 'lebanon',
  by: 'belarus', eg: 'egypt', iq: 'iraq', ad: 'andorra', mc: 'monaco',
  li: 'liechtenstein', sm: 'san-marino', fo: 'faroe-islands', gl: 'greenland',
  im: 'isle-of-man', je: 'jersey', cw: 'curacao', mq: 'martinique',
  re: 'reunion', pr: 'puerto-rico', vu: 'vanuatu', mo: 'macau',
}

export function plonkitUrl(code: string): string {
  const slug = PLONKIT_SLUGS[code]
  return slug ? `https://www.plonkit.net/${slug}` : 'https://www.plonkit.net/guide'
}
