/* ============================================================
   QuestLog v2 — Main Application Logic
   ============================================================
   Refactored from single-file. Cloud persistence via db.js.
   ============================================================ */

/* ── Constants ─────────────────────────────────────────────── */
const SKILLS = [
  {id:"projects",   name:"Projects",    icon:"\u{1F6E0}\uFE0F", color:"#00FF88"},
  {id:"jobhunt",    name:"Job Hunt",    icon:"\u{1F4BC}",       color:"#FBBF24"},
  {id:"gradschool", name:"Grad School", icon:"\u{1F393}",       color:"#A855F7"},
  {id:"fitness",    name:"Fitness",     icon:"\u{1F4AA}",       color:"#EF4444"},
  {id:"nutrition",  name:"Nutrition",   icon:"\u{1F957}",       color:"#06B6D4"},
  {id:"sleep",      name:"Sleep",       icon:"\u{1F319}",       color:"#38BDF8"},
];
const SK = Object.fromEntries(SKILLS.map(s=>[s.id,s]));

const DIFF = {
  Common:    {xp:10,  color:"#4ADE80"},
  Rare:      {xp:25,  color:"#38BDF8"},
  Epic:      {xp:50,  color:"#A855F7"},
  Legendary: {xp:100, color:"#F59E0B"},
};

const LADDER = {
  projects:["Add one new feature to the project","Write a test or squash a real bug",
            "Deploy it somewhere public","Write a clean README and put it on your resume",
            "Add it to a portfolio page"],
  jobhunt:["Send one more tailored application","Customize your resume for a specific role",
           "Send a referral or cold DM to someone at a target company",
           "Do one mock interview question out loud","Apply to one reach company"],
  gradschool:["Read one paper in your target area","Email a potential advisor",
              "Draft a paragraph of your statement of purpose","Shortlist one more program",
              "Write a short research note"],
  fitness:["Add 5 minutes to your workout","Increase reps or weight on one lift",
           "Add a new exercise","Fit in one extra session this week"],
  nutrition:["Cook one meal instead of ordering","Hit your protein target today",
             "Cut one junk snack","Prep tomorrow's meals tonight"],
  sleep:["Go to bed 15 minutes earlier","No screens 30 min before bed",
         "Wake at the same time tomorrow","Hold the schedule through the weekend"],
};

const MULT = [[30,2.0],[14,1.5],[7,1.25],[3,1.1]];

