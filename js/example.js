// ── CROP CONFIG (6 stages: seed → sprout → leaves → budding → flowering → harvest) ──
const CROPS = [
    { emoji: '\u{1F34E}', name: '\uC0AC\uACFC', color: '#e74c3c', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u{1F333}', '\u{1F338}', '\u{1F34E}'] },
    { emoji: '\u{1F350}', name: '\uBC30', color: '#a8d14f', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u{1F333}', '\u{1F338}', '\u{1F350}'] },
    { emoji: '\u{1F349}', name: '\uC218\uBC15', color: '#2ecc71', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u2618\uFE0F', '\u{1F33C}', '\u{1F349}'] },
    { emoji: '\u{1F34A}', name: '\uADC8', color: '#f39c12', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u{1F333}', '\u{1F338}', '\u{1F34A}'] },
    { emoji: '\u{1F345}', name: '\uD1A0\uB9C8\uD1A0', color: '#e74c3c', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u2618\uFE0F', '\u{1F338}', '\u{1F345}'] },
    { emoji: '\u{1F360}', name: '\uACE0\uAD6C\uB9C8', color: '#8e6b3e', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u2618\uFE0F', '\u{1FAB4}', '\u{1F360}'] },
    { emoji: '\u{1F33D}', name: '\uC625\uC218\uC218', color: '#f1c40f', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u2618\uFE0F', '\u{1F33E}', '\u{1F33D}'] },
    { emoji: '\u{1F955}', name: '\uB2F9\uADFC', color: '#e67e22', stages: ['\u{1F7E4}', '\u{1F331}', '\u{1F33F}', '\u2618\uFE0F', '\u{1FAB4}', '\u{1F955}'] },
];

// Get crop stage and visual properties based on percentage
function getCropVisual(crop, pct) {
    const stageIdx = pct >= 100 ? 5 : pct >= 80 ? 4 : pct >= 55 ? 3 : pct >= 30 ? 2 : pct >= 10 ? 1 : 0;
    const emoji = crop.stages[stageIdx];
    // Smooth size: 14px at 0% → 32px at 100%
    const size = Math.round(14 + (pct / 100) * 18);
    // Stem height: 0px at 0% → 40px at 100%
    const stemH = Math.round((pct / 100) * 40);
    return { emoji, size, stemH, stageIdx };
}

// ── AUTH & STATE ──
let currentUser = null; // logged-in username
let sessions = [];
let categories = [];
let goalMinutes = 0;
let timerInterval = null;
let timerSeconds = 0;
let isRunning = false;
let isPaused = false;
let currentResult = null;
let timerMode = 'stopwatch';
let countdownTotal = 0;
let selectedCatId = null;
let selectedTaskId = null;
let selectedCropIdx = 0;

// Simple hash for password (NOT cryptographically secure, but fine for local demo)
function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash |= 0;
    }
    return 'h' + Math.abs(hash).toString(36);
}

function userKey(key) {
    return `bf_${currentUser}_${key}`;
}

function loadUserData() {
    sessions = JSON.parse(localStorage.getItem(userKey('sessions')) || '[]');
    categories = JSON.parse(localStorage.getItem(userKey('categories')) || '[]');
}

function saveSessions() {
    localStorage.setItem(userKey('sessions'), JSON.stringify(sessions));
}

function saveCategories() {
    localStorage.setItem(userKey('categories'), JSON.stringify(categories));
}

// ── AUTH FUNCTIONS ──
function toggleAuthMode(e) {
    e.preventDefault();
    const login = document.getElementById('loginForm');
    const reg = document.getElementById('registerForm');
    document.getElementById('loginError').textContent = '';
    if (login.style.display === 'none') {
        login.style.display = '';
        reg.style.display = 'none';
    } else {
        login.style.display = 'none';
        reg.style.display = '';
    }
}

function doRegister() {
    const id = document.getElementById('regId').value.trim();
    const pw = document.getElementById('regPw').value;
    const pw2 = document.getElementById('regPw2').value;
    const errEl = document.getElementById('loginError');

    if (id.length < 3) { errEl.textContent = '아이디는 3자 이상이어야 해요.'; return; }
    if (pw.length < 4) { errEl.textContent = '비밀번호는 4자 이상이어야 해요.'; return; }
    if (pw !== pw2) { errEl.textContent = '비밀번호가 일치하지 않아요.'; return; }

    const users = JSON.parse(localStorage.getItem('bf_users') || '{}');
    if (users[id]) { errEl.textContent = '이미 존재하는 아이디예요.'; return; }

    users[id] = { pwHash: simpleHash(pw), created: new Date().toISOString() };
    localStorage.setItem('bf_users', JSON.stringify(users));

    // Auto login after register
    loginAs(id);
}

function doLogin() {
    const id = document.getElementById('loginId').value.trim();
    const pw = document.getElementById('loginPw').value;
    const errEl = document.getElementById('loginError');

    if (!id || !pw) { errEl.textContent = '아이디와 비밀번호를 입력해주세요.'; return; }

    const users = JSON.parse(localStorage.getItem('bf_users') || '{}');
    if (!users[id]) { errEl.textContent = '존재하지 않는 아이디예요.'; return; }
    if (users[id].pwHash !== simpleHash(pw)) { errEl.textContent = '비밀번호가 틀려요.'; return; }

    loginAs(id);
}

function loginAs(username) {
    currentUser = username;
    localStorage.setItem('bf_currentUser', username);

    // Update UI
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appWrap').style.display = '';
    document.getElementById('userName').textContent = username;

    // Load user data
    loadUserData();
    renderCategories();
    updateTodaySummary();

    showToast(`환영해요, ${username}님! 🌱`);
}

function doLogout() {
    if (!confirm('로그아웃 할까요?')) return;

    // Stop timer if running
    if (isRunning || isPaused) {
        clearInterval(timerInterval);
        isRunning = false;
        isPaused = false;
    }

    currentUser = null;
    localStorage.removeItem('bf_currentUser');
    sessions = [];
    categories = [];
    selectedCatId = null;
    selectedTaskId = null;

    document.getElementById('appWrap').style.display = 'none';
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginId').value = '';
    document.getElementById('loginPw').value = '';
    document.getElementById('loginError').textContent = '';
}

// ── NAV ──
function goPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const labels = { home: '농장', tasks: '관리', log: '기록', growth: '성장' };
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.textContent === labels[id]);
    });
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('bnav-' + id)?.classList.add('active');
    if (id === 'log') renderLog();
    if (id === 'home') renderFarm(); // in the redesign, 'home' is the farm visual, renderFarm() renders Home grid
    if (id === 'growth') renderGrowth();
}

// ── TODAY SUMMARY ──
function updateTodaySummary() {
    const todaySecs = getTodaySecs();
    document.getElementById('todayTotal').textContent = secToHM(todaySecs);
    // Count active tasks
    let taskCount = 0;
    categories.forEach(c => { taskCount += c.tasks.length; });
    const el = document.getElementById('todayTaskCount');
    if (el) el.textContent = taskCount;
    updateHomeFarm();
    renderFarm();
}

function getTodaySecs() {
    const today = new Date().toDateString();
    return sessions.filter(s => new Date(s.date).toDateString() === today && s.result !== 'fail')
        .reduce((a, s) => a + s.seconds, 0);
}

// ── CATEGORY & TASK ──
function showAddCat() {
    const area = document.getElementById('addCatArea');
    area.style.display = area.style.display === 'none' ? '' : 'none';
    // render crop picker
    document.getElementById('cropPicker').innerHTML = CROPS.map((c, i) =>
        `<span style="font-size:22px;cursor:pointer;padding:4px;border-radius:8px;border:2px solid ${i === selectedCropIdx ? c.color : 'transparent'}" onclick="pickCrop(${i})">${c.emoji}</span>`
    ).join('');
}

function pickCrop(idx) {
    selectedCropIdx = idx;
    showAddCat(); showAddCat(); // re-render picker
}

function addCategory() {
    const input = document.getElementById('newCatInput');
    const name = input.value.trim();
    if (!name) return;
    const cat = {
        id: Date.now().toString(),
        name,
        cropIdx: selectedCropIdx,
        tasks: []
    };
    categories.push(cat);
    saveCategories();
    input.value = '';
    document.getElementById('addCatArea').style.display = 'none';
    renderCategories();
    showToast(`${CROPS[cat.cropIdx].emoji} ${name} 카테고리 추가!`);
}

function deleteCategory(id) {
    categories = categories.filter(c => c.id !== id);
    if (selectedCatId === id) { selectedCatId = null; selectedTaskId = null; }
    saveCategories();
    renderCategories();
}

function selectCategory(id) {
    selectedCatId = id;
    selectedTaskId = null;
    renderCategories();
    updateSelectedInfo();
}

function renderCategories() {
    const list = document.getElementById('catList');
    if (!categories.length) {
        list.innerHTML = '<p style="font-size:12px;color:var(--muted);text-align:center;padding:10px">카테고리를 추가해보세요!</p>';
        document.getElementById('taskArea').style.display = 'none';
        return;
    }
    list.innerHTML = categories.map(c => {
        const crop = CROPS[c.cropIdx] || CROPS[0];
        return `<div class="cat-chip ${c.id === selectedCatId ? 'active' : ''}" onclick="selectCategory('${c.id}')">
      <span class="cat-name">${crop.emoji} ${c.name}</span>
      <span style="display:flex;align-items:center;gap:6px">
        <span class="cat-count">${c.tasks.length}개 태스크</span>
        <button class="del-btn" onclick="event.stopPropagation();deleteCategory('${c.id}')">✕</button>
      </span>
    </div>`;
    }).join('');

    // Show tasks if category selected
    const taskArea = document.getElementById('taskArea');
    if (selectedCatId) {
        const cat = categories.find(c => c.id === selectedCatId);
        if (cat) {
            taskArea.style.display = '';
            document.getElementById('taskAreaTitle').textContent = `📌 ${cat.name} 태스크`;
            renderTasks(cat);
        }
    } else {
        taskArea.style.display = 'none';
    }
}

function showAddTask() {
    const area = document.getElementById('addTaskArea');
    area.style.display = area.style.display === 'none' ? '' : 'none';
}

function addTask() {
    const input = document.getElementById('newTaskInput');
    const name = input.value.trim();
    if (!name || !selectedCatId) return;
    const cat = categories.find(c => c.id === selectedCatId);
    if (!cat) return;
    const goalH = parseInt(document.getElementById('newTaskGoalH').value) || 0;
    const goalM = parseInt(document.getElementById('newTaskGoalM').value) || 0;
    const goalMin = Math.max(5, goalH * 60 + goalM); // minimum 5 minutes
    cat.tasks.push({ id: Date.now().toString(), name, goalMinutes: goalMin });
    saveCategories();
    input.value = '';
    document.getElementById('newTaskGoalH').value = '1';
    document.getElementById('newTaskGoalM').value = '0';
    document.getElementById('addTaskArea').style.display = 'none';
    renderTasks(cat);
    const label = goalH > 0 ? `${goalH}h ${goalM}m` : `${goalM}m`;
    showToast(`태스크 "${name}" (목표 ${label}) 추가!`);
    updateTodaySummary();
}

function deleteTask(taskId) {
    const cat = categories.find(c => c.id === selectedCatId);
    if (!cat) return;
    cat.tasks = cat.tasks.filter(t => t.id !== taskId);
    if (selectedTaskId === taskId) selectedTaskId = null;
    saveCategories();
    renderTasks(cat);
    updateSelectedInfo();
}

function selectTask(taskId) {
    selectedTaskId = taskId;
    const cat = categories.find(c => c.id === selectedCatId);
    if (cat) renderTasks(cat);
    updateSelectedInfo();
}

function renderTasks(cat) {
    const list = document.getElementById('taskList');
    const crop = CROPS[cat.cropIdx] || CROPS[0];
    if (!cat.tasks.length) {
        list.innerHTML = '<p style="font-size:11px;color:var(--muted);padding:8px 0">태스크를 추가해보세요</p>';
        return;
    }
    list.innerHTML = cat.tasks.map(t => {
        const taskSess = sessions.filter(s => s.taskId === t.id && s.result !== 'fail');
        const totalSecs = taskSess.reduce((a, s) => a + s.seconds, 0);
        const goalSecs = (t.goalMinutes || 60) * 60;
        const pct = Math.min(100, Math.round((totalSecs / goalSecs) * 100));
        const totalLabel = secToHM(totalSecs);
        const goalLabel = secToHM(goalSecs);
        const v = getCropVisual(crop, pct);
        return `<div class="task-chip ${t.id === selectedTaskId ? 'active' : ''}" onclick="selectTask('${t.id}')">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-size:14px">${v.emoji}</span>
          <span style="font-size:13px;font-weight:500">${t.name}</span>
          <span style="font-size:10px;color:var(--muted);margin-left:auto">${totalLabel} / ${goalLabel}</span>
        </div>
        <div class="task-bar-bg"><div class="task-bar" style="width:${pct}%;background:${crop.color}"></div></div>
        <div style="font-size:9px;color:${crop.color};margin-top:2px;font-weight:600">${pct}% 성장</div>
      </div>
      <button class="del-btn" onclick="event.stopPropagation();deleteTask('${t.id}')" style="margin-left:8px">✕</button>
    </div>`;
    }).join('');
}

function updateSelectedInfo() {
    const el = document.getElementById('selectedInfo');
    const label = document.getElementById('selectedLabel');
    if (selectedCatId && selectedTaskId) {
        const cat = categories.find(c => c.id === selectedCatId);
        const task = cat?.tasks.find(t => t.id === selectedTaskId);
        if (cat && task) {
            el.style.display = '';
            label.textContent = `${cat.name} > ${task.name}`;
            document.getElementById('timerStatus').textContent = '준비됨';
            return;
        }
    }
    el.style.display = 'none';
    document.getElementById('timerStatus').textContent = '카테고리와 태스크를 선택하세요';
}

// saveCategories is defined in AUTH section above (uses userKey)

// ── TIMER MODE ──
function setMode(mode) {
    timerMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.includes(mode === 'stopwatch' ? '스톱워치' : '타이머'));
    });
    document.getElementById('timerSetArea').style.display = mode === 'timer' ? '' : 'none';
    if (!isRunning && !isPaused) {
        timerSeconds = 0;
        document.getElementById('timerDisplay').textContent = '00:00';
    }
}

