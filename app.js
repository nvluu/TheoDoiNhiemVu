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
function readProjects(text) {
  const rows = parseCSV(text);
  const index = rows.findIndex(r => r[0].trim() === 'STT' && r[1]?.trim() === 'Tên dự án');
  if (index < 0) throw new Error('Không tìm thấy dòng tiêu đề STT, Tên dự án.');
  let group = 'Khác'; const projects = [];
  for (const row of rows.slice(index + 1)) {
    if (/^[A-Z]$/.test(row[0].trim())) { group = row[1]; continue; }
    if (/^\d+$/.test(row[0].trim()) && row[1]?.trim()) projects.push([...row, group]);
  }
  return {headers: [...rows[index], 'Nguồn vốn'], records: projects, title: rows[0][0]};
}
if (typeof module !== 'undefined') module.exports = { parseCSV, readProjects };
if (typeof document !== 'undefined') {
  const el = id => document.getElementById(id);
  let headers = [], records = [], request = 0;
  function render() {
    const query = el('search').value.toLocaleLowerCase('vi');
    const filtered = records.filter(row => row.join(' ').toLocaleLowerCase('vi').includes(query) && (!el('group').value || row[row.length - 1] === el('group').value));
    el('count').textContent = `${filtered.length}/${records.length}`;
    el('cards').replaceChildren();
    for (const row of filtered) {
      const card = document.createElement('article'), title = document.createElement('h3'), list = document.createElement('dl');
      title.textContent = row[1] || 'Dự án'; card.append(title);
      headers.forEach((name, i) => {
        const key = document.createElement('dt'), value = document.createElement('dd');
        key.textContent = name; value.textContent = row[i] || '—'; list.append(key, value);
      });
      const details = document.createElement('details'), summary = document.createElement('summary');
      summary.textContent = 'Chi tiết dự án và 12 bước tiến độ'; details.append(summary, list);
      const group = document.createElement('p'); group.className = 'badge'; group.textContent = row[row.length - 1];
      const info = document.createElement('p'); info.textContent = `${row[3].trim()} · ${row[4]} · ${row[2]} triệu đồng`;
      const steps = document.createElement('div'); steps.className = 'steps';
      row.slice(6, 18).forEach((value, i) => {
        const step = document.createElement('span'); step.textContent = `B${i + 1}`;
        step.className = value.trim().toLowerCase() === 'x' ? 'done' : value.trim() ? 'active' : '';
        step.title = `Bước ${i + 1}: ${value || 'Chưa có dữ liệu'}`; steps.append(step);
      });
      card.append(group, info, steps, details); el('cards').append(card);
    }
  }
  function accept(text, source) {
    if (/^\s*</.test(text)) throw new Error('Nguồn trả về trang HTML thay vì CSV. Kiểm tra quyền chia sẻ bảng tính.');
    const data = readProjects(text);
    headers = data.headers; records = data.records;
    el('sheet-title').textContent = data.title;
    el('group').replaceChildren(new Option('Tất cả nguồn vốn', ''));
    for (const group of new Set(records.map(r => r[r.length - 1]))) el('group').add(new Option(group, group));
    render();
    el('columns').textContent = headers.join(' · ');
    el('status').textContent = `Đã đọc ${records.length} bản ghi từ ${source}. Dữ liệu gốc được giữ nguyên.`;
  }
  el('search').addEventListener('input', render);
  el('group').addEventListener('change', render);
  el('file').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    const current = ++request;
    try { const text = await file.text(); if (current === request) accept(text, file.name); }
    catch (error) { if (current === request) el('status').textContent = error.message; }
  });
  el('load').addEventListener('click', async () => {
    const current = ++request; el('load').disabled = true;
    el('status').textContent = 'Đang tải dữ liệu…';
    try {
      const source = new URL(el('source').value);
      const match = source.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/);
      if (source.hostname !== 'docs.google.com' || !match) throw new Error('Hãy nhập liên kết Google Sheets hợp lệ.');
      const fragment = new URLSearchParams(source.hash.slice(1));
      const gid = source.searchParams.get('gid') || fragment.get('gid') || '0';
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 20000);
      let response;
      try { response = await fetch(`https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${encodeURIComponent(gid)}`, {signal: controller.signal}); }
      finally { clearTimeout(timeout); }
      if (!response.ok) throw new Error(`Google Sheets trả về lỗi ${response.status}.`);
      const text = await response.text(); if (current === request) accept(text, 'Google Sheets');
    } catch (error) {
      if (current === request) el('status').textContent = `${error.message} Không tải được bảng tính. Kiểm tra quyền chia sẻ hoặc xuất CSV và mở bằng nút phía trên. Dữ liệu đã tải trước đó (nếu có) vẫn được giữ lại.`;
    } finally { el('load').disabled = false; }
  });
  fetch('data.csv').then(r => { if (!r.ok) throw new Error('Không đọc được dữ liệu đã lưu.'); return r.text(); })
    .then(text => { if (request === 0) accept(text, 'bản dữ liệu Google Sheets đã lưu ngày 06/10/2026'); })
    .catch(error => { if (request === 0) el('status').textContent = error.message; });
}
