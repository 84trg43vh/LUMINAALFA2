// Configuração do Firebase (substitua com suas credenciais)
const firebaseConfig = {
  apiKey: "AIzaSyBPaekXa46JviuBH-ZFCeMZvUhurvMqCoc",
  authDomain: "chat-b2ec6.firebaseapp.com",
  databaseURL: "https://chat-b2ec6-default-rtdb.firebaseio.com",
  projectId: "chat-b2ec6",
  storageBucket: "chat-b2ec6.firebasestorage.app",
  messagingSenderId: "825533610934",
  appId: "1:825533610934:web:3964c78d7f9d88dcb65f17"
};
// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Referências do DOM
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const googleLoginBtn = document.getElementById('google-login');
const logoutBtn = document.getElementById('logout-btn');
const menuBtn = document.getElementById('menu-btn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const messagesContainer = document.getElementById('messages');
const onlineUsersContainer = document.getElementById('online-users');
const onlineCount = document.getElementById('online-count');
const chatTitle = document.getElementById('chat-title');
const userAvatarMenu = document.getElementById('user-avatar-menu');
const userAvatarMenuLarge = document.getElementById('user-avatar-menu-large');
const menuUsername = document.getElementById('menu-username');
const menuEmail = document.getElementById('menu-email');
const sidebar = document.getElementById('sidebar');
const userMenu = document.getElementById('user-menu');
const typingIndicator = document.getElementById('typing-indicator');
const notificationBadge = document.getElementById('notification-badge');

// Variáveis globais
let currentUser = null;
let currentChatId = null;
let currentRecipient = null;
let usersRef, conversationsRef, messagesRef, userStatusRef, typingRef;
let isTyping = false;
let typingTimeout;
let unreadMessages = {};

// Event Listeners
loginBtn.addEventListener('click', loginWithEmail);
signupBtn.addEventListener('click', signUpWithEmail);
googleLoginBtn.addEventListener('click', loginWithGoogle);
logoutBtn.addEventListener('click', logout);
menuBtn.addEventListener('click', toggleSidebar);
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', handleTyping);
messageInput.addEventListener('input', checkTyping);
userAvatarMenu.addEventListener('click', showUserMenu);

// Fecha menus ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.sidebar') && !e.target.closest('.menu-toggle')) {
        sidebar.classList.remove('show');
    }
    if (!e.target.closest('.modal-content') && !e.target.closest('#user-avatar-menu')) {
        userMenu.classList.add('hidden');
    }
});

// Inicializa o app
initApp();

function initApp() {
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            setupChat(user);
            showChatUI(user);
            checkNewMessages();
        } else {
            showAuthUI();
        }
    });
}

// Autenticação
function loginWithEmail() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        alert('Por favor, preencha todos os campos');
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            alert(error.message);
        });
}

function signUpWithEmail() {
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (!email || !password) {
        alert('Por favor, preencha todos os campos');
        return;
    }
    
    auth.createUserWithEmailAndPassword(email, password)
        .catch(error => {
            alert(error.message);
        });
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => {
            alert(error.message);
        });
}

function logout() {
    if (currentUser) {
        database.ref(`status/${currentUser.uid}`).set({
            status: 'offline',
            lastChanged: firebase.database.ServerValue.TIMESTAMP
        });
        
        if (usersRef) usersRef.off();
        if (conversationsRef) conversationsRef.off();
        if (messagesRef) messagesRef.off();
        if (userStatusRef) userStatusRef.off();
        if (typingRef) typingRef.off();
    }
    
    auth.signOut();
}

// Interface
function showAuthUI() {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
    emailInput.value = '';
    passwordInput.value = '';
}

function showChatUI(user) {
    authScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    
    menuUsername.textContent = user.displayName || user.email.split('@')[0];
    menuEmail.textContent = user.email;
    
    if (user.photoURL) {
        userAvatarMenu.style.backgroundImage = `url(${user.photoURL})`;
        userAvatarMenu.textContent = '';
        userAvatarMenuLarge.style.backgroundImage = `url(${user.photoURL})`;
        userAvatarMenuLarge.textContent = '';
    } else {
        const initial = (user.displayName || user.email.charAt(0)).toUpperCase();
        userAvatarMenu.textContent = initial;
        userAvatarMenuLarge.textContent = initial;
    }
}

function toggleSidebar() {
    sidebar.classList.toggle('show');
}

function showUserMenu() {
    userMenu.classList.remove('hidden');
}

