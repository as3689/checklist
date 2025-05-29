const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const app = express();
const port = 3000;

// MariaDB 연결 설정
const db_config = {
  host: "218.145.156.138",
  port: 10000,
  user: "root",
  password: "root",
  database: "pi"
};

// MariaDB 연결
const db = mysql.createConnection(db_config);

db.connect((err) => {
  if (err) {
    console.error("MariaDB 연결 실패:", err);
    return;
  }
  console.log("MariaDB 연결 성공");
});

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// 루트 경로에 대한 기본 응답
app.get("/", (req, res) => {
  res.send("서버 실행 중 - API는 /api/checklist로 접근하세요.");
});

// 체크리스트 항목 불러오기
app.get("/api/checklist", (req, res) => {
  db.query("SELECT * FROM checklist", (err, rows) => {
    if (err) {
      console.error("체크리스트 조회 오류:", err);
      return res.status(500).send("DB Error");
    }
    if (rows.length === 0) {
      console.warn("체크리스트 데이터가 없습니다. 초기화 필요.");
      return res.json([]); // 빈 배열 반환
    }
    res.json(rows);
  });
});

// 특정 동의 체크리스트 상태 불러오기
app.get("/api/checklist/:dong", (req, res) => {
  const { dong } = req.params;
  const today = new Date().toISOString().split("T")[0]; // 오늘 날짜 (YYYY-MM-DD)
  db.query(
    "SELECT c.id, c.item, h.checked, h.user, h.timestamp " +
    "FROM checklist c " +
    "LEFT JOIN checklist_history h ON c.id = h.checklist_id " +
    "AND h.dong = ? AND DATE(h.timestamp) = ?",
    [dong, today],
    (err, rows) => {
      if (err) {
        console.error("동별 체크리스트 조회 오류:", err);
        return res.status(500).send("DB Error");
      }
      res.json(rows);
    }
  );
});

// 체크 상태 업데이트 (checklist_history에 기록)
app.post("/api/check/:dong/:id", (req, res) => {
  const { dong, id } = req.params;
  const { checked, user, timestamp } = req.body;
  const today = new Date().toISOString().split("T")[0]; // 오늘 날짜 (YYYY-MM-DD)

  db.query(
    "SELECT history_id FROM checklist_history WHERE dong = ? AND checklist_id = ? AND DATE(timestamp) = ?",
    [dong, id, today],
    (err, rows) => {
      if (err) {
        console.error("체크 기록 조회 오류:", err);
        return res.status(500).send("DB Error");
      }

      if (rows.length > 0) {
        db.query(
          "UPDATE checklist_history SET checked = ?, user = ?, timestamp = ? WHERE history_id = ?",
          [checked, user, timestamp, rows[0].history_id],
          (err) => {
            if (err) {
              console.error("체크 기록 업데이트 오류:", err);
              return res.status(500).send("DB Error");
            }
            res.send("OK");
          }
        );
      } else {
        db.query(
          "INSERT INTO checklist_history (dong, checklist_id, checked, user, timestamp) VALUES (?, ?, ?, ?, ?)",
          [dong, id, checked, user, timestamp],
          (err) => {
            if (err) {
              console.error("체크 기록 삽입 오류:", err);
              return res.status(500).send("DB Error");
            }
            res.send("OK");
          }
        );
      }
    }
  );
});

// 체크리스트 항목 추가
app.post("/api/checklist", (req, res) => {
  const { item, checked } = req.body;
  db.query(
    "INSERT INTO checklist (item) VALUES (?)",
    [item],
    (err) => {
      if (err) {
        console.error("항목 추가 오류:", err);
        return res.status(500).send("DB Error");
      }
      res.send("OK");
    }
  );
});

// 체크리스트 항목 삭제
app.delete("/api/checklist/:id", (req, res) => {
  const { id } = req.params;
  db.query(
    "DELETE FROM checklist WHERE id = ?",
    [id],
    (err) => {
      if (err) {
        console.error("항목 삭제 오류:", err);
        return res.status(500).send("DB Error");
      }
      db.query("UPDATE checklist SET id = id - 1 WHERE id > ?", [id], (err) => {
        if (err) console.error("ID 재조정 오류:", err);
      });
      res.send("OK");
    }
  );
});

// 특정 동의 체크리스트 저장 (초기화 포함)
app.post("/api/save-checklist/:dong", (req, res) => {
  const { dong } = req.params;
  const { checklist } = req.body;
  const today = new Date().toISOString().split("T")[0];

  checklist.forEach((item, index) => {
    const id = index + 1;
    const { checked, user, timestamp } = item;

    db.query(
      "SELECT history_id FROM checklist_history WHERE dong = ? AND checklist_id = ? AND DATE(timestamp) = ?",
      [dong, id, today],
      (err, rows) => {
        if (err) {
          console.error("저장 기록 조회 오류:", err);
          return;
        }

        if (rows.length > 0) {
          db.query(
            "UPDATE checklist_history SET checked = ?, user = ?, timestamp = ? WHERE history_id = ?",
            [checked, user, timestamp, rows[0].history_id],
            (err) => {
              if (err) console.error("저장 기록 업데이트 오류:", err);
            }
          );
        } else {
          db.query(
            "INSERT INTO checklist_history (dong, checklist_id, checked, user, timestamp) VALUES (?, ?, ?, ?, ?)",
            [dong, id, checked, user, timestamp],
            (err) => {
              if (err) console.error("저장 기록 삽입 오류:", err);
            }
          );
        }
      }
    );
  });

  res.send("OK");
});

// 특정 날짜의 체크 기록 조회
app.get("/api/checklist-history/:dong/:date", (req, res) => {
  const { dong, date } = req.params;
  db.query(
    "SELECT c.id, c.item, h.checked, h.user, h.timestamp " +
    "FROM checklist c " +
    "LEFT JOIN checklist_history h ON c.id = h.checklist_id " +
    "AND h.dong = ? AND DATE(h.timestamp) = ?",
    [dong, date],
    (err, rows) => {
      if (err) {
        console.error("체크 기록 조회 오류:", err);
        return res.status(500).send("DB Error");
      }
      res.json(rows);
    }
  );
});

app.listen(port, () => {
  console.log(`서버 실행됨: http://localhost:${port}`);
});