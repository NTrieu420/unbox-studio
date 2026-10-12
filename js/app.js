// frontend/js/app.js
let cachedItems = [];

function initDashboard(user) {
  document.getElementById('displayRoleName').innerText = `${user.name} (${user.badge})`;

  const formSection = document.getElementById('itemFormSection');
  const liveSection = document.getElementById('liveReportSection');
  const thAction = document.getElementById('thAction');
  const thStatus = document.getElementById('thStatus');

  if (user.id === 'KIMMIE') {
    formSection.classList.add('hidden');
    liveSection.classList.add('hidden');
    thAction.classList.add('hidden');
    if (thStatus) thStatus.style.display = 'none'; // Ẩn cột Trạng Thái với Kimmie
  } else {
    formSection.classList.remove('hidden');
    liveSection.classList.remove('hidden');
    thAction.classList.remove('hidden');
    if (thStatus) thStatus.style.display = '';     // Hiện lại với Củn và Ngân
  }

  loadData(user.id);
}

async function loadData(roleId) {
  try {
    const res = await fetch(`${CONFIG.SCRIPT_API_URL}?role=${roleId}`);
    const data = await res.json();
    cachedItems = data.items || [];
    
    // Cập nhật chỉ số KPI
    if (data.jointSummary) {
      document.getElementById('jointCapitalTotal').innerText = (data.jointSummary.totalJointCapital || 0).toLocaleString('vi-VN') + " đ";
      document.getElementById('kimmieShareVal').innerText = (data.jointSummary.kimmieContribution30 || 0).toLocaleString('vi-VN') + " đ";
      document.getElementById('cunNganShareVal').innerText = (data.jointSummary.cunNganContribution70 || 0).toLocaleString('vi-VN') + " đ";
    }

    renderTable(cachedItems, roleId);
    renderLiveSelect(cachedItems);
    renderLiveReports(data.liveReports || []);
  } catch (err) {
    console.error("Lỗi:", err);
  }
}

// Đổ danh sách sản phẩm vào dropdown để Ngân chọn báo cáo live
function renderLiveSelect(items) {
  const select = document.getElementById('liveItemSelect');
  select.innerHTML = '<option value="">-- Chọn mặt hàng đã khui --</option>';
  items.filter(it => it.status === 'DA_DUYET').forEach(it => {
    select.innerHTML += `<option value="${it.id}">${it.name} (Còn kho: ${it.stock})</option>`;
  });
}

// Thay đoạn renderTable trong frontend/js/app.js:
function renderTable(items, roleId) {
  const tbody = document.getElementById('inventoryList');
  tbody.innerHTML = '';
  
  // Đổi tiêu đề bảng linh hoạt
  const tableTitle = document.querySelector('.table-section h3') || document.querySelectorAll('.section-box h3')[2];
  if (tableTitle) {
    tableTitle.innerText = (roleId === 'KIMMIE') ? '📋 Danh Mục Hàng Hóa Vốn Chung' : '📋 Danh Mục Kho & Trạng Thái Duyệt';
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    const isPending = item.status === 'CHO_DUYET';
    let actionBtn = '-';
    if (roleId === 'CUN' && isPending) {
      actionBtn = `<button class="btn-approve" onclick="approveItem('${item.id}')">Duyệt ngay</button>`;
    }

    tr.innerHTML = `
      <td><strong>${item.name}</strong></td>
      <td>${item.capitalSource === 'CHUNG_70_30' ? '🤝 Vốn Chung' : '🔒 Vốn Riêng'}</td>
      <td>${Number(item.totalCostVnd).toLocaleString('vi-VN')} đ</td>
      <td>${Number(item.priceTiktok).toLocaleString('vi-VN')} đ</td>
      <td>${Number(item.priceZalo).toLocaleString('vi-VN')} đ</td>
      <td style="color:#facc15">${Number(item.priceDaoVang).toLocaleString('vi-VN')} đ</td>
      <td><strong>${item.stock}</strong></td>
      ${roleId !== 'KIMMIE' ? `
        <td><span class="status-badge ${isPending ? 'status-pending' : 'status-approved'}">${isPending ? 'Chờ duyệt' : 'Đã vào kho'}</span></td>
        <td>${actionBtn}</td>
      ` : ''}
    `;
    tbody.appendChild(tr);
  });
}

