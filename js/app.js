// frontend/js/app.js
let cachedItems = [];
let cachedDebts = [];
const LOW_STOCK = 5;

/* ---------- Tiện ích ---------- */
const fmtVnd = (n) => (Number(n) || 0).toLocaleString('vi-VN') + ' đ';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function showToast(message, type = 'success') {
  const host = document.getElementById('toastHost');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' error' : '');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

async function postAction(payload) {
  const res = await fetch(CONFIG.SCRIPT_API_URL, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res.json();
}

/* ---------- Logic chuyển Tab ---------- */
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  
  document.getElementById(tabId).classList.remove('hidden');
  if (btn) btn.classList.add('active');
}

/* ---------- Khởi tạo theo quyền ---------- */
function initDashboard(user) {
  document.getElementById('displayRoleName').innerText = `${user.name} (${user.badge})`;
  const avatar = document.getElementById('displayAvatar');
  avatar.src = user.avatar;
  avatar.alt = user.name;

  const isKimmie = user.id === 'KIMMIE';
  
  document.getElementById('itemFormSection').classList.toggle('hidden', isKimmie);
  document.getElementById('liveReportSection').classList.toggle('hidden', isKimmie);
  document.getElementById('debtSection').classList.toggle('hidden', isKimmie); 
  document.getElementById('nav-debt').classList.toggle('hidden', isKimmie);
  document.getElementById('thAction').classList.toggle('hidden', isKimmie);
  document.getElementById('thStatus').classList.toggle('hidden', isKimmie);

  loadData(user.id);
}

async function loadData(roleId) {
  try {
    const res = await fetch(`${CONFIG.SCRIPT_API_URL}?role=${roleId}`);
    const data = await res.json();
    cachedItems = data.items || [];

    if (data.jointSummary) {
      document.getElementById('jointCapitalTotal').innerText = fmtVnd(data.jointSummary.totalJointCapital);
      document.getElementById('kimmieShareVal').innerText = fmtVnd(data.jointSummary.kimmieContribution30);
      document.getElementById('cunNganShareVal').innerText = fmtVnd(data.jointSummary.cunNganContribution70);
    }

    renderTable(cachedItems, roleId);
    renderLiveSelect(cachedItems);
    renderLiveReports(data.liveReports || []);
    
    if (roleId !== 'KIMMIE') {
      cachedDebts = data.debts || [];
      applyDebtFilters(); 
    }
  } catch (err) {
    console.error('Lỗi:', err);
    showToast('Không tải được dữ liệu, thử lại sau nhé.', 'error');
  }
}

/* ---------- Dropdown chọn mặt hàng ---------- */
function renderLiveSelect(items) {
  const select = document.getElementById('liveItemSelect');
  select.innerHTML = '<option value="">-- Chọn mặt hàng đã khui --</option>';
  items.filter(it => it.status === 'DA_DUYET').forEach(it => {
    select.innerHTML += `<option value="${esc(it.id)}">${esc(it.name)} (Còn kho: ${esc(it.stock)})</option>`;
  });
}

/* ---------- Bảng kho ---------- */
function stockCell(stock) {
  const n = Number(stock) || 0;
  let badge = '';
  if (n <= 0) badge = '<span class="stock-badge stock-out">Hết hàng</span>';
  else if (n <= LOW_STOCK) badge = '<span class="stock-badge stock-low">Sắp hết</span>';
  return `<span class="stock-wrap">${badge}<strong>${n}</strong></span>`;
}

