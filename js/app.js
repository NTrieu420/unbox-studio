// frontend/js/app.js
let cachedItems = [];
let cachedDebts = [];
const LOW_STOCK = 5;
let currentDebtIdToPay = null;
let currentItemIdToEdit = null;

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
  
  // Ẩn form nhập liệu
  document.getElementById('itemFormSection').classList.toggle('hidden', isKimmie);
  document.getElementById('liveReportSection').classList.toggle('hidden', isKimmie);
  
  // Kimmie được xem Sổ Công Nợ (nhưng ẩn form thêm khách và các cột thao tác)
  document.getElementById('debtSection').classList.remove('hidden');
  document.getElementById('debtForm').classList.toggle('hidden', isKimmie);
  document.getElementById('thDebtAction').classList.toggle('hidden', isKimmie);
  
  // Ẩn các cột thao tác khác đối với Kimmie
  document.getElementById('thAction').classList.toggle('hidden', isKimmie);
  document.getElementById('thStatus').classList.toggle('hidden', isKimmie);
  document.getElementById('thLiveAction').classList.toggle('hidden', isKimmie);

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
    renderLiveReports(data.liveReports || [], roleId);
    
    cachedDebts = data.debts || [];
    applyDebtFilters(); 
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
    
    let actionBtn = '-';
    if (roleId === 'CUN') {
      actionBtn = `<div style="display:flex; justify-content:flex-end; gap:4px;">`;
      if (isPending) {
        actionBtn += `<button class="btn-approve" onclick="approveItem('${esc(item.id)}', this)">Duyệt</button>`;
      }
      actionBtn += `<button class="btn-logout" style="padding: 6px 12px; border-radius: 6px; font-size: 0.85rem;" onclick="openEditItemModal('${esc(item.id)}')">Sửa</button>`;
      actionBtn += `<button class="btn-delete" onclick="deleteItem('${esc(item.id)}', this)">Xóa</button>`;
      actionBtn += `</div>`;
    }

    tr.innerHTML = `
      <td class="name-cell" data-label="Tên thẻ"><strong>${esc(item.name)}</strong></td>
      <td data-label="Nguồn vốn"><span class="${isJoint ? 'tag-joint' : 'tag-private'}">${isJoint ? '🤝 Vốn Chung' : '🔒 Vốn Riêng'}</span></td>
      <td class="num" data-label="Giá Vốn 1 Hộp">${fmtVnd(item.totalCostVnd)}</td>
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
function renderLiveReports(reports, roleId) {
  const tbody = document.getElementById('liveReportList');
  const summary = document.getElementById('liveSummary');
  tbody.innerHTML = '';
  const isKimmie = roleId === 'KIMMIE';

  if (reports.length === 0) {
    summary.innerHTML = '';
    tbody.innerHTML = `<tr><td colspan="${isKimmie ? 8 : 9}" class="empty-row">Chưa có báo cáo phiên live nào</td></tr>`;
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
    
    let actionBtn = '';
    if (!isKimmie) {
      actionBtn = `<button class="btn-delete" onclick="deleteLiveSession('${esc(r.sessionId)}', '${esc(r.itemName)}', this)">Xóa</button>`;
    }

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
      ${isKimmie ? '' : `<td data-label="Thao tác">${actionBtn}</td>`}
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Xử lý Sửa Kho ---------- */
function openEditItemModal(itemId) {
  const item = cachedItems.find(it => it.id === itemId);
  if (!item) return;

  currentItemIdToEdit = itemId;
  // Vì DB lưu giá vốn 1 hộp, ta phải nhân ngược lại với số lượng để hiển thị Tổng tiền
  const totalCost = Number(item.totalCostVnd) * Number(item.stock);

  document.getElementById('editItemName').value = item.name;
  document.getElementById('editCapitalSource').value = item.capitalSource;
  document.getElementById('editCnyPrice').value = totalCost; // Hiển thị tổng tiền
  document.getElementById('editPriceTiktok').value = item.priceTiktok;
  document.getElementById('editPriceZalo').value = item.priceZalo;
  document.getElementById('editPriceDaoVang').value = item.priceDaoVang || '';
  document.getElementById('editStock').value = item.stock;

  document.getElementById('editItemModal').classList.remove('hidden');
}

function closeEditItemModal() {
  document.getElementById('editItemModal').classList.add('hidden');
  currentItemIdToEdit = null;
}

async function submitEditItem() {
  const btn = document.querySelector('#editItemModal .btn-primary');
  btn.disabled = true;

  const payload = {
    action: 'UPDATE_ITEM',
    userRole: currentSessionUser.id,
    itemId: currentItemIdToEdit,
    data: {
      name: document.getElementById('editItemName').value,
      capitalSource: document.getElementById('editCapitalSource').value,
      cnyPrice: document.getElementById('editCnyPrice').value, // Gửi tổng tiền
      priceTiktok: document.getElementById('editPriceTiktok').value,
      priceZalo: document.getElementById('editPriceZalo').value,
      priceDaoVang: document.getElementById('editPriceDaoVang').value || 0,
      stock: document.getElementById('editStock').value
    }
  };

  try {
    const resData = await postAction(payload);
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    if (resData.success) {
      closeEditItemModal();
      loadData(currentSessionUser.id);
    }
  } catch (err) {
    console.error(err);
    showToast('Sửa thất bại.', 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Xử lý Xóa Live ---------- */
async function deleteLiveSession(sessionId, itemName, btn) {
  if (!confirm(`Bạn có chắc muốn xóa phiên live này? Hệ thống sẽ hoàn lại số lượng vào kho (nếu có).`)) return;
  
  if (btn) btn.disabled = true;
  try {
    const resData = await postAction({
      action: 'DELETE_LIVE_SESSION',
      userRole: currentSessionUser.id,
      sessionId: sessionId,
      itemName: itemName
    });
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Xóa thất bại.', 'error');
    if (btn) btn.disabled = false;
  }
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
    tbody.innerHTML = `<tr><td colspan="${currentSessionUser.id === 'KIMMIE' ? 5 : 6}" class="empty-row">Không có dữ liệu</td></tr>`;
    return;
  }

  summary.innerHTML = `<span class="chip"><b>${debts.length}</b> khách hàng hiển thị</span>`;
  const isAdmin = currentSessionUser.id === 'CUN';
  const isKimmie = currentSessionUser.id === 'KIMMIE';

  debts.forEach(d => {
    const owedVal = Number(d.owed) || 0;
    
    let payBtn = '';
    if (owedVal > 0 && !isKimmie) {
      payBtn = `<button class="btn-approve" onclick="openDebtPayModal('${esc(d.id)}', '${esc(d.name)}', ${owedVal})">Thu Nợ</button>`;
    } else if (owedVal === 0) {
      payBtn = `<span style="color:var(--green); font-size:0.85rem; font-weight:600;">Đã xong</span>`;
    }

    let deleteBtn = '';
    if (isAdmin) {
      deleteBtn = `<button class="btn-delete" onclick="deleteDebt('${esc(d.id)}', this)">Xóa</button>`;
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Ngày">${esc(d.date)}</td>
      <td class="name-cell" data-label="Tên khách"><strong>${esc(d.name)}</strong></td>
      <td class="num green" data-label="Đã trả">${fmtVnd(d.paid)}</td>
      <td class="num red" data-label="Còn thiếu">${fmtVnd(d.owed)}</td>
      <td data-label="Ghi chú" style="font-size: 0.85rem; color: var(--muted);">${esc(d.note)}</td>
      ${isKimmie ? '' : `<td data-label="Thao tác"><div style="display:flex; gap:8px; justify-content:flex-end;">${payBtn}${deleteBtn}</div></td>`}
    `;
    tbody.appendChild(tr);
  });
}

