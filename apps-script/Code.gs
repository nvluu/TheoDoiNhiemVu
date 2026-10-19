/* Deploy as USER_ACCESSING, access MYSELF, from ongtaymepho@gmail.com. */
const EDITOR_EMAIL_ = 'ongtaymepho@gmail.com';
const SOURCE_ID_ = '1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks';
const TASK_GID_ = 1434454130;
const UNIT_GID_ = 1315345358;
const ID_HEADER_ = '_TASK_ID';
const STATES_ = ['Chưa thực hiện', 'Đang thực hiện', 'Đã hoàn thành', 'Trễ hạn'];

function requireEditor_() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email !== EDITOR_EMAIL_) throw new Error('Không có quyền. Hãy đăng nhập đúng tài khoản được cấp quyền nhập liệu.');
  return email;
}

function doGet() {
  try {
    requireEditor_();
    return HtmlService.createHtmlOutputFromFile('Editor')
      .setTitle('Quản lý nhiệm vụ').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (_) {
    return HtmlService.createHtmlOutput('<!doctype html><html lang="vi"><meta charset="utf-8"><h1>Không có quyền nhập liệu</h1><p>Hãy mở bằng tài khoản Google đã được cấp quyền.</p></html>');
  }
}

function locked_(work) {
  const email = requireEditor_(); // Authorize before opening any sheet, including backups.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Đang xử lý thao tác khác. Hãy thử lại sau.');
  try { return work(email); } finally { lock.releaseLock(); }
}

function source_() {
  const book = SpreadsheetApp.openById(SOURCE_ID_);
  const tasks = book.getSheets().find(s => s.getSheetId() === TASK_GID_);
  const units = book.getSheets().find(s => s.getSheetId() === UNIT_GID_);
  if (!tasks || !units) throw new Error('Không tìm thấy tab nhiệm vụ hoặc đơn vị.');
  const header = tasks.getRange(4, 1, 1, 10).getDisplayValues()[0];
  if (header[0].trim() !== 'STT' || header[2].trim() !== 'TÊN NHIỆM VỤ') throw new Error('Dòng tiêu đề nhiệm vụ đã thay đổi. Dừng ghi để bảo vệ dữ liệu.');
  const unitHeader = units.getRange(3, 1, 1, 2).getDisplayValues()[0];
  if (unitHeader[0].trim() !== 'Mã Đơn vị' || unitHeader[1].trim() !== 'Tên đơn vị') throw new Error('Dòng tiêu đề đơn vị đã thay đổi.');
  if (tasks.getMaxColumns() < 11) tasks.insertColumnsAfter(tasks.getMaxColumns(), 11 - tasks.getMaxColumns());
  const idHeader = tasks.getRange(4, 11).getDisplayValues()[0][0];
  if (idHeader && idHeader !== ID_HEADER_) throw new Error('Cột K đang được sử dụng. Không thể thêm mã nhiệm vụ tự động.');
  if (!idHeader) {
    if (tasks.getLastRow() >= 5 && tasks.getRange(5, 11, tasks.getLastRow() - 4, 1).getDisplayValues().some(r => r[0])) throw new Error('Cột K có dữ liệu. Không được ghi đè.');
    tasks.getRange(4, 11).setValue(ID_HEADER_);
  }
  const directory = units.getLastRow() < 4 ? [] : units.getRange(4, 1, units.getLastRow() - 3, 3).getDisplayValues().filter(r => r[0].trim() && r[1].trim());
  if (!directory.length) throw new Error('Danh mục đơn vị trống.');
  const rows = tasks.getLastRow() < 5 ? [] : tasks.getRange(5, 1, tasks.getLastRow() - 4, 11).getDisplayValues();
  const seen = new Set();
  const records = [];
  rows.forEach((row, i) => {
    if (!/^\d+$/.test(row[0].trim()) || !row[2].trim()) return;
    let id = row[10];
    if (!id) {
      id = Utilities.getUuid();
      tasks.getRange(i + 5, 11).setValue(id);
      row[10] = id;
    }
    if (seen.has(id)) throw new Error('Mã nhiệm vụ bị trùng. Dừng ghi để tránh sửa nhầm.');
    seen.add(id);
    records.push({id, rowNumber: i + 5, values: row.slice(0, 10), version: version_(row.slice(0, 11))});
  });
  return {tasks, directory, records};
}

function version_(values) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(values), Utilities.Charset.UTF_8)
    .map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}
function publicTask_(task) { return {id: task.id, values: task.values, version: task.version}; }
function id_(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) throw new Error('Mã nhiệm vụ không hợp lệ.');
  return value;
}
function existing_(source, id, version) {
  const record = source.records.find(r => r.id === id_(id));
  if (!record) throw new Error('Nhiệm vụ không còn tồn tại. Hãy tải lại danh sách.');
  if (record.version !== version) throw new Error('Nhiệm vụ đã được thay đổi trong Google Sheets. Hãy tải lại và mở lại nhiệm vụ trước khi lưu.');
  return record;
}
function fields_(input, source, previous) {
  if (!Array.isArray(input) || input.length !== 9 || input.some(v => typeof v !== 'string')) throw new Error('Cần đủ 9 trường thông tin nhiệm vụ.');
  const values = input.slice();
  if (values.some(v => v.length > 10000) || JSON.stringify(values).length > 35000) throw new Error('Nội dung quá dài. Mỗi trường tối đa 10.000 ký tự, tổng nội dung tối đa 35.000 ký tự.');
  values[0] = values[0].trim();
  if (!values[1].trim()) throw new Error('Hãy nhập tên nhiệm vụ.');
  if (!source.directory.some(r => r[0].trim() === values[0]) && (!previous || values[0] !== previous.values[1])) throw new Error('Hãy chọn đơn vị trong danh mục.');
  values[5] = values[5].trim();
  if (!STATES_.includes(values[5]) && (!previous || values[5] !== previous.values[6])) throw new Error('Hãy chọn trạng thái hợp lệ.');
  return values;
}
function literal_(value) { return /^\s*[=+\-@]/.test(value) ? "'" + value : value; }
function write_(sheet, row, values, id) {
  sheet.getRange(row, 1, 1, 11).setValues([[...values.map(literal_), id]]);
  SpreadsheetApp.flush();
  const displayed = sheet.getRange(row, 1, 1, 11).getDisplayValues()[0];
  return {id, values: displayed.slice(0, 10), version: version_(displayed)};
}

