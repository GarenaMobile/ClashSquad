-- ==============================================================================
-- MIGRASI GRAND TURISMO RACING (leaderboard waktu lap)
-- Jalankan di Supabase Dashboard > SQL Editor. Aman dijalankan berulang kali.
-- Pastikan juga: Authentication > Providers > "Allow anonymous sign-ins" = ON
-- (jika dimatikan, game tetap jalan, hanya player_id yang kosong).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS lap_times (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID,
  player_name   TEXT NOT NULL,
  car_id        TEXT NOT NULL,
  track_id      TEXT NOT NULL DEFAULT 'gt_circuit_v1',
  total_time_ms INTEGER NOT NULL,
  best_lap_ms   INTEGER NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Batasan sederhana agar data sampah tidak masuk
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lap_times_sane_values') THEN
    ALTER TABLE lap_times
      ADD CONSTRAINT lap_times_sane_values
      CHECK (
        total_time_ms BETWEEN 20000 AND 3600000
        AND best_lap_ms BETWEEN 10000 AND 3600000
        AND char_length(player_name) BETWEEN 1 AND 24
      ) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lap_times_track_total ON lap_times (track_id, total_time_ms ASC);

ALTER TABLE lap_times ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read lap_times" ON lap_times;
CREATE POLICY "Public read lap_times" ON lap_times FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert lap_times" ON lap_times;
CREATE POLICY "Public insert lap_times" ON lap_times FOR INSERT WITH CHECK (true);

-- Realtime untuk papan peringkat langsung
ALTER TABLE lap_times REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lap_times'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lap_times;
  END IF;
END $$;

-- OPSIONAL: tabel sisa proyek lama (tembak-tembakan). Hapus tanda komentar jika ingin membersihkan.
-- DROP TABLE IF EXISTS matches CASCADE;
-- DROP TABLE IF EXISTS room_players CASCADE;
-- DROP TABLE IF EXISTS rooms CASCADE;
-- DROP TABLE IF EXISTS drift_scores CASCADE;