/* ── Date Helpers ──────────────────────────────────────────── */
function fmt(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const today = ()=> fmt(new Date());
function yesterdayOf(d){ const t=new Date(d+"T00:00"); t.setDate(t.getDate()-1); return fmt(t); }
function daysBetween(a,b){ return Math.round((new Date(b+"T00:00")-new Date(a+"T00:00"))/86400000); }

/* ── State ─────────────────────────────────────────────────── */
const BLANK = ()=>({
  name:"Adventurer", createdAt:today(), totalXP:0,
  skills:Object.fromEntries(SKILLS.map(s=>[s.id,{xp:0}])),
  skillStreak:Object.fromEntries(SKILLS.map(s=>[s.id,{count:0,last:null}])),
  tasks:[],
  days:{},
  streak:{current:0,best:0,last:null},
  funnel:{applications:0,responses:0,interviews:0,offers:0},
  projects:[],
  quests:{date:null,list:[]},
  title:"Newcomer",
  filter:"active",
  apiKey:"",
});
let S = load();

function load(){
  try{ const r=localStorage.getItem("questlog"); if(r) return Object.assign(BLANK(),JSON.parse(r)); }catch(e){}
  return BLANK();
}

function save(){
  try{ localStorage.setItem("questlog",JSON.stringify(S)); }catch(e){}
  if (CloudDB.isConfigured() && CloudDB.getUser()) {
    CloudDB.scheduleSync(S);
  }
}

/* ── Leveling ──────────────────────────────────────────────── */
function reqForLevel(n){ return Math.round(80*Math.pow(1.08,n-1)); }
function overallLevel(){
  let lv=1, xp=S.totalXP;
  while(lv<50 && xp>=reqForLevel(lv)){ xp-=reqForLevel(lv); lv++; }
  return {lv, into:xp, need:lv>=50?0:reqForLevel(lv)};
}
const SKILL_REQ=150, SKILL_CAP=10;
function skillLevel(id){
  let lv=1, xp=S.skills[id].xp;
  while(lv<SKILL_CAP && xp>=SKILL_REQ){ xp-=SKILL_REQ; lv++; }
  return {lv, into:xp, need:lv>=SKILL_CAP?0:SKILL_REQ};
}

/* ── Streak / Multiplier ───────────────────────────────────── */
function currentMultiplier(){
  const c=S.streak.current;
  for(const [d,m] of MULT){ if(c>=d) return m; }
  return 1;
}
function titleFor(){
  const c=S.streak.current, lv=overallLevel().lv;
  if(c>=30) return "Unstoppable";
  if(c>=14) return "Relentless";
  if(c>=7) return "Disciplined";
  if(lv>=10) return "Veteran";
  if(c>=3) return "Committed";
  return "Newcomer";
}

/* ── Daily Quests ──────────────────────────────────────────── */
function weakestSkill(){
  return SKILLS.slice().sort((a,b)=>S.skills[a.id].xp-S.skills[b.id].xp)[0];
}
function ensureQuests(){
  if(!S.quests) S.quests = {date:null,list:[]};
  if(S.quests.date===today()) return;
  const w=weakestSkill();
  S.quests={date:today(),list:[
    {id:"any",   icon:"\u2694\uFE0F", title:"Complete any quest",
     desc:"+20 XP", xp:20, done:false},
    {id:"focus", icon:w.icon, title:`Train ${w.name}`,
     desc:`Finish 1 ${w.name} task \u00b7 +40 XP`, xp:40, skill:w.id, done:false},
    {id:"hard",  icon:"\u{1F525}", title:"Take on a challenge",
     desc:"Finish a Rare or harder quest \u00b7 +30 XP", xp:30, hard:true, done:false},
  ]};
  save();
}
function checkQuests(task){
  let gained=0;
  for(const q of S.quests.list){
    if(q.done) continue;
    let hit=false;
    if(q.id==="any") hit=true;
    else if(q.id==="focus" && task.skill===q.skill) hit=true;
    else if(q.id==="hard" && DIFF[task.difficulty].xp>=25) hit=true;
    if(hit){ q.done=true; gained+=q.xp; }
  }
  if(gained){ S.totalXP+=gained; toast(`Daily quest cleared! +${gained} XP`); }
  return gained;
}

/* ── Core Actions ──────────────────────────────────────────── */
function completeTask(id, ev){
  const t=S.tasks.find(x=>x.id===id); if(!t||t.status!=="active") return;
  const mult=currentMultiplier();
  const base=DIFF[t.difficulty].xp;
  const gained=Math.round(base*mult);
  const before=overallLevel().lv, beforeSk=skillLevel(t.skill).lv;

  t.status="completed"; t.completedAt=today();
  S.totalXP+=gained;
  S.skills[t.skill].xp+=gained;

  const d=today();
  S.days[d]=(S.days[d]||0)+1;
  if(S.streak.last!==d){
    if(S.streak.last===yesterdayOf(d)) S.streak.current++;
    else S.streak.current=1;
    S.streak.last=d;
    S.streak.best=Math.max(S.streak.best,S.streak.current);
  }
  const ss=S.skillStreak[t.skill];
  if(ss.last!==d){
    if(ss.last===yesterdayOf(d)) ss.count++;
    else ss.count=1;
    ss.last=d;
  }
  if(t.funnel && S.funnel[t.funnel]!==undefined) S.funnel[t.funnel]++;

  const questXP=checkQuests(t);
  S.title=titleFor();
  save();

  flyXP(ev, gained+questXP);
  const after=overallLevel().lv, afterSk=skillLevel(t.skill).lv;
  renderAll();
  if(mult>1) setTimeout(()=>toast(`\u{1F525} ${mult}x streak bonus applied`),300);
  if(afterSk>beforeSk) queueLevelUp("skill",t.skill,afterSk);
  if(after>before) queueLevelUp("overall",null,after);
  flushLevelUps();

  // Log level-ups to cloud for weekly review
  if (CloudDB.isConfigured() && CloudDB.getUser()) {
    if (afterSk > beforeSk) CloudDB.execOp({ type:'insert_levelup', data:{ date:d, kind:'skill', skillId:t.skill, level:afterSk }});
    if (after > before) CloudDB.execOp({ type:'insert_levelup', data:{ date:d, kind:'overall', skillId:'', level:after }});
  }

  // Handle recurring tasks (Feature 2 — stub, will be wired later)
  if (t.repeat && t.repeat !== 'none') {
    generateNextInstance(t);
  }
}

let luQueue=[];
function queueLevelUp(kind,skill,lv){ luQueue.push({kind,skill,lv}); }
function flushLevelUps(){
  if(!luQueue.length){ return; }
  const e=luQueue.shift();
  const body=document.getElementById("luBody");
  if(e.kind==="overall"){
    body.innerHTML=`<div class="glow burst">\u2B50</div>
      <div class="eyebrow">Character Level Up</div>
      <div class="big num">LV ${e.lv}</div>
      <p style="color:var(--muted);font-size:.85rem">New title earned: <b style="color:var(--text)">${titleFor()}</b></p>
      <button class="btn-primary" style="width:100%;margin-top:8px" onclick="ackLevel()">Continue</button>`;
  } else {
    const s=SK[e.skill];
    body.innerHTML=`<div class="glow burst" style="filter:drop-shadow(0 0 24px ${s.color})">${s.icon}</div>
      <div class="eyebrow">${s.name} Level Up</div>
      <div class="big num" style="background:linear-gradient(90deg,${s.color},#fff);-webkit-background-clip:text;background-clip:text">LV ${e.lv}</div>
      <p style="color:var(--muted);font-size:.85rem">You're getting stronger in <b style="color:var(--text)">${s.name}</b>.</p>
      <button class="btn-primary" style="width:100%;margin-top:8px" onclick="ackLevel()">Continue</button>`;
  }
  document.getElementById("luModal").classList.add("show");
}
function ackLevel(){
  document.getElementById("luModal").classList.remove("show");
  setTimeout(flushLevelUps,180);
}

/* ── Recurring Tasks (Feature 2 helper) ────────────────────── */
function generateNextInstance(t) {
  if (!t.repeat || t.repeat === 'none') return;
  const baseDue = t.due ? new Date(t.due + 'T00:00') : new Date(today() + 'T00:00');
  let nextDue = new Date(baseDue);
  if (t.repeat === 'daily') {
    nextDue.setDate(nextDue.getDate() + 1);
  } else if (t.repeat === 'weekdays') {
    do { nextDue.setDate(nextDue.getDate() + 1); } while (nextDue.getDay() === 0 || nextDue.getDay() === 6);
  } else if (t.repeat === 'weekly' && t.repeatDays && t.repeatDays.length) {
    nextDue.setDate(nextDue.getDate() + 1);
    let tries = 0;
    while (tries < 14 && !t.repeatDays.includes(nextDue.getDay())) {
      nextDue.setDate(nextDue.getDate() + 1);
      tries++;
    }
  } else { return; }
  const dueStr = fmt(nextDue);
  if (S.tasks.some(x => x.parentId === t.id && x.due === dueStr)) return;
  const next = Object.assign({}, t, {
    id: uid(), status: 'active', createdAt: dueStr,
    due: dueStr, completedAt: undefined, parentId: t.id
  });
  S.tasks.unshift(next);
  save();
}

function rerollRecurringTasks() {
  const t = today();
  S.tasks.forEach(task => {
    if (task.repeat && task.repeat !== 'none' && task.status === 'active') {
      const hasFuture = S.tasks.some(x => x.parentId === task.id && x.due > t);
      if (!hasFuture) generateNextInstance(task);
    }
  });
}

/* ── Recommender ───────────────────────────────────────────── */
function recommendation(id){
  const ss=S.skillStreak[id];
  if(!ss || ss.count<3 || (ss.last!==today() && ss.last!==yesterdayOf(today()))) return null;
  const lv=skillLevel(id).lv;
  const ladder=LADDER[id];
  const idx=Math.min(lv-1,ladder.length-1);
  return ladder[idx];
}
async function suggestAITask(id){
  const ss=S.skillStreak[id];
  if (ss && ss.count >= 3 && S.apiKey) {
    try {
      const recentCompleted = S.tasks
        .filter(t => t.skill === id && t.status === 'completed')
        .slice(-10)
        .map(t => t.title);
      const skillInfo = SK[id];
      const sl = skillLevel(id);
      const prompt = `You are a progression system for a gamified task tracker.
Skill: ${skillInfo.name} (Level ${sl.lv}, ${S.skills[id].xp} XP)
Current streak on this skill: ${ss.count} days
Recent completed tasks in this skill: ${recentCompleted.length ? recentCompleted.join('; ') : 'none yet'}
Ladder suggestions: ${LADDER[id].join('; ')}

Give ONE concrete, actionable next task that escalates difficulty. Return ONLY JSON: {"title":"...","difficulty":"Common|Rare|Epic|Legendary","reasoning":"..."}`;
      const result = await AI.callOpenRouter([
        { role: 'user', content: prompt }
      ], S.apiKey);
      if (result) {
        const parsed = JSON.parse(result.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());
        if (parsed.title) {
          prefillTask(id, parsed.title);
          toast(`AI suggestion: ${parsed.difficulty || 'Common'} difficulty`);
          return;
        }
      }
    } catch(e) {
      console.warn('AI suggestion failed, falling back to ladder:', e);
    }
  }
  const r=recommendation(id) || LADDER[id][0];
  prefillTask(id,r);
}
function prefillTask(skill,title){
  openTask();
  document.getElementById("f-skill").value=skill;
  document.getElementById("f-title").value=title;
  onSkillChange();
}

/* ============================================================
   RENDER
   ============================================================ */
function renderHero(){
  const o=overallLevel();
  const pct=o.need? Math.min(100,Math.round(o.into/o.need*100)):100;
  const syncClass = CloudDB.getSyncStatus();
  document.getElementById("hero").innerHTML=`
    <div class="avatar" style="cursor:pointer" onclick="openProfile()">\u{1F9D9}</div>
    <div class="who">
      <div class="name">${escapeHtml(S.name)} <span class="lvtag num">Lv. ${o.lv}</span>
        <span class="sync-dot ${syncClass}" title="Sync: ${syncClass}"></span></div>
      <div class="ribbon">${S.title}</div>
      <div class="xpbar"><div class="xpfill" style="width:${pct}%"></div></div>
      <div class="xpmeta"><span>${o.need? o.into+' / '+o.need+' XP':'MAX LEVEL'}</span><span class="num">${pct}%</span></div>
    </div>
    <div class="flame"><div class="ic">\u{1F525}</div><div class="d num">${S.streak.current}d</div></div>`;
}

function renderTabs(){
  const counts={active:0,completed:0,failed:0};
  S.tasks.forEach(t=>counts[t.status]++);
  const tabs=[["active","Active"],["completed","Done"],["failed","Failed"]];
  document.getElementById("tabs").innerHTML=tabs.map(([k,l])=>
    `<button class="tab ${S.filter===k?'active':''}" onclick="setFilter('${k}')">${l} ${counts[k]?`(${counts[k]})`:''}</button>`
  ).join("");
}
function setFilter(f){ S.filter=f; save(); renderTabs(); renderTasks(); }

function renderTasks(){
  const d=today();
  S.tasks.forEach(t=>{ if(t.status==="active"&&t.due&&t.due<d){ t.status="failed"; } });
  const list=S.tasks.filter(t=>t.status===S.filter)
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  const el=document.getElementById("tasklist");
  if(!list.length){ el.innerHTML=`<div class="glass pad empty">No ${S.filter} quests. Tap + New Quest to add one.</div>`; return; }
  el.innerHTML=list.map(t=>{
    const s=SK[t.skill], dc=DIFF[t.difficulty];
    const xp=DIFF[t.difficulty].xp;
    return `<div class="glass task ${t.status==='completed'?'done':''} ${t.status==='failed'?'failed':''}" style="--sc:${s.color}">
      <div class="seal" title="${s.name}">${s.icon}</div>
      <div class="body">
        <div class="t">${escapeHtml(t.title)}</div>
        <div class="meta"><span class="chip" style="color:${dc.color};border-color:${dc.color}55">${t.difficulty}</span>
          &nbsp;${s.name}${t.notes?' \u00b7 '+escapeHtml(t.notes):''}${t.repeat&&t.repeat!=='none'?' \u00b7 \u{1F501}':''}</div>
      </div>
      <button class="del" onclick="handleDelete(event,'${t.id}','${t.status}')" title="Delete quest">\u2715</button>
      ${t.status==='active'
        ? `<span class="xpcoin num">+${xp}</span>
           <button class="btn-primary complete-btn" onclick="completeTask('${t.id}',event)">Complete</button>`
        : ``}
    </div>`;
  }).join("");
}

function renderQuests(){
  ensureQuests();
  document.getElementById("qdate").textContent=new Date().toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  document.getElementById("quests").innerHTML=S.quests.list.map(q=>`
    <div class="glass quest ${q.done?'done':''}">
      <div class="qi">${q.icon}</div>
      <div class="qb"><div class="qt">${q.title}</div><div class="qm">${q.desc}</div></div>
      <div>${q.done?'\u2705':'\u25CB'}</div>
    </div>`).join("");
}

function renderSkills(){
  document.getElementById("skilllist").innerHTML=SKILLS.map(s=>{
    const l=skillLevel(s.id);
    const pct=l.need? Math.round(l.into/l.need*100):100;
    const reco=recommendation(s.id);
    const ss=S.skillStreak[s.id];
    const onFire = ss.last===today();
    return `<div class="glass skill" style="border-left:3px solid ${s.color}">
      <div class="top">
        <span class="nm">${s.icon} ${s.name} ${onFire?'<span style="color:var(--streak)">\u{1F525}'+ss.count+'</span>':''}</span>
        <span class="lv num" style="color:${s.color}">Lv. ${l.lv}${l.lv>=SKILL_CAP?' \u00b7 MAX':''}</span>
      </div>
      <div class="ring"><i style="width:${pct}%;background:${s.color};box-shadow:0 0 10px ${s.color}88"></i></div>
      <div class="sub"><span>${l.need? l.into+' / '+l.need+' XP':'Mastered'}</span><span class="num">${pct}%</span></div>
      ${reco?`<div class="reco">\u2B06\uFE0F <b>Level-up move:</b> ${escapeHtml(reco)}
         <div class="x">
           <button class="mini btn-primary" onclick="prefillTask('${s.id}',${JSON.stringify(reco).replace(/"/g,'&quot;')})">Add this</button>
           <button class="mini btn-ghost" onclick="suggestAITask('${s.id}')">Suggest another</button>
         </div></div>`:''}
    </div>`;
  }).join("");
}

