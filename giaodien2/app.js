'use strict';
function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else if (quoted || cell === '') quoted = !quoted;
      else cell += ch;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (quoted) throw new Error('File CSV có dấu ngoặc kép chưa đóng.');
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(v => v.trim()));
}
function readTable(text, firstHeader) {
  if (/^\s*</.test(text)) throw new Error('Nguồn trả về HTML thay vì CSV.');
  const rows = parseCSV(text);
  const index = rows.findIndex(row => row[0].trim() === firstHeader);
  if (index < 0) throw new Error(`Không tìm thấy tiêu đề ${firstHeader}.`);
  return { headers: rows[index], rows: rows.slice(index + 1), title: rows.slice(0, index).map(r => r[0]).join(' · ') };
}
function readData(taskText, unitText) {
  const tasks = readTable(taskText, 'STT'), units = readTable(unitText, 'Mã Đơn vị');
  if (tasks.headers[2]?.trim() !== 'TÊN NHIỆM VỤ' || units.headers[1]?.trim() !== 'Tên đơn vị') throw new Error('Cấu trúc bảng tính không đúng.');
  const directory = units.rows.filter(r => r[0]?.trim() && r[1]?.trim());
  const byCode = new Map(directory.map(r => [r[0].trim(), r]));
  const records = tasks.rows.filter(r => /^\d+$/.test(r[0].trim()) && r[2]?.trim()).map(row => ({row, unit: byCode.get(row[1].trim())}));
  if (!records.length || !directory.length) throw new Error('Bảng tính chưa có nhiệm vụ hoặc đơn vị.');
  return {headers: tasks.headers, records, units: directory, title: tasks.title};
}
function sheetCSV(response) {
  if (response.status !== 'ok' || !response.table?.cols || !response.table?.rows) throw new Error('Google Sheets không trả về dữ liệu hợp lệ. Kiểm tra quyền chia sẻ công khai.');
  const {cols, rows} = response.table;
  const values = [cols.map(c => c.label), ...rows.map(row => cols.map((_, i) => row.c[i]?.f ?? row.c[i]?.v ?? ''))];
  return values.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\n');
}
if (typeof module !== 'undefined') module.exports = {parseCSV, readData, sheetCSV};
if (typeof document !== 'undefined') {
  const el = id => document.getElementById(id);
  const cacheKey = 'task-dashboard:1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks:v1';
  const displayTime = time => new Date(time).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'});
  let data, request = 0, loading = false, callbackId = 0;
  const node = (tag, text, className) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
  function render() {
    if (!data) return;
    const query = el('search').value.toLocaleLowerCase('vi').trim();
    const filtered = data.records.filter(({row, unit}) => [...row, ...(unit || [])].join(' ').toLocaleLowerCase('vi').includes(query) && (!el('group').value || (row[1].trim() || '__missing') === el('group').value) && (!el('state').value || (row[6].trim() || '__missing') === el('state').value));
    el('count').textContent = `${filtered.length}/${data.records.length}`;
    el('completed-count').textContent = filtered.filter(({row}) => /^(Đã hoàn thành|Hoàn thành)$/i.test(row[6].trim())).length;
    el('overdue-count').textContent = filtered.filter(({row}) => [row[6], row[9]].some(value => /^(Trễ hạn|Quá hạn)$/i.test((value || '').trim()))).length;
    const completed = Number(el('completed-count').textContent);
    const overdue = Number(el('overdue-count').textContent);
    const ongoing = filtered.filter(({row}) => /^Đang /i.test(row[6].trim())).length;
    el('ongoing-count').textContent = ongoing;
    el('filtered-units').textContent = new Set(filtered.map(({row}) => row[1].trim()).filter(Boolean)).size;
    const percent = filtered.length ? Math.round(completed / filtered.length * 100) : 0;
    el('completion-percent').textContent = `${percent}%`;
    el('completion-ring').style.setProperty('--completion', `${percent}%`);
    el('completion-caption').textContent = `${completed} hoàn thành / ${filtered.length} nhiệm vụ đang hiển thị`;
    el('overview-note').textContent = overdue ? `${overdue} nhiệm vụ được đánh dấu trễ hạn hoặc quá hạn trong bảng tính.` : 'Danh sách đang hiển thị chưa có nhiệm vụ được đánh dấu quá hạn.';
    const counts = new Map(data.units.map(unit => [unit[1], 0]));
    for (const {row, unit} of filtered) {
      const name = unit?.[1] || row[1].trim() || 'Chưa có mã đơn vị';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    const bars = el('unit-bars'); bars.replaceChildren();
    const allUnits = [...counts].sort((a,b) => b[1] - a[1]);
    const largest = allUnits[0]?.[1] || 1;
    for (const [name, count] of allUnits) {
      const item = node('div', '', 'bar-item'), label = node('div', '', 'bar-label');
      label.append(node('span', name), node('strong', String(count)));
      const track = node('div', '', 'bar-track'), fill = node('div', '', 'bar-fill');
      fill.style.width = `${count / largest * 100}%`; track.append(fill); item.append(label, track); bars.append(item);
    }
    if (!allUnits.length) bars.append(node('p', 'Chưa có nhiệm vụ phù hợp.', 'muted'));
    el('cards').replaceChildren();
    for (const {row, unit} of filtered) {
      const card = node('article', ''), badges = node('div', '', 'tools');
      badges.append(node('span', unit ? `${row[1]} · ${unit[1]}` : row[1] ? `${row[1]} · Chưa có trong danh mục đơn vị` : 'Chưa có mã đơn vị', 'badge'));
      const status = row[6].trim();
      badges.append(node('span', status || 'Chưa có trạng thái', 'badge ' + (/^(Đã hoàn thành|Hoàn thành)$/i.test(status) ? 'done' : status === 'Trễ hạn' ? 'late' : 'active')));
      card.append(badges, node('h3', `${row[0]}. ${row[2]}`));
      card.append(node('p', `Thời hạn: ${row[4] || 'Chưa có dữ liệu'} · Lãnh đạo phụ trách: ${row[5] || 'Chưa có dữ liệu'}`, 'task-meta'));
      if (row[9]) card.append(node('p', `Ghi chú: ${row[9]}`, 'task-note' + (row[9].trim() === 'Trễ hạn' ? ' late' : '')));
      card.append(node('h4', 'Tiến độ, kết quả thực hiện'), node('p', row[8] || 'Chưa có dữ liệu', 'progress'));
      const details = node('details', ''), list = node('dl', '');
      data.headers.forEach((name, i) => list.append(node('dt', name), node('dd', row[i] || '—')));
      if (unit) ['Tên đơn vị', 'Người phụ trách đơn vị', 'Gmail', 'SĐT'].forEach((name, i) => list.append(node('dt', name), node('dd', unit[i + 1] || '—')));
      details.append(node('summary', 'Xem đầy đủ thông tin nhiệm vụ'), list); card.append(details); el('cards').append(card);
    }
    el('empty').hidden = filtered.length > 0;
  }
  function accept(taskText, unitText, source) {
    const next = readData(taskText, unitText); data = next;
    const selectedGroup = el('group').value, selectedState = el('state').value;
    el('sheet-title').textContent = data.title;
    el('group').replaceChildren(new Option('Tất cả đơn vị', ''));
    for (const code of new Set(data.records.map(r => r.row[1].trim()))) {
      const unit = data.units.find(r => r[0].trim() === code);
      el('group').add(new Option(unit ? `${code} · ${unit[1]}` : code || 'Chưa có mã đơn vị', code || '__missing'));
    }
    el('state').replaceChildren(new Option('Tất cả trạng thái', ''));
    for (const state of new Set(data.records.map(r => r.row[6].trim()))) el('state').add(new Option(state || 'Chưa có trạng thái', state || '__missing'));
    if ([...el('group').options].some(o => o.value === selectedGroup)) el('group').value = selectedGroup;
    if ([...el('state').options].some(o => o.value === selectedState)) el('state').value = selectedState;
    const body = el('units'); body.replaceChildren();
    for (const unit of data.units) { const row = node('tr', ''); unit.slice(0, 5).forEach(value => row.append(node('td', value || '—'))); body.append(row); }
    el('unit-count').textContent = data.units.length;
    render(); el('status').textContent = `Đã đọc ${data.records.length} nhiệm vụ và ${data.units.length} đơn vị từ ${source}.`;
  }
  async function fetchCSV(url) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try { const response = await fetch(url, {signal: controller.signal}); if (!response.ok) throw new Error(`Nguồn dữ liệu trả về lỗi ${response.status}.`); return await response.text(); }
    finally { clearTimeout(timer); }
  }
  el('reset').addEventListener('click', () => { el('search').value = ''; el('group').value = ''; el('state').value = ''; render(); });
  ['search', 'group', 'state'].forEach(id => el(id).addEventListener(id === 'search' ? 'input' : 'change', render));
  function loadSheet(gid, range) {
    return new Promise((resolve, reject) => {
      const callback = `sheetResponse_${Date.now()}_${++callbackId}`, script = document.createElement('script');
      const url = new URL('https://docs.google.com/spreadsheets/d/1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks/gviz/tq');
      url.search = new URLSearchParams({gid, range, headers: '1', tqx: `out:json;responseHandler:${callback}`, _: Date.now()});
      let timer;
      function cleanup() {
        clearTimeout(timer); script.remove();
        // A timed-out response can arrive late; leave a temporary no-op callback.
        window[callback] = () => {}; setTimeout(() => delete window[callback], 60000);
      }
      window[callback] = response => { cleanup(); try { resolve(sheetCSV(response)); } catch (error) { reject(error); } };
      script.onerror = () => { cleanup(); reject(new Error('Không kết nối được Google Sheets.')); };
      timer = setTimeout(() => { cleanup(); reject(new Error('Google Sheets phản hồi quá lâu.')); }, 20000);
      script.src = url.href; document.head.append(script);
    });
  }
  async function refresh() {
    if (loading) return;
    loading = true; const current = ++request; el('load').disabled = true;
    el('status').textContent = 'Đang đọc dữ liệu trực tiếp từ hai tab Google Sheets…';
    try {
      const texts = await Promise.all([loadSheet('1434454130', 'A4:J'), loadSheet('1315345358', 'A3:E')]);
      if (current === request) {
        const savedAt = new Date().toISOString();
        accept(...texts, `Google Sheets · cập nhật lúc ${displayTime(savedAt)}`);
        try {
          localStorage.setItem(cacheKey, JSON.stringify({version: 1, tasks: texts[0], units: texts[1], savedAt}));
        } catch {
          el('status').textContent += ' Không lưu được bộ nhớ trình duyệt; lần mở sau sẽ tải lại Google Sheets.';
        }
      }
    } catch (error) {
      if (current !== request) return;
      if (!data) {
        try {
          const texts = await Promise.all([fetchCSV('data.csv'), fetchCSV('units.csv')]);
          if (current !== request) return;
          accept(...texts, 'bản lưu dự phòng ngày 08/10/2026');
        } catch (fallbackError) {
          if (current === request) el('status').textContent = `${error.message} ${fallbackError.message} Bấm “Cập nhật ngay” để thử lại.`;
          return;
        }
      }
      if (current === request) el('status').textContent = `${error.message} Đang giữ dữ liệu gần nhất hoặc bản lưu dự phòng, chưa cập nhật trực tiếp. Bấm “Cập nhật ngay” để thử lại.`;
    } finally { loading = false; el('load').disabled = false; }
  }
  el('load').addEventListener('click', refresh);
  function openCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (!cached || cached.version !== 1 || typeof cached.tasks !== 'string' || typeof cached.units !== 'string' || typeof cached.savedAt !== 'string' || !Number.isFinite(Date.parse(cached.savedAt))) return false;
      accept(cached.tasks, cached.units, `bộ nhớ trình duyệt · lưu lúc ${displayTime(cached.savedAt)} · bấm “Cập nhật ngay” để lấy dữ liệu mới`);
      return true;
    } catch { return false; }
  }
  if (!openCache()) refresh();
}
