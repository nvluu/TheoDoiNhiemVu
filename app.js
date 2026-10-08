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
if (typeof module !== 'undefined') module.exports = {parseCSV, readData};
if (typeof document !== 'undefined') {
  const el = id => document.getElementById(id);
  let data, request = 0;
  const node = (tag, text, className) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };
  function render() {
    if (!data) return;
    const query = el('search').value.toLocaleLowerCase('vi').trim();
    const filtered = data.records.filter(({row, unit}) => [...row, ...(unit || [])].join(' ').toLocaleLowerCase('vi').includes(query) && (!el('group').value || (row[1].trim() || '__missing') === el('group').value) && (!el('state').value || (row[6].trim() || '__missing') === el('state').value));
    el('count').textContent = `${filtered.length}/${data.records.length}`;
    el('cards').replaceChildren();
    for (const {row, unit} of filtered) {
      const card = node('article', ''), badges = node('div', '', 'tools');
      badges.append(node('span', unit ? `${row[1]} · ${unit[1]}` : row[1] ? `${row[1]} · Chưa có trong danh mục đơn vị` : 'Chưa có mã đơn vị', 'badge'));
      const status = row[6].trim();
      badges.append(node('span', status || 'Chưa có trạng thái', 'badge ' + (/^(Đã hoàn thành|Hoàn thành)$/i.test(status) ? 'done' : status === 'Trễ hạn' ? 'late' : 'active')));
      card.append(badges, node('h3', `${row[0]}. ${row[2]}`));
      card.append(node('p', `Thời hạn: ${row[4] || 'Chưa có dữ liệu'} · Lãnh đạo phụ trách: ${row[5] || 'Chưa có dữ liệu'}`));
      if (row[9]) card.append(node('p', `Ghi chú: ${row[9]}`, row[9].trim() === 'Trễ hạn' ? 'late' : ''));
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
    el('sheet-title').textContent = data.title;
    el('group').replaceChildren(new Option('Tất cả đơn vị', ''));
    for (const code of new Set(data.records.map(r => r.row[1].trim()))) {
      const unit = data.units.find(r => r[0].trim() === code);
      el('group').add(new Option(unit ? `${code} · ${unit[1]}` : code || 'Chưa có mã đơn vị', code || '__missing'));
    }
    el('state').replaceChildren(new Option('Tất cả trạng thái', ''));
    for (const state of new Set(data.records.map(r => r.row[6].trim()))) el('state').add(new Option(state || 'Chưa có trạng thái', state || '__missing'));
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
  ['search', 'group', 'state'].forEach(id => el(id).addEventListener(id === 'search' ? 'input' : 'change', render));
  el('load').addEventListener('click', async () => {
    const current = ++request; el('load').disabled = true; el('status').textContent = 'Đang tải cả hai tab Google Sheets…';
    try {
      const base = 'https://docs.google.com/spreadsheets/d/1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks/export?format=csv&gid=';
      const [tasks, units] = await Promise.all([fetchCSV(base + '1434454130'), fetchCSV(base + '1315345358')]);
      if (current === request) accept(tasks, units, 'Google Sheets vừa tải');
    } catch (error) { if (current === request) el('status').textContent = `${error.message} Không tải được cả hai tab. Dữ liệu đang hiển thị được giữ lại; có thể mở hai file CSV xuất từ bảng tính.`; }
    finally { el('load').disabled = false; }
  });
  el('import').addEventListener('click', async () => {
    const tasks = el('task-file').files[0], units = el('unit-file').files[0];
    if (!tasks || !units) { el('status').textContent = 'Hãy chọn cả CSV nhiệm vụ (Trang tính4) và CSV đơn vị (Trang tính3).'; return; }
    const current = ++request;
    try { const texts = await Promise.all([tasks.text(), units.text()]); if (current === request) accept(...texts, 'hai file CSV đã chọn'); }
    catch (error) { if (current === request) el('status').textContent = `${error.message} Dữ liệu đang hiển thị được giữ lại.`; }
  });
  Promise.all([fetchCSV('data.csv'), fetchCSV('units.csv')]).then(([tasks, units]) => { if (request === 0) accept(tasks, units, 'bản lưu hai tab ngày 08/10/2026'); })
    .catch(error => { if (request === 0) el('status').textContent = error.message; });
}