function renderFunnel(){
  const f=S.funnel;
  const cells=[["applications","Applied"],["responses","Replies"],["interviews","Interviews"],["offers","Offers"]];
  document.getElementById("funnel").innerHTML=`
    <div class="funnel">${cells.map(([k,l])=>`
      <div class="fcell"><div class="n num">${f[k]}</div><div class="l">${l}</div>
        <div class="fctrl"><button onclick="funnelAdjust('${k}',-1)">\u2212</button><button onclick="funnelAdjust('${k}',1)">+</button></div>
      </div>`).join("")}</div>
    <div class="xpmeta" style="margin-top:10px"><span>Completing a Job Hunt task can auto-advance this.</span></div>`;
}
function funnelAdjust(k,n){ S.funnel[k]=Math.max(0,S.funnel[k]+n); save(); renderFunnel(); }

const PSTAGES=["Started","MVP","Deployed","On Resume"];
function renderProjects(){
  const el=document.getElementById("projlist");
  if(!S.projects.length){ el.innerHTML=`<div class="glass pad empty">No projects yet. Add one and push it from Started \u2192 On Resume.</div>`; return; }
  el.innerHTML=S.projects.map(p=>`
    <div class="glass proj">
      <div class="h"><span class="pn">${escapeHtml(p.name)}</span>
        <button class="del" onclick="delProject('${p.id}')">\u2715</button></div>
      <div class="stages">${PSTAGES.map((s,i)=>`<div class="stage ${i<=p.stage?'on':''}">${s}</div>`).join("")}</div>
      <div class="pctrl">
        <button class="mini btn-ghost" onclick="projStage('${p.id}',-1)">\u2190 Back</button>
        <button class="mini btn-primary" onclick="projStage('${p.id}',1)">Advance \u2192</button>
      </div>
    </div>`).join("");
}
function addProject(){
  const name=prompt("Project name:"); if(!name) return;
  S.projects.push({id:uid(),name:name.trim(),stage:0}); save(); renderProjects();
}
function projStage(id,n){
  const p=S.projects.find(x=>x.id===id); if(!p) return;
  const was=p.stage; p.stage=Math.max(0,Math.min(PSTAGES.length-1,p.stage+n));
  save(); renderProjects();
  if(p.stage>was) toast(p.stage===PSTAGES.length-1?`\u{1F3C6} ${p.name} is resume-ready!`:`${p.name} \u2192 ${PSTAGES[p.stage]}`);
  if (CloudDB.isConfigured() && CloudDB.getUser() && p.stage !== was) {
    CloudDB.execOp({ type:'insert_stage_log', data:{
      projectId:p.id, projectName:p.name, oldStage:was, newStage:p.stage
    }});
  }
}
function delProject(id){ S.projects=S.projects.filter(x=>x.id!==id); save(); renderProjects(); }

