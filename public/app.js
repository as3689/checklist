// 로그인 계정 목록
const validUsers = {
  admin: "1111",
  mhw0226: "1234",
  ju928: "1234",
  kyb: "1234",
  pjs04: "1234",
  acs: "1234"
};

// 로그인 사용자 초기화
let username = localStorage.getItem("username") || null;

// 로그인 폼 처리
document.getElementById("login-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const inputUsername = document.getElementById("username").value;
  const inputPassword = document.getElementById("password").value;
  const loginMessage = document.getElementById("login-message");

  if (validUsers[inputUsername] && validUsers[inputUsername] === inputPassword) {
    localStorage.setItem("username", inputUsername);
    window.location.href = "checklist.html";
  } else {
    loginMessage.innerText = "잘못된 아이디 또는 비밀번호입니다.";
    loginMessage.style.color = "red";
  }
});

// 체크리스트 페이지로 이동 시 로그인 확인
if (window.location.pathname.includes("checklist.html")) {
  if (!username || !validUsers[username]) {
    localStorage.removeItem("username");
    window.location.href = "index.html";
  }

  // 로그인 사용자 표시
  document.getElementById("user-info").innerText = `사용자: ${username}`;
  document.getElementById("timestamp").innerText = new Date().toLocaleString();

  // 로그아웃 버튼
  document.getElementById("logout").addEventListener("click", () => {
    localStorage.removeItem("username");
    window.location.href = "index.html";
  });

  // 현재 선택된 동 (기본값: 3동) 및 날짜
  let currentDong = "3";
  let selectedDate = new Date().toISOString().split("T")[0]; // 오늘 날짜 (YYYY-MM-DD)
  let checklistData = []; // DB에서 불러온 항목으로 초기화

  // 동 버튼을 동적으로 생성하는 함수
  function renderDongButtons() {
    const dongButtonsDiv = document.querySelector(".dong-buttons");
    dongButtonsDiv.innerHTML = "";

    for (let dong = 3; dong <= 17; dong++) {
      const button = document.createElement("button");
      button.className = `dong-button ${dong === 3 ? "active" : ""}`;
      button.setAttribute("data-dong", dong);
      button.textContent = `${dong}동`;
      button.addEventListener("click", () => {
        document.querySelectorAll(".dong-button").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        currentDong = button.getAttribute("data-dong");
        renderChecklist();
      });
      dongButtonsDiv.appendChild(button);
    }
  }

  // 날짜 선택 초기화
  const datePicker = document.getElementById("date-picker");
  datePicker.value = selectedDate; // 오늘 날짜로 초기화
  datePicker.addEventListener("change", (e) => {
    selectedDate = e.target.value;
    renderChecklist();
  });

  // DB에서 체크리스트 항목 불러오기
  async function fetchChecklistItems() {
    try {
      const response = await fetch("/api/checklist");
      if (!response.ok) throw new Error("서버 응답 오류");
      const data = await response.json();
      console.log("Fetched checklist data:", data);
      checklistData = data.map(item => item.item);
      if (checklistData.length === 0) {
        console.warn("체크리스트 데이터가 비어 있습니다. 초기 데이터 삽입 필요.");
        // 기본 항목 삽입 시도 (선택 사항)
        await fetch("/api/checklist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item: "양액 A 확인" })
        });
        await fetchChecklistItems(); // 재시도
      }
    } catch (error) {
      console.error("체크리스트 불러오기 실패:", error);
      alert("체크리스트 데이터를 불러오지 못했습니다. 서버를 확인하세요.");
    }
  }

  // 체크리스트 렌더링 함수
  async function renderChecklist() {
    const checklistKey = `naJuChecklist_${currentDong}`;
    const saved = JSON.parse(localStorage.getItem(checklistKey)) || {};
    const checklistBody = document.getElementById("checklist");

    if (checklistData.length === 0) {
      await fetchChecklistItems(); // 데이터가 없으면 다시 시도
      if (checklistData.length === 0) return; // 여전히 비어 있으면 중단
    }

    // 선택한 날짜와 동에 맞는 체크 기록 불러오기
    const response = await fetch(`/api/checklist-history/${currentDong}/${selectedDate}`);
    const checklistWithHistory = await response.json();

    checklistBody.innerHTML = "";

    checklistWithHistory.forEach((item, index) => {
      const key = `item_${index}`;
      const row = document.createElement("tr");

      const itemData = saved[key] || {};
      const isChecked = selectedDate === new Date().toISOString().split("T")[0] 
        ? (itemData.checked || item.checked || false)
        : (item.checked || false);
      const confirmBy = selectedDate === new Date().toISOString().split("T")[0] 
        ? (itemData.username || item.user || "")
        : (item.user || "");
      const confirmTime = selectedDate === new Date().toISOString().split("T")[0] 
        ? (itemData.time || item.timestamp || "")
        : (item.timestamp || "");

      row.innerHTML = `
        <td style="text-align: left;">${index + 1}. ${item.item}</td>
        <td><input type="checkbox" id="${key}" ${isChecked ? "checked" : ""} ${selectedDate !== new Date().toISOString().split("T")[0] ? "disabled" : ""}></td>
        <td>${isChecked ? `${confirmBy}<br>(${confirmTime})` : ""}</td>
      `;

      // 오늘 날짜일 경우에만 체크 가능
      if (selectedDate === new Date().toISOString().split("T")[0]) {
        row.querySelector(`#${key}`).addEventListener("change", async (e) => {
          const checked = e.target.checked;
          if (checked) {
            saved[key] = {
              checked: true,
              username: username,
              time: new Date().toLocaleString()
            };
          } else {
            delete saved[key];
          }
          localStorage.setItem(checklistKey, JSON.stringify(saved));

          // DB 업데이트 (checklist_history)
          await fetch(`/api/check/${currentDong}/${item.id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              checked: checked ? 1 : 0,
              user: checked ? username : null,
              timestamp: checked ? new Date().toLocaleString() : null
            })
          });

          renderChecklist();
        });
      }

      checklistBody.appendChild(row);
    });
  }

  // 항목 추가
  document.getElementById("add-item").addEventListener("click", async () => {
    const newItem = prompt("새 확인 항목을 입력하세요:");
    if (newItem) {
      checklistData.push(newItem);

      // DB에 새 항목 추가
      await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: newItem })
      });

      renderChecklist();
    }
  });

  // 항목 삭제
  document.getElementById("delete-item").addEventListener("click", async () => {
    const itemIndex = prompt("삭제할 항목 번호를 입력하세요 (1부터 시작):");
    const index = parseInt(itemIndex) - 1;
    if (!isNaN(index) && index >= 0 && index < checklistData.length) {
      const removedItem = checklistData.splice(index, 1)[0];

      // DB에서 항목 삭제
      await fetch(`/api/checklist/${index + 1}`, {
        method: "DELETE"
      });

      // 모든 동의 localStorage에서 해당 항목 제거
      for (let dong = 3; dong <= 17; dong++) {
        const key = `naJuChecklist_${dong}`;
        const saved = JSON.parse(localStorage.getItem(key)) || {};
        delete saved[`item_${index}`];
        for (let i = index; i < checklistData.length; i++) {
          saved[`item_${i}`] = saved[`item_${i + 1}`];
          delete saved[`item_${i + 1}`];
        }
        localStorage.setItem(key, JSON.stringify(saved));
      }

      renderChecklist();
    } else {
      alert("유효한 번호를 입력하세요.");
    }
  });

  // 저장 버튼
  document.getElementById("save-checklist").addEventListener("click", async () => {
    const checklistKey = `naJuChecklist_${currentDong}`;
    const saved = JSON.parse(localStorage.getItem(checklistKey)) || {};

    const checklistToSave = checklistData.map((item, index) => {
      const key = `item_${index}`;
      const itemData = saved[key] || {};
      return {
        checked: itemData.checked || false,
        user: itemData.username || null,
        timestamp: itemData.time || null
      };
    });

    // DB에 저장
    await fetch(`/api/save-checklist/${currentDong}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checklist: checklistToSave })
    });

    // 체크박스와 확인자 초기화
    localStorage.setItem(checklistKey, JSON.stringify({}));
    renderChecklist();
  });

  // 초기 실행
  renderDongButtons();
  fetchChecklistItems().then(() => renderChecklist());
}