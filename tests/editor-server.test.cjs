const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {parseCSV} = require('../app.js');
const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
class Sheet {
  constructor(id, data = []) {this.id = id;this.data = data;this.writes = [];this.name = '';}
  getSheetId() {return this.id;}
  getLastRow() {let n = this.data.length;while (n && !this.data[n-1].some(v => v !== '')) n--;return n;}
  getMaxColumns() {return 11;}
  setName(name) {this.name = name;}
  getRange(row, col, height = 1, width = 1) {
    const self = this;
    return {
      getDisplayValues() {return Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => {
        const value = self.data[row+y-1]?.[col+x-1] ?? '';
        return String(value).replace(/^'/, '');
      }));},
      setValue(value) {return this.setValues([[value]]);},
      setValues(values) {
        self.writes.push({row, col, values: structuredClone(values)});
        for (let y = 0; y < height; y++) {self.data[row+y-1] ||= [];for (let x = 0; x < width; x++) self.data[row+y-1][col+x-1] = values[y][x];}
      },
      clearContent() {this.setValues(Array.from({length:height}, () => Array(width).fill('')));}
    };
  }
  appendRow(row) {this.data.push(row.slice());}
}
function server(email = 'ongtaymepho@gmail.com') {
  const rawTasks = parseCSV(fs.readFileSync('data.csv','utf8'));
  const headerIndex = rawTasks.findIndex(r=>r[0]==='STT');
  const tasks = new Sheet(1434454130, [[],[],[],...rawTasks.slice(headerIndex)]);
  const rawUnits = parseCSV(fs.readFileSync('units.csv','utf8'));
  const units = new Sheet(1315345358, [[],[],...rawUnits]);
  const archive = new Sheet(0);
  let opens = 0, locks = 0, releases = 0, archiveCreates = 0, failArchive = false;
  const props = new Map();
  const context = vm.createContext({
    Session: {getActiveUser:()=>({getEmail:()=>email})},
    LockService:{getScriptLock:()=>({tryLock:()=>{locks++;return true;},releaseLock:()=>releases++})},
    SpreadsheetApp:{openById:id=>{opens++;return id==='private-archive'?{getSheetByName:()=>archive}:{getSheets:()=>[tasks,units]};},create:()=>{if(failArchive)throw Error('Archive unavailable');archiveCreates++;return {getId:()=> 'private-archive',getSheets:()=>[archive]};},flush(){}},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(k,v)=>props.set(k,v)})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>Array.from(crypto.createHash('sha256').update(s).digest()).map(v=>v>127?v-256:v)},
    HtmlService:{createHtmlOutput:text=>({text}),createHtmlOutputFromFile:()=>({setTitle(){return this},addMetaTag(){return this}})}
  });
  vm.runInContext(code, context);
  return {api:context,tasks,units,archive,counts:()=>({opens,locks,releases,archiveCreates}),failArchive:()=>failArchive=true};
}
const fields = ['CQ','Nhiệm vụ thử nghiệm','Phương án','30/11/2026','Lãnh đạo','Đang thực hiện','Văn bản','Tiến độ','Ghi chú'];
test('deny missing/wrong identity before opening sheets or acquiring locks on every RPC',()=>{
  for(const email of ['', 'someone@gmail.com']){
    const s=server(email);
    for(const [name,args] of [['listTasks',[]],['saveTask',[{}]],['deleteTask',[{}]],['listDeletedTasks',[]],['restoreTask',['bad']]])assert.throws(()=>s.api[name](...args),/Không có quyền/);
    assert.deepEqual(s.counts(),{opens:0,locks:0,releases:0,archiveCreates:0});
    assert.match(s.api.doGet().text,/Không có quyền/);
  }
});
test('IDs persist across reordering; updates use ID, reject stale version and leave directory untouched',()=>{
  const s=server();let result=s.api.listTasks();assert.equal(result.tasks.length,65);assert.equal(result.units.length,11);
  const first=result.tasks[0],other=result.tasks[1];const directory=JSON.stringify(s.units.data);
  [s.tasks.data[4],s.tasks.data[5]]=[s.tasks.data[5],s.tasks.data[4]];
  const updated=s.api.saveTask({id:first.id,version:first.version,fields});
  assert.equal(s.tasks.data[5][2],fields[1]);assert.equal(s.tasks.data[4][2],other.values[2]);
  assert.throws(()=>s.api.saveTask({id:first.id,version:first.version,fields}),/đã được thay đổi/);
  assert.notEqual(updated.version,first.version);assert.equal(JSON.stringify(s.units.data),directory);
  assert.equal(s.archive.data[1][3],'UPDATE_BEFORE');assert.equal(JSON.parse(s.archive.data[1][5])[2],first.values[2]);
  assert.equal(s.counts().locks,s.counts().releases);
});
test('create uses automatic STT, retries are idempotent, formula-like fields stay literal',()=>{
  const s=server();const id=crypto.randomUUID();const input=fields.slice();input[1]='=IMPORTXML("https://example.com","//a")';
  const created=s.api.saveTask({id,fields:input});assert.equal(created.values[0],'66');assert.equal(created.values[2],input[1]);
  assert(s.tasks.writes.some(w=>w.values[0][2] === "'"+input[1]));
  const retry=s.api.saveTask({id,fields:input});assert.equal(retry.id,id);assert.equal(s.api.listTasks().tasks.length,66);
  assert.throws(()=>s.api.saveTask({id:crypto.randomUUID(),fields:['bad',...fields.slice(1)]}),/chọn đơn vị/);
  assert.throws(()=>s.api.saveTask({id:crypto.randomUUID(),fields:['CQ','',...fields.slice(2)]}),/tên nhiệm vụ/);
});
test('trash backs up the task before clearing; restore keeps ID and rejects duplicate restoration',()=>{
  const s=server();const first=s.api.listTasks().tasks[0];s.api.deleteTask({id:first.id,version:first.version});
  assert.equal(s.api.listTasks().tasks.length,64);const trash=s.api.listDeletedTasks();assert.equal(trash.length,1);assert.equal(trash[0].id,first.id);
  const restored=s.api.restoreTask(trash[0].eventId);assert.equal(restored.id,first.id);assert.deepEqual(Array.from(restored.values),Array.from(first.values));
  assert.equal(s.api.listTasks().tasks.length,65);assert.equal(s.api.listDeletedTasks().length,0);assert.throws(()=>s.api.restoreTask(trash[0].eventId),/đã được khôi phục/);
});
test('archive failure and column K collisions stop writes to task data',()=>{
  const s=server();const first=s.api.listTasks().tasks[0];const before=JSON.stringify(s.tasks.data);s.failArchive();
  assert.throws(()=>s.api.deleteTask({id:first.id,version:first.version}),/Archive unavailable/);assert.equal(JSON.stringify(s.tasks.data),before);
  const t=server();t.tasks.data[3][10]='Existing user column';const original=JSON.stringify(t.tasks.data);assert.throws(()=>t.api.listTasks(),/Cột K/);assert.equal(JSON.stringify(t.tasks.data),original);
});
test('an empty task sheet is valid and does not resurrect the bundled snapshot',()=>{
  const {readData}=require('../app.js');
  const header=parseCSV(fs.readFileSync('data.csv','utf8')).find(r=>r[0]==='STT');
  const csv=header.map(v=>'"'+v.replaceAll('"','""')+'"').join(',');
  const result=readData(csv,fs.readFileSync('units.csv','utf8'));
  assert.equal(result.records.length,0);assert.equal(result.units.length,11);
});
