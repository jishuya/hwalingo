// Uses local mock API responses and the production frontend build; never connects to the application DB.
import {spawn} from 'node:child_process'
import {createServer} from 'node:http'
import {readFile,writeFile,mkdtemp} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import assert from 'node:assert/strict'
const root=fileURLToPath(new URL('../../',import.meta.url))
const artifacts=await mkdtemp(path.join(tmpdir(),'hwalingo-browser-'))
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
const date=(offset)=>new Date(Date.parse(today)+offset*86400000).toISOString().slice(0,10)
const calls=[]
let mode='normal'
const vocab=Array.from({length:40},(_,i)=>({vocabularyId:String(i+1),word:`example-${i+1}`,meaning:'기억하고 싶은 단어의 의미',languageCode:i%2?'en':'fr',contextMeaning:null,isFavorite:false,exampleSentence:'This is an example sentence.',exampleTranslation:'이것은 예시 문장이에요.',memoryTip:'재미있는 상황으로 떠올려보세요.',progress:{masteryLevel:i%8,totalAttempts:10,incorrectCount:i%5,correctCount:10-i%5,lastReviewedAt:date(-i%7)+'T12:00:00+09:00',nextReviewAt:date(i%10-2)+'T10:00:00+09:00'}}))
const progress={savedWords:40,masteredWords:10,dueWords:8,currentStreak:4,longestStreak:20,weeklyCompletedDays:4,weeklyGoalDays:5,totalXp:1200,level:7,currentLevelXp:30,nextLevelXp:330,progressPercent:9,hwarangGrade:{name:'새싹 학습자',step:7,index:0},masteryDistribution:Array.from({length:8},(_,i)=>({masteryLevel:i,wordCount:5})),recentLearningDays:[],weeklyLearningTrend:[],totalAnswers:100,correctAnswers:75,accuracyPercent:75}
function fixture(url){
 const u=new URL(url,'http://localhost');calls.push(u.pathname+u.search)
 const from=u.searchParams.get('from')??date(-6), to=u.searchParams.get('to')??today
 const span=(Date.parse(to)-Date.parse(from))/86400000+1
 const grain=u.searchParams.get('period')==='all'||span>62?'month':'day'
 const count=grain==='month'?12:Math.min(62,Math.max(1,span))
 const range={start:from,end:to,today,grain}
 const days=Array.from({length:count},(_,i)=>grain==='month'?`${today.slice(0,4)}-${String(i+1).padStart(2,'0')}-01`:new Date(Date.parse(from)+i*86400000).toISOString().slice(0,10))
 const empty=mode==='empty'
 if(u.pathname==='/api/auth/me')return{user:{id:'1',email:'preview@example.test',displayName:'미리보기'}}
 if(u.pathname==='/api/settings/me')return{settings:{theme:'light',weeklyGoalDays:5,quizQuestionCount:10}}
 if(u.pathname==='/api/vocabularies')return{vocabularies:empty?[]:vocab}
 if(u.pathname==='/api/progress/me')return{progress:empty?{...progress,savedWords:0,masteredWords:0,totalXp:0,masteryDistribution:progress.masteryDistribution.map(d=>({...d,wordCount:0}))}:progress}
 if(u.pathname==='/api/progress/activity')return{range,uniqueWords:empty?0:23,days:days.map((date,i)=>({date,newAnswers:empty?0:i%4,reviewAnswers:empty?0:i%5,correctAnswers:empty?0:i%4,uniqueWords:empty?0:i%5}))}
 if(u.pathname==='/api/learning-time/me')return{range,measurementStartedAt:date(-5)+'T00:00:00+09:00',days:days.map((d,i)=>({date:d,endDate:d,seconds:empty?0:i*30,measuredDays:i?1:0,activeDays:empty?0:1,byActivity:{analysis:empty?0:i*10,quiz:empty?0:i*10,story:empty?0:i*10,vocabulary:0}}))}
 if(u.pathname==='/api/progress/calendar')return{days:Array.from({length:365},(_,i)=>({date:date(i-364),activityCount:empty?0:i%35,answerCount:empty?0:i%20,earnedXp:empty?0:i*3}))}
 if(u.pathname==='/api/progress/relearning')return{range,days:days.map((date,i)=>({date,completed:empty?0:i%4,remaining:empty?0:i%2,unavailable:empty?0:i%2,standardRemaining:empty?0:i%2,incorrectRemaining:0}))}
 if(u.pathname==='/api/progress/insights')return{range,activities:empty?[]:[{type:'analysis',count:10},{type:'vocabulary',count:20},{type:'quiz',count:42},{type:'story',count:3}],languages:empty?[]:[{language:'en',saved:20,learned:15,mastered:5,answers:30},{language:'fr',saved:20,learned:10,mastered:5,answers:12}],weekdays:Array.from({length:7},(_,i)=>({weekday:i+1,averageAnswers:empty?0:i*2,averageSeconds:empty?null:i*40,activeDays:empty?0:i,observedDays:8,measuredDays:empty?0:4})),growth:{openingXp:empty?0:100,days:days.map((date,i)=>({date,totalXp:empty?0:100+i*50,earnedXp:empty?0:50,level:empty?1:2+Math.floor(i/3),levelsGained:empty?0:i%3===0?1:0,grade:'새싹 학습자'}))}}
 return{}
}
const server=createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');if(mode==='error'&&!req.url.startsWith('/api/auth')&&!req.url.startsWith('/api/settings')){res.statusCode=500;res.end(JSON.stringify({message:'test error'}));return}res.end(JSON.stringify(fixture(req.url)));return}
 const pathname=new URL(req.url,'http://localhost').pathname
 const file=Boolean(path.extname(pathname))?pathname:'/index.html'
 const mime=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':file.endsWith('.webmanifest')?'application/manifest+json':'text/html'
 res.setHeader('Content-Type',mime);res.end(await readFile(path.join(root,'frontend/dist',file)))
 }catch(e){res.statusCode=404;res.end('not found')}})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port

