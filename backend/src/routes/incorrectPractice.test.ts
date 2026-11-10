import assert from 'node:assert/strict'
import { test } from 'node:test'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import express from 'express'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'

const execute=promisify(execFile)
interface Session {
  id:string; status:string; totalCount:number; earnedXp:number
  items:Array<{id:string;word:string;result:string|null;retryOfItemId:string|null}>
}

test('incorrect practice selects all or a subset and never changes official learning state', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hwalingo-practice-test-'))
  const pg=process.env.PG_BINDIR??'/usr/lib/postgresql/16/bin'
  let started=false
  let closeApp:(()=>Promise<void>)|undefined
  let closePool:(()=>Promise<void>)|undefined
  try {
    await execute(join(pg,'initdb'),['-D',join(dir,'data'),'-A','trust','-U','postgres','--no-locale'])
    await execute(join(pg,'pg_ctl'),['-D',join(dir,'data'),'-l',join(dir,'pg.log'),'-o',`-k ${dir} -h '' -p 55444`,'-w','start']);started=true
    Object.assign(process.env,{PGHOST:dir,PGPORT:'55444',PGDATABASE:'postgres',PGUSER:'postgres',PGPASSWORD:'test',JWT_SECRET:'practice-test',DB_SSL:'false'})
    const {pool}=await import('../config/database.js');closePool=()=>pool.end()
    await pool.query(await readFile(new URL('../../../docs/db.sql',import.meta.url),'utf8'))
    for(const file of ['003_quiz_sessions.sql','004_user_growth.sql','005_learning_streaks.sql','008_vocabulary_example_translation.sql','011_ai_story_details.sql','015_quiz_retries.sql','016_quiz_modes.sql','018_learning_time.sql']){
      await pool.query(await readFile(process.env.TEST_MIGRATION_DIR?join(process.env.TEST_MIGRATION_DIR,file):new URL('../../sql/'+file,import.meta.url),'utf8'))
    }
    // Earlier schemas can be supplied separately; these fields are used by the current quiz API.
    await pool.query(`ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS quiz_question_count smallint DEFAULT 10;
      ALTER TABLE quiz_session_items ADD COLUMN IF NOT EXISTS acceptable_answers jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS explanation text,ADD COLUMN IF NOT EXISTS generation_source varchar(24) DEFAULT 'deterministic',
      ADD COLUMN IF NOT EXISTS response_time_ms integer`)
    const migration=await readFile(new URL('../../sql/019_incorrect_practice.sql',import.meta.url),'utf8')
    await pool.query(migration)
    const {quizzesRouter}=await import('./quizzes.js')
    const {vocabulariesRouter}=await import('./vocabularies.js')
    const {progressRouter}=await import('./progress.js')
    const app=express();app.use(express.json(),cookieParser());app.use('/quizzes',quizzesRouter);app.use('/vocabularies',vocabulariesRouter);app.use('/progress',progressRouter)
    app.use(((error,_req,res,_next)=>res.status(500).json({message:String(error)})) as express.ErrorRequestHandler)
    const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve))
    closeApp=()=>new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
    const address=server.address();assert.ok(address&&typeof address!=='string')
    const base=`http://127.0.0.1:${address.port}`
    const owner=(await pool.query(`INSERT INTO users(email,password_hash,display_name) VALUES('practice@test.local','test','test') RETURNING id`)).rows[0].id as string
    const cookie=`hwalingo_session=${jwt.sign({userId:owner},'practice-test')}`
    const send=async(path:string,body?:object,method=body?'POST':'GET')=>fetch(base+path,{method,headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
    const post=async(path:string,body:object)=>{const response=await send(path,body);assert.ok(response.ok,await response.clone().text());return response.json()}
    const start=async(body:object={})=>(await post('/quizzes/sessions',{mode:'incorrect',...body})).session as Session
    const get=async(id:string)=>(await (await send('/quizzes/sessions/'+id)).json()).session as Session
    const answer=async(session:Session,correct:boolean)=>{
      const item=session.items.find(item=>!item.result);assert.ok(item)
      return post(`/quizzes/sessions/${session.id}/items/${item.id}/answer`,{selfReportedCorrect:correct})
    }
    const ids:string[]=[]
    for(let i=0;i<58;i++){
      const id=(await pool.query('INSERT INTO vocabularies(user_id,word,meaning) VALUES($1,$2,$3) RETURNING id',[owner,'practice-'+i,'뜻 '+i])).rows[0].id as string
      ids.push(id)
      await pool.query(`INSERT INTO vocabulary_progress(user_id,vocabulary_id,mastery_level,total_attempts,correct_count,incorrect_count,next_review_at)
        VALUES($1,$2,2,3,2,1,CURRENT_TIMESTAMP+($3::int*interval '1 day'))`,[owner,id,i<48?-1:30])
    }
    await pool.query('INSERT INTO user_progress(user_id,total_xp) VALUES($1,330)',[owner])
    await pool.query('INSERT INTO favorite_vocabularies(vocabulary_id) VALUES($1)',[ids[0]])
    const snapshot=async()=>(await pool.query('SELECT * FROM vocabulary_progress WHERE user_id=$1 ORDER BY vocabulary_id',[owner])).rows
    const before=await snapshot()
    let session=await start()
    assert.equal(session.totalCount,58)
    assert.equal((await start({count:1})).id,session.id)
    const first=await answer(session,false)
    assert.equal(first.xpEarned,0);assert.deepEqual(first.mastery,{before:2,after:2})
    session=await get(session.id)
    assert.equal(session.items.length,59)
    assert.equal(session.items.at(-1)!.retryOfItemId,session.items[0].id)
    while(session.items.some(item=>!item.result)){
      const result=await answer(session,true)
      assert.equal(result.xpEarned,0);assert.equal(result.mastery.before,result.mastery.after)
      session=await get(session.id)
    }
    assert.equal(session.status,'completed');assert.equal(session.totalCount,58)
    assert.deepEqual(await snapshot(),before)
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM quizzes WHERE user_id=$1',[owner])).rows[0].n,0)
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM xp_events WHERE user_id=$1',[owner])).rows[0].n,0)
    assert.equal(Number((await pool.query('SELECT total_xp FROM user_progress WHERE user_id=$1',[owner])).rows[0].total_xp),330)
    const learningDay=(await pool.query('SELECT sum(reviewed_word_count)::int AS reviews,sum(earned_xp)::int AS xp FROM user_learning_days WHERE user_id=$1',[owner])).rows[0]
    assert.deepEqual(learningDay,{reviews:0,xp:0})
    const activity=await (await send('/progress/activity')).json()
    assert.equal(activity.days.reduce((n:number,day:{newAnswers:number;reviewAnswers:number})=>n+day.newAnswers+day.reviewAnswers,0),0)

    // Selected sets are exact, ownership is checked, and reordered selections resume.
    const chosen=ids.slice(0,3)
    session=await start({vocabularyIds:chosen,count:1})
    assert.equal(session.totalCount,3)
    assert.equal((await start({vocabularyIds:[...chosen].reverse()})).id,session.id)
    assert.equal((await send('/quizzes/sessions',{mode:'incorrect',vocabularyIds:[]})).status,400)
    assert.equal((await send('/quizzes/sessions',{mode:'incorrect',vocabularyIds:['99999999']})).status,409)
    const standard=(await post('/quizzes/sessions',{count:10})).session as Session
    assert.equal(standard.totalCount,10)
    const standardBefore=await get(standard.id)
    assert.equal((await send(`/vocabularies/${chosen[0]}/incorrect-practice`,undefined,'DELETE')).status,204)
    const vocabularyList=await (await send('/vocabularies')).json()
    const excluded=vocabularyList.vocabularies.find((word:{vocabularyId:string})=>word.vocabularyId===chosen[0])
    assert.ok(excluded);assert.equal(excluded.incorrectPracticeExcluded,true);assert.equal(excluded.isFavorite,true)
    assert.equal(excluded.progress.incorrectCount,1)
    assert.equal((await get(session.id)).totalCount,2)
    assert.equal((await send('/quizzes/sessions',{mode:'incorrect',vocabularyIds:chosen})).status,409)
    assert.deepEqual(await get(standard.id),standardBefore)
    assert.equal((await pool.query('SELECT archived_at FROM vocabularies WHERE id=$1',[chosen[0]])).rows[0].archived_at,null)
    assert.equal((await send(`/quizzes/sessions/${session.id}/items/${session.items[0].id}/answer`,{selfReportedCorrect:true})).status,404)

    // All eligible words are used again when a different selection is explicitly started.
    session=await start()
    assert.equal(session.totalCount,57)
    // Legacy real sessions are expanded in place while preserving answers and retry queues.
    await pool.query('DELETE FROM quiz_session_items WHERE session_id=$1 AND position>10',[session.id])
    await pool.query('UPDATE quiz_sessions SET total_count=10,requested_count=10,practice_version=0 WHERE id=$1',[session.id])
    session=await get(session.id);await answer(session,true);session=await get(session.id);await answer(session,false)
    const oldItems=(await get(session.id)).items
    const resumed=await start()
    assert.equal(resumed.id,session.id);assert.equal(resumed.totalCount,57)
    for(const item of oldItems)assert.deepEqual(resumed.items.find(next=>next.id===item.id),item)
    // The 57-word snapshot does not grow when another official wrong word appears mid-session.
    const extra=(await pool.query(`INSERT INTO vocabularies(user_id,word,meaning) VALUES($1,'later','later') RETURNING id`,[owner])).rows[0].id
    await pool.query('INSERT INTO vocabulary_progress(user_id,vocabulary_id,total_attempts,incorrect_count) VALUES($1,$2,1,1)',[owner,extra])
    assert.equal((await start()).totalCount,57)

    // Quarantine only demo manifest sessions, keeping a real standard session and answers.
    await pool.query(`INSERT INTO xp_events(user_id,event_type,amount,metadata) VALUES($1,'bonus',0,$2::jsonb)`,[owner,JSON.stringify({purpose:'fixture-manifest',session_ids:[Number(resumed.id),Number(standard.id)]})])
    await pool.query(migration);await pool.query(migration)
    assert.equal((await get(resumed.id)).status,'abandoned')
    assert.equal((await get(standard.id)).status,'active')
    assert.equal((await get(resumed.id)).items.length,resumed.items.length)
    const allAgain=await start();assert.equal(allAgain.totalCount,58)
    // A genuine new standard wrong answer reenrols a previously excluded word.
    await pool.query('UPDATE vocabulary_progress SET incorrect_practice_excluded_at=CURRENT_TIMESTAMP WHERE vocabulary_id=(SELECT vocabulary_id FROM quiz_session_items WHERE id=$1)',[standard.items[0].id])
    const standardAnswer=await answer(standard,false)
    assert.deepEqual(standardAnswer.mastery,{before:2,after:1})
    assert.equal((await pool.query('SELECT incorrect_practice_excluded_at FROM vocabulary_progress WHERE vocabulary_id=(SELECT vocabulary_id FROM quiz_session_items WHERE id=$1)',[standard.items[0].id])).rows[0].incorrect_practice_excluded_at,null)
    // An actual vocabulary deletion still removes it from both storage and practice.
    assert.equal((await send(`/vocabularies/${extra}`,undefined,'DELETE')).status,204)
    assert.equal((await get(allAgain.id)).totalCount,57)
  } finally {
    await closeApp?.();await closePool?.()
    if(started)await execute(join(pg,'pg_ctl'),['-D',join(dir,'data'),'-m','immediate','-w','stop'])
    await rm(dir,{recursive:true,force:true})
  }
})