// ── TIMER ──
function startTimer() {
    if (!selectedCatId || !selectedTaskId) {
        showToast('카테고리와 태스크를 먼저 선택하세요!');
        return;
    }
    if (isPaused) {
        isRunning = true; isPaused = false;
    } else {
        if (timerMode === 'timer') {
            const h = parseInt(document.getElementById('setHour').value) || 0;
            const m = parseInt(document.getElementById('setMin').value) || 0;
            const s = parseInt(document.getElementById('setSec').value) || 0;
            countdownTotal = h * 3600 + m * 60 + s;
            if (countdownTotal <= 0) { showToast('시간을 설정해주세요!'); return; }
            timerSeconds = countdownTotal;
        } else {
            timerSeconds = 0;
        }
        isRunning = true;
    }
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('pauseBtn').style.display = '';
    document.getElementById('stopBtn').style.display = '';
    document.getElementById('timerStatus').textContent = '집중 중... 🔥';
    if (timerMode === 'timer') document.getElementById('timerSetArea').style.display = 'none';

    timerInterval = setInterval(() => {
        if (!isRunning) return;
        if (timerMode === 'stopwatch') {
            timerSeconds++;
            document.getElementById('timerDisplay').textContent = secToMS(timerSeconds);
        } else {
            timerSeconds--;
            document.getElementById('timerDisplay').textContent = secToMS(timerSeconds);
            if (timerSeconds <= 0) {
                clearInterval(timerInterval);
                isRunning = false;
                showToast('⏰ 타이머 완료!');
                timerSeconds = countdownTotal; // store total for session
                stopTimer();
            }
        }
    }, 1000);
}

