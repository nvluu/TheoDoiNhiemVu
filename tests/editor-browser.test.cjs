const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {chromium} = require('playwright');
const {readData} = require('../app.js');
const portal = fs.readFileSync('apps-script/Editor.html','utf8');
const tasksCSV = fs.readFileSync('data.csv','utf8'), unitsCSV = fs.readFileSync('units.csv','utf8');
const cacheKey = 'task-dashboard:1nxTlfSaB0POG4OY9zL0QmA1qa0ZIr4foaWOIghDy3ks:v1';

test('editor UI creates/edits/deletes/restores through RPC; failed save preserves input and draft ID', async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const data=readData(tasksCSV,unitsCSV);let tasks=data.records.slice(0,2).map(({row})=>({id:crypto.randomUUID(),version:crypto.randomUUID(),values:row}));
    let deleted=[], calls=[],failSave=false;
    await page.exposeFunction('serverCall',({method,args})=>{
      calls.push({method,args});
      if(method==='listTasks')return {email:'ongtaymepho@gmail.com',tasks,units:data.units,states:['Chưa thực hiện','Đang thực hiện','Đã hoàn thành','Trễ hạn']};
      if(method==='saveTask'){
        if(failSave)throw Error('Lỗi thử nghiệm: chưa lưu');
        const p=args[0],old=tasks.find(t=>t.id===p.id),result={id:p.id,version:crypto.randomUUID(),values:[old?.values[0]||'66',...p.fields]};
        tasks=tasks.filter(t=>t.id!==p.id).concat([result]);return result;
      }
      if(method==='deleteTask'){const task=tasks.find(t=>t.id===args[0].id);deleted.push({...task,eventId:crypto.randomUUID(),deletedAt:new Date().toISOString()});tasks=tasks.filter(t=>t.id!==task.id);return {id:task.id};}
      if(method==='listDeletedTasks')return deleted;
      if(method==='restoreTask'){const task=deleted.find(t=>t.eventId===args[0]);deleted=deleted.filter(t=>t!==task);tasks.push(task);return task;}
      throw Error('Unexpected RPC '+method);
    });
    await page.addInitScript(()=>{
      Object.defineProperty(window,'google',{value:{script:{get run(){let success,failure;const runner=new Proxy({}, {get:(_,name)=>name==='withSuccessHandler'?(cb)=>{success=cb;return runner}:name==='withFailureHandler'?(cb)=>{failure=cb;return runner}:(...args)=>window.serverCall({method:name,args}).then(success,error=>failure({message:error.message}))});return runner;}}}});
    });
    await page.route('http://localhost:8999/**',r=>r.fulfill({contentType:'text/html',body:portal}));
    await page.goto('http://localhost:8999');await page.waitForFunction(()=>document.querySelector('#new-task').disabled===false);
    assert.match(await page.locator('#identity').innerText(),/ongtaymepho@gmail.com/);
    await page.locator('#new-task').click();await page.locator('#unit').selectOption('CQ');await page.locator('#title').fill('<b>Nhiệm vụ mới</b>');await page.locator('#deadline').fill('30/11/2026');
    failSave=true;await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#form-error').textContent.includes('chưa lưu'));
    const failedId=calls.find(c=>c.method==='saveTask').args[0].id;assert.equal(await page.locator('#title').inputValue(),'<b>Nhiệm vụ mới</b>');assert(await page.locator('#task-dialog').isVisible());
    failSave=false;await page.locator('#save').click();await page.waitForFunction(()=>!document.querySelector('#task-dialog').open);
    const saves=calls.filter(c=>c.method==='saveTask');assert.equal(saves[1].args[0].id,failedId);assert.equal(saves[1].args[0].fields[3],'30/11/2026');assert.equal(saves[1].args[0].fields[5],'Đang thực hiện');
    const card=page.locator('#list article').filter({hasText:'<b>Nhiệm vụ mới</b>'});assert.equal(await card.locator('h3 b').count(),0);
    await card.getByRole('button',{name:'Sửa',exact:true}).click();await page.locator('#progress').fill('Kết quả mới');await page.locator('#save').click();await page.waitForFunction(()=>!document.querySelector('#task-dialog').open);
    assert(calls.filter(c=>c.method==='saveTask').at(-1).args[0].version);
    await card.getByRole('button',{name:'Xóa',exact:true}).click();await page.locator('#confirm-delete').click();await page.waitForFunction(()=>!document.querySelector('#delete-dialog').open);assert.equal(await card.count(),0);
    await page.locator('#trash-tab').click();await page.waitForFunction(()=>document.querySelector('#trash-tab').getAttribute('aria-pressed')==='true');await page.getByRole('button',{name:'Khôi phục',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('Đã khôi phục'));await page.locator('#active-tab').click();assert.equal(await card.count(),1);
    assert.match(await page.locator('#dashboard').getAttribute('href'),/refresh=1/);
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('dashboard without deployment remains readable; configured link uses Google-hosted editor; refresh=1 overrides cache',async()=>{
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage();let configured=false;
    await page.addInitScript(({tasks,units,key})=>localStorage.setItem(key,JSON.stringify({version:1,tasks,units,savedAt:new Date().toISOString()})),{tasks:tasksCSV,units:unitsCSV,key:cacheKey});
    await page.route('http://localhost:8999/**',r=>{
      const name=new URL(r.request().url()).pathname.slice(1)||'index.html';
      const body=name==='editor-config.js'&&configured?"window.TASK_EDITOR_CONFIG={url:'https://script.google.com/macros/s/test-deployment/exec'}":fs.readFileSync(name,'utf8');
      return r.fulfill({contentType:name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html',body});
    });
    await page.goto('http://localhost:8999');assert.equal(await page.locator('#count').innerText(),'65/65');await page.locator('#task-editor-link').click();assert(await page.locator('#editor-unavailable').isVisible());await page.locator('#close-editor-unavailable').click();
    configured=true;await page.reload();assert.equal(await page.locator('#task-editor-link').getAttribute('href'),'https://script.google.com/macros/s/test-deployment/exec');
    let requests=0;await page.route('https://docs.google.com/**',r=>{requests++;return r.abort();});
    await page.goto('http://localhost:8999/?refresh=1');await page.waitForFunction(()=>!document.querySelector('#load').disabled);assert.equal(requests,2);assert.equal(new URL(page.url()).searchParams.has('refresh'),false);assert.equal(await page.locator('#count').innerText(),'65/65');
  } finally {await browser.close();}
});
