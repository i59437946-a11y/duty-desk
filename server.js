const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 建立網頁伺服器
const server = http.createServer((req, res) => {
    // 讓所有人都能直接連進來看網頁
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>值班台即時通報系統</title>
    <style>
        body { font-family: sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; background: #f4f6f9; }
        .box { background: white; border: 1px solid #e1e4e8; padding: 20px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        button { background: #007bff; color: white; border: none; padding: 10px 15px; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; margin-top: 5px;}
        button:hover { background: #0056b3; }
        input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 6px; box-sizing: border-box; font-size: 16px; margin-bottom: 10px; }
        textarea { width: 100%; height: 200px; margin-top: 10px; box-sizing: border-box; border-radius: 6px; border: 1px solid #ccc; padding: 10px; font-size: 14px; background: #fafafa; }
    </style>
</head>
<body>
    <h2>🚨 值班台即時通報</h2>
    <div class="box">
        <h3>步驟一：平板端設定</h3>
        <button onclick="requestNotificationPermission()">點擊此處：開啟平板通知功能</button>
    </div>
    <div class="box">
        <h3>步驟二：發送通知（值班台）</h3>
        <input type="text" id="msgInput" placeholder="請輸入通知內容...">
        <button onclick="sendData()">發送給平板</button>
    </div>
    <div class="box">
        <h3>歷史訊息紀錄</h3>
        <textarea id="logArea" readonly></textarea>
    </div>
    <script>
        // 自動抓取當前網址來建立 WebSocket 連線
        const wsProtocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
        const ws = new WebSocket(wsProtocol + window.location.host);
        const logArea = document.getElementById('logArea');

        function requestNotificationPermission() {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') alert('通知權限已啟用！');
                else alert('您拒絕了通知權限，平板將無法彈出提示。');
            });
        }

        ws.onopen = () => { logArea.value += "[系統] 成功連線至值班中樞\\n"; };
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            logArea.value += \`[\${data.time}] \${data.content}\\n\`;
            logArea.scrollTop = logArea.scrollHeight;
            if (Notification.permission === 'granted') {
                new Notification("🚨 值班台最新消息", { body: data.content });
            }
        };

        function sendData() {
            const input = document.getElementById('msgInput');
            if (!input.value) return;
            const payload = { content: input.value, time: new Date().toLocaleTimeString() };
            ws.send(JSON.stringify(payload));
            logArea.value += \`[已發送 \${payload.time}] \${payload.content}\\n\`;
            input.value = '';
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
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === 1) {
                    client.send(JSON.stringify(data));
                }
            });
        } catch (e) {}
    });
});

// Render 平台會自動分配 port，我們必須讀取環境變數
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`伺服器正運行在 port ${PORT}`);
});
