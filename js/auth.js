// frontend/js/auth.js
let selectedProfile = null;
let currentSessionUser = null;
let enteredPin = "";

const profileListEl = document.getElementById('profileList');
const pinModalEl = document.getElementById('pinModal');
const pinBoxCardEl = document.getElementById('pinBoxCard');
const modalUserNameEl = document.getElementById('modalUserName');
const pinErrorMsgEl = document.getElementById('pinErrorMsg');

function renderProfiles() {
  profileListEl.innerHTML = '';
  CONFIG.PROFILES.forEach(profile => {
    const card = document.createElement('div');
    card.className = 'profile-card';
    card.innerHTML = `
      <img src="${profile.avatar}" class="profile-avatar" alt="${profile.name}">
      <span class="profile-name">${profile.name}</span>
    `;
    card.onclick = () => openPinModal(profile);
    profileListEl.appendChild(card);
  });
}

function openPinModal(profile) {
  selectedProfile = profile;
  enteredPin = "";
  pinErrorMsgEl.innerText = "";
  modalUserNameEl.innerText = `Mã PIN của ${profile.name}`;
  updatePinDots();
  pinModalEl.classList.remove('hidden');
}

function closePinModal() {
  pinModalEl.classList.add('hidden');
  selectedProfile = null;
  enteredPin = "";
}

function pressNum(num) {
  if (enteredPin.length < 6) {
    enteredPin += num;
    updatePinDots();
  }

  // Tự động kiểm tra ngay khi đủ 6 ký tự
  if (enteredPin.length === 6) {
    setTimeout(verifyPin, 100);
  }
}

function deleteNum() {
  if (enteredPin.length > 0) {
    enteredPin = enteredPin.slice(0, -1);
    pinErrorMsgEl.innerText = "";
    updatePinDots();
  }
}

function updatePinDots() {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById(`dot${i}`);
    if (i < enteredPin.length) {
      dot.classList.add('filled');
    } else {
      dot.classList.remove('filled');
    }
  }
}

function verifyPin() {
  if (!selectedProfile) return;

  if (enteredPin === selectedProfile.pin) {
    // ĐÚNG MÃ PIN -> ĐĂNG NHẬP VÀO DASHBOARD
    currentSessionUser = selectedProfile;
    pinModalEl.classList.add('hidden');
    document.getElementById('netflixScreen').classList.add('hidden');
    document.getElementById('mainDashboard').classList.remove('hidden');
    initDashboard(currentSessionUser);
  } else {
    // SAI MÃ PIN -> Rung lắc và chửi đúng câu yêu cầu
    pinErrorMsgEl.innerText = "Cặc!!! Sai PASS rồi!";
    pinBoxCardEl.classList.add('error-shake');
    
    setTimeout(() => {
      pinBoxCardEl.classList.remove('error-shake');
      enteredPin = "";
      updatePinDots();
    }, 600);
  }
}

// Bắt cả bàn phím cứng trên máy tính
window.addEventListener('keydown', (e) => {
  if (pinModalEl.classList.contains('hidden')) return;
  if (e.key >= '0' && e.key <= '9') {
    pressNum(e.key);
  } else if (e.key === 'Backspace') {
    deleteNum();
  } else if (e.key === 'Escape') {
    closePinModal();
  }
});

document.getElementById('btnLogout').onclick = () => {
  currentSessionUser = null;
  document.getElementById('mainDashboard').classList.add('hidden');
  document.getElementById('netflixScreen').classList.remove('hidden');
};

renderProfiles();