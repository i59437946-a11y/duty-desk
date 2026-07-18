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
        
        #toast {
            position: fixed; top: -100px; left: 50%; transform: translateX(-50%);
            background: #dc3545; color: white; padding: 15px 25px; border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-weight: bold; font-size: 18px;
            transition: top 0.4s ease-in-out; z-index: 9999; width: 85%; text-align: center;
        }
        #toast.show { top: 20px; }
    </style>
</head>
<body>

    <div id="toast">收到新訊息！</div>
    <audio id="alertSound" src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" preload="auto"></audio>

    <h2>🚨 雙向即時通報系統</h2>
    
    <div class="box">
        <h3>1. 啟用系統推播與語音（平板/電腦皆可點）</h3>
        <button onclick="enableAlerts()" id="enableBtn">點擊此處：開啟通知、音效與語音播報</button>
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

        function enableAlerts() {
            Notification.requestPermission().then(permission => {
                alertsEnabled = true;
                document.getElementById('enableBtn').innerText = "✅ 通知、音效與語音已啟用";
                document.getElementById('enableBtn').style.background = "#28a745";
                
                // 播放一段音效解鎖
                document.getElementById('alertSound').play().catch(()=>{});
                
                // 讓系統真的講一句話來徹底解除瀏覽器限制
                if ('speechSynthesis' in window) {
                    const unlockSpeech = new SpeechSynthesisUtterance('語音系統已連線');
                    unlockSpeech.lang = 'zh-TW';
                    window.speechSynthesis.speak(unlockSpeech);
                }
            });
        }

        function showTopBanner(sender, msg) {
            const toast = document.getElementById('toast');
            toast.innerText = \`🚨 [\${sender}] 傳來訊息：\${msg}\`;
            toast.classList.add('show');
            if (alertsEnabled) {
                document.getElementById('alertSound').play().catch(()=>{});
            }
            setTimeout(() => { toast.classList.remove('show'); }, 5000);
        }

        // 新增：文字轉語音播報功能
        function speakText(sender, msg) {
            if (alertsEnabled && 'speechSynthesis' in window) {
                // 將前方的發送者與訊息組合起來
                const textToSpeak = \`\${sender}，傳來訊息說：\${msg}\`;
                const utterance = new SpeechSynthesisUtterance(textToSpeak);
                
                utterance.lang = 'zh-TW'; // 設定語言為台灣中文
                utterance.rate = 1.0;     // 語速 (1.0為正常，可改 1.2 加快)
                utterance.pitch = 1.0;    // 音調
                
                window.speechSynthesis.speak(utterance);
            }
        }

        ws.onopen = () => { logArea.value += "[系統] 成功連線至伺服器\\n"; };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            logArea.value += \`[\${data.time}] \${data.sender}：\${data.content}\\n\`;
            logArea.scrollTop = logArea.scrollHeight;
            
            // 收到訊息時，同時觸發橫幅與語音播報
            showTopBanner(data.sender, data.content);
            speakText(data.sender, data.content); 

            if (Notification.permission === 'granted' && document.hidden) {
                new Notification(\`🚨 \${data.sender} 傳來新訊息\`, { body: data.content });
            }
        };

        function sendData() {
            const nameInput = document.getElementById('senderName').value || '未命名';
            const msgInput = document.getElementById('msgInput');
            if (!msgInput.value) return;
            
            const payload = { 
                sender: nameInput,
                content: msgInput.value, 
                time: new Date().toLocaleTimeString() 
            };
            
            ws.send(JSON.stringify(payload));
            logArea.value += \`[已發送 \${payload.time}] 我 (\${payload.sender})：\${payload.content}\\n\`;
            logArea.scrollTop = logArea.scrollHeight;
            msgInput.value = ''; 
        }
    </script>
</body>
</html>
    `);
});

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

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => { console.log(`伺服器運行在 port ${PORT}`); });
