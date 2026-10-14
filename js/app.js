// frontend/js/app.js
let cachedItems = [];
const LOW_STOCK = 5; // ≤ mức này sẽ hiện nhãn "Sắp hết"

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

/* ---------- Khởi tạo theo quyền ---------- */
function initDashboard(user) {
  document.getElementById('displayRoleName').innerText = `${user.name} (${user.badge})`;
  const avatar = document.getElementById('displayAvatar');
  avatar.src = user.avatar;
  avatar.alt = user.name;

  const isKimmie = user.id === 'KIMMIE';
  document.getElementById('itemFormSection').classList.toggle('hidden', isKimmie);
  document.getElementById('liveReportSection').classList.toggle('hidden', isKimmie);
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

  // Tóm tắt
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
    if (roleId === 'CUN' && isPending) {
      actionBtn = `<button class="btn-approve" onclick="approveItem('${esc(item.id)}', this)">Duyệt ngay</button>`;
    }

    tr.innerHTML = `
      <td class="name-cell" data-label="Tên thẻ"><strong>${esc(item.name)}</strong></td>
      <td data-label="Nguồn vốn"><span class="${isJoint ? 'tag-joint' : 'tag-private'}">${isJoint ? '🤝 Vốn Chung' : '🔒 Vốn Riêng'}</span></td>
      <td class="num" data-label="Vốn gốc (kèm ship)">${fmtVnd(item.totalCostVnd)}</td>
      <td class="num" data-label="TikTok">${fmtVnd(item.priceTiktok)}</td>
      <td class="num" data-label="Zalo">${fmtVnd(item.priceZalo)}</td>
      <td class="num gold" data-label="Giá Đào Vàng">${fmtVnd(item.priceDaoVang)}</td>
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

/* ---------- Gửi Báo Cáo Phiên Live ---------- */
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
      daoVangPlays: document.getElementById('daoVangPlays').value,
      daoVangRevenue: document.getElementById('daoVangRevenue').value,
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
    showToast('Gửi báo cáo thất bại, thử lại nhé.', 'error');
  } finally {
    btn.disabled = false;
  }
};

/* ---------- Form nhập kho ---------- */
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
      priceDaoVang: document.getElementById('priceDaoVang').value,
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
    showToast('Tạo đơn nhập kho thất bại, thử lại nhé.', 'error');
  } finally {
    btn.disabled = false;
  }
};

/* ---------- Duyệt hàng (chỉ Củn) ---------- */
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
    showToast('Duyệt thất bại, thử lại nhé.', 'error');
    if (btn) btn.disabled = false;
  }
}