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
const vocab=Array.from({length:40},(_,i)=>({vocabularyId:String(i+1),word:`example-${i+1}`,meaning:'기억하고 싶은 단어의 의미',cefrLevel:'B2',languageCode:i%2?'en':'fr',contextMeaning:'문맥에 맞는 단어의 뜻이에요.',etymology:'어원을 한국어로 확인해요.',isFavorite:false,exampleSentence:'This is an example sentence.',exampleTranslation:'이것은 예시 문장이에요.',memoryTip:'재미있는 상황으로 떠올려보세요.',progress:{masteryLevel:i%8,totalAttempts:10,incorrectCount:i%5,correctCount:10-i%5,lastReviewedAt:date(-i%7)+'T12:00:00+09:00',nextReviewAt:date(i%10-2)+'T10:00:00+09:00'}}))
const progress={savedWords:40,masteredWords:10,dueWords:8,currentStreak:4,longestStreak:20,weeklyCompletedDays:4,weeklyGoalDays:5,totalXp:1200,level:7,currentLevelXp:30,nextLevelXp:330,progressPercent:9,hwarangGrade:{name:'새싹 학습자',step:7,index:0},masteryDistribution:Array.from({length:8},(_,i)=>({masteryLevel:i,wordCount:5})),recentLearningDays:[],weeklyLearningTrend:[],totalAnswers:100,correctAnswers:75,accuracyPercent:75}
let practiceSession
let practiceScope=''
function fixture(url,method,body={}){
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
 if(/^\/api\/vocabularies\/[^/]+\/favorite$/.test(u.pathname)){const word=vocab.find(item=>item.vocabularyId===u.pathname.split('/')[3]);if(word)word.isFavorite=method==='POST';return{}}
 if(/^\/api\/vocabularies\/[^/]+\/incorrect-practice$/.test(u.pathname)){
  const word=vocab.find(item=>item.vocabularyId===u.pathname.split('/')[3]);if(word)word.incorrectPracticeExcluded=true;return{}
 }
 if(u.pathname==='/api/quizzes/sessions'&&method==='POST'){
  const eligible=vocab.filter(word=>word.progress.incorrectCount>0&&!word.incorrectPracticeExcluded)
  const chosen=body.vocabularyIds?eligible.filter(word=>body.vocabularyIds.includes(word.vocabularyId)):eligible
  const scope=chosen.map(word=>word.vocabularyId).sort().join(',')
  if(!practiceSession||practiceSession.status!=='active'||practiceScope!==scope){
   practiceScope=scope
   practiceSession={id:'practice-'+calls.length,status:'active',mode:'incorrect',practiceVersion:1,practiceVocabularyIds:body.vocabularyIds??null,totalCount:chosen.length,correctCount:0,earnedXp:0,items:chosen.map((word,index)=>({...word,id:'item-'+word.vocabularyId,position:index+1,retryOfItemId:null,selectionGroup:'weak',reviewIntervalMinutes:36000,questionType:'recall',choices:[],prompt:word.word,result:null,generationSource:'deterministic'}))}
  }
  return{session:practiceSession}
 }
 if(/^\/api\/quizzes\/sessions\/[^/]+\/items\/[^/]+\/answer$/.test(u.pathname)){
  const item=practiceSession.items.find(item=>item.id===u.pathname.split('/')[6]);item.result=body.selfReportedCorrect?'correct':'incorrect'
  practiceSession.correctCount++;if(practiceSession.items.every(item=>item.result))practiceSession.status='completed'
  return{correct:body.selfReportedCorrect,xpEarned:0,mastery:{before:2,after:2},nextReviewAt:today}
 }
 if(u.pathname==='/api/quizzes/sessions/active')return{session:practiceSession?.status==='active'?practiceSession:null}
 if(u.pathname.startsWith('/api/quizzes/sessions/'))return{session:practiceSession}
 if(u.pathname==='/api/vocabularies')return{vocabularies:empty?[]:vocab}
 if(u.pathname==='/api/progress/me')return{progress:empty?{...progress,savedWords:0,masteredWords:0,totalXp:0,masteryDistribution:progress.masteryDistribution.map(d=>({...d,wordCount:0}))}:progress}
 if(u.pathname==='/api/progress/word-growth')return{words:empty?[]:vocab.slice(0,3).map((w,i)=>({vocabularyId:w.vocabularyId,word:w.word,meaning:w.meaning,languageCode:w.languageCode,beforeLevel:0,currentLevel:3-i,gained:3-i}))}
 if(u.pathname==='/api/progress/activity')return{range,uniqueWords:empty?0:23,days:days.map((date,i)=>({date,newAnswers:empty?0:i%4,reviewAnswers:empty?0:i%5,correctAnswers:empty?0:i%4,uniqueWords:empty?0:i%5}))}
 if(u.pathname==='/api/learning-time/me')return{range,measurementStartedAt:date(-5)+'T00:00:00+09:00',days:days.map((d,i)=>({date:d,endDate:d,seconds:empty?0:i*30,measuredDays:i?1:0,activeDays:empty?0:1,byActivity:{analysis:empty?0:i*10,quiz:empty?0:i*10,story:empty?0:i*10,vocabulary:0}}))}
 if(u.pathname==='/api/progress/calendar')return{days:Array.from({length:365},(_,i)=>({date:date(i-364),activityCount:empty?0:i%35,answerCount:empty?0:i%20,earnedXp:empty?0:i*3}))}
 if(u.pathname==='/api/progress/relearning')return{range,days:days.map((date,i)=>({date,completed:empty?0:i%4,remaining:empty?0:i%2,unavailable:empty?0:i%2,standardRemaining:empty?0:i%2,incorrectRemaining:0}))}
 if(u.pathname==='/api/progress/insights')return{range,activities:empty?[]:[{type:'analysis',count:10},{type:'vocabulary',count:20},{type:'quiz',count:42},{type:'story',count:3}],languages:empty?[]:[{language:'en',saved:20,learned:15,mastered:5,answers:30},{language:'fr',saved:20,learned:10,mastered:5,answers:12}],weekdays:Array.from({length:7},(_,i)=>({weekday:i+1,maxAnswers:empty?0:i*4,maxSeconds:empty?null:i*80,averageAnswers:empty?0:i*2,averageSeconds:empty?null:i*40,activeDays:empty?0:i,observedDays:8,measuredDays:empty?0:4})),growth:{openingXp:empty?0:100,days:days.map((date,i)=>({date,totalXp:empty?0:100+i*50,earnedXp:empty?0:50,level:empty?1:2+Math.floor(i/3),levelsGained:empty?0:i%3===0?1:0,grade:'새싹 학습자'}))}}
 return{}
}
const server=createServer(async(req,res)=>{try{
 if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');if(mode==='error'&&!req.url.startsWith('/api/auth')&&!req.url.startsWith('/api/settings')){res.statusCode=500;res.end(JSON.stringify({message:'test error'}));return}let raw='';for await(const chunk of req)raw+=chunk;res.end(JSON.stringify(fixture(req.url,req.method,raw?JSON.parse(raw):{})));return}
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
  assert.equal(await evaluate(`(() => {
    const time=document.querySelector('.learning-time-totals'), volume=document.querySelector('.learning-volume-summary');
    if (!time || !volume) return false;
    const properties=['marginTop','marginBottom','paddingTop','paddingBottom','fontSize','lineHeight'];
    return [null,'div','span','strong'].every(selector => {
      const a=selector?time.querySelector(selector):time, b=selector?volume.querySelector(selector):volume;
      const ac=getComputedStyle(a), bc=getComputedStyle(b);
      return properties.every(key=>ac[key]===bc[key]) && Math.abs(a.getBoundingClientRect().height-b.getBoundingClientRect().height)<1;
    });
  })()`),true,'time and volume summary dimensions '+width)
  assert.equal(await evaluate(`document.querySelectorAll('.learning-volume-summary>div').length`),3)
  await evaluate(`(() => {
    document.documentElement.style.scrollBehavior='auto';
    document.querySelector('.learning-progress-page').style.paddingTop='1200px';
    window.chartEntranceCount=0;
    document.querySelectorAll('.learning-time-bar').forEach(element=>{
      const original=element.animate.bind(element);
      element.animate=(...args)=>{window.chartEntranceCount++;return original(...args)};
    });
    const plot=document.querySelector('.learning-time-bars');
    window.scrollTo(0,plot.getBoundingClientRect().top+scrollY+plot.offsetHeight+100);
  })()`)
  await pause(200)
  await evaluate(`window.chartEntranceCount=0`)
  await evaluate(`(() => {const plot=document.querySelector('.learning-time-bars');window.scrollTo(0,plot.getBoundingClientRect().top+scrollY-innerHeight+plot.offsetHeight*.2)})()`)
  await pause(200)
  assert.equal(await evaluate(`window.chartEntranceCount`),0,'no entrance below 30 percent')
  await evaluate(`(() => {const plot=document.querySelector('.learning-time-bars');window.scrollTo(0,plot.getBoundingClientRect().top+scrollY-innerHeight+plot.offsetHeight*.4)})()`)
  await pause(200)
  assert.ok(await evaluate(`window.chartEntranceCount>0`),'entrance after 30 percent')
  await evaluate(`(() => {const plot=document.querySelector('.learning-time-bars');window.scrollTo(0,plot.getBoundingClientRect().top+scrollY+plot.offsetHeight+100);window.chartEntranceCount=0})()`)
  await pause(200)
  await evaluate(`document.querySelector('.learning-time-bars').scrollIntoView({block:'center'})`)
  await pause(200)
  assert.ok(await evaluate(`window.chartEntranceCount>0`),'replay when scrolling back up')
  await evaluate(`document.querySelector('.learning-progress-page').style.paddingTop='';window.scrollTo(0,0)`)
  await screenshot('records-'+width)
  await evaluate(`document.querySelector('.learning-time-card').scrollIntoView()`);await screenshot('time-'+width)
  assert.equal(await evaluate(`document.querySelector('.learning-accuracy-card')`),null)
  await evaluate(`document.querySelector('.analytics-card').scrollIntoView()`);await pause(1400);await screenshot('weekdays-'+width)
  await click('.analytics-period button:nth-child(2)');await ready('하루 평균')
  assert(await evaluate(`document.querySelector('.learning-time-bars').children.length===${Number(today.slice(8,10))}`),'month bars')
  assert.equal(await evaluate(`document.querySelector('.analytics-period.card')`),null)
  assert.equal(await evaluate(`document.querySelector('.learning-volume-card .analytics-period button[aria-pressed="true"]').textContent`),'주','volume period remains independent')
  await click('.learning-volume-card .analytics-period button:nth-child(2)')
  await ready('선택 기간 합계')
  assert.equal(await evaluate(`document.querySelector('.learning-volume-card .analytics-period button[aria-pressed="true"]').textContent`),'월')
  await screenshot('month-'+width)
  await click('.analytics-period button:nth-child(3)');await ready('선택 기간 합계')
  await click('.analytics-period button:nth-child(4)');await ready('선택 기간 합계')
  await click('#analytics-tab-vocabulary');await ready('언어별 학습 현황')
  assert.equal(await evaluate(`document.querySelectorAll('.analytics-period').length`),0)
  await click('.analytics-card .analytics-switch button:nth-child(4)')
  assert.equal(await evaluate(`document.querySelectorAll('.analytics-period').length`),1)
  await click('.analytics-card .analytics-switch button:nth-child(1)')
  assert.equal(await evaluate(`document.querySelectorAll('.analytics-period').length`),0)
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('#analytics-panel-vocabulary .report-chart-refresh')).every(button=>{
    const rect=button.getBoundingClientRect(),icon=button.querySelector('svg').getBoundingClientRect();
    return rect.width===26&&rect.height===26&&icon.width===15&&icon.height===15&&!button.textContent.trim();
  })`),true,'vocabulary refresh sizes')
  assert.equal(await evaluate(`document.querySelectorAll('#analytics-panel-vocabulary [class*="-note"]').length`),0,'no long chart notes')
  await ready('최근 성장한 단어 TOP 5')
  assert.equal(await evaluate(`document.querySelectorAll('.learning-word-growth-card .learning-weak-ranking>li').length`),3)
  assert.ok(await evaluate(`document.querySelector('.learning-word-growth-card').textContent.includes('+3단계')`))
  assert.equal(await evaluate(`document.querySelector('.learning-relearning-card')`),null,'relearning chart removed')
  assert.equal(await evaluate(`document.querySelector('.learning-review-card')`),null,'review schedule removed')
  await screenshot('vocabulary-'+width)
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'vocabulary overflow '+width)
  for(const [selector,name] of [['.learning-mastery-card','mastery'],['.learning-weak-card:not(.learning-word-growth-card)','weak'],['.learning-word-growth-card','word-growth'],['.analytics-horizontal.languages','languages']]){
   await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView()`);await screenshot(name+'-'+width)
  }
  if(width===390){await evaluate(`document.documentElement.dataset.theme='dark';document.querySelector('.learning-mastery-card').scrollIntoView()`);await screenshot('vocabulary-dark');await evaluate(`document.documentElement.dataset.theme='light'`)}

  await click('[aria-label="숙련도 단계 안내"]');await ready('숙련도 단계 안내')
  assert.equal(await evaluate(`document.querySelectorAll('[role="dialog"] .mastery-stage-guide>li').length`),8)
  assert.ok(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('120일')`))
  await pause(500)
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] .ui-dialog-footer')`),null)
  assert.ok(await evaluate(`(() => {const rect=document.querySelector('[role="dialog"]').getBoundingClientRect();return Math.abs((rect.top+rect.bottom)/2-innerHeight/2)<2})()`),'help overlay centered')
  await screenshot('mastery-help-'+width)
  await click('[aria-label="숙련도 단계 안내 닫기"]')
  assert.equal(await evaluate(`document.querySelector('[role="dialog"]')`),null)
  await click('.learning-weak-card:not(.learning-word-growth-card) .learning-weak-ranking li>button');await ready('단어 상세')
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] .compact-delete')`),null,'detail hides delete')
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] .favorite-star')`),null,'detail hides favorite')
  assert.ok(await evaluate(`document.querySelector('[role="dialog"] .vocabulary-page .compact-word-card.expanded')!==null`))
  assert.ok(await evaluate(`document.querySelector('[role="dialog"] .vocabulary-etymology')!==null`))
  assert.ok(await evaluate(`document.querySelector('[role="dialog"] .word-memory-tip')!==null`))
  await click('[role="dialog"] .word-detail-heading button[aria-pressed]')
  assert.ok(await evaluate(`document.querySelector('[role="dialog"] .word-example-translation')!==null`))
  await screenshot('weak-word-detail-'+width)
  await click('[aria-label="단어 상세 닫기"]')
  await click('.learning-mastery-rows>button');await ready('New 단어')
  assert.ok(await evaluate(`document.querySelector('[role="dialog"]').textContent.includes('처음 저장했거나 다시 익혀야 하는 단어예요.')`))
  assert.equal(await evaluate(`document.querySelector('[role="dialog"] .report-word-cefr').textContent`),'B2')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.learning-mastery-word-count')).textAlign`),'right')
  assert.ok(await evaluate(`document.querySelector('[role="dialog"] .report-word-language').textContent.length>0`))
  await screenshot('mastery-words-'+width)
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await pause(100)
  await click('#analytics-tab-growth');await ready('누적 XP 성장 곡선');await ready('기간 마지막 누적 XP')
  assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'growth overflow '+width)
  assert.ok(await evaluate(`document.querySelector('.growth-area').getAttribute('d').endsWith('Z')`))
  await click('.analytics-growth-columns>button')
  assert.equal(await evaluate(`document.querySelector('.analytics-growth-columns>button').getAttribute('aria-pressed')`),'true')
  assert.ok(await evaluate(`document.querySelector('[role="tooltip"]').textContent.includes('누적')`),'click shows XP tooltip')
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`)
  assert.equal(await evaluate(`document.querySelector('[role="tooltip"]')`),null,'escape dismisses tooltip')
  await click('.analytics-growth-columns>button:last-child .growth-date')
  assert.ok(await evaluate(`document.querySelector('[role="tooltip"]').textContent.includes('400 XP')`),'date click shows last value')
  assert.ok(await evaluate(`(() => {const rect=document.querySelector('[role="tooltip"]').getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth})()`),'edge tooltip stays in viewport')
  assert.equal(await evaluate(`document.querySelector('.growth-hero-avatar img').alt`),'레벨 7 프로필 캐릭터','hero uses user character')
  assert.equal(await evaluate(`document.querySelector('.growth-hero-avatar>span').textContent`),'Lv.7')
  assert.equal(await evaluate(`document.querySelector('.growth-hero-copy [role="progressbar"]').getAttribute('aria-valuenow')`),'9')
  await screenshot('growth-'+width)
  await evaluate(`document.querySelector('.analytics-growth-chart').scrollIntoView()`);await screenshot('growth-chart-'+width)
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.analytics-growth-axis>span:not(.growth-axis-unit)')).every(label=>/^\\d{1,3}$/.test(label.textContent))`),true,'axis has at most three digits')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.growth-fit-chart')).gridTemplateColumns.split(' ')[0]`),'30px','compact XP axis')
  assert.equal(await evaluate(`document.querySelectorAll('.analytics-growth-columns>button').length`),7,'default shows seven days')
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('.growth-date')).map(label=>label.textContent)`),Array.from({length:7},(_,i)=>date(i-6)).map(d=>`${Number(d.slice(5,7))}/${Number(d.slice(8,10))}`),'all seven dates are visible')
  assert.equal(await evaluate(`document.querySelector('.analytics-growth-columns>button').getAttribute('aria-label').includes('기간 시작 전')`),false,'opening balance excluded from default week')
  assert.equal(await evaluate(`document.querySelector('.growth-zoom-hint')`),null,'zoom hint removed')
  const initialPointCount=await evaluate(`document.querySelectorAll('.analytics-growth-columns>button').length`)
  const wheelPosition=await evaluate(`(() => {const rect=document.querySelector('.analytics-growth-columns').getBoundingClientRect();return {x:rect.left+rect.width*.6,y:rect.top+80}})()`)
  for(const deltaY of [-120,120]){
    await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...wheelPosition,deltaX:0,deltaY})
    await pause(100)
    assert.equal(await evaluate(`document.querySelectorAll('.analytics-growth-columns>button').length`),initialPointCount,'wheel does not zoom graph')
  }
  for(const periodIndex of [2,3,4]){
    await click('.analytics-period button:nth-child('+periodIndex+')')
    await pause(200)
    assert.equal(await evaluate(`(() => {const plot=document.querySelector('.growth-fit-chart');return plot.scrollWidth<=plot.clientWidth})()`),true,'growth fits each period')
    assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'no growth overflow')
  }
  if(width===390){await evaluate(`document.documentElement.dataset.theme='dark'`);await screenshot('growth-dark');await evaluate(`document.documentElement.dataset.theme='light'`)}
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/vocabulary`});await ready('내 단어장');await ready('example-1')
  await click('.compact-word-card .vocabulary-pronounce')
  assert.ok(await evaluate(`document.querySelector('.compact-word-card.expanded .word-details')!==null`))
  assert.ok(await evaluate(`document.querySelector('.compact-word-card .compact-delete')!==null`),'vocabulary keeps delete')
  assert.ok(await evaluate(`document.querySelector('.compact-word-card .favorite-star')!==null`),'vocabulary keeps favorite')
  await screenshot('vocabulary-shared-card-'+width)
  await click('.vocabulary-filter-incorrect')
  const wrongIds=await evaluate(`Array.from(document.querySelectorAll('.vocabulary-practice-checkbox')).length`)
  assert.ok(wrongIds>10)
  await click('.vocabulary-practice-checkbox')
  await evaluate(`document.querySelectorAll('.vocabulary-practice-checkbox')[1].click()`);await pause(100)
  await ready('틀린단어 집중연습 · 2개')
  await screenshot('incorrect-selection-'+width)
  await click('.vocabulary-incorrect-test button')
  await ready('틀린단어 집중연습')
  assert.equal(await evaluate(`document.querySelector('.quiz-practice-header h1').textContent`),'틀린단어 집중연습')
  assert.equal(await evaluate(`document.querySelector('.quiz-review-badge')`),null)
  assert.equal(await evaluate(`document.body.innerText.includes('숙련도·복습일·XP는 바뀌지 않아요.')`),false)
  assert.equal(await evaluate(`document.querySelector('.quiz-progress [role="progressbar"]').getAttribute('aria-valuemax')`),'2')
  await click('[aria-label="안내 닫기"]')
  await screenshot('incorrect-practice-header-'+width)
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await pause(500)
  assert.equal(await evaluate(`document.querySelector('.quiz-progress [role="progressbar"]').getAttribute('aria-valuenow')`),'1')
  await click('.quiz-practice-notice button');await ready('내 단어장')
  await click('.vocabulary-filter-incorrect');await ready('틀린단어 집중연습');await click('.vocabulary-incorrect-test button');await ready('틀린단어 집중연습')
  assert.equal(await evaluate(`document.querySelector('.quiz-progress [role="progressbar"]').getAttribute('aria-valuenow')`),'1','practice resumes')
  await click('[aria-label="안내 닫기"]')
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);await ready('틀린단어 집중연습 완료!')
  assert.equal(await evaluate(`document.querySelector('.quiz-completion-stats').textContent.includes('XP')`),false)
  await screenshot('incorrect-complete-'+width)
  await click('.quiz-completion-home');await ready('내 단어장');await click('.vocabulary-filter-incorrect')
  assert.equal(await evaluate(`document.querySelector('.compact-word-card .compact-delete')`),null,'wrong word cards hide delete')
  assert.equal(await evaluate(`document.querySelector('.compact-word-card .favorite-star')`),null,'wrong word cards hide favorite')
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.vocabulary-practice-checkbox')).borderRadius`),'5px')
  await click('.vocabulary-filter-all')
  assert.ok(await evaluate(`document.querySelector('.compact-word-card .compact-delete')!==null`),'other tabs keep delete')



 }
 for(const state of ['empty','error']){
  mode=state
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/learning-progress?tab=records&test=${state}`});await ready(state==='empty'?'하루 평균':'다시 시도');await screenshot(state)
  await click('#analytics-tab-vocabulary');await ready('언어별 학습 현황');await screenshot(state+'-vocabulary')
  if(state==='empty'){await ready('아직 언어별 학습 기록이 없어요');assert.ok(await evaluate(`document.querySelector('.learning-language-empty svg')!==null`));assert.equal(await evaluate(`document.querySelector('.analytics-horizontal.languages')`),null,'empty languages shows illustration instead of empty plot')}
  await click('#analytics-tab-growth');await ready('누적 XP 성장 곡선');await screenshot(state+'-growth')
  if(state==='empty') assert.equal(await evaluate(`document.querySelectorAll('.growth-date').length`),7,'zero XP days keep all dates')
  if(state==='error'){
    await ready('누적 XP 성장 기록을 불러오지 못했어요.')
    assert.equal(await evaluate(`document.querySelector('.analytics-card .report-chart-error>button').textContent`),'다시 시도')
    assert.equal(await evaluate(`document.querySelector('.analytics-card .report-chart-error').getAttribute('role')`),'alert')
    assert.equal(await evaluate(`document.documentElement.scrollWidth>innerWidth`),false,'chart error has no overflow')
    mode='normal'
    await click('.analytics-card .report-chart-error>button')
    await ready('기간 마지막 누적 XP')
    assert.equal(await evaluate(`document.querySelector('.analytics-card .report-chart-error')`),null,'retry restores growth chart')
  }

 }
 assert.equal(errors.length,0,JSON.stringify(errors))
 console.log(JSON.stringify({checked:'mobile and desktop; all tabs; week/month/year/all; detail modal; empty/error; no runtime errors or horizontal overflow',screenshots:artifacts,requests:calls.length}))
}finally{clearTimeout(timeout);chrome.kill('SIGTERM');await new Promise(resolve=>server.close(resolve))}