function pauseTimer() {
    isRunning = false; isPaused = true;
    clearInterval(timerInterval);
    document.getElementById('timerStatus').textContent = '일시정지됨 ⏸';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('startBtn').style.display = '';
    document.getElementById('startBtn').textContent = '▶ 재시작';
}

function stopTimer() {
    clearInterval(timerInterval);
    const elapsed = timerMode === 'stopwatch' ? timerSeconds : countdownTotal - Math.max(0, timerSeconds);
    isRunning = false; isPaused = false;
    document.getElementById('sessionSummary').textContent = `집중 시간: ${secToMS(elapsed)}`;
    currentResult = null;
    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('sel'));
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('sel'));
    document.getElementById('noteInput').value = '';
    document.getElementById('failReason').value = '';
    document.getElementById('improvePlan').value = '';
    document.getElementById('tagSection').style.display = 'none';
    document.getElementById('memoSection').style.display = 'none';
    document.getElementById('endModal').classList.add('show');
    // store elapsed for save
    window._elapsed = elapsed;
}

function resetTimer() {
    timerSeconds = 0;
    document.getElementById('timerDisplay').textContent = '00:00';
    document.getElementById('timerStatus').textContent = selectedTaskId ? '준비됨' : '카테고리와 태스크를 선택하세요';
    document.getElementById('startBtn').style.display = '';
    document.getElementById('startBtn').textContent = '▶ 시작';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display = 'none';
    if (timerMode === 'timer') document.getElementById('timerSetArea').style.display = '';
}

