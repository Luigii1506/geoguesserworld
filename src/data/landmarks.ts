// Lugares reconocibles para el entrenamiento: imágenes en vivo desde Wikipedia
// (CC BY-SA). Las preguntas se generan en la vista Entrenar con los nombres de
// país de la base global.

export interface Landmark {
  id: string
  name: string
  /** Título del artículo en es.wikipedia.org (los redirects se resuelven solos). */
  wikiTitle: string
  country: string
  type: 'monumento' | 'ciudad' | 'natural'
  /** Qué lo hace reconocible desde Street View o en foto. */
  clue: string
  /** Tres países plausibles como distractores. */
  distractors: [string, string, string]
}

export const LANDMARKS: Landmark[] = [
  // ── Europa ──
  { id: 'torre-eiffel', name: 'Torre Eiffel', wikiTitle: 'Torre Eiffel', country: 'fr', type: 'monumento', clue: 'Celosía de hierro marrón; visible desde media ciudad de París.', distractors: ['be', 'es', 'it'] },
  { id: 'coliseo', name: 'Coliseo', wikiTitle: 'Coliseo', country: 'it', type: 'monumento', clue: 'Anfiteatro de arcos superpuestos con la mitad del anillo exterior caído.', distractors: ['gr', 'es', 'tr'] },
  { id: 'sagrada-familia', name: 'Sagrada Familia', wikiTitle: 'Sagrada Familia', country: 'es', type: 'monumento', clue: 'Torres cónicas con pináculos de mosaico y grúas eternas, Barcelona.', distractors: ['pt', 'fr', 'it'] },
  { id: 'torre-belem', name: 'Torre de Belém', wikiTitle: 'Torre de Belém', country: 'pt', type: 'monumento', clue: 'Torreón manuelino blanco a orillas del Tajo, Lisboa.', distractors: ['es', 'mt', 'gr'] },
  { id: 'big-ben', name: 'Big Ben', wikiTitle: 'Big Ben', country: 'gb', type: 'monumento', clue: 'Torre del reloj neogótica junto al Támesis y autobuses rojos.', distractors: ['ie', 'ca', 'au'] },
  { id: 'atomium', name: 'Atomium', wikiTitle: 'Atomium', country: 'be', type: 'monumento', clue: 'Nueve esferas de acero unidas en forma de cristal de hierro gigante.', distractors: ['nl', 'de', 'fr'] },
  { id: 'brandeburgo', name: 'Puerta de Brandeburgo', wikiTitle: 'Puerta de Brandeburgo', country: 'de', type: 'monumento', clue: 'Columnata neoclásica con cuadriga verde en lo alto, Berlín.', distractors: ['at', 'fr', 'ru'] },
  { id: 'san-basilio', name: 'Catedral de San Basilio', wikiTitle: 'Catedral de San Basilio', country: 'ru', type: 'monumento', clue: 'Cúpulas de cebolla multicolores junto a la muralla roja del Kremlin.', distractors: ['ua', 'kz', 'bg'] },
  { id: 'partenon', name: 'Partenón', wikiTitle: 'Partenón', country: 'gr', type: 'monumento', clue: 'Templo dórico de mármol sobre la Acrópolis de Atenas.', distractors: ['it', 'cy', 'tr'] },
  { id: 'santa-sofia', name: 'Santa Sofía', wikiTitle: 'Santa Sofía', country: 'tr', type: 'monumento', clue: 'Cúpula enorme rosada con cuatro minaretes, Estambul.', distractors: ['gr', 'ae', 'jo'] },
  { id: 'puente-carlos', name: 'Puente de Carlos', wikiTitle: 'Puente de Carlos', country: 'cz', type: 'monumento', clue: 'Puente gótico de piedra con estatuas ennegrecidas sobre el Moldava.', distractors: ['sk', 'hu', 'de'] },
  { id: 'parlamento-budapest', name: 'Parlamento de Budapest', wikiTitle: 'Parlamento de Budapest', country: 'hu', type: 'monumento', clue: 'Palacio neogótico de cúpula roja reflejado en el Danubio.', distractors: ['at', 'cz', 'ro'] },
  { id: 'palacio-cultura', name: 'Palacio de la Cultura y la Ciencia', wikiTitle: 'Palacio de la Cultura y la Ciencia', country: 'pl', type: 'monumento', clue: 'Rascacielos estalinista con aguja dominando Varsovia.', distractors: ['ru', 'ua', 'lv'] },
  { id: 'hallgrimskirkja', name: 'Hallgrímskirkja', wikiTitle: 'Hallgrímskirkja', country: 'is', type: 'monumento', clue: 'Iglesia de hormigón con alas escalonadas como columnas de basalto.', distractors: ['no', 'dk', 'fi'] },
  { id: 'geirangerfjord', name: 'Fiordo de Geiranger', wikiTitle: 'Fiordo de Geiranger', country: 'no', type: 'natural', clue: 'Fiordo estrecho con cascadas cayendo de paredes verticales.', distractors: ['is', 'nz', 'cl'] },
  { id: 'gamla-stan', name: 'Gamla stan', wikiTitle: 'Gamla stan', country: 'se', type: 'ciudad', clue: 'Casco viejo de fachadas ocres y callejones adoquinados sobre islas.', distractors: ['dk', 'no', 'ee'] },
  { id: 'nyhavn', name: 'Nyhavn', wikiTitle: 'Nyhavn', country: 'dk', type: 'ciudad', clue: 'Canal con casas de colores y veleros amarrados, Copenhague.', distractors: ['nl', 'se', 'no'] },
  { id: 'catedral-helsinki', name: 'Catedral de Helsinki', wikiTitle: 'Catedral de Helsinki', country: 'fi', type: 'monumento', clue: 'Catedral blanca de cúpulas verdes sobre una escalinata monumental.', distractors: ['ee', 'ru', 'se'] },
  { id: 'moher', name: 'Acantilados de Moher', wikiTitle: 'Acantilados de Moher', country: 'ie', type: 'natural', clue: 'Paredón verde-negro cortado a pico sobre el Atlántico.', distractors: ['gb', 'is', 'pt'] },
  { id: 'schonbrunn', name: 'Palacio de Schönbrunn', wikiTitle: 'Palacio de Schönbrunn', country: 'at', type: 'monumento', clue: 'Palacio barroco amarillo imperial con jardines geométricos, Viena.', distractors: ['de', 'hu', 'fr'] },
  { id: 'cervino', name: 'Cervino (Matterhorn)', wikiTitle: 'Cervino', country: 'ch', type: 'natural', clue: 'Pirámide de roca torcida e inconfundible sobre Zermatt.', distractors: ['at', 'fr', 'it'] },
  { id: 'molinos-kinderdijk', name: 'Molinos de Kinderdijk', wikiTitle: 'Molinos de Kinderdijk', country: 'nl', type: 'monumento', clue: 'Hilera de molinos de viento junto a canales llanos.', distractors: ['be', 'dk', 'de'] },
  { id: 'bled', name: 'Lago de Bled', wikiTitle: 'Lago de Bled', country: 'si', type: 'natural', clue: 'Lago alpino turquesa con islita e iglesia en el centro.', distractors: ['at', 'ch', 'hr'] },
  { id: 'diocleciano', name: 'Palacio de Diocleciano', wikiTitle: 'Palacio de Diocleciano', country: 'hr', type: 'monumento', clue: 'Ruinas romanas integradas en el casco de Split, junto al Adriático.', distractors: ['it', 'gr', 'me'] },
  { id: 'bran', name: 'Castillo de Bran', wikiTitle: 'Castillo de Bran', country: 'ro', type: 'monumento', clue: 'Castillo de torres puntiagudas en un risco de Transilvania ("de Drácula").', distractors: ['hu', 'sk', 'bg'] },
  { id: 'rila', name: 'Monasterio de Rila', wikiTitle: 'Monasterio de Rila', country: 'bg', type: 'monumento', clue: 'Monasterio de arcos a rayas blancas y negras en plena montaña.', distractors: ['gr', 'rs', 'mk'] },
  { id: 'san-sava', name: 'Templo de San Sava', wikiTitle: 'Templo de San Sava', country: 'rs', type: 'monumento', clue: 'Iglesia ortodoxa blanca gigantesca de cúpula verde, Belgrado.', distractors: ['bg', 'mk', 'ru'] },
  { id: 'kotor', name: 'Bahía de Kotor', wikiTitle: 'Bahía de Kotor', country: 'me', type: 'natural', clue: 'Fiordo mediterráneo entre montañas con pueblos de piedra.', distractors: ['hr', 'al', 'gr'] },
  { id: 'kiev-pecherska', name: 'Monasterio de las Cuevas', wikiTitle: 'Monasterio de las Cuevas de Kiev', country: 'ua', type: 'monumento', clue: 'Campanarios dorados y muros blancos sobre el río Dniéper.', distractors: ['ru', 'bg', 'rs'] },
  { id: 'tiflis', name: 'Casco viejo de Tiflis', wikiTitle: 'Tiflis', country: 'ge', type: 'ciudad', clue: 'Balcones de madera tallada colgando sobre calles empinadas.', distractors: ['tr', 'ru', 'bg'] },

  // ── Asia ──
  { id: 'fuji', name: 'Monte Fuji', wikiTitle: 'Monte Fuji', country: 'jp', type: 'natural', clue: 'Cono volcánico simétrico nevado, a menudo tras torres eléctricas.', distractors: ['kr', 'tw', 'id'] },
  { id: 'fushimi-inari', name: 'Fushimi Inari-taisha', wikiTitle: 'Fushimi Inari-taisha', country: 'jp', type: 'monumento', clue: 'Túnel de miles de torii rojos en ladera, Kioto.', distractors: ['kr', 'tw', 'th'] },
  { id: 'gyeongbokgung', name: 'Gyeongbokgung', wikiTitle: 'Gyeongbokgung', country: 'kr', type: 'monumento', clue: 'Palacio de tejados verdes con guardias de colores y rascacielos detrás.', distractors: ['jp', 'tw', 'hk'] },
  { id: 'taipei-101', name: 'Taipei 101', wikiTitle: 'Taipei 101', country: 'tw', type: 'monumento', clue: 'Rascacielos en segmentos apilados como pagoda de cristal verde.', distractors: ['hk', 'sg', 'my'] },
  { id: 'gran-palacio', name: 'Gran Palacio de Bangkok', wikiTitle: 'Gran Palacio de Bangkok', country: 'th', type: 'monumento', clue: 'Chedis dorados y tejados escalonados naranjas y verdes.', distractors: ['kh', 'la', 'vn'], },
  { id: 'angkor', name: 'Angkor Wat', wikiTitle: 'Angkor Wat', country: 'kh', type: 'monumento', clue: 'Cinco torres de piña de piedra gris reflejadas en un foso.', distractors: ['th', 'la', 'in'] },
  { id: 'pha-that-luang', name: 'Pha That Luang', wikiTitle: 'Pha That Luang', country: 'la', type: 'monumento', clue: 'Estupa dorada puntiaguda rodeada de claustro, Vientián.', distractors: ['th', 'kh', 'mn'] },
  { id: 'halong', name: 'Bahía de Ha Long', wikiTitle: 'Bahía de Ha Long', country: 'vn', type: 'natural', clue: 'Centenares de islotes kársticos verticales saliendo del mar verde.', distractors: ['th', 'ph', 'id'] },
  { id: 'petronas', name: 'Torres Petronas', wikiTitle: 'Torres Petronas', country: 'my', type: 'monumento', clue: 'Torres gemelas plateadas unidas por un puente a media altura.', distractors: ['sg', 'ae', 'id'] },
  { id: 'marina-bay', name: 'Marina Bay Sands', wikiTitle: 'Marina Bay Sands', country: 'sg', type: 'monumento', clue: 'Tres torres con un "barco" de hormigón cruzado en la azotea.', distractors: ['my', 'ae', 'hk'] },
  { id: 'borobudur', name: 'Borobudur', wikiTitle: 'Borobudur', country: 'id', type: 'monumento', clue: 'Pirámide budista de estupas acampanadas entre volcanes de Java.', distractors: ['kh', 'th', 'in'] },
  { id: 'taj-mahal', name: 'Taj Mahal', wikiTitle: 'Taj Mahal', country: 'in', type: 'monumento', clue: 'Mausoleo de mármol blanco con cúpula bulbosa y cuatro minaretes.', distractors: ['bd', 'ae', 'tr'] },
  { id: 'sigiriya', name: 'Sigiriya', wikiTitle: 'Sigiriya', country: 'lk', type: 'natural', clue: 'Peñón naranja plano con palacio en la cima sobre la selva.', distractors: ['in', 'th', 'au'] },
  { id: 'boudhanath', name: 'Estupa de Boudhanath', wikiTitle: 'Boudhanath', country: 'np', type: 'monumento', clue: 'Cúpula blanca con ojos de Buda pintados y banderas de oración.', distractors: ['bt', 'in', 'mn'] },
  { id: 'taktshang', name: 'Nido del Tigre (Taktshang)', wikiTitle: 'Taktshang', country: 'bt', type: 'monumento', clue: 'Monasterio blanco colgado de un acantilado entre pinos.', distractors: ['np', 'in', 'kg'] },
  { id: 'burj-khalifa', name: 'Burj Khalifa', wikiTitle: 'Burj Khalifa', country: 'ae', type: 'monumento', clue: 'La aguja escalonada más alta del mundo sobre autopistas de desierto.', distractors: ['qa', 'sg', 'my'] },
  { id: 'petra', name: 'Petra', wikiTitle: 'Petra', country: 'jo', type: 'monumento', clue: 'Fachada del Tesoro tallada en roca rosa al final de un desfiladero.', distractors: ['il', 'tn', 'ae'] },
  { id: 'cupula-roca', name: 'Cúpula de la Roca', wikiTitle: 'Cúpula de la Roca', country: 'il', type: 'monumento', clue: 'Cúpula dorada sobre octógono de azulejos azules, Jerusalén.', distractors: ['jo', 'tr', 'ae'] },
  { id: 'gengis-kan', name: 'Estatua ecuestre de Gengis Kan', wikiTitle: 'Estatua ecuestre de Gengis Kan', country: 'mn', type: 'monumento', clue: 'Jinete plateado colosal plantado en mitad de la estepa.', distractors: ['kz', 'kg', 'ru'] },
  { id: 'bayterek', name: 'Bayterek', wikiTitle: 'Bayterek', country: 'kz', type: 'monumento', clue: 'Torre blanca con esfera dorada en la cima, Astaná.', distractors: ['mn', 'ae', 'ru'] },

  // ── África ──
  { id: 'montana-mesa', name: 'Montaña de la Mesa', wikiTitle: 'Montaña de la Mesa', country: 'za', type: 'natural', clue: 'Cumbre totalmente plana presidiendo Ciudad del Cabo.', distractors: ['au', 'ke', 'br'] },
  { id: 'baobabs', name: 'Avenida de los Baobabs', wikiTitle: 'Avenida de los Baobabs', country: 'mg', type: 'natural', clue: 'Baobabs gigantes de tronco liso flanqueando una pista de tierra roja.', distractors: ['sn', 'bw', 'ke'] },
  { id: 'monte-kenia', name: 'Monte Kenia', wikiTitle: 'Monte Kenia', country: 'ke', type: 'natural', clue: 'Picos rocosos con glaciares residuales sobre la sabana.', distractors: ['ug', 'za', 'np'] },
  { id: 'el-jem', name: 'Anfiteatro de El Jem', wikiTitle: 'Anfiteatro de El Djem', country: 'tn', type: 'monumento', clue: 'Coliseo romano casi intacto en mitad de un pueblo tunecino.', distractors: ['it', 'jo', 'gr'] },
  { id: 'elmina', name: 'Castillo de Elmina', wikiTitle: 'Castillo de Elmina', country: 'gh', type: 'monumento', clue: 'Fortaleza colonial blanca sobre el Atlántico con barcas pesqueras.', distractors: ['sn', 'ng', 'za'] },
  { id: 'zuma-rock', name: 'Zuma Rock', wikiTitle: 'Zuma Rock', country: 'ng', type: 'natural', clue: 'Monolito gris enorme junto a la carretera a Abuya.', distractors: ['gh', 'ke', 'au'] },
  { id: 'lago-retba', name: 'Lago Rosa (Retba)', wikiTitle: 'Lago Retba', country: 'sn', type: 'natural', clue: 'Lago de aguas rosadas con montañas de sal en la orilla.', distractors: ['tn', 'ke', 'bo'] },
  { id: 'okavango', name: 'Delta del Okavango', wikiTitle: 'Delta del Okavango', country: 'bw', type: 'natural', clue: 'Canales y islas verdes vistos a ras de mokoro (canoa).', distractors: ['za', 'ke', 'ug'] },

  // ── América ──
  { id: 'libertad', name: 'Estatua de la Libertad', wikiTitle: 'Estatua de la Libertad', country: 'us', type: 'monumento', clue: 'Figura verde con antorcha en la bahía de Nueva York.', distractors: ['ca', 'fr', 'br'] },
  { id: 'golden-gate', name: 'Golden Gate', wikiTitle: 'Puente Golden Gate', country: 'us', type: 'monumento', clue: 'Puente colgante rojo-anaranjado entre nieblas, San Francisco.', distractors: ['ca', 'au', 'jp'] },
  { id: 'torre-cn', name: 'Torre CN', wikiTitle: 'Torre CN', country: 'ca', type: 'monumento', clue: 'Aguja de hormigón con plato mirador sobre el lago Ontario.', distractors: ['us', 'au', 'de'] },
  { id: 'angel-independencia', name: 'Ángel de la Independencia', wikiTitle: 'Monumento a la Independencia (México)', country: 'mx', type: 'monumento', clue: 'Columna con ángel dorado en plena avenida Reforma.', distractors: ['ar', 'co', 'es'] },
  { id: 'chichen-itza', name: 'Chichén Itzá', wikiTitle: 'Chichén Itzá', country: 'mx', type: 'monumento', clue: 'Pirámide escalonada de Kukulcán con templo plano en la cima.', distractors: ['gt', 'pe', 'ec'] },
  { id: 'tikal', name: 'Tikal', wikiTitle: 'Tikal', country: 'gt', type: 'monumento', clue: 'Pirámides mayas de crestas altas asomando sobre la selva.', distractors: ['mx', 'pe', 'kh'] },
  { id: 'canal-panama', name: 'Canal de Panamá', wikiTitle: 'Canal de Panamá', country: 'pa', type: 'monumento', clue: 'Esclusas gigantes con buques portacontenedores entre selva.', distractors: ['co', 'mx', 'tn'] },
  { id: 'cristo-redentor', name: 'Cristo Redentor', wikiTitle: 'Cristo Redentor', country: 'br', type: 'monumento', clue: 'Cristo de brazos abiertos sobre el Corcovado y la bahía de Río.', distractors: ['ar', 'pt', 'co'] },
  { id: 'machu-picchu', name: 'Machu Picchu', wikiTitle: 'Machu Picchu', country: 'pe', type: 'monumento', clue: 'Terrazas incas con el pico Huayna Picchu detrás.', distractors: ['bo', 'ec', 'co'] },
  { id: 'uyuni', name: 'Salar de Uyuni', wikiTitle: 'Salar de Uyuni', country: 'bo', type: 'natural', clue: 'Desierto de sal blanco infinito que se vuelve espejo con lluvia.', distractors: ['cl', 'ar', 'pe'] },
  { id: 'moai', name: 'Moáis de Rapa Nui', wikiTitle: 'Moái', country: 'cl', type: 'monumento', clue: 'Cabezas de piedra gigantes alineadas frente al Pacífico.', distractors: ['pe', 'mx', 'id'] },
  { id: 'obelisco-ba', name: 'Obelisco de Buenos Aires', wikiTitle: 'Obelisco de Buenos Aires', country: 'ar', type: 'monumento', clue: 'Obelisco blanco en la avenida más ancha del mundo (9 de Julio).', distractors: ['uy', 'cl', 'us'] },
  { id: 'palacio-salvo', name: 'Palacio Salvo', wikiTitle: 'Palacio Salvo', country: 'uy', type: 'monumento', clue: 'Torre ecléctica y recargada presidiendo la Plaza Independencia.', distractors: ['ar', 'br', 'es'] },
  { id: 'mitad-mundo', name: 'Mitad del Mundo', wikiTitle: 'Ciudad Mitad del Mundo', country: 'ec', type: 'monumento', clue: 'Monolito con globo terráqueo sobre la línea ecuatorial.', distractors: ['co', 'pe', 'bo'] },
  { id: 'zipaquira', name: 'Catedral de Sal de Zipaquirá', wikiTitle: 'Catedral de Sal de Zipaquirá', country: 'co', type: 'monumento', clue: 'Catedral subterránea excavada en una mina de sal iluminada.', distractors: ['ec', 'pe', 'bo'] },
  { id: 'valparaiso', name: 'Cerros de Valparaíso', wikiTitle: 'Valparaíso', country: 'cl', type: 'ciudad', clue: 'Colinas cubiertas de casas de colores y murales sobre el puerto.', distractors: ['ar', 'co', 'pt'] },
  { id: 'cartagena', name: 'Cartagena de Indias', wikiTitle: 'Cartagena de Indias', country: 'co', type: 'ciudad', clue: 'Murallas coloniales y balcones de madera floridos en el Caribe.', distractors: ['mx', 'pa', 'do'] },
  { id: 'cuzco', name: 'Cuzco', wikiTitle: 'Cuzco', country: 'pe', type: 'ciudad', clue: 'Muros incas de piedra perfecta bajo balcones coloniales.', distractors: ['bo', 'ec', 'mx'] },
  { id: 'guanajuato', name: 'Guanajuato', wikiTitle: 'Guanajuato', country: 'mx', type: 'ciudad', clue: 'Casas de colores apiladas en un valle con callejones y túneles.', distractors: ['gt', 'co', 'es'] },

  // ── Oceanía ──
  { id: 'opera-sidney', name: 'Ópera de Sídney', wikiTitle: 'Ópera de Sídney', country: 'au', type: 'monumento', clue: 'Velas blancas de hormigón sobre la bahía con el Harbour Bridge.', distractors: ['nz', 'sg', 'us'] },
  { id: 'uluru', name: 'Uluru', wikiTitle: 'Uluru', country: 'au', type: 'natural', clue: 'Monolito rojo gigante en mitad del desierto australiano.', distractors: ['us', 'za', 'mn'] },
  { id: 'hobbiton', name: 'Hobbiton', wikiTitle: 'Hobbiton', country: 'nz', type: 'monumento', clue: 'Puertas redondas de colores en colinas verdes de película.', distractors: ['au', 'ie', 'gb'] },
  { id: 'milford', name: 'Milford Sound', wikiTitle: 'Milford Sound', country: 'nz', type: 'natural', clue: 'Fiordo con el pico Mitre saliendo vertical del agua oscura.', distractors: ['no', 'cl', 'ca'] },

  // ── Ciudades europeas reconocibles ──
  { id: 'venecia', name: 'Venecia', wikiTitle: 'Venecia', country: 'it', type: 'ciudad', clue: 'Canales con góndolas y palacios desconchados al nivel del agua.', distractors: ['nl', 'gr', 'hr'] },
  { id: 'dubrovnik', name: 'Dubrovnik', wikiTitle: 'Dubrovnik', country: 'hr', type: 'ciudad', clue: 'Ciudad amurallada de tejados naranjas sobre el Adriático.', distractors: ['me', 'gr', 'it'] },
  { id: 'san-petersburgo', name: 'San Petersburgo', wikiTitle: 'San Petersburgo', country: 'ru', type: 'ciudad', clue: 'Palacios pastel junto a canales y la iglesia del Salvador de cúpulas de colores.', distractors: ['ua', 'lv', 'fi'] },
  { id: 'luang-prabang', name: 'Luang Prabang', wikiTitle: 'Luang Prabang', country: 'la', type: 'ciudad', clue: 'Templos dorados y casas coloniales francesas junto al Mekong.', distractors: ['th', 'kh', 'vn'] },
]

// Validación en desarrollo: distractores con códigos válidos y sin duplicados.
if (import.meta.env.DEV) {
  const seen = new Set<string>()
  for (const l of LANDMARKS) {
    if (seen.has(l.id)) console.warn(`[GeoMastery] Landmark duplicado: ${l.id}`)
    seen.add(l.id)
  }
}

export const LANDMARK_MAP = new Map(LANDMARKS.map((l) => [l.id, l]))
