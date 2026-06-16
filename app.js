// 1. ตรวจสอบและใส่ API Key จริงของคุณที่นี่ (ต้องขึ้นต้นด้วย AIzaSy...)
// โค้ดใหม่ที่ปรับปรุงแล้วใน app.js (Frontend)
const API_URL = 'http://localhost:3000/api/chat';

// เลือก DOM Elements
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-container');
const newChatBtn = document.getElementById('new-chat-btn');
const historyList = document.getElementById('history-list');

// โครงสร้างประวัติการสนทนาในรอบปัจจุบัน (ส่งให้ API เพื่อจำบริบทสั้นๆ)
let currentChatHistory = [];

// ค้นหาความจำหลักที่เก็บใน LocalStorage (ใช้สำหรับแสดงผลที่แถบ Sidebar)
let savedConversations = JSON.parse(localStorage.getItem('robot_ai_chats')) || [];

// --- ฟังก์ชันหลักในการแสดงข้อความขึ้นหน้าจอ ---
function appendMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${sender}-message`);

    const avatarHTML = sender === 'user' 
        ? `<div class="avatar"><i class="fa-solid fa-user"></i></div>`
        : `<div class="avatar"><i class="fa-solid fa-robot"></i></div>`;

    // ตรวจสอบว่าถ้าเป็น AI ให้แปลง Markdown เป็น HTML ก่อน
    let formattedText = text;
    if (sender === 'ai' && typeof marked !== 'undefined' && text !== 'กำลังประมวลผลคำตอบ...') {
        formattedText = marked.parse(text);
    }

    messageDiv.innerHTML = `
        ${avatarHTML}
        <div class="message-content">${formattedText}</div>
    `;

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight; // Auto-scroll to bottom
}

// --- ฟังก์ชันเรียกใช้ Gemini API ---
async function fetchGeminiResponse(userPrompt) {
    const contents = [...currentChatHistory, { role: "user", parts: [{ text: userPrompt }] }];

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: contents,
                systemInstruction: {
                    parts: [{
                        text: "คุณคือ Robot AI ผู้ช่วยอัจฉริยะที่สุภาพเรียบร้อย ตอบคำถามด้วยภาษาไทยที่ถูกต้อง เป็นทางการแต่นุ่มนวล ทุกครั้งที่ตอบคำถามที่มีเนื้อหาขนาดยาวหรือเป็นขั้นตอน ให้จัดเรียงเป็นหัวข้อ (Bullet points) และเว้นบรรทัดให้ชัดเจน อ่านง่าย ห้ามเขียนข้อความต่อกันเป็นพืดเด็ดขาด"
                    }]
                }
            })
        });

        if (!response.ok) throw new Error('API Response Error');

        const data = await response.json();
        const replyText = data.candidates[0].content.parts[0].text;
        return replyText;

    } catch (error) {
        console.error("Error connecting to Gemini API:", error);
        return "ขออภัยค่ะ เกิดข้อผิดพลาดในการเชื่อมต่อระบบฐานข้อมูลของ Robot AI";
    }
}

// --- อีเวนต์เมื่อกดส่งคำถาม ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message) return;

    // 1. แสดงฝั่ง User
    appendMessage('user', message);
    userInput.value = '';

    // 2. แสดงสถานะ Loading
    appendMessage('ai', 'กำลังประมวลผลคำตอบ...');
    const loadingMessage = chatContainer.lastElementChild;

    // 3. ส่งข้อมูลไปหา API
    const aiReply = await fetchGeminiResponse(message);

    // 4. ลบข้อความกำลังประมวลผล แล้วใส่คำตอบจริงแทน
    if (loadingMessage) loadingMessage.remove();
    appendMessage('ai', aiReply);

    // 5. บันทึกเข้าประวัติแชตย่อย (Context)
    currentChatHistory.push({ role: "user", parts: [{ text: message }] });
    currentChatHistory.push({ role: "model", parts: [{ text: aiReply }] });

    // 6. อัปเดตข้อมูลลงฐานความจำหลัก (LocalStorage)
    saveCurrentSessionToStorage(message);
});

// --- ระบบบันทึกประวัติลง LocalStorage ---
function saveCurrentSessionToStorage(firstMessage) {
    if (currentChatHistory.length === 2) {
        const newRecord = {
            id: Date.now(),
            title: firstMessage.length > 20 ? firstMessage.substring(0, 20) + '...' : firstMessage,
            dialogue: currentChatHistory
        };
        savedConversations.unshift(newRecord);
    } else {
        if(savedConversations.length > 0) {
            savedConversations[0].dialogue = currentChatHistory;
        }
    }
    localStorage.setItem('robot_ai_chats', JSON.stringify(savedConversations));
    renderSidebarHistory();
}

// --- ฟังก์ชันแสดงรายชื่อประวัติที่แถบ Sidebar ---
function renderSidebarHistory() {
    historyList.innerHTML = '';
    savedConversations.forEach(chat => {
        const li = document.createElement('li');
        li.classList.add('history-item');
        li.innerHTML = `<i class="fa-regular fa-comment"></i> ${chat.title}`;
        li.addEventListener('click', () => loadPastConversation(chat));
        historyList.appendChild(li);
    });
}

// ฟังก์ชันโหลดแชตเก่าขึ้นมาดู
function loadPastConversation(chat) {
    chatContainer.innerHTML = '';
    currentChatHistory = chat.dialogue;
    
    currentChatHistory.forEach(msg => {
        const sender = msg.role === 'user' ? 'user' : 'ai';
        appendMessage(sender, msg.parts[0].text);
    });
}

// --- ฟังก์ชันกดเริ่มแชตใหม่ ---
newChatBtn.addEventListener('click', () => {
    chatContainer.innerHTML = `
        <div class="message ai-message">
            <div class="avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">เริ่มการสนทนาใหม่แล้วค่ะ มีอะไรให้ Robot AI ช่วยไหมคะ?</div>
        </div>
    `;
    currentChatHistory = [];
});

// รันครั้งแรกเมื่อโหลดหน้าเว็บ
renderSidebarHistory();