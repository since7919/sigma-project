/**
 * 로딩 중 랜덤 미니게임 5종 세트
 */
let mg_animationId = null;
let mg_keys = {};
let currentGame = null;

// 공통 키보드 핸들러
window.addEventListener("keydown", (e) => {
    const overlay = document.getElementById('loading-overlay');
    const standalone = document.getElementById('minigame-standalone-modal');
    const isOverlayActive = (overlay && overlay.style.display !== 'none');
    const isStandaloneActive = (standalone && standalone.style.display !== 'none');
    
    if (isOverlayActive || isStandaloneActive) {
        // 방향키 또는 스페이스바 누를 때 스크롤 방지
        if(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
            e.preventDefault();
        }
        mg_keys[e.code] = true;
        if (currentGame && currentGame.isGameOver && e.code === "Space") {
            currentGame.reset();
    canvas.focus();
}
    }
});
window.addEventListener("keyup", (e) => { 
    mg_keys[e.code] = false; 
});

// 공통 루프 중단 확인
function isOverlayHidden() {
    const standalone = document.getElementById('minigame-standalone-modal');
    if (standalone && standalone.style.display !== 'none') return false;
    const overlay = document.getElementById('loading-overlay');
    return (overlay && overlay.style.display === 'none');
}

// ----------------------------------------------------
// 1. 신호등 받기 (과일 먹기 응용)
// ----------------------------------------------------
function initFruitCatch(ctx, canvas, scoreDisplay, titleDisplay, descDisplay) {
    titleDisplay.innerHTML = "🎮 미니게임 1: 신호등 받기";
    descDisplay.innerHTML = "방향키(<strong>←, →</strong>)로 신호등(🚦)을 먹고, 장애물(🚧)을 피하세요!";
    
    let score = 0, isGameOver = false, playerX = 160, playerY = 165;
    let items = [], timer = 0;

    const game = {
        get isGameOver() { return isGameOver; },
        reset: () => {
            score = 0; isGameOver = false; items = []; playerX = 160; timer = 0; loop();
        }
    };

    function update() {
        if (isGameOver) return;
        if (mg_keys["ArrowLeft"] && playerX > 10) playerX -= 5;
        if (mg_keys["ArrowRight"] && playerX < canvas.width - 45) playerX += 5;

        timer++;
        if (timer % 40 === 0) {
            const isObstacle = Math.random() < 0.3;
            items.push({
                x: Math.random() * (canvas.width - 30) + 15, y: -20,
                symbol: isObstacle ? '🚧' : '🚦', type: isObstacle ? 'bad' : 'good',
                speed: Math.random() * 2 + 1.5
            });
        }

        for (let i = items.length - 1; i >= 0; i--) {
            items[i].y += items[i].speed;
            if (items[i].y >= playerY - 10 && items[i].y <= playerY + 20 &&
                items[i].x >= playerX - 5 && items[i].x <= playerX + 35) {
                if (items[i].type === 'good') score += 100; else isGameOver = true;
                items.splice(i, 1);
            } else if (items[i].y > canvas.height) {
                items.splice(i, 1);
            }
        }
        scoreDisplay.textContent = "점수: " + score;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "28px sans-serif";
        ctx.fillText("🚔", playerX, playerY + 20);
        for (let item of items) ctx.fillText(item.symbol, item.x, item.y);
        
        if (isGameOver) drawGameOver(ctx, canvas, score);
    }

    function loop() {
        if (isOverlayHidden()) return;
        update(); draw();
        if (!isGameOver) mg_animationId = requestAnimationFrame(loop);
    }
    
    return game;
}