const chrome=spawn(process.env.CHROME_BIN??'/usr/bin/google-chrome',['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-pipe','--user-data-dir='+path.join(artifacts,'profile'),'about:blank'],{stdio:['ignore','ignore','pipe','pipe','pipe']})
let next=1,buffer=Buffer.alloc(0),session
const pending=new Map(),errors=[]
chrome.stderr.on('data',()=>{})
chrome.stdio[4].on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);let index;while((index=buffer.indexOf(0))>=0){const value=JSON.parse(buffer.subarray(0,index).toString());buffer=buffer.subarray(index+1);if(value.id){const p=pending.get(value.id);pending.delete(value.id);value.error?p?.reject(new Error(JSON.stringify(value.error))):p?.resolve(value.result)}else if(value.method==='Runtime.exceptionThrown')errors.push(value.params.exceptionDetails)}})
function cdp(method,params={},sessionId=session){const id=next++;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});chrome.stdio[3].write(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0')})}
const timeout=setTimeout(()=>{console.error('browser timeout');chrome.kill('SIGKILL');server.close();process.exit(1)},60000)
const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function ready(text){for(let i=0;i<100;i++){if(await evaluate(`(document.body?.innerText??'').includes(${JSON.stringify(text)})`))return;await pause(50)}throw new Error('missing '+text)}
async function click(selector){assert(await evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`),selector);await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await pause(180)}
async function screenshot(name){const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path.join(artifacts,name+'.png'),Buffer.from(shot.data,'base64'))}
try{
 const target=await cdp('Target.createTarget',{url:'about:blank'},undefined)
 const attached=await cdp('Target.attachToTarget',{targetId:target.targetId,flatten:true},undefined);session=attached.sessionId
 await cdp('Runtime.enable');await cdp('Page.enable')
 for(const width of [390,1440]){
  await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500})
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/learning-progress`});await ready('하루 평균');await ready('요일별 학습 패턴')
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'horizontal page overflow '+width)
  await screenshot('records-'+width)
  await evaluate(`document.querySelector('.learning-time-card').scrollIntoView()`);await screenshot('time-'+width)
  await evaluate(`document.querySelector('.learning-accuracy-card').scrollIntoView()`);await screenshot('accuracy-'+width)
  await evaluate(`document.querySelector('.analytics-card').scrollIntoView()`);await screenshot('weekdays-'+width)
  await click('.analytics-period button:nth-child(2)');await ready('하루 평균')
  assert(await evaluate(`document.querySelector('.learning-time-bars').children.length>=28`),'month bars')
  await screenshot('month-'+width)
  await click('.analytics-period button:nth-child(3)');await ready('선택 기간 합계')
  await click('.analytics-period button:nth-child(4)');await ready('선택 기간 합계')
  await click('#analytics-tab-vocabulary');await ready('오답 재학습 완료');await ready('언어별 학습 현황')
  await screenshot('vocabulary-'+width)
  await click('.learning-mastery-rows>button');await ready('처음 만남 단어')
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await pause(100)
  await click('#analytics-tab-growth');await ready('누적 XP 성장 곡선');await ready('기간 마지막 누적 XP')
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'growth overflow '+width)
  await screenshot('growth-'+width)
  await evaluate(`document.querySelector('.analytics-growth-chart').scrollIntoView()`);await screenshot('growth-chart-'+width)
  if(width===390){await evaluate(`document.documentElement.dataset.theme='dark'`);await screenshot('growth-dark');await evaluate(`document.documentElement.dataset.theme='light'`)}
 }
 for(const state of ['empty','error']){
  mode=state
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/learning-progress?tab=records&test=${state}`});await ready(state==='empty'?'하루 평균':'다시 시도');await screenshot(state)
  await click('#analytics-tab-vocabulary');await ready('언어별 학습 현황');await screenshot(state+'-vocabulary')
  await click('#analytics-tab-growth');await ready('누적 XP 성장 곡선');await screenshot(state+'-growth')
 }
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log(JSON.stringify({checked:'mobile and desktop; all tabs; week/month/year/all; detail modal; empty/error; no runtime errors or horizontal overflow',screenshots:artifacts,requests:calls.length}))
}finally{clearTimeout(timeout);chrome.kill('SIGTERM');await new Promise(resolve=>server.close(resolve))}