function renderMap(){
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  document.getElementById("mapmonth").textContent=now.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  document.getElementById("heathead").innerHTML=["S","M","T","W","T","F","S"].map(d=>`<div class="hhead">${d}</div>`).join("");
  const first=new Date(y,m,1).getDay();
  const days=new Date(y,m+1,0).getDate();
  let cells="";
  for(let i=0;i<first;i++) cells+=`<div></div>`;
  let conquered=0;
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const on=S.days[key]>0; if(on)conquered++;
    const isToday=key===today();
    cells+=`<div class="htile ${on?'on':''} ${isToday?'today':''}">${d}</div>`;
  }
  document.getElementById("heat").innerHTML=cells;
  document.getElementById("conquered").textContent=`${conquered} / ${days} days conquered`;
  document.getElementById("beststreak").innerHTML=`Best streak: <b class="num" style="color:var(--streak)">${S.streak.best}d</b>`;
}

function renderStats(){
  const totalDone=S.tasks.filter(t=>t.status==="completed").length;
  const totalFailed=S.tasks.filter(t=>t.status==="failed").length;
  const byDiff={Common:0,Rare:0,Epic:0,Legendary:0};
  S.tasks.filter(t=>t.status==="completed").forEach(t=>byDiff[t.difficulty]++);
  const rows=[
    ["Total XP",S.totalXP.toLocaleString()],
    ["Quests completed",totalDone],
    ["Quests failed",totalFailed],
    ["Current streak",S.streak.current+" days"],
    ["Active multiplier",currentMultiplier()+"x"],
  ];
  document.getElementById("stats").innerHTML=
    rows.map(([k,v])=>`<div class="skill sub" style="font-size:.8rem;margin-top:0;padding:7px 0;border-bottom:1px solid var(--line)">
      <span style="color:var(--muted)">${k}</span><span class="num">${v}</span></div>`).join("")
    +`<div style="margin-top:12px">${Object.entries(byDiff).map(([k,v])=>
        `<span class="chip" style="color:${DIFF[k].color};border-color:${DIFF[k].color}55;margin:3px 4px 0 0;display:inline-block">${k} ${v}</span>`).join("")}</div>`;
}

