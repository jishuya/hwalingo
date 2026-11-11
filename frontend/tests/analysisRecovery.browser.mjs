// Production frontend + mock APIs only. No application DB or real AI requests.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../dist/', import.meta.url))
const profile = await mkdtemp(path.join(tmpdir(), 'hwalingo-recovery-browser-'))
let workerVersion = 1
let analysisPosts = 0
let latestReads = 0
const analysis = { inputLanguage:'es', learningLanguage:'en', detectedSourceLanguage:'es', backgroundKnowledge:'광장을 설계한 상황이에요.', warnings:[], sentences:[{inputText:'Una plaza.',learningSentence:'A plaza.',koreanTranslation:'광장입니다.',englishTranslation:'A plaza.',chunks:[{targetText:'A plaza.',sourceMeaning:'광장.'}],keyExpressions:[],paraphrases:[],vocabulary:[]}] }
const job = {id:'saved-job',status:'completed',request:{text:'Una plaza.',inputLanguage:'es',learningLanguage:'en'},analysis,message:null}
const server = createServer(async (req,res) => {
 const url = new URL(req.url,'http://localhost')
 res.setHeader('Cache-Control','no-store')
 if (url.pathname.startsWith('/api/')) {
  res.setHeader('Content-Type','application/json')
  if(req.method==='POST'&&url.pathname==='/api/analysis')analysisPosts++
  if(url.pathname==='/api/analysis/jobs/latest')latestReads++
  const fixture = url.pathname==='/api/auth/me'?{user:{id:'1',displayName:'검증',email:'test@example.invalid'}}
   :url.pathname==='/api/settings/me'?{settings:{theme:'light',weeklyGoalDays:5,quizQuestionCount:10}}
   :url.pathname==='/api/progress/me'?{progress:{currentStreak:3}}
   :url.pathname==='/api/vocabularies'?{vocabularies:[]}
   :url.pathname==='/api/analysis/vocabulary'?{vocabularies:[[]]}
   :url.pathname.startsWith('/api/analysis/jobs/')||url.pathname==='/api/analysis'?{job,analysis}:{}
  res.end(JSON.stringify(fixture));return
 }
 const file = url.pathname.includes('.')?url.pathname.slice(1):'index.html'
 try {
  const content = await readFile(path.join(root,file))
  res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.json')||file.endsWith('.webmanifest')?'application/json':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream')
  res.end(file==='sw.js'?Buffer.concat([content,Buffer.from(`\n// browser-test-version-${workerVersion}`)]):content)
 } catch {res.statusCode=404;res.end('not found')}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const chrome = spawn(process.env.CHROME_BIN??'/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-pipe','--user-data-dir='+profile,'about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']})
chrome.stderr.on('data',()=>{})
let next=1, buffer=Buffer.alloc(0), session
const pending=new Map()
chrome.stdio[4].on('data',chunk=>{
 buffer=Buffer.concat([buffer,chunk]);let end
 while((end=buffer.indexOf(0))>=0){const value=JSON.parse(buffer.subarray(0,end).toString());buffer=buffer.subarray(end+1);if(value.id){const item=pending.get(value.id);pending.delete(value.id);value.error?item?.reject(new Error(JSON.stringify(value.error))):item?.resolve(value.result)}}
})
const cdp=(method,params={},sessionId=session)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0')})
const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const until=async expression=>{for(let i=0;i<200;i++){if(await evaluate(expression))return;await pause(50)}throw new Error('Browser condition timed out: '+expression)}
const timeout=setTimeout(()=>{chrome.kill('SIGKILL');server.close();process.exit(1)},60000)
try {
 const target=await cdp('Target.createTarget',{url:'about:blank'},undefined)
 session=(await cdp('Target.attachToTarget',{targetId:target.targetId,flatten:true},undefined)).sessionId
 await cdp('Runtime.enable');await cdp('Page.enable')
 await cdp('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/study`})
 await until(`document.body.innerText.includes('AI 분석 시작')`)
 assert.equal(await evaluate(`document.body.innerText.includes('이전 분석 이어보기')`),false)
 assert.equal(latestReads,0,'Opening study must not automatically fetch a previous analysis')
 await evaluate(`(() => {const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'Para un proyecto universitario, diseñé una pequeña plaza con formas elegantes.');input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 await evaluate(`document.querySelector('.study-composer-submit button').click()`)

 await until(`document.body.innerText.includes('광장을 설계한 상황이에요.')`)
 assert.equal(analysisPosts,1,'Study submits the requested analysis once')
 await evaluate(`document.querySelector('.clickable-chunks button').click()`)
 assert.equal(await evaluate(`document.querySelector('.clickable-chunks button').textContent`),'광장')
 await until(`Boolean(navigator.serviceWorker.controller)`)
 await evaluate(`(() => {const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,'작성 중인 내용');input.dispatchEvent(new Event('input',{bubbles:true}))})()`)
 workerVersion=2
 await evaluate(`navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)`)
 await until(`document.body.innerText.includes('새 버전이 준비됐어요')`)
 assert.equal(await evaluate(`document.querySelector('textarea').value`),'작성 중인 내용','An update must not silently discard input')
 await evaluate(`Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(b=>b.textContent==='나중에').click()`)
 assert.equal(await evaluate(`document.querySelector('textarea').value`),'작성 중인 내용')
 workerVersion=3
 await evaluate(`navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)`)
 await until(`document.body.innerText.includes('새 버전이 준비됐어요')`)
 await evaluate(`Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(b=>b.textContent==='새로고침').click()`)
 await until(`document.body.innerText.includes('AI 분석 시작')`)
 assert.equal(await evaluate(`document.querySelector('textarea').value`),'','Confirmed update must reload the page')
 console.log('PASS: previous-analysis UI and automatic lookup removed, normal analysis still works; cached-client update is announced, deferrable, and reloads on confirmation.')
} finally {clearTimeout(timeout);chrome.kill('SIGTERM');await new Promise(resolve=>server.close(resolve))}