function renderTable(items, roleId) {
  const tbody = document.getElementById('inventoryList');
  const isKimmie = roleId === 'KIMMIE';
  tbody.innerHTML = '';

  document.getElementById('inventoryTitle').innerText = isKimmie
    ? '📋 Danh Mục Hàng Hóa Vốn Chung'
    : '📋 Danh Mục Kho & Trạng Thái Duyệt';

  const totalStock = items.reduce((s, it) => s + (Number(it.stock) || 0), 0);
  const pendingCount = items.filter(it => it.status === 'CHO_DUYET').length;
  document.getElementById('inventorySummary').innerHTML =
    `<span class="chip"><b>${items.length}</b> mã hàng</span>` +
    `<span class="chip"><b>${totalStock}</b> hộp tồn kho</span>` +
    (isKimmie ? '' : `<span class="chip"><b>${pendingCount}</b> chờ duyệt</span>`);

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${isKimmie ? 7 : 9}" class="empty-row">Chưa có hàng trong kho</td></tr>`;
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    const isPending = item.status === 'CHO_DUYET';
    const isJoint = item.capitalSource === 'CHUNG_70_30';
    
    // XỬ LÝ NÚT THAO TÁC
    let actionBtn = '-';
    if (roleId === 'CUN') {
      actionBtn = `<div style="display:flex; justify-content:flex-end;">`;
      if (isPending) {
        actionBtn += `<button class="btn-approve" onclick="approveItem('${esc(item.id)}', this)">Duyệt ngay</button>`;
      }
      actionBtn += `<button class="btn-delete" onclick="deleteItem('${esc(item.id)}', this)">Xóa</button>`;
      actionBtn += `</div>`;
    }

    tr.innerHTML = `
      <td class="name-cell" data-label="Tên thẻ"><strong>${esc(item.name)}</strong></td>
      <td data-label="Nguồn vốn"><span class="${isJoint ? 'tag-joint' : 'tag-private'}">${isJoint ? '🤝 Vốn Chung' : '🔒 Vốn Riêng'}</span></td>
      <td class="num" data-label="Vốn gốc">${fmtVnd(item.totalCostVnd)}</td>
      <td class="num" data-label="TikTok">${fmtVnd(item.priceTiktok)}</td>
      <td class="num" data-label="Zalo">${fmtVnd(item.priceZalo)}</td>
      <td class="num gold" data-label="Đào Vàng">${fmtVnd(item.priceDaoVang)}</td>
      <td class="num" data-label="Kho còn">${stockCell(item.stock)}</td>
      ${isKimmie ? '' : `
        <td data-label="Trạng thái"><span class="status-badge ${isPending ? 'status-pending' : 'status-approved'}">${isPending ? 'Chờ duyệt' : 'Đã vào kho'}</span></td>
        <td data-label="Thao tác">${actionBtn}</td>
      `}
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Bảng nhật ký live ---------- */
function renderLiveReports(reports) {
  const tbody = document.getElementById('liveReportList');
  const summary = document.getElementById('liveSummary');
  tbody.innerHTML = '';

  if (reports.length === 0) {
    summary.innerHTML = '';
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">Chưa có báo cáo phiên live nào</td></tr>';
    return;
  }

  const totalRev = reports.reduce((s, r) => s + (Number(r.totalRevenue) || 0), 0);
  const totalProfit = reports.reduce((s, r) => s + (Number(r.profit) || 0), 0);
  summary.innerHTML =
    `<span class="chip"><b>${reports.length}</b> phiên live</span>` +
    `<span class="chip">Doanh thu: <b>${fmtVnd(totalRev)}</b></span>` +
    `<span class="chip">Lãi: <b class="${totalProfit < 0 ? 'red' : 'green'}">${totalProfit < 0 ? '-' : '+'}${fmtVnd(Math.abs(totalProfit))}</b></span>`;

  reports.forEach(r => {
    const profit = Number(r.profit) || 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Thời gian">${esc(r.date)}</td>
      <td data-label="Nick live"><span style="color:#60a5fa">${esc(r.tiktokAcc)}</span></td>
      <td data-label="Kênh bán">${r.channel === 'TIKTOK_SHOP' ? 'TikTok Shop' : 'Zalo Ngoài'}</td>
      <td class="name-cell" data-label="Mặt hàng"><strong>${esc(r.itemName)}</strong></td>
      <td class="num" data-label="SL bán">${esc(r.quantity)}</td>
      <td class="num gold" data-label="Tiền đào vàng">${fmtVnd(r.daoVangRevenue)}</td>
      <td class="num" data-label="Tổng doanh thu">${fmtVnd(r.totalRevenue)}</td>
      <td class="num ${profit < 0 ? 'red' : 'green'}" data-label="Tiền lãi" style="font-weight:700;">${profit < 0 ? '-' : '+'}${fmtVnd(Math.abs(profit))}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Bộ Lọc & Sổ Công Nợ ---------- */
function applyDebtFilters() {
  const searchName = document.getElementById('filterDebtName').value.toLowerCase().trim();
  const filterDate = document.getElementById('filterDebtDate').value;
  const sortType = document.getElementById('sortDebt').value;

  let filtered = cachedDebts.filter(d => {
    const matchName = d.name.toLowerCase().includes(searchName);
    let matchDate = true;
    if (filterDate && d.date) {
      const datePart = d.date.split(' ')[0];
      const parts = datePart.split('/');
      if (parts.length === 3) {
        const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        matchDate = (formattedDate === filterDate);
      } else { matchDate = false; }
    }
    return matchName && matchDate;
  });

  filtered.sort((a, b) => {
    if (sortType === 'owed_desc') return (Number(b.owed) || 0) - (Number(a.owed) || 0);
    if (sortType === 'owed_asc') return (Number(a.owed) || 0) - (Number(b.owed) || 0);
    if (sortType === 'paid_desc') return (Number(b.paid) || 0) - (Number(a.paid) || 0);
    return b.id.localeCompare(a.id);
  });

  renderDebts(filtered);
}

function resetDebtFilters() {
  document.getElementById('filterDebtName').value = '';
  document.getElementById('filterDebtDate').value = '';
  document.getElementById('sortDebt').value = 'newest';
  applyDebtFilters();
}

function renderDebts(debts) {
  const tbody = document.getElementById('debtList');
  const summary = document.getElementById('debtSummary');
  tbody.innerHTML = '';

  const totalPaid = cachedDebts.reduce((s, d) => s + (Number(d.paid) || 0), 0);
  const totalOwed = cachedDebts.reduce((s, d) => s + (Number(d.owed) || 0), 0);

  document.getElementById('totalPaidVal').innerText = fmtVnd(totalPaid);
  document.getElementById('totalOwedVal').innerText = fmtVnd(totalOwed);
  updateDebtChart(totalPaid, totalOwed);

  if (debts.length === 0) {
    summary.innerHTML = '<span class="chip">Không tìm thấy khách hàng nào</span>';
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Không có dữ liệu</td></tr>';
    return;
  }

  summary.innerHTML = `<span class="chip"><b>${debts.length}</b> khách hàng hiển thị</span>`;

  debts.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Ngày">${esc(d.date)}</td>
      <td class="name-cell" data-label="Tên khách"><strong>${esc(d.name)}</strong></td>
      <td class="num green" data-label="Đã trả">${fmtVnd(d.paid)}</td>
      <td class="num red" data-label="Còn thiếu">${fmtVnd(d.owed)}</td>
      <td data-label="Ghi chú">${esc(d.note)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Biểu đồ tròn (Chart.js) ---------- */
let debtChartInstance = null;
function updateDebtChart(paid, owed) {
  const ctx = document.getElementById('debtChart');
  if (!ctx) return;

  if (debtChartInstance) {
    debtChartInstance.destroy();
  }

  debtChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Đã trả', 'Còn nợ'],
      datasets: [{
        data: [paid, owed],
        backgroundColor: ['#34d399', '#f87171'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ca3af', font: { size: 12, family: 'Inter, sans-serif' } }
        }
      },
      cutout: '70%'
    }
  });
}

/* ---------- Các Form Gửi Dữ Liệu ---------- */
document.getElementById('liveReportForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const payload = {
    action: 'SUBMIT_LIVE_SESSION',
    userRole: currentSessionUser.id,
    data: {
      tiktokAccount: document.getElementById('liveTikTokAcc').value,
      itemId: document.getElementById('liveItemSelect').value,
      orderChannel: document.getElementById('liveOrderChannel').value,
      quantity: document.getElementById('liveQuantity').value,
      itemRevenue: document.getElementById('liveItemRevenue').value,
      daoVangPlays: document.getElementById('daoVangPlays').value || 0,
      daoVangRevenue: document.getElementById('daoVangRevenue').value || 0,
      note: document.getElementById('liveNote').value
    }
  };

  try {
    const resData = await postAction(payload);
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    form.reset();
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Gửi báo cáo thất bại.', 'error');
  } finally {
    btn.disabled = false;
  }
};

document.getElementById('debtForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const payload = {
    action: 'CREATE_DEBT',
    userRole: currentSessionUser.id,
    data: {
      name: document.getElementById('debtName').value,
      paid: document.getElementById('debtPaid').value || 0,
      owed: document.getElementById('debtOwed').value || 0,
      note: document.getElementById('debtNote').value
    }
  };

  try {
    const resData = await postAction(payload);
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    form.reset();
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Thêm khách nợ thất bại.', 'error');
  } finally {
    btn.disabled = false;
  }
};

document.getElementById('addItemForm').onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  const alertEl = document.getElementById('sweetAlertMsg');
  btn.disabled = true;

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
      priceDaoVang: document.getElementById('priceDaoVang').value || 0,
      stock: document.getElementById('stock').value
    }
  };

  try {
    const resData = await postAction(payload);

    if (currentSessionUser.id === 'NGAN') {
      alertEl.innerText = resData.message;
      alertEl.classList.remove('hidden');
      setTimeout(() => alertEl.classList.add('hidden'), 5000);
    } else {
      showToast(resData.message, resData.success === false ? 'error' : 'success');
    }

    form.reset();
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Tạo đơn nhập kho thất bại.', 'error');
  } finally {
    btn.disabled = false;
  }
};

async function approveItem(itemId, btn) {
  if (btn) btn.disabled = true;
  try {
    const resData = await postAction({
      action: 'APPROVE_ITEM',
      userRole: currentSessionUser.id,
      itemId: itemId
    });
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Duyệt thất bại.', 'error');
    if (btn) btn.disabled = false;
  }
}

// THÊM HÀM XỬ LÝ NÚT XÓA
async function deleteItem(itemId, btn) {
  // Hiển thị hộp thoại xác nhận trước khi xóa để tránh bấm nhầm
  if (!confirm('Bạn có chắc chắn muốn xóa mặt hàng này khỏi kho không? Hành động này không thể hoàn tác!')) {
    return;
  }
  
  if (btn) btn.disabled = true;
  try {
    const resData = await postAction({
      action: 'DELETE_ITEM',
      userRole: currentSessionUser.id,
      itemId: itemId
    });
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Xóa thất bại, thử lại nhé.', 'error');
    if (btn) btn.disabled = false;
  }
}