function renderAll(){
  renderHero(); renderTabs(); renderTasks(); renderQuests();
  renderSkills(); renderFunnel(); renderProjects(); renderMap(); renderStats();
  save();
}

/* ── Task Modal ────────────────────────────────────────────── */
function openTask(){
  document.getElementById("f-skill").innerHTML=SKILLS.map(s=>`<option value="${s.id}">${s.icon} ${s.name}</option>`).join("");
  buildDifSeg();
  document.getElementById("f-title").value="";
  document.getElementById("f-notes").value="";
  document.getElementById("f-funnel").value="";
  onSkillChange();
  document.getElementById("taskModal").classList.add("show");
  setTimeout(()=>document.getElementById("f-title").focus(),50);
}
let chosenDif="Common";
function buildDifSeg(){
  chosenDif="Common";
  document.getElementById("f-dif").innerHTML=Object.entries(DIFF).map(([k,v])=>
    `<button data-d="${k}" class="${k==='Common'?'on':''}" style="${k==='Common'?'background:'+v.color:''}" onclick="pickDif('${k}')">${k}<br>+${v.xp}</button>`).join("");
}
function pickDif(k){
  chosenDif=k;
  document.querySelectorAll("#f-dif button").forEach(b=>{
    const on=b.dataset.d===k; b.classList.toggle("on",on);
    b.style.background=on?DIFF[k].color:"";
  });
}
function onSkillChange(){
  const isJob=document.getElementById("f-skill").value==="jobhunt";
  document.getElementById("f-funnelwrap").style.display=isJob?"block":"none";
}
document.getElementById("f-skill").addEventListener("change",onSkillChange);