function listTasks() {
  return locked_(email => {
    const source = source_();
    return {email, tasks: source.records.map(publicTask_), units: source.directory, states: STATES_};
  });
}

// Snapshots live in a separate, PRIVATE spreadsheet. Hidden tabs in the public source are not private.
function archive_() {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty('TASK_ARCHIVE_ID');
  if (!id) {
    const book = SpreadsheetApp.create('Lịch sử và thùng rác nhiệm vụ (riêng tư)');
    id = book.getId();
    const sheet = book.getSheets()[0];
    sheet.setName('History');
    sheet.appendRow(['Event ID', 'Thời điểm', 'Tài khoản', 'Thao tác', 'Task ID', 'Dữ liệu trước thao tác (JSON)', 'Phiên bản', 'Khôi phục lúc']);
    properties.setProperty('TASK_ARCHIVE_ID', id);
  }
  if (id === SOURCE_ID_) throw new Error('File lưu lịch sử phải riêng với file dữ liệu công khai.');
  const book = SpreadsheetApp.openById(id);
  const sheet = book.getSheetByName('History');
  if (!sheet || sheet.getRange(1, 1).getDisplayValues()[0][0] !== 'Event ID') throw new Error('File lịch sử không đúng cấu trúc.');
  return sheet;
}
function snapshot_(email, action, task) {
  archive_().appendRow([Utilities.getUuid(), new Date().toISOString(), email, action, task.id, JSON.stringify(task.values), task.version || '', '']);
}

function saveTask(payload) {
  return locked_(email => {
    if (!payload || typeof payload !== 'object') throw new Error('Yêu cầu không hợp lệ.');
    const id = id_(payload.id), source = source_();
    if (payload.version) {
      const previous = existing_(source, id, payload.version);
      const fields = fields_(payload.fields, source, previous);
      snapshot_(email, 'UPDATE_BEFORE', previous); // Backup must succeed before the public row changes.
      return write_(source.tasks, previous.rowNumber, [previous.values[0], ...fields], id);
    }
    const fields = fields_(payload.fields, source, null);
    const alreadySaved = source.records.find(r => r.id === id);
    if (alreadySaved) {
      if (JSON.stringify(alreadySaved.values.slice(1)) === JSON.stringify(fields)) return publicTask_(alreadySaved);
      throw new Error('Mã nhiệm vụ đã tồn tại. Hãy tải lại danh sách.');
    }
    const properties = PropertiesService.getScriptProperties();
    const next = Math.max(Number(properties.getProperty('LAST_TASK_NUMBER') || 0), ...source.records.map(r => Number(r.values[0])), 0) + 1;
    properties.setProperty('LAST_TASK_NUMBER', String(next));
    const values = [String(next), ...fields];
    snapshot_(email, 'CREATE_REQUEST', {id, values});
    return write_(source.tasks, Math.max(source.tasks.getLastRow() + 1, 5), values, id);
  });
}

function deleteTask(payload) {
  return locked_(email => {
    if (!payload) throw new Error('Yêu cầu không hợp lệ.');
    const source = source_(), task = existing_(source, payload.id, payload.version);
    snapshot_(email, 'DELETE_BEFORE', task);
    source.tasks.getRange(task.rowNumber, 1, 1, 11).clearContent(); // Do not shift other rows/formulas.
    SpreadsheetApp.flush();
    return {id: task.id};
  });
}
function listDeletedTasks() {
  return locked_(() => {
    const source = source_(), sheet = archive_();
    if (sheet.getLastRow() < 2) return [];
    const active = new Set(source.records.map(r => r.id));
    return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getDisplayValues()
      .filter(r => r[3] === 'DELETE_BEFORE' && !r[7] && !active.has(r[4]))
      .map(r => ({eventId: r[0], deletedAt: r[1], id: r[4], values: JSON.parse(r[5])}));
  });
}
function restoreTask(eventId) {
  return locked_(() => {
    id_(eventId);
    const source = source_(), sheet = archive_();
    const rows = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getDisplayValues();
    const index = rows.findIndex(r => r[0] === eventId && r[3] === 'DELETE_BEFORE');
    if (index < 0) throw new Error('Không tìm thấy bản lưu đã xóa.');
    const archived = rows[index];
    if (archived[7]) throw new Error('Nhiệm vụ đã được khôi phục.');
    if (source.records.some(r => r.id === archived[4])) throw new Error('Nhiệm vụ đang tồn tại. Không khôi phục trùng.');
    const values = JSON.parse(archived[5]);
    if (!Array.isArray(values) || values.length !== 10 || values.some(v => typeof v !== 'string')) throw new Error('Bản lưu không hợp lệ.');
    const task = write_(source.tasks, Math.max(source.tasks.getLastRow() + 1, 5), values, id_(archived[4]));
    sheet.getRange(index + 2, 8).setValue(new Date().toISOString());
    return task;
  });
}