function renderLiveReports(reports) {
  const tbody = document.getElementById('liveReportList');
  tbody.innerHTML = '';
  if (reports.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#777;">Chưa có báo cáo phiên live nào</td></tr>';
    return;
  }

  reports.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.date}</td>
      <td><span style="color:#60a5fa">${r.tiktokAcc}</span></td>
      <td>${r.channel === 'TIKTOK_SHOP' ? 'TikTok Shop' : 'Zalo Ngoài'}</td>
      <td><strong>${r.itemName}</strong></td>
      <td>${r.quantity}</td>
      <td style="color:#facc15">${Number(r.daoVangRevenue).toLocaleString('vi-VN')} đ</td>
      <td>${Number(r.totalRevenue).toLocaleString('vi-VN')} đ</td>
      <td style="color:#4ade80; font-weight:700;">+${Number(r.profit).toLocaleString('vi-VN')} đ</td>
    `;
    tbody.appendChild(tr);
  });
}

// Xử lý gửi Báo Cáo Phiên Live
document.getElementById('liveReportForm').onsubmit = async (e) => {
  e.preventDefault();
  
  const payload = {
    action: 'SUBMIT_LIVE_SESSION',
    userRole: currentSessionUser.id,
    data: {
      tiktokAccount: document.getElementById('liveTikTokAcc').value,
      itemId: document.getElementById('liveItemSelect').value,
      orderChannel: document.getElementById('liveOrderChannel').value,
      quantity: document.getElementById('liveQuantity').value,
      itemRevenue: document.getElementById('liveItemRevenue').value,
      daoVangPlays: document.getElementById('daoVangPlays').value,
      daoVangRevenue: document.getElementById('daoVangRevenue').value,
      note: document.getElementById('liveNote').value
    }
  };

  const res = await fetch(CONFIG.SCRIPT_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const resData = await res.json();
  alert(resData.message);
  e.target.reset();
  loadData(currentSessionUser.id);
};

// Xử lý Form nhập kho của Ngân & Củn
document.getElementById('addItemForm').onsubmit = async (e) => {
  e.preventDefault();
  const alertEl = document.getElementById('sweetAlertMsg');
  
  const payload = {
    action: 'CREATE_ITEM',
    userRole: currentSessionUser.id,
    data: {
      name: document.getElementById('itemName').value,
      capitalSource: document.getElementById('capitalSource').value,
      cnyPrice: document.getElementById('cnyPrice').value,
      shippingFeeTqVn: document.getElementById('shippingFeeTqVn').value,
      priceTiktok: document.getElementById('priceTiktok').value,
      priceZalo: document.getElementById('priceZalo').value,
      priceDaoVang: document.getElementById('priceDaoVang').value,
      stock: document.getElementById('stock').value
    }
  };

  const res = await fetch(CONFIG.SCRIPT_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const resData = await res.json();

  if (currentSessionUser.id === 'NGAN') {
    alertEl.innerText = resData.message;
    alertEl.classList.remove('hidden');
    setTimeout(() => alertEl.classList.add('hidden'), 5000);
  } else {
    alert(resData.message);
  }

  e.target.reset();
  loadData(currentSessionUser.id);
};

async function approveItem(itemId) {
  const payload = {
    action: 'APPROVE_ITEM',
    userRole: currentSessionUser.id,
    itemId: itemId
  };

  const res = await fetch(CONFIG.SCRIPT_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  const resData = await res.json();
  alert(resData.message);
  loadData(currentSessionUser.id);
}