function saveTask(){
  const title=document.getElementById("f-title").value.trim();
  if(!title){ toast("Give your quest a name."); return; }
  const skill=document.getElementById("f-skill").value;
  const t={id:uid(),title,skill,difficulty:chosenDif,
    notes:document.getElementById("f-notes").value.trim(),
    funnel: skill==="jobhunt"?document.getElementById("f-funnel").value:"",
    status:"active",createdAt:today(),due:today(),repeat:"none",repeatDays:[],parentId:""};
  S.tasks.unshift(t); save();
  closeModal("taskModal");
  S.filter="active"; renderAll();
}
function deleteTask(id){ S.tasks=S.tasks.filter(t=>t.id!==id); save(); renderTasks(); renderTabs(); }
function handleDelete(ev,id,status){
  ev.stopPropagation();
  const t=S.tasks.find(x=>x.id===id); if(!t) return;
  if(status==='active'){
    if(!confirm(`Delete "${t.title}"? No XP awarded, no streak impact.`)) return;
  }
  deleteTask(id);
}
function closeModal(id){ document.getElementById(id).classList.remove("show"); }

/* ── FX ────────────────────────────────────────────────────── */
function flyXP(ev,amount){
  const x=ev?ev.clientX:innerWidth/2, y=ev?ev.clientY:innerHeight/2;
  const f=document.createElement("div"); f.className="float"; f.textContent="+"+amount+" XP";
  f.style.left=x+"px"; f.style.top=y+"px"; document.body.appendChild(f);
  setTimeout(()=>f.remove(),1000);
  const bar=document.querySelector(".xpfill").getBoundingClientRect();
  for(let i=0;i<6;i++){
    const o=document.createElement("div"); o.className="orb";
    o.style.left=x+"px"; o.style.top=y+"px"; document.body.appendChild(o);
    const dx=bar.left+bar.width/2, dy=bar.top+bar.height/2;
    requestAnimationFrame(()=>{
      o.style.transition="transform .8s cubic-bezier(.4,0,.2,1),opacity .8s";
      o.style.transform=`translate(${dx-x}px,${dy-y}px)`; o.style.opacity="0";
    });
    setTimeout(()=>o.remove(),850);
  }
}
function toast(msg){
  const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ── Nav ───────────────────────────────────────────────────── */
const VIEWS=[["today","Today","\u2694\uFE0F"],["skills","Skills","\u2B50"],["map","Map","\u{1F5FA}\uFE0F"]];
function buildNav(){
  document.getElementById("nav").innerHTML=VIEWS.map(([k,l,i],idx)=>
    `<button class="${idx===0?'active':''}" data-v="${k}" onclick="goView('${k}')"><span class="ni">${i}</span>${l}</button>`).join("");
}
function goView(v){
  document.querySelectorAll(".view").forEach(el=>el.classList.toggle("active",el.id==="view-"+v));
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.v===v));
  window.scrollTo({top:0,behavior:"smooth"});
}

/* ── Utils ─────────────────────────────────────────────────── */
function uid(){ return Math.random().toString(36).slice(2,9); }
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function exportData(){
  const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download="questlog-backup-"+today()+".json"; a.click();
}
function importData(ev){
  const file=ev.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const data=JSON.parse(r.result);
      if(!data || !data.skills || !data.tasks){ toast("That doesn't look like a QuestLog backup."); return; }
      if(confirm("Replace everything on this device with the backup? Your current progress here will be overwritten.")){
        S=Object.assign(BLANK(),data); save(); ensureQuests(); renderAll(); goView("today");
        toast("Backup restored.");
      }
    }catch(e){ toast("Couldn't read that file."); }
    ev.target.value="";
  };
  r.readAsText(file);
}
function hardReset(){
  if(confirm("Wipe ALL progress and start over? This cannot be undone.")){
    if(confirm("Really sure? Export a backup first if you want to keep your data.")){
      localStorage.removeItem("questlog"); S=BLANK(); save(); renderAll(); goView("today");
    }
  }
}