// ----------------------------------------------------
// 2. 단속 카메라 피하기 (별똥별 피하기 응용)
// ----------------------------------------------------
function initDodger(ctx, canvas, scoreDisplay, titleDisplay, descDisplay) {
    titleDisplay.innerHTML = "🎮 미니게임 2: 난폭운전 피하기";
    descDisplay.innerHTML = "방향키(<strong>↑ ↓ ← →</strong>)로 역주행 차량(🚗)을 피하세요!";
    
    let startTime = 0, survivalTime = 0, isGameOver = false;
    let player = { x: 180, y: 170, size: 8, speed: 4 };
    let stars = [], frameCount = 0;

    const game = {
        get isGameOver() { return isGameOver; },
        reset: () => {
            survivalTime = 0; startTime = Date.now(); isGameOver = false; 
            stars = []; player.x = 180; player.y = 170; frameCount = 0; loop();
        }
    };

    function update() {
        if (isGameOver) return;
        frameCount++;
        survivalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        if (mg_keys["ArrowLeft"] && player.x > 10) player.x -= player.speed;
        if (mg_keys["ArrowRight"] && player.x < canvas.width - 10) player.x += player.speed;
        if (mg_keys["ArrowUp"] && player.y > 10) player.y -= player.speed;
        if (mg_keys["ArrowDown"] && player.y < canvas.height - 10) player.y += player.speed;

        let spawnInterval = Math.max(10, 30 - Math.floor(survivalTime * 1.5));
        if (frameCount % spawnInterval === 0) {
            stars.push({
                x: Math.random() * canvas.width, y: -10,
                vx: (Math.random() - 0.5) * 1.0, vy: Math.random() * 2 + 2,
                size: Math.random() * 4 + 4,
                color: Math.random() > 0.3 ? '#e74c3c' : '#f39c12'
            });
        }

        for (let i = stars.length - 1; i >= 0; i--) {
            let s = stars[i];
            s.x += s.vx; s.y += s.vy;
            if (s.y > canvas.height + 10 || s.x < -10 || s.x > canvas.width + 10) {
                stars.splice(i, 1); continue;
            }
            if (Math.hypot(player.x - s.x, player.y - s.y) < player.size + s.size - 2) {
                isGameOver = true;
            }
        }
        scoreDisplay.textContent = "생존: " + survivalTime + "초";
    }

    function draw() {
        ctx.fillStyle = "rgba(18, 18, 18, 0.4)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!isGameOver) {
            for (let s of stars) {
                ctx.fillStyle = s.color;
                ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = "#3498db";
            ctx.beginPath(); ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#2980b9";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(player.x, player.y, player.size + 3, 0, Math.PI * 2); ctx.stroke();
        } else {
            drawGameOver(ctx, canvas, survivalTime + "초");
        }
    }

    function loop() {
        if (isOverlayHidden()) return;
        update(); draw();
        if (!isGameOver) mg_animationId = requestAnimationFrame(loop);
    }
    
    return game;
}

// ----------------------------------------------------
// 3. 미니 팩맨 (신호 대기조)
// ----------------------------------------------------
function initPacman(ctx, canvas, scoreDisplay, titleDisplay, descDisplay) {
    titleDisplay.innerHTML = "🎮 미니게임 3: 순찰차 팩맨";
    descDisplay.innerHTML = "방향키(<strong>↑ ↓ ← →</strong>)로 불법주차(빨간원)를 피해 코인(노란원)을 드세요!";
    
    let score = 0, isGameOver = false;
    let player = { x: 50, y: 50, size: 10, speed: 2.5, dx: 0, dy: 0 };
    let ghost = { x: 300, y: 150, size: 10, speed: 1.5 };
    let dot = { x: 200, y: 100, size: 6 };

    const game = {
        get isGameOver() { return isGameOver; },
        reset: () => {
            score = 0; isGameOver = false;
            player.x = 50; player.y = 50;
            ghost.x = 300; ghost.y = 150;
            spawnDot(); loop();
        }
    };

    function spawnDot() {
        dot.x = Math.random() * (canvas.width - 40) + 20;
        dot.y = Math.random() * (canvas.height - 40) + 20;
    }

    function update() {
        if (isGameOver) return;

        player.dx = 0; player.dy = 0;
        if (mg_keys["ArrowLeft"]) player.dx = -player.speed;
        if (mg_keys["ArrowRight"]) player.dx = player.speed;
        if (mg_keys["ArrowUp"]) player.dy = -player.speed;
        if (mg_keys["ArrowDown"]) player.dy = player.speed;

        player.x += player.dx; player.y += player.dy;

        if (player.x < 10) player.x = 10;
        if (player.x > canvas.width - 10) player.x = canvas.width - 10;
        if (player.y < 10) player.y = 10;
        if (player.y > canvas.height - 10) player.y = canvas.height - 10;

        if (ghost.x < player.x) ghost.x += ghost.speed;
        if (ghost.x > player.x) ghost.x -= ghost.speed;
        if (ghost.y < player.y) ghost.y += ghost.speed;
        if (ghost.y > player.y) ghost.y -= ghost.speed;

        if (Math.hypot(player.x - dot.x, player.y - dot.y) < player.size + dot.size) {
            score += 100; spawnDot(); ghost.speed += 0.05; // 점점 빨라짐
        }

        if (Math.hypot(player.x - ghost.x, player.y - ghost.y) < player.size) {
            isGameOver = true;
        }
        scoreDisplay.textContent = "점수: " + score;
    }

    function draw() {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (!isGameOver) {
            ctx.fillStyle = "#f1c40f";
            ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = "#3498db";
            ctx.beginPath(); ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = "#e74c3c";
            ctx.beginPath(); ctx.arc(ghost.x, ghost.y, ghost.size, 0, Math.PI * 2); ctx.fill();
        } else {
            drawGameOver(ctx, canvas, score);
        }
    }

    function loop() {
        if (isOverlayHidden()) return;
        update(); draw();
        if (!isGameOver) mg_animationId = requestAnimationFrame(loop);
    }
    
    return game;
}