// ── MODAL ──
function selectResult(r) {
    currentResult = r;
    document.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('sel'));
    document.querySelector('.choice-' + (r === 'done' ? 'done' : r === 'partial' ? 'partial' : 'fail')).classList.add('sel');
    const showFail = r === 'fail' || r === 'partial';
    document.getElementById('tagSection').style.display = showFail ? '' : 'none';
    document.getElementById('memoSection').style.display = showFail ? '' : 'none';
}

function toggleTag(el) { el.classList.toggle('sel'); }

function saveSession() {
    if (!currentResult) { showToast('결과를 선택해주세요!'); return; }
    const tags = [...document.querySelectorAll('.tag.sel')].map(t => t.textContent.trim());
    const note = document.getElementById('noteInput').value.trim();
    const failReason = document.getElementById('failReason').value.trim();
    const improvePlan = document.getElementById('improvePlan').value.trim();
    const cat = categories.find(c => c.id === selectedCatId);
    const task = cat?.tasks.find(t => t.id === selectedTaskId);

    const session = {
        date: new Date().toISOString(),
        seconds: window._elapsed || timerSeconds,
        result: currentResult,
        tags, note, failReason, improvePlan,
        catId: selectedCatId,
        taskId: selectedTaskId,
        catName: cat?.name || '',
        taskName: task?.name || ''
    };
    sessions.push(session);
    saveSessions();
    document.getElementById('endModal').classList.remove('show');
    resetTimer();
    updateTodaySummary();
    renderCategories();
    const msgs = {
        done: '완료! 작물이 자라고 있어요 🌱',
        partial: '수고했어요! 조금씩이면 돼요 🌤',
        fail: '실패는 거름이에요! 작물이 더 튼튼해질 거예요 🌧'
    };
    showToast(msgs[currentResult]);
}

// ── HOME FARM VISUAL ──
function updateHomeFarm() {
    const field = document.getElementById('cropField');
    const soilMsg = document.getElementById('soilMsg');
    // Collect all tasks across categories
    const allTasks = [];
    categories.forEach(cat => {
        const crop = CROPS[cat.cropIdx] || CROPS[0];
        cat.tasks.forEach(t => {
            allTasks.push({ ...t, catName: cat.name, crop, catId: cat.id });
        });
    });
    if (!allTasks.length) {
        field.innerHTML = '<div style="font-size:36px;opacity:0.5">🌱</div>';
        soilMsg.textContent = '씨앗을 심어보세요 🌱';
        return;
    }
    const today = new Date().toDateString();
    let needSave = false;
    field.innerHTML = allTasks.map((t, index) => {
        const taskSess = sessions.filter(s => s.taskId === t.id && s.result !== 'fail');
        const totalSecs = taskSess.reduce((a, s) => a + s.seconds, 0);
        const goalSecs = (t.goalMinutes || 60) * 60;
        const pct = Math.min(100, Math.round((totalSecs / goalSecs) * 100));
        const failCount = sessions.filter(s => s.taskId === t.id && s.result === 'fail').length;
        const v = getCropVisual(t.crop, pct);

        let posX = t.posX;
        let posY = t.posY;

        if (posX === undefined || posY === undefined) {
            posX = posX !== undefined ? posX : (Math.random() * 80);
            posY = posY !== undefined ? posY : (Math.random() * 50);

            categories.forEach(cat => {
                if (cat.id === t.catId) {
                    const origT = cat.tasks.find(x => x.id === t.id);
                    if (origT) {
                        origT.posX = posX;
                        origT.posY = posY;
                        t.posX = posX;
                        t.posY = posY;
                    }
                }
            });
            needSave = true;
        }

        return `<div class="crop-item" data-task-id="${t.id}" style="position:absolute; left:${posX}%; bottom:${posY}%; cursor: grab;">
      <div class="crop-emoji" style="font-size:${v.size}px;transition:font-size 0.8s ease">${v.emoji}</div>
      <div class="crop-stem" style="height:${v.stemH}px;background:${t.crop.color};opacity:0.5"></div>
    </div>`;
    }).join('');

    if (needSave) {
        saveCategories();
    }

    const todayFails = sessions.filter(s => new Date(s.date).toDateString() === today && s.result === 'fail').length;
    updateRain(todayFails > 0);
    soilMsg.textContent = todayFails > 0 ? '비가 와도 괜찮아요, 거름이 되니까 🌧' : '';

    makeCropsDraggable();
}