/* ── Settings ──────────────────────────────────────────────── */
function openSettings(){
  document.getElementById("s-name").value = S.name || '';
  document.getElementById("s-apikey").value = S.apiKey || '';
  document.getElementById("settingsModal").classList.add("show");
}
function saveSettings(){
  const name = document.getElementById("s-name").value.trim();
  if (name) S.name = name;
  S.apiKey = document.getElementById("s-apikey").value.trim();
  save();
  closeModal("settingsModal");
  renderAll();
  toast("Settings saved.");
}

/* ── Auth UI ───────────────────────────────────────────────── */
let authMode = 'signin'; // 'signin' | 'signup'
let authMethod = 'password'; // 'password' | 'magic'

function renderAuthScreen(){
  const box = document.getElementById("authBox");
  const isSignIn = authMode === 'signin';
  const isPassword = authMethod === 'password';
  box.innerHTML = `
    <div class="logo">\u{1F9D9}</div>
    <h1>QUESTLOG</h1>
    <p class="sub">Sync your progress across devices</p>
    <div class="auth-tabs">
      <button class="auth-tab ${isSignIn?'active':''}" onclick="authMode='signin';renderAuthScreen()">Sign In</button>
      <button class="auth-tab ${!isSignIn?'active':''}" onclick="authMode='signup';renderAuthScreen()">Create Account</button>
    </div>
    <input id="auth-email" type="email" placeholder="your@email.com" autocomplete="email">
    ${isPassword ? `<input id="auth-pass" type="password" placeholder="password" autocomplete="${isSignIn?'current-password':'new-password'}">
    <p style="font-size:.6rem;color:var(--muted);margin:-10px 0 10px;text-align:left">6+ chars, uppercase, lowercase, symbol</p>` : ''}
    <button class="btn-primary" style="width:100%;padding:13px" onclick="handleAuth()">
      ${isSignIn ? (isPassword ? 'Sign In' : 'Send Magic Link') : (isPassword ? 'Create Account' : 'Send Magic Link')}
    </button>
    <div class="or">or</div>
    <span class="offline-link" onclick="handleOffline()">Continue offline</span>
    <p class="hint" style="margin-top:14px">
      ${isPassword
        ? `<span style="cursor:pointer;text-decoration:underline" onclick="authMethod='magic';renderAuthScreen()">Use magic link instead</span>`
        : `<span style="cursor:pointer;text-decoration:underline" onclick="authMethod='password';renderAuthScreen()">Use password instead</span>`
      }
    </p>
  `;
}

async function handleAuth(){
  try {
    console.log('handleAuth called', authMode, authMethod);
    const email = document.getElementById("auth-email")?.value.trim();
    if (!email || !email.includes('@')) { toast("Enter a valid email."); return; }

    if (authMethod === 'magic') {
      const result = await CloudDB.signInMagic(email);
      if (result.error) { toast("Failed: " + (result.error.message || 'Unknown error')); return; }
      document.getElementById("authBox").innerHTML = `
        <div class="logo">\u{1F9D9}</div>
        <h1>CHECK YOUR EMAIL</h1>
        <p class="sub">Click the magic link to sign in.<br>This tab updates automatically.</p>
        <p class="hint"><span style="cursor:pointer;text-decoration:underline" onclick="renderAuthScreen()">Back to sign in</span></p>
      `;
      return;
    }

    const pass = document.getElementById("auth-pass")?.value;
    if (!pass) { toast("Enter a password."); return; }
    if (pass.length < 6) { toast("Password must be at least 6 characters."); return; }
    if (!/[A-Z]/.test(pass)) { toast("Password needs an uppercase letter."); return; }
    if (!/[a-z]/.test(pass)) { toast("Password needs a lowercase letter."); return; }
    if (!/[^A-Za-z0-9]/.test(pass)) { toast("Password needs a symbol (!@#$%...)."); return; }

    if (authMode === 'signin') {
      const result = await CloudDB.signInPassword(email, pass);
      if (result.error) { toast("Sign-in failed: " + (result.error.message || 'Wrong email or password')); return; }
      document.getElementById("authScreen").classList.add("hide");
      bootApp();
    } else {
      const result = await CloudDB.signUp(email, pass);
      if (result.error) { toast("Signup failed: " + (result.error.message || 'Unknown error')); return; }
      toast("Account created! You are now signed in.");
      document.getElementById("authScreen").classList.add("hide");
      bootApp();
    }
  } catch(e) {
    console.error('Auth error:', e);
    toast("Something went wrong: " + e.message);
  }
}

function handleOffline(){
  document.getElementById("authScreen").classList.add("hide");
  isOfflineMode = true;
  localStorage.setItem('questlog_offline_mode', '1');
  bootApp();
}