// ----------------------------------------------------
// 4. 점프! 안전선 넘기 (크롬 공룡 응용)
// ----------------------------------------------------
function initDinoJump(ctx, canvas, scoreDisplay, titleDisplay, descDisplay) {
    titleDisplay.innerHTML = "🎮 미니게임 4: 과속 방지턱 넘기";
    descDisplay.innerHTML = "<strong>스페이스바</strong>를 눌러 방지턱(🚧)을 뛰어넘으세요!";
    
    let score = 0, isGameOver = false, frameCount = 0;
    let player = { x: 50, y: 150, size: 20, vy: 0, gravity: 0.6, jump: -10, grounded: true };
    let obstacles = [];

    const game = {
        get isGameOver() { return isGameOver; },
        reset: () => {
            score = 0; isGameOver = false; frameCount = 0;
            player.y = 150; player.vy = 0; player.grounded = true;
            obstacles = []; loop();
        }
    };

    function update() {
        if (isGameOver) return;
        frameCount++;
        score = Math.floor(frameCount / 10);
        
        if (mg_keys["Space"] && player.grounded) {
            player.vy = player.jump;
            player.grounded = false;
        }

        player.vy += player.gravity;
        player.y += player.vy;
        
        if (player.y >= 150) {
            player.y = 150;
            player.grounded = true;
        }

        if (frameCount % Math.floor(Math.random() * 60 + 60) === 0) {
            obstacles.push({ x: canvas.width, y: 155, w: 15, h: 15, speed: 5 });
        }

        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].x -= obstacles[i].speed;
            
            // AABB 충돌
            if (player.x < obstacles[i].x + obstacles[i].w &&
                player.x + player.size > obstacles[i].x &&
                player.y < obstacles[i].y + obstacles[i].h &&
                player.y + player.size > obstacles[i].y) {
                isGameOver = true;
            }
            if (obstacles[i].x < -20) obstacles.splice(i, 1);
        }
        scoreDisplay.textContent = "점수: " + score;
    }

    function draw() {
        ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 바닥선
        ctx.strokeStyle = "#555"; ctx.beginPath(); ctx.moveTo(0, 170); ctx.lineTo(canvas.width, 170); ctx.stroke();
        
        if (!isGameOver) {
            ctx.font = "24px sans-serif";
            ctx.fillText("🚔", player.x, player.y + 20);
            
            ctx.font = "20px sans-serif";
            for (let obs of obstacles) {
                ctx.fillText("🚧", obs.x, obs.y + 15);
            }
        } else {
            drawGameOver(ctx, canvas, score);
        }
    }

    function loop() {
        if (isOverlayHidden()) return;
        update(); draw();
        if (!isGameOver) mg_animationId = requestAnimationFrame(loop);
    }
    
    return game;
}

