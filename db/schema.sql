CREATE TABLE IF NOT EXISTS spots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  dong TEXT,
  report_count INTEGER NOT NULL DEFAULT 0,
  congestion_count INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT '낮음',
  status TEXT NOT NULL DEFAULT '접수됨',
  escalated INTEGER NOT NULL DEFAULT 0,
  ai_report_text TEXT,
  ai_recommended_actions TEXT,
  ai_target TEXT,
  complaint_number TEXT,
  complaint_channel TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  spot_id INTEGER NOT NULL REFERENCES spots(id),
  kind TEXT NOT NULL DEFAULT 'issue', -- 'issue' | 'congestion'
  device_id TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  dong TEXT,
  problem_types TEXT, -- JSON array
  custom_problem_type TEXT, -- "기타" 선택 시 사용자가 직접 입력한 문제 유형
  detail TEXT,
  photo_path TEXT,
  time_band TEXT,
  risk_level TEXT, -- AI가 제보 내용을 분석해 자동으로 배정한 위험도
  congestion_level TEXT,
  congestion_time_band TEXT,
  pedestrian_type TEXT,
  ai_problem_types TEXT, -- JSON array
  ai_target TEXT,
  ai_time_band TEXT,
  ai_risk_level TEXT,
  ai_recommended_actions TEXT, -- JSON array
  ai_report_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_device_created ON reports(device_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reports_spot ON reports(spot_id);
CREATE INDEX IF NOT EXISTS idx_spots_location ON spots(lat, lng);