function makeCropsDraggable() {
    const crops = document.querySelectorAll('.crop-item');
    crops.forEach(crop => {
        let isDragging = false;
        let startX, startY, startLeft, startBottom;

        const onStart = (e) => {
            if (e.type === 'mousedown' && e.button !== 0) return;
            isDragging = true;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            startLeft = parseFloat(crop.style.left) || 0;
            startBottom = parseFloat(crop.style.bottom) || 0;
            crop.style.zIndex = 10;
            crop.style.cursor = 'grabbing';
        };

        const onMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - startX;
            const dy = clientY - startY;

            const field = document.getElementById('cropField');
            const fieldRect = field.getBoundingClientRect();

            let newLeft = startLeft + (dx / fieldRect.width) * 100;
            let newBottom = startBottom - (dy / fieldRect.height) * 100;

            newLeft = Math.max(0, Math.min(newLeft, 90));
            newBottom = Math.max(0, Math.min(newBottom, 80));

            crop.style.left = newLeft + '%';
            crop.style.bottom = newBottom + '%';
        };

        const onEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            crop.style.zIndex = '';
            crop.style.cursor = 'grab';
            const taskId = crop.getAttribute('data-task-id');
            const newLeft = parseFloat(crop.style.left);
            const newBottom = parseFloat(crop.style.bottom);
            saveCropPosition(taskId, newLeft, newBottom);
        };

        crop.addEventListener('mousedown', onStart);
        document.addEventListener('mousemove', onMove, { passive: false });
        document.addEventListener('mouseup', onEnd);

        crop.addEventListener('touchstart', onStart, { passive: false });
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    });
}

function saveCropPosition(taskId, left, bottom) {
    categories.forEach(cat => {
        const task = cat.tasks.find(t => t.id === taskId);
        if (task) {
            task.posX = left;
            task.posY = bottom;
        }
    });
    saveCategories();
}

function updateRain(raining) {
    const rain = document.getElementById('rainEl');
    rain.innerHTML = '';
    if (raining) {
        for (let i = 0; i < 18; i++) {
            const d = document.createElement('div');
            d.className = 'drop';
            d.style.left = Math.random() * 100 + '%';
            d.style.animationDuration = (0.6 + Math.random() * 0.6) + 's';
            d.style.animationDelay = (Math.random() * 1.2) + 's';
            rain.appendChild(d);
        }
    }
}

// ── FARM PAGE ──
function renderFarm() {
    const grid = document.getElementById('farmGrid');
    const empty = document.getElementById('farmEmpty');
    if (!categories.length) {
        grid.innerHTML = '';
        empty.style.display = '';
        return;
    }
    empty.style.display = 'none';
    grid.innerHTML = '';
    categories.forEach(cat => {
        const crop = CROPS[cat.cropIdx] || CROPS[0];
        const stageNames = ['씨앗', '새싹', '성장', '무성', '개화', '수확!'];
        cat.tasks.forEach(t => {
            const taskSess = sessions.filter(s => s.taskId === t.id && s.result !== 'fail');
            const totalSecs = taskSess.reduce((a, s) => a + s.seconds, 0);
            const goalSecs = (t.goalMinutes || 60) * 60;
            const pct = Math.min(100, Math.round((totalSecs / goalSecs) * 100));
            const failCount = sessions.filter(s => s.taskId === t.id && s.result === 'fail').length;
            const totalLabel = secToHM(totalSecs);
            const goalLabel = secToHM(goalSecs);
            const v = getCropVisual(crop, pct);
            grid.innerHTML += `<div class="farm-card">
      <div class="farm-growth-area">
        <div class="farm-crop" style="font-size:${Math.round(24 + pct * 0.24)}px;transition:font-size 0.8s">${v.emoji}</div>
      </div>
      <div class="farm-name">${t.name}</div>
      <div class="farm-stage-label" style="color:${crop.color}">${stageNames[v.stageIdx]}</div>
      <div class="farm-bar-bg"><div class="farm-bar" style="width:${pct}%;background:${crop.color}"></div></div>
      ${failCount > 0 ? `<div style="font-size:10px;color:var(--text-secondary);margin-top:6px">🧪 거름 ${failCount}회</div>` : ''}
    </div>`;
        });
    });
}

