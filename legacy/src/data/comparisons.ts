import type { Comparison } from './types'

// Atlas comparativo: países que se confunden entre sí, cara a cara.
// Regla: cuando una fila no separa de verdad, se marca overlap y se dice.

export const COMPARISONS: Comparison[] = [
  {
    id: 'nordicos',
    title: 'Suecia vs Noruega vs Finlandia',
    countries: ['se', 'no', 'fi'],
    intro:
      'El trío más confundido de Europa: mismo bosque boreal, casas rojas y carreteras impecables. Se separan con tres pistas mecánicas antes que con el paisaje.',
    rows: [
      {
        category: 'Línea central',
        cells: ['Blanca', 'AMARILLA', 'Blanca (amarilla en cobertura vieja)'],
        note: 'La pista más rápida del trío.',
      },
      {
        category: 'Señales de advertencia',
        cells: ['Fondo amarillo', 'Fondo amarillo', 'Fondo amarillo'],
        overlap: true,
        note: 'No separa entre ellos; solo descarta Dinamarca (fondo blanco).',
      },
      {
        category: 'Letras delatoras',
        cells: ['ö, ä', 'ø, æ, å', 'ä, ö + vocales dobles (aa, ii)'],
        note: '"vägen/gatan" sueco; "veien/gata" noruego; "tie/katu" finés.',
      },
      {
        category: 'Relieve',
        cells: ['Ondulado suave', 'Fiordos, montañas, túneles', 'Llano con miles de lagos'],
      },
      {
        category: 'Carretera típica',
        cells: ['2+1 con barrera de cable', 'Túneles y quitamiedos de roca', 'Rectas entre bosque llano'],
      },
      {
        category: 'Idioma secundario en señales',
        cells: ['Rara vez', 'Rara vez (sami en el norte)', 'Sueco en la costa (bilingüe)'],
        note: 'Un cartel bilingüe finés/sueco fija Finlandia.',
      },
      {
        category: 'Arquitectura',
        cells: ['Rojo falu + esquinas blancas', 'Madera blanca frecuente', 'Rojo falu similar al sueco'],
        overlap: true,
      },
    ],
    verdict:
      'Orden de decisión: (1) color de línea central, (2) ø/æ contra ö/ä, (3) fiordos o lagos. Si hay bilingüe sueco-finés, es Finlandia costera.',
    relatedClues: ['nordicos-linea-central', 'dano-noruego-vs-sueco', 'fines-estonio', 'suecia-2mas1', 'falu-rojo-nordico'],
  },
  {
    id: 'austria-eslovenia',
    title: 'Austria vs Eslovenia',
    countries: ['at', 'si'],
    intro:
      'Mismos Alpes, mismos prados, iglesias parecidas de campanario puntiagudo. El idioma es la llave; la infraestructura ayuda.',
    rows: [
      {
        category: 'Idioma',
        cells: ['Alemán (ß, ü, compuestas largas)', 'Esloveno (č, š, ž; palabras cortas)'],
        note: 'Una palabra basta: "Ausfahrt" vs "Izhod".',
      },
      {
        category: 'Paisaje',
        cells: ['Alpino, valles amplios', 'Alpino + karst; más bosque continuo'],
        overlap: true,
        note: 'No intentes separarlos por la montaña: es el mismo sistema.',
      },
      {
        category: 'Carteles de autopista',
        cells: ['Azules', 'Verdes'],
        note: 'Eslovenia sigue el modelo italiano (verde = autopista).',
      },
      {
        category: 'Matrículas',
        cells: ['Franja azul UE con escudo', 'Franja azul UE'],
        overlap: true,
      },
      {
        category: 'Cobertura (meta)',
        cells: ['Histórica escasa, renovada reciente', 'Cobertura normal'],
        note: 'Imagen vieja y rara en zona alpina inclina a Austria.',
      },
    ],
    verdict:
      'Busca texto: alemán → Austria, esloveno → Eslovenia. Sin texto, el color del cartel de autopista (azul vs verde) decide.',
    relatedClues: ['bolardo-aleman-austriaco', 'colores-carteles-autopista', 'alemania-cobertura'],
  },
  {
    id: 'uruguay-argentina',
    title: 'Uruguay vs Argentina',
    countries: ['uy', 'ar'],
    intro:
      'Pampa, mate, PARE y español rioplatense a ambos lados del río. Separarlos es cuestión de relieve, rutas y detalles de banquina.',
    rows: [
      {
        category: 'Relieve',
        cells: ['Lomas suaves ("cuchillas"), afloramientos de piedra', 'Llanura pampeana totalmente plana (centro)'],
        note: 'Si el horizonte ondula, piensa Uruguay.',
      },
      {
        category: 'Numeración de rutas',
        cells: ['"Ruta N°" en carteles sencillos', 'RN (nacional) / RP (provincial) en carteles verdes'],
      },
      {
        category: 'Santuarios de carretera',
        cells: ['Poco frecuentes', 'Gauchito Gil (rojo) y Difunta Correa frecuentes'],
        note: 'Mancha roja en la banquina → Argentina.',
      },
      {
        category: 'Matrículas',
        cells: ['Mercosur con banda azul', 'Mercosur con banda azul (viejas negras)'],
        overlap: true,
      },
      {
        category: 'Vegetación',
        cells: ['Palmeras butiá sueltas, pradera', 'Álamos y eucaliptos cortavientos, pampa'],
        overlap: true,
        note: 'Tendencia, no regla.',
      },
      {
        category: 'Escala del país',
        cells: ['Distancias cortas, todo cerca de la costa', 'Patagonia árida, Andes, subtrópico: enorme variedad'],
        note: 'Desierto patagónico o montaña seca → Argentina seguro.',
      },
    ],
    verdict:
      'Horizonte ondulado y piedra → Uruguay. Santuario rojo, cartel RN/RP o paisaje extremo (Patagonia/Andes) → Argentina.',
    relatedClues: ['pampa-uy-ar', 'gauchito-gil', 'matricula-mercosur'],
  },
  {
    id: 'sudafrica-australia',
    title: 'Sudáfrica vs Australia',
    countries: ['za', 'au'],
    intro:
      'Ambos conducen por la izquierda, con interior seco, cercas infinitas y luz dura. El error clásico del hemisferio sur.',
    rows: [
      {
        category: 'Señales de advertencia',
        cells: ['Triángulo (convención de Viena)', 'Rombo amarillo'],
        note: 'La diferencia más fiable y visible.',
      },
      {
        category: 'Idiomas en carteles',
        cells: ['Inglés + afrikáans ("straat", "weg")', 'Solo inglés'],
        note: 'Afrikáans visto → Sudáfrica.',
      },
      {
        category: 'Vegetación',
        cells: ['Veld de hierba dorada, fynbos, aloes', 'Eucaliptos, bush gris-verde'],
        note: 'Corteza pelada de eucalipto → Australia (pero hay eucaliptos plantados en ZA).',
        overlap: true,
      },
      {
        category: 'Numeración vial',
        cells: ['N1, R44 en carteles verdes', 'M/A/B o alfanumérica por estado'],
      },
      {
        category: 'Entorno social visible',
        cells: ['Townships, vendedores, gente caminando', 'Carreteras vacías, roadtrains, buzones'],
        note: 'La densidad de peatones en carretera es mayor en Sudáfrica.',
      },
    ],
    verdict:
      'Primera comprobación: forma de la señal de advertencia (triángulo = ZA, rombo = AU). Después afrikáans y tipo de matorral.',
    relatedClues: ['advertencia-rombo-amarillo', 'eucaliptos-australia', 'fynbos-cabo', 'izquierda-mundo'],
  },
  {
    id: 'tailandia-camboya',
    title: 'Tailandia vs Camboya (y Laos)',
    countries: ['th', 'kh', 'la'],
    intro:
      'Trópico continental con arrozales y pagodas. Dos pistas mecánicas lo resuelven casi siempre: el lado de conducción y la escritura.',
    rows: [
      {
        category: 'Sentido de circulación',
        cells: ['IZQUIERDA', 'Derecha', 'Derecha'],
        note: 'Lo primero que hay que mirar.',
      },
      {
        category: 'Escritura',
        cells: ['Tailandesa: circulitos, compacta', 'Jemer: alta, picuda, apilada', 'Lao: redondeada y simple'],
      },
      {
        category: 'Infraestructura',
        cells: ['Asfalto bueno, postes cuadrados de hormigón', 'Polvo rojo, carreteras más pobres', 'Mixta, tranquila'],
        overlap: true,
      },
      {
        category: 'Cultura visible',
        cells: ['Casas de espíritus, retratos reales', 'Banderas con Angkor, menos parafernalia', 'Hoz y martillo ocasional'],
        note: 'La casa de espíritus elaborada es sobre todo tailandesa.',
      },
      {
        category: 'Vehículos',
        cells: ['Pickups y tuk-tuks', 'Motos y remolques artesanales', 'Motos, tráfico escaso'],
        overlap: true,
      },
    ],
    verdict:
      'Conducción izquierda → Tailandia, fin. Si van por la derecha: escritura picuda y polvo rojo → Camboya; redondeada y poco tráfico → Laos.',
    relatedClues: ['vecinos-sentido-opuesto', 'tailandes-lao-jemer-birmano', 'casas-espiritus'],
  },
  {
    id: 'balticos',
    title: 'Estonia vs Letonia vs Lituania',
    countries: ['ee', 'lv', 'lt'],
    intro:
      'Bosque mixto, carreteras de grava y pasado soviético compartido. Las letras y los sufijos de calle los separan sin fallar.',
    rows: [
      {
        category: 'Letras delatoras',
        cells: ['õ (única), vocales dobles', 'Macrones: ā, ē, ī, ū', 'ė, ų, č sin macrones largos'],
      },
      {
        category: 'Palabra "calle"',
        cells: ['tänav', 'iela', 'gatvė'],
        note: 'Sufijo visto, país resuelto.',
      },
      {
        category: 'Parecido lingüístico',
        cells: ['Al finés', 'Al lituano', 'Al letón'],
        note: 'Estonio ≠ familia báltica: si "suena a finés", es Estonia.',
      },
      {
        category: 'Paisaje',
        cells: ['Boreal, costa con islas', 'Bosque y campo llano', 'Agrícola, algo más próspero'],
        overlap: true,
        note: 'No separes bálticos por paisaje: es casi idéntico.',
      },
    ],
    verdict:
      'Busca una placa de calle o un cartel: õ/tänav → Estonia; macrón/iela → Letonia; ė/gatvė → Lituania.',
    relatedClues: ['iela-baltico', 'letonia-macrones', 'fines-estonio'],
  },
  {
    id: 'chequia-eslovaquia',
    title: 'Chequia vs Eslovaquia',
    countries: ['cz', 'sk'],
    intro:
      'Mismo bolardo naranja, misma estética centroeuropea. La ortografía es el bisturí.',
    rows: [
      {
        category: 'Letras exclusivas',
        cells: ['ř, ů, ě', 'ľ, ĺ, ŕ, ô, ä'],
        note: 'Una letra basta; ř es la firma checa, ľ la eslovaca.',
      },
      {
        category: 'Relieve',
        cells: ['Colinas suaves de Bohemia/Moravia', 'Tatras y valles más abruptos'],
        overlap: true,
      },
      {
        category: 'Forma de los pueblos',
        cells: ['Compactos alrededor de plaza', 'Pueblo-calle alargado'],
        overlap: true,
        note: 'Tendencia útil solo como apoyo.',
      },
      {
        category: 'Bolardo',
        cells: ['Blanco con banda naranja', 'Blanco con banda naranja'],
        overlap: true,
        note: 'Idéntico: sirve para la pareja, no para separarla.',
      },
    ],
    verdict:
      'Lee cualquier texto buscando ř/ů (Chequia) o ľ/ô (Eslovaquia). Sin texto, montaña grande inclina a Eslovaquia.',
    relatedClues: ['checo-vs-eslovaco', 'bolardo-checo-eslovaco'],
  },
  {
    id: 'espana-portugal',
    title: 'España vs Portugal',
    countries: ['es', 'pt'],
    intro:
      'Península compartida, pero con señalética, suelos y fachadas sorprendentemente distintos.',
    rows: [
      {
        category: 'Idioma',
        cells: ['ñ, "Calle", -ción', 'ã/õ, "Rua", -ção'],
      },
      {
        category: 'Aceras',
        cells: ['Baldosa gris corriente', 'Calzada portuguesa: adoquín blanco-negro'],
        note: 'El suelo portugués es ornamental hasta en pueblos.',
      },
      {
        category: 'Fachadas',
        cells: ['Estuco liso, ladrillo', 'Azulejos cerámicos frecuentes'],
      },
      {
        category: 'Vegetación',
        cells: ['Olivar y meseta seca', 'Eucalipto y pino, más verde'],
        overlap: true,
        note: 'Galicia se parece a Portugal: cuidado.',
      },
      {
        category: 'Numeración vial',
        cells: ['A-/AP-, N-', 'A, N, M, IP/IC'],
        overlap: true,
      },
    ],
    verdict:
      'Rua/ã → Portugal; Calle/ñ → España. Sin texto: suelo de adoquín decorado o azulejo → Portugal.',
    relatedClues: ['espana-vs-portugal-idioma', 'azulejos-portugal', 'bolardo-espanol'],
  },
  {
    id: 'indonesia-malasia',
    title: 'Indonesia vs Malasia',
    countries: ['id', 'my'],
    intro:
      'Lenguas hermanas, conducción izquierda y palma aceitera en ambos. Aquí hay solapamiento real: acumula pistas, no busques una bala de plata.',
    rows: [
      {
        category: 'Matrículas',
        cells: ['Negras → blancas (transición desde 2022)', 'Negras siempre'],
        overlap: true,
        note: 'Negras no deciden; blancas nuevas inclinan a Indonesia.',
      },
      {
        category: 'Vocabulario visible',
        cells: ['warung, desa, kabupaten', 'Más inglés; jawi ocasional'],
      },
      {
        category: 'Infraestructura',
        cells: ['Variable, caótica en Java', 'Autopistas cuidadas, orden general'],
        overlap: true,
      },
      {
        category: 'Arquitectura',
        cells: ['Teja naranja empinada, densidad', 'Casas sobre pilares, suburbios planificados'],
        overlap: true,
      },
      {
        category: 'Religión visible',
        cells: ['Mezquitas de cúpula metálica por doquier', 'Mezquitas + templos chinos e hindúes mezclados'],
        note: 'La mezcla religiosa visible inclina a Malasia.',
      },
    ],
    verdict:
      'No hay pista única fiable: suma tres (vocabulario, orden vial, placas nuevas). Caos denso y warungs → Indonesia; autopista impecable con inglés → Malasia.',
    relatedClues: ['indonesia-vs-malasia', 'matricula-malasia-indonesia', 'jalan-sudeste', 'palma-aceitera'],
  },
  {
    id: 'kenia-uganda',
    title: 'Kenia vs Uganda',
    countries: ['ke', 'ug'],
    intro:
      'África oriental anglófona, conducción izquierda, boda-bodas y tierra roja en ambos. El meta del coche y el verdor marcan la diferencia.',
    rows: [
      {
        category: 'Coche de Google (meta)',
        cells: ['Snorkel visible en el frontal', 'Sin snorkel en la mayoría de cobertura'],
        note: 'La pista clásica; puede caducar con cobertura nueva.',
      },
      {
        category: 'Paisaje',
        cells: ['Sabana seca, acacias', 'Verde intenso, plataneras'],
        overlap: true,
        note: 'El oeste keniano también es verde.',
      },
      {
        category: 'Carteles',
        cells: ['Inglés + suajili', 'Inglés + luganda/suajili'],
        overlap: true,
      },
      {
        category: 'Matrículas',
        cells: ['Blanca delante, amarilla detrás', 'Similar esquema'],
        overlap: true,
        note: 'No apuestes por matrícula aquí; verifica antes.',
      },
    ],
    verdict:
      'Mira el coche: snorkel → Kenia. Sin snorkel y todo platanera/verde → Uganda. Lo demás se solapa demasiado.',
    relatedClues: ['kenia-snorkel', 'tierra-roja-tropical', 'izquierda-mundo'],
  },
]

export const COMPARISON_MAP = new Map(COMPARISONS.map((c) => [c.id, c]))
