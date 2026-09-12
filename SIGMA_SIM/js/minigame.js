/**
 * 로딩 중 미니게임 (안전운전 - 과일먹기 응용)
 */
let mg_score = 0;
let mg_isGameOver = false;
let mg_playerX = 160;
const mg_playerY = 165;
let mg_keys = {};
let mg_items = [];
let mg_timer = 0;
let mg_animationId = null;

function initMiniGame() {
    const canvas = document.getElementById("minigameCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const scoreDisplay = document.getElementById("minigame-score");

    function resetGame() {
        mg_score = 0;
        mg_isGameOver = false;
        mg_items = [];
        mg_playerX = 160;
        loop();
    }

    function update() {
        if (mg_isGameOver) return;

        if (mg_keys["ArrowLeft"] && mg_playerX > 10) mg_playerX -= 5;
        if (mg_keys["ArrowRight"] && mg_playerX < canvas.width - 45) mg_playerX += 5;

        mg_timer++;
        if (mg_timer % 40 === 0) {
            const isObstacle = Math.random() < 0.3;
            mg_items.push({
                x: Math.random() * (canvas.width - 30) + 15,
                y: -20,
                symbol: isObstacle ? '🚧' : '🚦',
                type: isObstacle ? 'bad' : 'good',
                speed: Math.random() * 2 + 1.5
            });
        }

        for (let i = mg_items.length - 1; i >= 0; i--) {
            mg_items[i].y += mg_items[i].speed;

            if (mg_items[i].y >= mg_playerY - 10 && mg_items[i].y <= mg_playerY + 20 &&
                mg_items[i].x >= mg_playerX - 5 && mg_items[i].x <= mg_playerX + 35) {
                
                if (mg_items[i].type === 'good') {
                    mg_score += 100;
                } else {
                    mg_isGameOver = true;
                }
                mg_items.splice(i, 1);
            } else if (mg_items[i].y > canvas.height) {
                mg_items.splice(i, 1);
            }
        }
        scoreDisplay.textContent = "점수: " + mg_score;
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.font = "28px sans-serif";
        ctx.fillText("🚔", mg_playerX, mg_playerY + 20);

        for (let item of mg_items) {
            ctx.fillText(item.symbol, item.x, item.y);
        }

        if (mg_isGameOver) {
            ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = "#ffffff";
            ctx.font = "16px 'Malgun Gothic'";
            ctx.textAlign = "center";
            ctx.fillText("사고 발생! (최종 점수: " + mg_score + ")", canvas.width / 2, canvas.height / 2 - 10);
            
            ctx.fillStyle = "#f1c40f";
            ctx.font = "12px 'Malgun Gothic'";
            ctx.fillText("스페이스바를 누르면 재시작", canvas.width / 2, canvas.height / 2 + 15);
            ctx.textAlign = "left";
        }
    }

    function loop() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && overlay.style.display === 'none') {
            return;
        }

        update();
        draw();
        
        if (!mg_isGameOver) {
            mg_animationId = requestAnimationFrame(loop);
        }
    }

    window.addEventListener("keydown", (e) => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && overlay.style.display !== 'none') {
            mg_keys[e.code] = true;
            if (mg_isGameOver && e.code === "Space") {
                resetGame();
            }
        }
    });
    window.addEventListener("keyup", (e) => { 
        mg_keys[e.code] = false; 
    });

    resetGame();
}

document.addEventListener("DOMContentLoaded", () => {
    initMiniGame();
});