// ── LOG ──
function renderLog() {
    const list = [...sessions].reverse();
    document.getElementById('logCount').textContent = sessions.length + '개';
    if (!list.length) {
        document.getElementById('logList').innerHTML = `<div class="empty-state"><div class="big">📂</div><p>아직 기록이 없어요.<br>타이머를 시작해서 첫 기록을 남겨보세요!</p></div>`;
        return;
    }
    const icons = { done: '✅', partial: '🌤', fail: '🌧' };
    const labels = { done: '완료', partial: '일부 완료', fail: '중단' };
    document.getElementById('logList').innerHTML = list.map((s, i) => {
        const realIdx = sessions.length - 1 - i; // index in original sessions array
        return `
    <div class="log-entry">
      <div class="entry-icon">${icons[s.result]}</div>
      <div class="entry-body">
        <div class="entry-top">
          <div>
            <div class="entry-title">${labels[s.result]}</div>
            ${s.catName ? `<div class="entry-cat">${s.catName}${s.taskName ? ' > ' + s.taskName : ''}</div>` : ''}
          </div>
          <div style="display:flex;align-items:flex-start;gap:6px">
            <div class="entry-date">${fmtDate(s.date)}</div>
            <button class="entry-del-btn" onclick="deleteSession(${realIdx})" title="삭제">✕</button>
          </div>
        </div>
        <div class="entry-time">⏱ ${secToMS(s.seconds)}</div>
        ${s.tags?.length ? `<div class="tag-chips">${s.tags.map(t => `<span class="chip">${t}</span>`).join('')}</div>` : ''}
        ${s.failReason ? `<div class="entry-note"><strong>실패 원인:</strong> ${s.failReason}</div>` : ''}
        ${s.improvePlan ? `<div class="entry-note"><strong>개선 계획:</strong> ${s.improvePlan}</div>` : ''}
        ${s.note ? `<div class="entry-note">📝 ${s.note}</div>` : ''}
      </div>
    </div>`;
    }).join('');
}

function deleteSession(idx) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    sessions.splice(idx, 1);
    saveSessions();
    renderLog();
    updateTodaySummary();
    renderCategories();
    showToast('기록이 삭제되었습니다 🗑️');
}

// ── GROWTH ──
function renderGrowth() {
    const totalSecs = sessions.reduce((a, s) => a + s.seconds, 0);
    document.getElementById('totalHours').textContent = Math.floor(totalSecs / 3600) + 'h';
    document.getElementById('totalSessions').textContent = sessions.length;
    const doneCount = sessions.filter(s => s.result === 'done').length;
    const rate = sessions.length ? Math.round(doneCount / sessions.length * 100) : null;
    document.getElementById('doneRate').textContent = rate !== null ? rate + '%' : '—';

    let streak = 0;
    const days = new Set(sessions.map(s => new Date(s.date).toDateString()));
    let d = new Date();
    while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    document.getElementById('streak').textContent = streak;

    // week bars
    const days7 = [];
    for (let i = 6; i >= 0; i--) {
        const dt = new Date(); dt.setDate(dt.getDate() - i);
        const ds = dt.toDateString();
        const secs = sessions.filter(s => new Date(s.date).toDateString() === ds).reduce((a, s) => a + s.seconds, 0);
        days7.push({ label: ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()], mins: Math.round(secs / 60), isToday: i === 0 });
    }
    const maxMins = Math.max(...days7.map(d => d.mins), 1);
    document.getElementById('weekBars').innerHTML = days7.map(d => `
    <div class="wday">
      <div class="wbar" style="height:${Math.round(d.mins / maxMins * 70) + 4}px;background:${d.isToday ? 'var(--accent)' : d.mins > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)'}"></div>
      <div class="wday-label" style="${d.isToday ? 'color:var(--accent);font-weight:600' : ''}">${d.label}</div>
    </div>`).join('');

    // fail tags
    const tagCount = {};
    sessions.filter(s => s.result !== 'done').forEach(s => (s.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
    const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
        const max = sorted[0][1];
        document.getElementById('failTagChart').innerHTML = sorted.slice(0, 5).map(([t, c]) => `
      <div class="fail-tag-row">
        <div class="ftag-label">${t}</div>
        <div class="ftag-bar-bg"><div class="ftag-bar" style="width:${Math.round(c / max * 100)}%"></div></div>
        <div class="ftag-count">${c}</div>
      </div>`).join('');
    } else {
        document.getElementById('failTagChart').innerHTML = '<p style="font-size:13px;color:var(--muted)">아직 데이터가 없어요.</p>';
    }

    // insights
    let insights = '';
    if (sessions.length >= 3) {
        const topTag = sorted[0];
        if (topTag) {
            insights += `<div class="insight-card amber"><div class="insight-icon">🔍</div>
        <div class="insight-text">최근 가장 많은 방해 요소는 <strong>${topTag[0]}</strong>이에요 (${topTag[1]}회).</div></div>`;
        }
        if (rate >= 70) {
            insights += `<div class="insight-card"><div class="insight-icon">🌟</div>
        <div class="insight-text">목표 달성률 <strong>${rate}%</strong>! 꾸준히 잘 해내고 있어요.</div></div>`;
        } else if (rate !== null) {
            insights += `<div class="insight-card"><div class="insight-icon">💪</div>
        <div class="insight-text">달성률 <strong>${rate}%</strong>. 실패를 기록하는 것 자체가 성장이에요.</div></div>`;
        }
    } else {
        insights = `<div class="insight-card"><div class="insight-icon">🌱</div>
      <div class="insight-text">세션을 <strong>3번 이상</strong> 완료하면 인사이트가 생성돼요!</div></div>`;
    }
    document.getElementById('insightArea').innerHTML = insights;
}

