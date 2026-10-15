-- Estudio de cada usuario (Neon). Lo escribe y lee /api/me/sync (worker/src/me.js).
--
-- La app guarda todo primero en el dispositivo y sincroniza en segundo plano:
--   · mazos, guardados, tarjetas y ajustes: gana el cambio más reciente (updated_at, ms del
--     reloj del cliente); un borrado es un cambio más (deleted = true)
--   · repasos: solo se añaden (id único generado en el cliente)
-- synced_at (hora del servidor) dice qué hay que mandar a cada dispositivo: lo cambiado desde
-- su última sincronización.

CREATE TABLE IF NOT EXISTS study_deck (
  user_id    text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  id         text NOT NULL,
  name       text NOT NULL,
  updated_at bigint NOT NULL,
  deleted    boolean NOT NULL DEFAULT false,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

-- algo guardado para estudiar: una pista (t:<grupo>), una foto (f:<imagen>) o un lugar (g:<entidad>);
-- data es una copia de lo necesario para preguntarlo (texto, foto, coordenadas…)
CREATE TABLE IF NOT EXISTS study_item (
  user_id    text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  key        text NOT NULL,
  kind       text NOT NULL,
  cc         text,
  decks      text[] NOT NULL DEFAULT '{}',
  note       text NOT NULL DEFAULT '',
  data       jsonb NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  deleted    boolean NOT NULL DEFAULT false,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- estado FSRS de cada tarjeta (una pista da varias: reconocer el país, recordar la pista…)
CREATE TABLE IF NOT EXISTS study_card (
  user_id    text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  key        text NOT NULL,
  state      jsonb NOT NULL,
  due        timestamptz,
  updated_at bigint NOT NULL,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- cada respuesta: alimenta las estadísticas (racha, confusiones, dominio por país)
CREATE TABLE IF NOT EXISTS study_review (
  user_id   text NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  id        text NOT NULL,
  card      text NOT NULL,
  cc        text,
  answer    text,
  rating    smallint NOT NULL,
  ms        integer,
  at        bigint NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS study_settings (
  user_id    text PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  data       jsonb NOT NULL,
  updated_at bigint NOT NULL,
  synced_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS study_deck_sync ON study_deck (user_id, synced_at);
CREATE INDEX IF NOT EXISTS study_item_sync ON study_item (user_id, synced_at);
CREATE INDEX IF NOT EXISTS study_card_sync ON study_card (user_id, synced_at);
CREATE INDEX IF NOT EXISTS study_review_sync ON study_review (user_id, synced_at);
