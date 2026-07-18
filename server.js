const { WebSocketServer } = require('ws');
const http = require('http');

// 建立網頁伺服器
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>雙向即時通報系統</title>
    <style>
        body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #f4f6f9; }
        .box { background: white; border: 1px solid #e1e4e8; padding: 20px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        button { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; margin-top: 5px;}
        button:hover { background: #0056b3; }
        input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 16px; margin-bottom: 10px; }
        textarea { width: 100%; height: 300px; margin-top: 10px; box-sizing: border-box; border-radius: 6px; border: 1px solid #ccc; padding: 10px; font-size: 15px; background: #fafafa; }
        
        /* 上方彈出橫幅的樣式 */
        #toast {
            position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
            background: #dc3545; color: white; padding: 15px 25px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-weight: bold; font-size: 18px;
            transition: top 0.4s ease-in-out; z-index: 9999; width: 85%; text-align: center;
        }
        #toast.show { top: 20px; } /* 顯示時往下掉 */
    </style>
</head>
<body>

    <!-- 網頁內置的上方彈出橫幅 -->
    <div id="toast">收到新訊息！</div>
    
    <!-- 提示音效 (使用免版權音效) -->
    <audio id="alertSound" src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto"></audio>

    <h2>🚨 雙向即時通報系統</h2>
    
    <div class="box">
        <h3>1. 啟用系統推播（平板/電腦皆可點）</h3>
        <button onclick="enableAlerts()" id="enableBtn">點擊此處：開啟通知與音效權限</button>
    </div>

    <div class="box">
        <h3>2. 發送訊息</h3>
        <input type="text" id="senderName" placeholder="您是誰？ (例如: 值班台 / 平板1號)" value="">
        <input type="text" id="msgInput" placeholder="請輸入要傳送的訊息內容...">
        <button onclick="sendData()">發送訊息</button>
    </div>

    <div class="box">
        <h3>💬 訊息紀錄</h3>
        <textarea id="logArea" readonly></textarea>
    </div>

    <script>
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProtocol + window.location.host);
        const logArea = document.getElementById('logArea');
        let alertsEnabled = false;

        // 啟用通知與音效權限
        function enableAlerts() {
            Notification.requestPermission().then(permission => {
                alertsEnabled = true;
                document.getElementById('enableBtn').innerText = "✅ 通知與音效已啟用";
                document.getElementById('enableBtn').style.background = "#28a745";
                // 播放一段無聲來解鎖瀏覽器的音效限制
                document.getElementById('alertSound').play().catch(()=>{});
            });
        }

        // 顯示上方彈出橫幅與音效
        function showTopBanner(sender, msg) {
            const toast = document.getElementById('toast');
            toast.innerText = \`🚨 [\${sender}] 傳來訊息：\${msg}\`;
            toast.classList.add('show');
            
            if (alertsEnabled) {
                document.getElementById('alertSound').play().catch(()=>{});
            }

            // 5秒後自動收起
            setTimeout(() => { toast.classList.remove('show'); }, 5000);
        }

        ws.onopen = () => { logArea.value += "[系統] 成功連線至伺服器\\n"; };
        
        // 接收到對方傳來的訊息
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            logArea.value += \`[\${data.time}] \${data.sender}：\${data.content}\\n\`;
            logArea.scrollTop = logArea.scrollHeight;
            
            // 觸發網頁內的上方橫幅與音效
            showTopBanner(data.sender, data.content);

            // 若平板螢幕關閉或切換到其他APP，觸發系統級推播
            if (Notification.permission === 'granted' && document.hidden) {
                new Notification(\`🚨 \${data.sender} 傳來新訊息\`, { body: data.content });
            }
        };

        // 發送訊息給對方
        function sendData() {
            const nameInput = document.getElementById('senderName').value || '未命名';
            const msgInput = document.getElementById('msgInput');
            
            if (!msgInput.value) return;
            
            const payload = { 
                sender: nameInput,
                content: msgInput.value, 
                time: new Date().toLocaleTimeString() 
            };
            
            // 透過 WebSocket 送給對方
            ws.send(JSON.stringify(payload));
            
            // 顯示在自己的畫面上
            logArea.value += \`[已發送 \${payload.time}] 我 (\${payload.sender})：\${payload.content}\\n\`;
            logArea.scrollTop = logArea.scrollHeight;
            msgInput.value = ''; // 清空對話框
        }
    </script>
</body>
</html>
    `);
});

// 啟動 WebSocket
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
    ws.on('message', (rawData) => {
        try {
            const data = JSON.parse(rawData);
            // 收到訊息後，廣播給除了發送者以外的所有連線裝置
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === 1) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (e) {}
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => { console.log(`伺服器運行在 port ${PORT}`); });