// Configuração do Chat
function setupChat(user) {
    usersRef = database.ref('users');
    conversationsRef = database.ref('conversations');
    messagesRef = database.ref('messages');
    userStatusRef = database.ref('status');
    typingRef = database.ref('typing');
    
    usersRef.child(user.uid).set({
        uid: user.uid,
        displayName: user.displayName || user.email.split('@')[0],
        email: user.email,
        photoURL: user.photoURL || null,
        lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
    
    userStatusRef.child(user.uid).set({
        status: 'online',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    });
    
    userStatusRef.child(user.uid).onDisconnect().set({
        status: 'offline',
        lastChanged: firebase.database.ServerValue.TIMESTAMP
    });
    
    loadOnlineUsers();
    openGlobalChat();
}

// Usuários Online
function loadOnlineUsers() {
    userStatusRef.orderByChild('status').equalTo('online').on('value', snapshot => {
        onlineUsersContainer.innerHTML = '';
        let count = 0;
        
        snapshot.forEach(childSnapshot => {
            if (childSnapshot.key !== currentUser.uid) {
                count++;
                
                usersRef.child(childSnapshot.key).once('value', userSnapshot => {
                    const user = userSnapshot.val();
                    if (user) addOnlineUser(user);
                });
            }
        });
        
        onlineCount.textContent = count;
    });
}

function addOnlineUser(user) {
    const userElement = document.createElement('div');
    userElement.classList.add('user-card');
    userElement.dataset.uid = user.uid;
    
    userElement.innerHTML = `
        <div class="user-avatar-sm" style="${user.photoURL ? `background-image: url(${user.photoURL})` : ''}">
            ${user.photoURL ? '' : user.displayName.charAt(0).toUpperCase()}
        </div>
        <div class="user-info">
            <div class="user-name">${user.displayName}</div>
            <div class="user-status">online</div>
        </div>
        <button class="chat-private-btn" data-uid="${user.uid}">
            <i class="fas fa-comment"></i>
        </button>
    `;
    
    userElement.addEventListener('click', () => {
        createPrivateChat(user);
        sidebar.classList.remove('show');
    });
    
    const chatBtn = userElement.querySelector('.chat-private-btn');
    chatBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        createPrivateChat(user);
        sidebar.classList.remove('show');
    });
    
    onlineUsersContainer.appendChild(userElement);
}

// Conversas
function createPrivateChat(recipient) {
    const conversationId = generateConversationId(currentUser.uid, recipient.uid);
    
    database.ref(`conversations/${conversationId}`).once('value', snapshot => {
        if (!snapshot.exists()) {
            const conversation = {
                participants: {
                    [currentUser.uid]: true,
                    [recipient.uid]: true
                },
                created: firebase.database.ServerValue.TIMESTAMP,
                lastUpdated: firebase.database.ServerValue.TIMESTAMP
            };
            database.ref(`conversations/${conversationId}`).set(conversation);
        }
        openPrivateChat(conversationId, recipient);
    });
}

function openGlobalChat() {
    currentChatId = 'global';
    currentRecipient = null;
    chatTitle.textContent = 'Chat Global';
    messagesContainer.innerHTML = '';
    
    if (messagesRef) messagesRef.off();
    
    messagesRef = database.ref('messages/global');
    messagesRef.orderByChild('timestamp').limitToLast(100).on('child_added', snapshot => {
        const message = snapshot.val();
        displayMessage(message);
    });
}

function openPrivateChat(conversationId, recipient) {
    currentChatId = conversationId;
    currentRecipient = recipient;
    chatTitle.textContent = recipient.displayName;
    messagesContainer.innerHTML = '';
    
    // Marca mensagens como lidas
    if (unreadMessages[conversationId]) {
        unreadMessages[conversationId] = 0;
        updateNotificationBadge();
    }
    
    if (messagesRef) messagesRef.off();
    
    messagesRef = database.ref(`messages/${conversationId}`);
    messagesRef.orderByChild('timestamp').limitToLast(100).on('child_added', snapshot => {
        const message = snapshot.val();
        displayMessage(message);
        
        // Marca como lida se for mensagem recebida
        if (message.uid !== currentUser.uid && !message.read) {
            database.ref(`messages/${conversationId}/${message.messageId}/read`).set(true);
        }
    });
    
    setupTypingIndicator(conversationId, recipient);
}