// ── UTILS ──
function secToMS(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function secToHM(s) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
}
function fmtDate(iso) {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2600);
}

// ── SCROLL PICKER ──
function initScrollPicker(containerId, values, initialValue) {
    const container = document.getElementById(containerId);
    // Add top/bottom padding items for centering
    container.innerHTML = '<div class="scroll-picker-item" style="visibility:hidden"></div>'
        + values.map(v => `<div class="scroll-picker-item" data-value="${v}">${String(v).padStart(2, '0')}</div>`).join('')
        + '<div class="scroll-picker-item" style="visibility:hidden"></div>';

    const items = container.querySelectorAll('.scroll-picker-item[data-value]');
    const itemH = 40;

    function updateActive() {
        const scrollCenter = container.scrollTop + container.clientHeight / 2;
        items.forEach(item => {
            const itemCenter = item.offsetTop + itemH / 2;
            item.classList.toggle('active', Math.abs(scrollCenter - itemCenter) < itemH / 2);
        });
    }

    container.addEventListener('scroll', updateActive);

    // Click to scroll
    items.forEach(item => {
        item.addEventListener('click', () => {
            container.scrollTo({ top: item.offsetTop - container.clientHeight / 2 + itemH / 2, behavior: 'smooth' });
        });
    });

    // Set initial value
    const idx = values.indexOf(initialValue);
    if (idx >= 0) {
        setTimeout(() => {
            const target = items[idx];
            container.scrollTo({ top: target.offsetTop - container.clientHeight / 2 + itemH / 2, behavior: 'auto' });
            updateActive();
        }, 50);
    }
}

function getPickerValue(containerId) {
    const container = document.getElementById(containerId);
    const active = container.querySelector('.scroll-picker-item.active');
    return active ? parseInt(active.dataset.value) : 0;
}

// ── INIT ──
document.getElementById('endModal').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('show');
});

// Enter key support for login forms
['loginId', 'loginPw'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});
['regId', 'regPw', 'regPw2'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });
});

// Auto-login if session exists
const savedUser = localStorage.getItem('bf_currentUser');
if (savedUser) {
    const users = JSON.parse(localStorage.getItem('bf_users') || '{}');
    if (users[savedUser]) {
        loginAs(savedUser);
    }
}