// ----------------------------------------------------
// 5. 신호등 타이밍 맞추기
// ----------------------------------------------------
function initReaction(ctx, canvas, scoreDisplay, titleDisplay, descDisplay) {
    titleDisplay.innerHTML = "🎮 미니게임 5: 초록불 반응속도";
    descDisplay.innerHTML = "신호등이 <strong style='color:#2ecc71'>초록색(🟢)</strong>이 되는 순간 <strong>스페이스바</strong>를 누르세요!";
    
    let state = 'waiting'; // waiting -> ready(red) -> go(green) -> over
    let waitTimer = 0, reactTime = 0, score = 0, startTime = 0;
    
    const game = {
        get isGameOver() { return state === 'over'; },
        reset: () => {
            state = 'waiting'; waitTimer = Math.floor(Math.random() * 100) + 60; 
            reactTime = 0; scoreDisplay.textContent = "준비..."; loop();
        }
    };

    function update() {
        if (state === 'waiting') {
            waitTimer--;
            if (waitTimer <= 0) {
                state = 'go';
                startTime = Date.now();
                scoreDisplay.textContent = "지금!!";
            }
            if (mg_keys["Space"]) { // 플라잉
                state = 'over'; score = "실패 (너무 빨랐습니다)";
            }
        } else if (state === 'go') {
            if (mg_keys["Space"]) {
                reactTime = Date.now() - startTime;
                score = reactTime + "ms";
                state = 'over';
                mg_keys["Space"] = false;
            }
        }
    }

    function draw() {
        ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#333";
        ctx.fillRect(canvas.width/2 - 30, canvas.height/2 - 75, 60, 150);
        
        // 빨간불
        ctx.fillStyle = (state === 'waiting') ? "#e74c3c" : "#552222";
        ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2 - 40, 20, 0, Math.PI*2); ctx.fill();
        
        // 초록불
        ctx.fillStyle = (state === 'go' || state === 'over' && typeof score === 'string' && !score.includes('실패')) ? "#2ecc71" : "#225522";
        ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2 + 40, 20, 0, Math.PI*2); ctx.fill();

        if (state === 'over') {
            drawGameOver(ctx, canvas, score);
        }
    }

    function loop() {
        if (isOverlayHidden()) return;
        update(); draw();
        if (state !== 'over') mg_animationId = requestAnimationFrame(loop);
    }
    
    return game;
}

// ----------------------------------------------------
// 헬퍼 함수
// ----------------------------------------------------
function drawGameOver(ctx, canvas, scoreStr) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px 'Malgun Gothic'";
    ctx.textAlign = "center";
    ctx.fillText("게임 종료! (기록: " + scoreStr + ")", canvas.width / 2, canvas.height / 2 - 10);
    ctx.fillStyle = "#f1c40f";
    ctx.font = "12px 'Malgun Gothic'";
    ctx.fillText("스페이스바를 누르면 재시작", canvas.width / 2, canvas.height / 2 + 15);
    ctx.textAlign = "left";
}

// ----------------------------------------------------
// 메인 초기화 (5종 중 1개 랜덤 선택)
// ----------------------------------------------------