// Mensagens
function displayMessage(message) {
    const isCurrentUser = message.uid === currentUser.uid;
    const messageElement = document.createElement('div');
    
    messageElement.classList.add('message');
    messageElement.classList.add(isCurrentUser ? 'message-user' : 'message-other');
    
    const senderName = isCurrentUser ? 'Você' : message.displayName;
    const readStatus = isCurrentUser ? 
        `<span class="message-read">${message.read ? '✓✓' : '✓'}</span>` : '';
    
    messageElement.innerHTML = `
        ${!isCurrentUser ? `<div class="message-sender">${senderName}</div>` : ''}
        <div class="message-text">${message.text} ${readStatus}</div>
        <div class="message-time">${formatTime(message.timestamp)}</div>
        ${isCurrentUser ? `
        <div class="message-actions">
            <div class="message-action delete" data-message-id="${message.messageId}">
                <i class="fas fa-trash"></i>
            </div>
        </div>
        ` : ''}
    `;
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
    
    if (isCurrentUser) {
        const deleteBtn = messageElement.querySelector('.delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteMessage(message.messageId);
        });
    }
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (text === '' || !currentChatId) return;
    
    const messageId = database.ref().child('messages').push().key;
    const message = {
        messageId: messageId,
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email.split('@')[0],
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP,
        read: currentChatId === 'global' ? true : false
    };
    
    database.ref(`messages/${currentChatId}/${messageId}`).set(message)
        .then(() => {
            if (currentChatId !== 'global') {
                database.ref(`conversations/${currentChatId}`).update({
                    lastMessage: message,
                    lastUpdated: firebase.database.ServerValue.TIMESTAMP
                });
            }
            
            messageInput.value = '';
            stopTyping();
            scrollToBottom();
        })
        .catch(error => {
            console.error('Erro ao enviar mensagem:', error);
        });
}

function deleteMessage(messageId) {
    if (!currentChatId || !messageId) return;
    database.ref(`messages/${currentChatId}/${messageId}`).remove()
        .catch(error => console.error('Erro ao apagar mensagem:', error));
}

// Digitando...
function setupTypingIndicator(conversationId, recipient) {
    if (typingRef) typingRef.off();
    
    typingRef = database.ref(`typing/${conversationId}/${recipient.uid}`);
    typingRef.on('value', (snapshot) => {
        const typingData = snapshot.val();
        
        if (typingData && typingData.isTyping) {
            typingIndicator.innerHTML = `
                <div class="typing">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <p>${recipient.displayName} está digitando...</p>
            `;
            typingIndicator.style.display = 'flex';
        } else {
            typingIndicator.style.display = 'none';
        }
    });
}

function checkTyping() {
    if (!isTyping && messageInput.value.trim() !== '' && currentChatId && currentChatId !== 'global') {
        isTyping = true;
        database.ref(`typing/${currentChatId}/${currentUser.uid}`).set({
            uid: currentUser.uid,
            displayName: currentUser.displayName || currentUser.email.split('@')[0],
            isTyping: true
        });
    } else if (messageInput.value.trim() === '' && isTyping) {
        stopTyping();
    }
}

function handleTyping(e) {
    if (e.key === 'Enter') {
        sendMessage();
        return;
    }
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 2000);
}

function stopTyping() {
    if (isTyping && currentChatId && currentChatId !== 'global') {
        isTyping = false;
        database.ref(`typing/${currentChatId}/${currentUser.uid}`).update({
            isTyping: false
        });
    }
}

// Notificações
function checkNewMessages() {
    conversationsRef.orderByChild(`participants/${currentUser.uid}`).equalTo(true).on('value', (snapshot) => {
        unreadMessages = {};
        let totalUnread = 0;
        
        snapshot.forEach((conversationSnapshot) => {
            const conversation = conversationSnapshot.val();
            const lastMessage = conversation.lastMessage;
            
            if (lastMessage && lastMessage.uid !== currentUser.uid && !lastMessage.read) {
                unreadMessages[conversationSnapshot.key] = (unreadMessages[conversationSnapshot.key] || 0) + 1;
                totalUnread++;
            }
        });
        
        updateNotificationBadge(totalUnread);
    });
}

function updateNotificationBadge(count) {
    if (count > 0) {
        notificationBadge.textContent = count > 9 ? '9+' : count;
        notificationBadge.style.display = 'flex';
    } else {
        notificationBadge.style.display = 'none';
    }
}

// Utilitários
function generateConversationId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}