// ── SHARE ──
async function shareFarm() {
    const homeEl = document.getElementById('home');
    showToast("농장 캡처 중... 📸");

    try {
        const canvas = await html2canvas(homeEl, {
            backgroundColor: "#F4F7F6",
            scale: 2, // High resolution for social media
            useCORS: true,
            windowWidth: 640 // Fixes mobile layout quirks sometimes
        });

        const imgUrl = canvas.toDataURL("image/png");

        // Trigger download
        const a = document.createElement('a');
        a.href = imgUrl;
        a.download = `BloomFarm_${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Optional: try Web Share API if supported
        if (navigator.share) {
            canvas.toBlob(async (blob) => {
                const file = new File([blob], "bloomfarm.png", { type: "image/png" });
                try {
                    await navigator.share({
                        title: '나의 Bloom Farm 🌱',
                        text: '열심히 키운 나의 농장과 공부 기록을 구경해보세요!',
                        files: [file]
                    });
                } catch (err) {
                    console.log("Share API error or cancelled", err);
                }
            });
        }

        showToast("농장 이미지가 저장되었습니다! SNS에 자랑해보세요! ✨");
    } catch (e) {
        console.error("Screenshot error:", e);
        showToast("캡처에 실패했어요 😢");
    }
}

// ── AI REPORT ──
function openAIReport() {
    if (sessions.length === 0) {
        showToast('아직 기록이 없어 분석을 시작할 수 없어요! 🌱');
        return;
    }
    document.getElementById('aiReportModal').style.display = 'flex';
    document.getElementById('aiReportContent').innerHTML = `
        <div class="report-loading" style="padding: 40px 0; text-align:center;">
            <div class="pulse-dot" style="margin: 0 auto; display:inline-block; width: 12px; height: 12px; border-radius:50%; background:var(--accent); box-shadow:0 0 10px var(--accent); animation:pulse 1.5s infinite;"></div>
            <p style="text-align:center; color:var(--text-secondary); margin-top:16px; font-size:14px;">AI가 조지 할아버지의 일지를 뒤적이며<br>수확량을 계산하고 있어요...</p>
        </div>`;

    // Simulate AI processing time
    setTimeout(() => {
        generateAIReportContent();
    }, 2000);
}

function closeAIReport() {
    document.getElementById('aiReportModal').style.display = 'none';
}

function generateAIReportContent() {
    const totalSessions = sessions.length;
    const totalSecs = sessions.reduce((a, s) => a + s.seconds, 0);
    const totalHours = (totalSecs / 3600).toFixed(1);

    const doneCount = sessions.filter(s => s.result === 'done').length;
    const failCount = sessions.filter(s => s.result === 'fail').length;
    const rate = Math.round((doneCount / totalSessions) * 100) || 0;

    // Find top crop
    let catTime = {};
    sessions.forEach(s => {
        if (!catTime[s.catName]) catTime[s.catName] = 0;
        catTime[s.catName] += s.seconds;
    });
    const cEntries = Object.entries(catTime).sort((a, b) => b[1] - a[1]);
    const topCropName = cEntries.length > 0 ? cEntries[0][0] : '없음';

    // Find biggest obstacle
    let tagTime = {};
    sessions.filter(s => s.result === 'fail' && s.tags).forEach(s => {
        s.tags.forEach(t => {
            tagTime[t] = (tagTime[t] || 0) + 1;
        });
    });
    const tEntries = Object.entries(tagTime).sort((a, b) => b[1] - a[1]);
    const topObstacle = tEntries.length > 0 ? tEntries[0][0] : '알 수 없는 피로감';

    let aiQuote = '';
    if (rate >= 80) aiQuote = `"올해 수확은 마을 품평회 1등 감이구먼! 아주 훌륭한 일꾼이야."`;
    else if (rate >= 50) aiQuote = `"비가 오나 눈이 오나 밭에 나간 흔적이 보이네. 내년엔 더 큰 수확을 기대하겠네!"`;
    else aiQuote = `"음.. 올해 농사는 잡초랑 씨름하다 끝난 것 같군. 거름을 많이 줬으니 다음 시즌엔 풍년일세."`;

    const nextAdvice = topObstacle === '스마트폰' ? '밭일할 때는 스마트폰을 오두막에 두고 가보는 건 어떨까요? 흙내음에 집중해보세요!' :
        topObstacle === '피로감' ? '스타드롭 하나 먹고 푹 자는 것도 농사의 일부랍니다. 체력을 보충하고 다시 시작하세요.' :
            '실패는 훌륭한 고급 거름입니다. 이번 수확의 경험을 바탕으로 나만의 리듬을 찾아보세요!';

    const html = `
        <div class="ai-report-body" style="background: rgba(255,255,255,0.7); border-radius: 16px; margin: 8px 0;">
            <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 20px; line-height:1.5;">
                🧙‍♂️ AI 촌장님의 한 줄 평: <br><strong style="color:var(--text-primary); font-size: 15px;">${aiQuote}</strong>
            </div>
            
            <div class="report-stats" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="r-stat-box" style="background: rgba(16, 185, 129, 0.1); padding: 14px 10px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 26px; margin-bottom: 6px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🌟</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2px;">수확 성공률</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--accent);">${rate}%</div>
                </div>
                <div class="r-stat-box" style="background: rgba(245, 158, 11, 0.1); padding: 14px 10px; border-radius: 12px; text-align: center;">
                    <div style="font-size: 26px; margin-bottom: 6px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">👑</div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 2px;">최고 수확 작물</div>
                    <div style="font-size: 16px; font-weight: 700; color: var(--warning); padding-top:2px;">${topCropName}</div>
                </div>
            </div>

            <div style="margin-top: 24px; background: rgba(0,0,0,0.03); padding: 16px; border-radius: 12px;">
                <div style="font-size: 14px; font-weight: 700; margin-bottom: 12px; display:flex; align-items:center; gap:6px;">
                    <span style="font-size:16px">📊</span> 이번 시즌 영농 기록
                </div>
                <ul style="font-size: 13.5px; list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; color: var(--text-secondary);">
                    <li>⏱ 총 밭에 나간 시간: <strong style="color:var(--text-primary)">${totalHours}시간</strong></li>
                    <li>🌧 가장 많은 병충해(거름): <strong style="color:var(--text-primary)">${topObstacle}</strong> (${tEntries.length > 0 ? tEntries[0][1] : 0}회)</li>
                    <li>🧪 생산한 최고급 거름: <strong style="color:var(--text-primary)">${failCount}포대</strong> (중단 횟수)</li>
                </ul>
            </div>
            
            <div style="margin-top:20px; padding: 16px; background: rgba(230, 244, 255, 0.6); border-radius: 12px; text-align:center; border: 1px solid rgba(16, 185, 129, 0.2);">
                <div style="font-size:28px; margin-bottom: 8px;">🧑‍🌾</div>
                <div style="font-size:14px; font-weight:700; color: var(--text-primary);">다음 시즌을 위한 AI 조언</div>
                <div style="font-size:13px; color: var(--text-secondary); margin-top:8px; line-height:1.4; word-break:keep-all;">
                    ${nextAdvice}
                </div>
            </div>
        </div>
    `;
    document.getElementById('aiReportContent').innerHTML = html;
}

// Share AI report image
async function shareAIReport() {
    const reportEl = document.querySelector('#aiReportModal .modal');
    showToast("보고서 캡처 중... 📸");

    // Hide buttons during capture
    const btnsRow = reportEl.querySelector('div[style*="margin-top:16px"]');
    if (btnsRow) btnsRow.style.display = 'none';

    try {
        const canvas = await html2canvas(reportEl, {
            backgroundColor: "#F4F7F6",
            scale: 2,
            useCORS: true,
            windowWidth: Math.min(window.innerWidth, 400)
        });
        const imgUrl = canvas.toDataURL("image/png");
        const a = document.createElement('a');
        a.href = imgUrl;
        a.download = `BloomFarm_AI_Report_${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast("AI 수확 보고서가 캡처되었습니다! ✨");
    } catch (e) {
        showToast("캡처에 실패했어요 😢");
    } finally {
        if (btnsRow) btnsRow.style.display = 'flex';
    }
}