// ----------------------------------------------------
// 6. 2048 게임
// ----------------------------------------------------
function init2048(ctx, canvas, scoreDisplay, titleDisplay, descDisplay) {
    titleDisplay.innerHTML = "🎮 미니게임 6: 2048";
    descDisplay.innerHTML = "방향키(<strong>↑↓←→</strong>)로 같은 숫자를 합쳐 2048을 만드세요!";
    
    let score = 0, isGameOver = false;
    let grid = [];
    let keyLocked = { up: false, down: false, left: false, right: false };

    function addRandomTile() {
        let emptyCells = [];
        for (let r=0; r<4; r++) {
            for (let c=0; c<4; c++) {
                if (grid[r][c] === 0) emptyCells.push({r, c});
            }
        }
        if (emptyCells.length > 0) {
            let {r, c} = emptyCells[Math.floor(Math.random() * emptyCells.length)];
            grid[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    const game = {
        get isGameOver() { return isGameOver; },
        reset: () => {
            score = 0; isGameOver = false;
            grid = Array(4).fill().map(() => Array(4).fill(0));
            addRandomTile();
            addRandomTile();
            loop();
        }
    };

    function slide(row) {
        let arr = row.filter(val => val);
        let missing = 4 - arr.length;
        return arr.concat(Array(missing).fill(0));
    }
    
    function combine(row) {
        for (let i = 0; i < 3; i++) {
            if (row[i] !== 0 && row[i] === row[i+1]) {
                row[i] *= 2;
                score += row[i];
                row[i+1] = 0;
            }
        }
        return row;
    }
    
    function operate(row) {
        return slide(combine(slide(row)));
    }

    function moveLeft() {
        let moved = false;
        for (let r=0; r<4; r++) {
            let oldRow = [...grid[r]];
            grid[r] = operate(grid[r]);
            if (oldRow.join(',') !== grid[r].join(',')) moved = true;
        }
        return moved;
    }
    
    function moveRight() {
        let moved = false;
        for (let r=0; r<4; r++) {
            let oldRow = [...grid[r]];
            grid[r] = operate(grid[r].reverse()).reverse();
            if (oldRow.join(',') !== grid[r].join(',')) moved = true;
        }
        return moved;
    }
    
    function moveUp() {
        let moved = false;
        for (let c=0; c<4; c++) {
            let col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
            let oldCol = [...col];
            let newCol = operate(col);
            for (let r=0; r<4; r++) grid[r][c] = newCol[r];
            if (oldCol.join(',') !== newCol.join(',')) moved = true;
        }
        return moved;
    }
    
    function moveDown() {
        let moved = false;
        for (let c=0; c<4; c++) {
            let col = [grid[0][c], grid[1][c], grid[2][c], grid[3][c]];
            let oldCol = [...col];
            let newCol = operate(col.reverse()).reverse();
            for (let r=0; r<4; r++) grid[r][c] = newCol[r];
            if (oldCol.join(',') !== newCol.join(',')) moved = true;
        }
        return moved;
    }

    function checkGameOver() {
        for (let r=0; r<4; r++) {
            for (let c=0; c<4; c++) {
                if (grid[r][c] === 0) return;
                if (c < 3 && grid[r][c] === grid[r][c+1]) return;
                if (r < 3 && grid[r][c] === grid[r+1][c]) return;
            }
        }
        isGameOver = true;
    }

    function update() {
        if (isGameOver) return;
        
        let moved = false;
        if (mg_keys["ArrowUp"]) { if (!keyLocked.up) { moved = moveUp(); keyLocked.up = true; } } else keyLocked.up = false;
        if (mg_keys["ArrowDown"]) { if (!keyLocked.down) { moved = moveDown(); keyLocked.down = true; } } else keyLocked.down = false;
        if (mg_keys["ArrowLeft"]) { if (!keyLocked.left) { moved = moveLeft(); keyLocked.left = true; } } else keyLocked.left = false;
        if (mg_keys["ArrowRight"]) { if (!keyLocked.right) { moved = moveRight(); keyLocked.right = true; } } else keyLocked.right = false;

        if (moved) {
            addRandomTile();
            checkGameOver();
            scoreDisplay.textContent = "점수: " + score;
        }
    }

    const colors = {
        0: "#cdc1b4", 2: "#eee4da", 4: "#ede0c8", 8: "#f2b179",
        16: "#f59563", 32: "#f67c5f", 64: "#f65e3b", 128: "#edcf72",
        256: "#edcc61", 512: "#edc850", 1024: "#edc53f", 2048: "#edc22e"
    };

    function draw() {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = "#bbada0";
        ctx.fillRect(85, 5, 190, 190);
        
        for (let r=0; r<4; r++) {
            for (let c=0; c<4; c++) {
                let val = grid[r][c];
                let cx = 85 + 6 + c * 46;
                let cy = 5 + 6 + r * 46;
                
                ctx.fillStyle = colors[val] || "#3c3a32";
                ctx.fillRect(cx, cy, 40, 40);
                
                if (val > 0) {
                    ctx.fillStyle = val <= 4 ? "#776e65" : "#f9f6f2";
                    ctx.font = val > 100 ? "bold 13px sans-serif" : "bold 18px sans-serif";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(val, cx + 20, cy + 20);
                }
            }
        }
        
        if (isGameOver) drawGameOver(ctx, canvas, score);
    }

    function loop() {
        if (isOverlayHidden()) return;
        update();
        draw();
        if (!isGameOver) mg_animationId = requestAnimationFrame(loop);
    }
    
    return game;
}

function initMiniGameMaster(forceGameIndex = -1) {
    let container = document.getElementById("minigame-container");
    if (!container) {
        const overlay = document.getElementById('loading-overlay');
        if (!overlay) return; // 로딩 오버레이 자체가 없으면 포기
        
        container = document.createElement('div');
        container.id = 'minigame-container';
        container.style.cssText = "background: rgba(0,0,0,0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); width: 400px; text-align: center; margin-top: 20px;";
        container.innerHTML = `
            <h4 style="color: #00d4ff; margin: 0 0 10px 0; font-size: 14px;">🎮 휴식 타임 미니게임</h4>
            <div style="display:flex; justify-content:center; gap:5px; margin-bottom:10px;">
                <button onclick="initMiniGameMaster(0)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">과일</button>
                <button onclick="initMiniGameMaster(1)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">회피</button>
                <button onclick="initMiniGameMaster(2)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">팩맨</button>
                <button onclick="initMiniGameMaster(3)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">공룡</button>
                <button onclick="initMiniGameMaster(4)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">반응</button>
                <button onclick="initMiniGameMaster(5)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">2048</button>
            </div>
            <canvas id="minigameCanvas" width="360" height="200" tabindex="0" style="background: #111; border-radius: 5px; display: block; margin: 0 auto; box-shadow: inset 0 0 10px rgba(0,0,0,0.8); outline:none;"></canvas>
            <div id="minigame-score" style="font-size: 14px; font-weight: bold; color: #f1c40f; margin-top: 10px;">점수: 0</div>
            <p style="color: #888; font-size: 11px; margin: 5px 0 0 0;">방향키(스페이스바)를 사용하여 플레이하세요!</p>
`;
        overlay.appendChild(container);
    }

    const canvas = document.getElementById("minigameCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const scoreDisplay = document.getElementById("minigame-score");
    const titleDisplay = document.querySelector("#minigame-container h4");
    const descDisplay = document.querySelector("#minigame-container p");

    const games = [initFruitCatch, initDodger, initPacman, initDinoJump, initReaction, init2048];
    const selectedGame = forceGameIndex >= 0 && forceGameIndex < games.length ? games[forceGameIndex] : games[Math.floor(Math.random() * games.length)];
    
    if (mg_animationId) cancelAnimationFrame(mg_animationId);
    
    // 선택된 게임 실행
    currentGame = selectedGame(ctx, canvas, scoreDisplay, titleDisplay, descDisplay);
    currentGame.reset();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initMiniGameMaster(-1));
} else {
    initMiniGameMaster(-1);
}


window.playStandaloneMiniGame = function() {
    let modal = document.getElementById('minigame-standalone-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'minigame-standalone-modal';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:999999; display:flex; align-items:center; justify-content:center; flex-direction:column; backdrop-filter:blur(5px);";
        
        const closeBtn = document.createElement('div');
        closeBtn.innerHTML = "❌ 닫기";
        closeBtn.style.cssText = "position:absolute; top:20px; right:30px; color:#fff; font-size:24px; cursor:pointer; font-weight:bold;";
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
        modal.appendChild(closeBtn);
        
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    
    let container = document.getElementById("minigame-container");
    if (!container) {
        container = document.createElement('div');
        container.id = 'minigame-container';
        container.style.cssText = "background: rgba(0,0,0,0.5); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1); width: 400px; text-align: center; margin-top: 20px;";
        container.innerHTML = `
            <h4 style="color: #00d4ff; margin: 0 0 10px 0; font-size: 14px;">🎮 휴식 타임 미니게임</h4>
            <div style="display:flex; justify-content:center; gap:5px; margin-bottom:10px;">
                <button onclick="initMiniGameMaster(0)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">과일</button>
                <button onclick="initMiniGameMaster(1)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">회피</button>
                <button onclick="initMiniGameMaster(2)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">팩맨</button>
                <button onclick="initMiniGameMaster(3)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">공룡</button>
                <button onclick="initMiniGameMaster(4)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">반응</button>
                <button onclick="initMiniGameMaster(5)" style="background:#333; color:#fff; border:1px solid #555; border-radius:3px; font-size:11px; padding:2px 5px; cursor:pointer;" onmouseover="this.style.background='#555'" onmouseout="this.style.background='#333'">2048</button>
            </div>
            <canvas id="minigameCanvas" width="360" height="200" tabindex="0" style="background: #111; border-radius: 5px; display: block; margin: 0 auto; box-shadow: inset 0 0 10px rgba(0,0,0,0.8); outline:none;"></canvas>
            <div id="minigame-score" style="font-size: 14px; font-weight: bold; color: #f1c40f; margin-top: 10px;">점수: 0</div>
            <p style="color: #888; font-size: 11px; margin: 5px 0 0 0;">방향키(스페이스바)를 사용하여 플레이하세요!</p>
`;
    }
    
    modal.appendChild(container);
    
    // 텍스트 업데이트
    const title = container.querySelector("h4");
    if (title) title.innerHTML = "🎮 휴식 타임 미니게임";
    const p = container.querySelector("p");
    if (p) p.innerHTML = "방향키를 사용하여 플레이하세요!";
    
    const canvas = document.getElementById("minigameCanvas");
    if (canvas) {
        canvas.focus(); // 캔버스에 포커스 (방향키 작동을 위해)
    }

    initMiniGameMaster();
};