/* ---------- Xử lý Thu Nợ ---------- */
function openDebtPayModal(id, name, owed) {
  currentDebtIdToPay = id;
  document.getElementById('payDebtName').innerText = name;
  document.getElementById('payDebtAmount').value = owed;
  document.getElementById('payDebtHint').innerText = `Còn nợ: ${fmtVnd(owed)}`;
  document.getElementById('debtPayModal').classList.remove('hidden');
  
  setTimeout(() => document.getElementById('payDebtAmount').focus(), 100);
}

function closeDebtPayModal() {
  document.getElementById('debtPayModal').classList.add('hidden');
  currentDebtIdToPay = null;
}

async function submitDebtPayment() {
  const amount = document.getElementById('payDebtAmount').value;
  if (!amount || Number(amount) <= 0) {
    showToast('Vui lòng nhập số tiền hợp lệ!', 'error');
    return;
  }

  const btn = document.querySelector('#debtPayModal .btn-primary');
  btn.disabled = true;

  try {
    const resData = await postAction({
      action: 'RECORD_DEBT_PAYMENT',
      debtId: currentDebtIdToPay,
      amount: amount
    });
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    closeDebtPayModal();
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Thu nợ thất bại, thử lại nhé.', 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteDebt(debtId, btn) {
  if (!confirm('Bạn có chắc chắn muốn xóa công nợ của khách này? Hành động này không thể hoàn tác!')) return;
  
  if (btn) btn.disabled = true;
  try {
    const resData = await postAction({
      action: 'DELETE_DEBT',
      userRole: currentSessionUser.id,
      debtId: debtId
    });
    showToast(resData.message, resData.success === false ? 'error' : 'success');
    loadData(currentSessionUser.id);
  } catch (err) {
    console.error(err);
    showToast('Xóa thất bại.', 'error');
    if (btn) btn.disabled = false;
  }
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
      cnyPrice: document.getElementById('cnyPrice').value, // Gửi tổng tiền
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

async function deleteItem(itemId, btn) {
  if (!confirm('Bạn có chắc chắn muốn xóa mặt hàng này khỏi kho không? Hành động này không thể hoàn tác!')) return;
  
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