/* ── Profile ───────────────────────────────────────────────── */
function openProfile(){
  const user = CloudDB.getUser();
  const o = overallLevel();
  const body = document.getElementById("profileBody");
  const isOnline = user && !isOfflineMode;
  const email = user?.email || '';
  body.innerHTML = `
    <div class="profile-header">
      <div class="pavatar">\u{1F9D9}</div>
      <div class="pname">${escapeHtml(S.name)} <span class="lvtag num">Lv. ${o.lv}</span></div>
      ${isOnline ? `<div class="pemail">${escapeHtml(email)}</div>` : '<div class="pemail">Offline mode</div>'}
      <div class="plevel">${S.title} \u00b7 ${S.totalXP.toLocaleString()} XP</div>
    </div>
    <div class="profile-section">
      <h3>Account</h3>
      ${isOnline ? `<button class="profile-btn" onclick="openSettings();closeModal('profileModal')">Settings</button>` : ''}
      ${isOnline ? `<button class="profile-btn danger" onclick="signOutApp()">Sign Out</button>` : ''}
      ${!isOnline ? `<button class="profile-btn" onclick="promptSignIn()">Sign In / Create Account</button>` : ''}
    </div>
    <div style="text-align:center;margin-top:16px">
      <button class="btn-ghost" onclick="closeModal('profileModal')" style="font-size:.78rem">Close</button>
    </div>
  `;
  document.getElementById("profileModal").classList.add("show");
}

function promptSignIn(){
  closeModal("profileModal");
  isOfflineMode = false;
  localStorage.removeItem('questlog_offline_mode');
  CloudDB.setSyncStatus('offline');
  renderAuthScreen();
  document.getElementById("authScreen").classList.remove("hide");
}

async function signOutApp(){
  await CloudDB.signOut();
  localStorage.removeItem('questlog_offline_mode');
  closeModal("profileModal");
  S = BLANK();
  save();
  renderAll();
  renderAuthScreen();
  document.getElementById("authScreen").classList.remove("hide");
  toast("Signed out.");
}

let isOfflineMode = false;

/* ── Migration UI ──────────────────────────────────────────── */
function showMigrationPrompt(){
  const body = document.getElementById("migrateBody");
  body.innerHTML = `
    <div class="icon">\u{1F4E6}</div>
    <h2>Import Local Progress?</h2>
    <p>We found existing progress on this device. Import it to the cloud so it syncs across devices?</p>
    <div style="display:flex;gap:10px">
      <button class="btn-ghost" onclick="skipMigration()" style="flex:1">Skip</button>
      <button class="btn-primary" onclick="runMigration()" style="flex:1">Import</button>
    </div>
  `;
  document.getElementById("migrateModal").classList.add("show");
}

async function runMigration(){
  closeModal("migrateModal");
  toast("Importing progress...");
  const ok = await CloudDB.migrateLocalToCloud();
  if (ok) {
    toast("Progress imported! Now syncing to cloud.");
    CloudDB.setSyncStatus('synced');
    renderAll();
  } else {
    toast("Import failed. Data stays on this device.");
  }
}

function skipMigration(){
  closeModal("migrateModal");
}

/* ── Boot ──────────────────────────────────────────────────── */
function bootApp(){
  ensureQuests();
  rerollRecurringTasks();
  firstRun();
  renderAll();
}

function firstRun(){
  if(S.createdAt===today() && S.totalXP===0 && S.tasks.length===0 && !localStorage.getItem("questlog_named")){
    const n=prompt("Welcome, adventurer. What's your name?");
    if(n&&n.trim()) S.name=n.trim();
    localStorage.setItem("questlog_named","1");
    save();
  }
}
function ambient(){
  const b=document.getElementById("bokeh"); let h="";
  for(let i=0;i<14;i++){
    const s=4+Math.random()*10;
    h+=`<i style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${s}px;height:${s}px;animation-duration:${6+Math.random()*8}s;animation-delay:${-Math.random()*8}s"></i>`;
  }
  b.innerHTML=h;
}

async function initApp(){
  ambient();
  buildNav();

  CloudDB.setSyncCallback((status) => {
    const dot = document.querySelector('.sync-dot');
    if (dot) { dot.className = 'sync-dot ' + status; dot.title = 'Sync: ' + status; }
  });

  const cloudReady = CloudDB.init();

  if (!cloudReady || localStorage.getItem('questlog_offline_mode')) {
    document.getElementById("authScreen").classList.add("hide");
    isOfflineMode = true;
    bootApp();
    return;
  }

  const session = await CloudDB.getSession();
  if (session && session.user) {
    document.getElementById("authScreen").classList.add("hide");
    CloudDB.setSyncStatus('syncing');
    const cloudData = await CloudDB.loadFromCloud();
    if (cloudData) {
      const merged = Object.assign(BLANK(), cloudData);
      const skillsOk = merged.skills && Object.values(merged.skills).some(s => s.xp > 0);
      const tasksOk = merged.tasks && merged.tasks.length > 0;
      if (skillsOk || tasksOk) {
        S = merged;
      } else if (CloudDB.hasLocalData()) {
        showMigrationPrompt();
        S = Object.assign(BLANK(), load());
      } else {
        S = merged;
      }
    } else {
      S = Object.assign(BLANK(), load());
      if (CloudDB.hasLocalData()) showMigrationPrompt();
    }
    bootApp();
    CloudDB.setSyncStatus('synced');
    CloudDB.flushQueue();
  } else {
    renderAuthScreen();
  }
}

initApp();
