/* ============================================================
   QuestLog v2 — app.js
   All rendering, state, events, XP, streaks, quests, modals, FX.
   ============================================================ */

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

const MULT = [[30,2.0],[14,1.5],[7,1.25],[3,1.1]];
const SKILL_REQ=150, SKILL_CAP=10;
const PSTAGES=["Started","MVP","Deployed","On Resume"];

/* ---------- date helpers ---------- */
function fmt(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const today = ()=> fmt(new Date());
function yesterdayOf(d){ const t=new Date(d+"T00:00"); t.setDate(t.getDate()-1); return fmt(t); }
function daysBetween(a,b){ return Math.round((new Date(b+"T00:00")-new Date(a+"T00:00"))/86400000); }

/* ---------- state ---------- */
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
  reflections:[],
});

let S = dbLoad() || BLANK();
if(!S.reflections) S.reflections = [];
if(!S.customSkills) S.customSkills = [];
if(!S.deletedSkills) S.deletedSkills = [];
if(!S.apiKey) S.apiKey = "";

/* ---------- custom skills ---------- */
const SKILL_COLORS = ["#00FF88","#FBBF24","#A855F7","#EF4444","#06B6D4","#38BDF8","#F97316","#EC4899","#10B981","#F59E0B"];
function allSkills(){
  return SKILLS.filter(s=>!S.deletedSkills.includes(s.id)).concat(S.customSkills);
}
function allSK(){ return Object.fromEntries(allSkills().map(s=>[s.id,s])); }

function save(){ dbSave(S); }

function openSkillModal(){
  document.getElementById("cs-name").value="";
  document.getElementById("cs-emoji").value="";
  openModal("skillModal");
  setTimeout(()=>document.getElementById("cs-name").focus(),100);
}
function saveCustomSkill(){
  const name=document.getElementById("cs-name").value.trim();
  const emoji=document.getElementById("cs-emoji").value.trim()||"\u2728";
  if(!name){toast("Give your skill a name.");return;}
  const id="custom_"+uid();
  const color=SKILL_COLORS[S.customSkills.length%SKILL_COLORS.length];
  S.customSkills.push({id,name,icon:emoji,color});
  S.skills[id]={xp:0};
  S.skillStreak[id]={count:0,last:null};
  dbSave(S); closeModal("skillModal"); renderSkillTiles();
  toast(`${emoji} ${name} added!`);
}
function deleteSkill(id){
  const isDefault=SKILLS.some(s=>s.id===id);
  const s=allSK()[id];
  if(!s)return;
  if(!confirm(`Delete "${s.name}"? This cannot be undone.`))return;
  if(isDefault){
    S.deletedSkills.push(id);
  } else {
    S.customSkills=S.customSkills.filter(x=>x.id!==id);
    delete S.skills[id];
    delete S.skillStreak[id];
  }
  dbSave(S); renderSkillTiles(); renderTodayCount(); renderTasks();
  toast(`${s.name} deleted.`);
}

/* ---------- leveling curves ---------- */
function reqForLevel(n){ return Math.round(80*Math.pow(1.08,n-1)); }
function overallLevel(){
  let lv=1, xp=S.totalXP;
  while(lv<50 && xp>=reqForLevel(lv)){ xp-=reqForLevel(lv); lv++; }
  return {lv, into:xp, need:lv>=50?0:reqForLevel(lv)};
}
function skillLevel(id){
  let lv=1, xp=S.skills[id]?.xp||0;
  while(lv<SKILL_CAP && xp>=SKILL_REQ){ xp-=SKILL_REQ; lv++; }
  return {lv, into:xp, need:lv>=SKILL_CAP?0:SKILL_REQ};
}

/* ---------- streak / multiplier ---------- */
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

/* ---------- daily quests ---------- */
function weakestSkill(){
  const skills=allSkills();
  return skills.slice().sort((a,b)=>(S.skills[a.id]?.xp||0)-(S.skills[b.id]?.xp||0))[0];
}
function ensureQuests(){
  if(S.quests.date===today()) return;
  const w=weakestSkill();
  S.quests={date:today(),list:[
    {id:"any",   icon:"\u2694\uFE0F", title:"Complete any quest",
     desc:"+20 XP", xp:20, done:false},
    {id:"focus", icon:w.icon, title:`Train ${w.name}`,
     desc:`Finish 1 ${w.name} task \u00B7 +40 XP`, xp:40, skill:w.id, done:false},
    {id:"hard",  icon:"\u{1F525}", title:"Take on a challenge",
     desc:"Finish a Rare or harder quest \u00B7 +30 XP", xp:30, hard:true, done:false},
  ]};
  dbSave(S);
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

/* ---------- core actions ---------- */
function completeTask(id, ev){
  const t=S.tasks.find(x=>x.id===id); if(!t||t.status!=="active") return;
  const mult=currentMultiplier();
  const base=DIFF[t.difficulty].xp;
  const isCrit=Math.random()<0.10;
  const gained=Math.round(base*mult*(isCrit?2:1));
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
  dbSave(S);

  const wrap=document.querySelector(`.task-wrap[data-id="${id}"]`);
  const chk=wrap?.querySelector('.task-chk');
  if(chk){
    chk.classList.add('animating');
    if(isCrit) chk.classList.add('crit');
    const icon=document.createElement('span');
    icon.className='tick-icon';
    icon.textContent='\u2713';
    icon.style.cssText='display:inline-block;transform:scale(0) rotate(-10deg);opacity:0';
    chk.innerHTML='';
    chk.appendChild(icon);
    setTimeout(()=>{
      chk.classList.add('bounce');
      if(wrap) wrap.classList.add('completing');
    },80);
    setTimeout(()=>{
      flyXP(ev, gained+questXP);
      if(isCrit) flyCrit(ev, gained);
      const after=overallLevel().lv, afterSk=skillLevel(t.skill).lv;
      renderAll();
      syncNative();
      if(isCrit) setTimeout(()=>toast(`\u26A1 CRIT! +${gained} XP`),100);
      if(mult>1) setTimeout(()=>toast(`\u{1F525} ${mult}x streak bonus applied`),300);
      if(afterSk>beforeSk) queueLevelUp("skill",t.skill,afterSk);
      if(after>before) queueLevelUp("overall",null,after);
      flushLevelUps();
    },380);
  } else {
    flyXP(ev, gained+questXP);
    const after=overallLevel().lv, afterSk=skillLevel(t.skill).lv;
    renderAll();
    syncNative();
    if(isCrit) setTimeout(()=>toast(`\u26A1 CRIT! +${gained} XP`),100);
    if(mult>1) setTimeout(()=>toast(`\u{1F525} ${mult}x streak bonus applied`),300);
    if(afterSk>beforeSk) queueLevelUp("skill",t.skill,afterSk);
    if(after>before) queueLevelUp("overall",null,after);
    flushLevelUps();
  }
}

function flyCrit(ev,amount){
  const x=ev?ev.clientX:innerWidth/2, y=ev?ev.clientY:innerHeight/2;
  const f=document.createElement("div"); f.className="crit-float"; f.textContent=`\u26A1 CRIT! +${amount} XP`;
  f.style.left=x+"px"; f.style.top=(y-20)+"px"; document.body.appendChild(f);
  setTimeout(()=>f.remove(),1000);
}

let luQueue=[];
function queueLevelUp(kind,skill,lv){ luQueue.push({kind,skill,lv}); }
function flushLevelUps(){
  if(!luQueue.length){ return; }
  const e=luQueue.shift();
  const body=document.getElementById("luBody");
  if(e.kind==="overall"){
    body.innerHTML=`<div class="glow burst">\u2B50</div>
      <div style="font-size:0.66rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase">Character Level Up</div>
      <div class="big num">LV ${e.lv}</div>
      <p style="color:var(--muted);font-size:0.85rem">New title earned: <b style="color:var(--text)">${titleFor()}</b></p>
      <button class="btn-primary" style="width:100%;margin-top:8px" onclick="ackLevel()">Continue</button>`;
  } else {
    const s=allSK()[e.skill];
    body.innerHTML=`<div class="glow burst" style="filter:drop-shadow(0 0 24px ${s.color})">${s.icon}</div>
      <div style="font-size:0.66rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase">${s.name} Level Up</div>
      <div class="big num" style="background:linear-gradient(90deg,${s.color},#fff);-webkit-background-clip:text;background-clip:text">LV ${e.lv}</div>
      <p style="color:var(--muted);font-size:0.85rem">You're getting stronger in <b style="color:var(--text)">${s.name}</b>.</p>
      <button class="btn-primary" style="width:100%;margin-top:8px" onclick="ackLevel()">Continue</button>`;
  }
  document.getElementById("luModal").classList.add("show");
}
function ackLevel(){
  document.getElementById("luModal").classList.remove("show");
  setTimeout(flushLevelUps,180);
}

/* ---------- recommenders ---------- */
function recommendation(id){
  const ss=S.skillStreak[id];
  if(!ss || ss.count<3 || (ss.last!==today() && ss.last!==yesterdayOf(today()))) return null;
  const lv=skillLevel(id).lv;
  return getRuleSuggestion(id, lv);
}
async function suggestAITask(id){
  const recent=S.tasks.filter(t=>t.skill===id&&t.status==="completed").slice(-5);
  const lv=skillLevel(id).lv;
  const ss=S.skillStreak[id];
  const streak=ss?ss.count:0;
  const result=await getAISuggestion(id, recent, lv, streak, S.apiKey);
  prefillTask(id, result.title);
}
function prefillTask(skill,title){
  openTask();
  const el=document.getElementById("f-skill");
  const opt=el.querySelector(`.cselect-opt[data-value="${skill}"]`);
  if(opt){
    el.dataset.value=skill;
    el.querySelector(".cselect-selected").innerHTML=opt.innerHTML;
    el.querySelectorAll(".cselect-opt").forEach(o=>o.classList.remove("selected"));
    opt.classList.add("selected");
  }
  document.getElementById("f-title").value=title;
  onSkillChange();
}

/* ============================================================
   RENDER
   ============================================================ */

function renderXPRail(){
  const o=overallLevel();
  const ratio=o.need? Math.min(1, o.into/o.need) : 1;
  document.getElementById("xp-fill").style.transform=`scaleX(${ratio})`;
}

function renderMasthead(){
  const o=overallLevel();
  document.getElementById("mast-name").textContent=S.name;
  document.getElementById("mast-level").innerHTML=
    `<span class="lv-num">Lv. ${o.lv}</span> <span class="lv-title">\u00B7 ${S.title}</span>`;
  document.getElementById("mast-right").innerHTML=
    `<div style="text-align:center">\u{1F525}<div class="num" style="font-size:1.1rem;font-weight:800;color:var(--streak)">${S.streak.current}</div><div style="font-size:0.48rem;color:var(--streak);opacity:0.5">day streak</div></div>`;
  if(o.need){
    document.getElementById("mast-xp").innerHTML=
      `<span class="xp-val">${o.need-o.into} XP</span> to Lv. ${o.lv+1}`;
  } else {
    document.getElementById("mast-xp").innerHTML=`<span class="xp-max">MAX LEVEL</span>`;
  }
}

let _questDetailOpen=false;
function renderQuestBars(){
  ensureQuests();
  const list=S.quests.list;
  const done=list.filter(q=>q.done).length;
  const bars=list.map((q,i)=>{
    let cls="quest-bar";
    if(q.done) cls+=" done";
    else if(i===done) cls+=" active";
    return `<div class="${cls}"></div>`;
  }).join("");
  document.getElementById("quest-bar-row").innerHTML=bars;
  document.getElementById("quest-bar-label").textContent="Daily quests";
  document.getElementById("quest-bar-row").onclick=()=>{
    _questDetailOpen=!_questDetailOpen;
    const el=document.getElementById("quest-detail");
    if(_questDetailOpen){
      el.innerHTML=list.map(q=>
        `<div class="quest-detail-item ${q.done?'done':''}">
          <span class="qdi-title">${q.icon} ${q.title}</span>
          <span class="qdi-xp">+${q.xp} XP</span>
        </div>`
      ).join("");
      el.classList.add("open");
    } else {
      el.classList.remove("open");
    }
  };
}

function renderWarnStrip(){
  const h=new Date().getHours();
  const el=document.getElementById("warn-strip");
  if(h>=18 && S.streak.current>=3 && !S.days[today()]){
    el.innerHTML=`Skip today and your <span class="warn-streak">${S.streak.current}d</span> streak resets.`;
    el.style.display="block";
  } else {
    el.style.display="none";
  }
}

function renderTodayCount(){
  const el=document.getElementById("today-count");
  const active=S.tasks.filter(t=>t.status==="active"&&t.due===today()).length;
  if(active===0){
    el.innerHTML=`<div class="all-clear">\u2713 All clear.</div><div class="all-clear-sub">Rest is part of the grind.</div>`;
  } else {
    el.innerHTML=`<div style="display:flex;align-items:baseline;gap:10px">
      <span class="count-num count-change">${active}</span>
      <span class="count-label">quests left</span>
    </div>`;
  }
}

function renderFilterTabs(){
  const counts={active:0,completed:0,failed:0};
  S.tasks.forEach(t=>counts[t.status]++);
  const tabs=[["active","Active",counts.active],["completed","Done",counts.completed],["failed","Failed",counts.failed]];
  document.getElementById("filter-tabs").innerHTML=tabs.map(([k,l,c])=>
    `<button class="filter-tab ${S.filter===k?'active':''}" onclick="setFilter('${k}')">${l}${c?` (${c})`:''}</button>`
  ).join("");
}
function setFilter(f){ S.filter=f; save(); renderFilterTabs(); renderTasks(); }

function renderTasks(){
  const d=today();
  S.tasks.forEach(t=>{ if(t.status==="active"&&t.due&&t.due<d){ t.status="failed"; } });
  const list=S.tasks.filter(t=>t.status===S.filter)
    .sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
  const el=document.getElementById("tasklist");
  if(!list.length){
    el.innerHTML=`<div class="empty-state">No ${S.filter} quests.</div>`;
    return;
  }
  el.innerHTML=list.map(t=>{
    const s=allSK()[t.skill]||{name:t.skill,icon:"?",color:"#888"}, dc=DIFF[t.difficulty];
    const xp=DIFF[t.difficulty].xp;
    const isDone=t.status!=="active";
    const doneCls=isDone?" task-done":"";
    const swipeAttr=t.status==="active"?` data-id="${t.id}"`:"";
    return `<div class="task-wrap"${swipeAttr}>
      <div class="task-delete-bg">\u{1F5D1}</div>
      <div class="task-card${doneCls}">
        <div class="task-bar" style="background:${s.color}"></div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(t.title)}</div>
          <div class="task-meta">
            <span style="color:${s.color}">${s.name}</span>
            <span class="dot"></span>
            <span style="color:${dc.color}">${t.difficulty}</span>
            <span class="dot"></span>
            <span>+${xp} XP</span>
          </div>
        </div>
        ${t.status==="active"
          ? `<button class="task-chk" onclick="completeTask('${t.id}',event)">\u2713</button>`
          : `<span style="font-size:0.72rem;color:var(--muted)">${t.status==="completed"?"\u2705":"\u274C"}</span>`}
      </div>
    </div>`;
  }).join("");
  if(S.filter==="active") attachSwipeHandlers();
}

function attachSwipeHandlers(){
  document.querySelectorAll(".task-wrap[data-id]").forEach(wrap=>{
    const card=wrap.querySelector(".task-card");
    let startX=0, delta=0, dragging=false;
    const onStart=(x)=>{ startX=x; delta=0; dragging=true; card.style.transition="none"; };
    const onMove=(x)=>{
      if(!dragging) return;
      delta=Math.min(0, x-startX);
      delta=Math.max(-80, delta);
      card.style.transform=`translateX(${delta}px)`;
    };
    const onEnd=()=>{
      if(!dragging) return;
      dragging=false;
      card.style.transition="transform 0.25s ease";
      if(Math.abs(delta)>=60){
        const id=wrap.dataset.id;
        const t=S.tasks.find(x=>x.id===id);
        if(!t) return;
        if(t.status==="active"){
          if(!confirm(`Delete "${t.title}"? No XP awarded, no streak impact.`)){
            card.style.transform="translateX(0)"; return;
          }
        }
        card.style.transform="translateX(-100%)";
        card.style.opacity="0";
        setTimeout(()=>{
          wrap.style.transition="transform 0.2s ease";
          wrap.style.transformOrigin="top";
          wrap.style.transform="scaleY(0)";
          setTimeout(()=>{
            S.tasks=S.tasks.filter(x=>x.id!==id);
            dbSave(S); renderTasks(); renderTodayCount();
          },200);
        },300);
      } else {
        card.style.transform="translateX(0)";
      }
    };
    wrap.addEventListener("touchstart",e=>onStart(e.touches[0].clientX),{passive:true});
    wrap.addEventListener("touchmove",e=>onMove(e.touches[0].clientX),{passive:true});
    wrap.addEventListener("touchend",onEnd);
    wrap.addEventListener("mousedown",e=>onStart(e.clientX));
    wrap.addEventListener("mousemove",e=>{if(dragging)onMove(e.clientX);});
    wrap.addEventListener("mouseup",onEnd);
    wrap.addEventListener("mouseleave",onEnd);
  });
}

function renderSkillTiles(){
  const el=document.getElementById("skill-grid");
  el.innerHTML=allSkills().map(s=>{
    const l=skillLevel(s.id);
    const pct=l.need? Math.round(l.into/l.need*100) : 100;
    const ss=S.skillStreak[s.id]||{count:0,last:null};
    const onFire=ss.last===today();
    return `<div class="skill-tile" style="--sc:${s.color}" onclick="openDrill('${s.id}')">
      <button class="skill-del" onclick="event.stopPropagation();deleteSkill('${s.id}')">\u2715</button>
      <span class="s-streak">${onFire?'\u{1F525} '+ss.count:''}</span>
      <div class="s-icon">${s.icon}</div>
      <div class="s-name">${s.name}</div>
      <div class="s-lv" style="color:${s.color}">Lv. ${l.lv}${l.lv>=SKILL_CAP?' \u00B7 MAX':''}</div>
      <div class="s-bar"><div class="s-fill" style="width:${pct}%;background:${s.color}"></div></div>
    </div>`;
  }).join("");
  requestAnimationFrame(()=>{
    el.querySelectorAll(".s-fill").forEach(f=>{
      const w=f.style.width; f.style.transform=`scaleX(${parseFloat(w)/100})`;
    });
  });
}

function openDrill(id){
  const s=allSK()[id], l=skillLevel(id);
  const pct=l.need? Math.round(l.into/l.need*100) : 100;
  const ss=S.skillStreak[id];
  const recent=S.tasks.filter(t=>t.skill===id&&t.status==="completed").slice(-5).reverse();
  const reco=recommendation(id);

  document.getElementById("skill-drill-header").innerHTML=
    `<button class="drill-back" onclick="closeDrill()">\u2190</button>
     <span style="font-size:1.2rem">${s.icon}</span>
     <span class="drill-name">${s.name}</span>`;

  let html=`
    <div style="font-size:1.3rem;font-weight:800;color:${s.color}">Lv. ${l.lv}${l.lv>=SKILL_CAP?' \u00B7 MAX':''}</div>
    <div class="drill-bar-wrap"><div class="drill-bar-fill" style="width:${pct}%;background:${s.color}"></div></div>
    <div class="drill-meta">${l.need? l.into+' / '+l.need+' XP':'Mastered'}</div>
    <div class="drill-streak">${ss.count>0?'\u{1F525} '+ss.count+' day streak':'No streak yet'}</div>`;

  if(recent.length){
    html+=`<div class="drill-recent"><div class="drill-recent-title">Recent completions</div>`;
    recent.forEach(t=>{
      html+=`<div class="drill-task">${escapeHtml(t.title)}</div>`;
    });
    html+=`</div>`;
  }

  if(reco){
    html+=`<div class="drill-reco">
      <div style="font-size:0.62rem;color:var(--muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px">\u2B06\uFE0F Level-up move</div>
      <div class="drill-reco-text">${escapeHtml(reco)}</div>
      <div class="drill-reco-btns">
        <button class="btn-primary" style="padding:8px 14px;font-size:0.76rem" onclick="prefillTask('${s.id}',${JSON.stringify(reco).replace(/"/g,'&quot;')})">Add this</button>
        <button class="btn-ghost" style="padding:8px 14px;font-size:0.76rem" onclick="suggestAITask('${s.id}')">Suggest another</button>
      </div>
    </div>`;
  }

  document.getElementById("skill-drill-body").innerHTML=html;
  document.getElementById("skill-drill").classList.add("open");
  requestAnimationFrame(()=>{
    const bar=document.querySelector(".drill-bar-fill");
    if(bar){ const w=bar.style.width; bar.style.transform=`scaleX(${parseFloat(w)/100})`; }
  });
}
function closeDrill(){
  document.getElementById("skill-drill").classList.remove("open");
}

function renderPipeline(){
  const f=S.funnel;
  const cells=[["applications","Applied"],["responses","Replies"],["interviews","Interviews"],["offers","Offers"]];
  const total=f.applications;
  const ratio=total? f.interviews/Math.max(total,1) : 0;
  document.getElementById("pipeline").innerHTML=`
    <div class="pipeline-label">Job Pipeline</div>
    <div class="pipeline-grid">${cells.map(([k,l])=>`
      <div class="pipeline-cell">
        <div class="pipeline-num">${f[k]}</div>
        <div class="pipeline-lbl">${l}</div>
        <div class="pipeline-ctrl">
          <button onclick="funnel('${k}',-1)">\u2212</button>
          <button onclick="funnel('${k}',1)">+</button>
        </div>
      </div>`).join("")}
    </div>
    <div class="pipe-track"><div class="pipe-fill" style="transform:scaleX(${ratio})"></div></div>`;
}
function funnel(k,n){ S.funnel[k]=Math.max(0,S.funnel[k]+n); dbSave(S); renderPipeline(); }

function renderProjects(){
  const el=document.getElementById("projects");
  if(!S.projects.length){
    el.innerHTML=`<div class="empty-state">No projects yet. Add one and push it from Started \u2192 On Resume.</div>`;
    return;
  }
  el.innerHTML=S.projects.map(p=>`
    <div class="project-card">
      <div class="project-name">${escapeHtml(p.name)}</div>
      <button class="project-del" onclick="delProject('${p.id}')">\u2715</button>
      <div class="project-stages">${PSTAGES.map((s,i)=>`<div class="project-stage ${i<=p.stage?'on':''}">${s}</div>`).join("")}</div>
      <div class="project-ctrls">
        <button class="btn-ghost" style="padding:6px 10px;font-size:0.72rem" onclick="projStage('${p.id}',-1)">\u2190 Back</button>
        <button class="btn-primary" style="padding:6px 10px;font-size:0.72rem" onclick="projStage('${p.id}',1)">Advance \u2192</button>
      </div>
    </div>`).join("");
}
function addProject(){
  const name=prompt("Project name:"); if(!name) return;
  S.projects.push({id:uid(),name:name.trim(),stage:0}); dbSave(S); renderProjects();
}
function projStage(id,n){
  const p=S.projects.find(x=>x.id===id); if(!p) return;
  const was=p.stage; p.stage=Math.max(0,Math.min(PSTAGES.length-1,p.stage+n));
  dbSave(S); renderProjects();
  if(p.stage>was) toast(p.stage===PSTAGES.length-1?`\u{1F3C6} ${p.name} is resume-ready!`:`${p.name} \u2192 ${PSTAGES[p.stage]}`);
}
function delProject(id){ S.projects=S.projects.filter(x=>x.id!==id); dbSave(S); renderProjects(); }

function renderHeatmap(){
  const now=new Date(), y=now.getFullYear(), m=now.getMonth();
  const monthName=now.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  document.getElementById("heatmap").innerHTML=`
    <div class="heatmap-month">${monthName}</div>
    <div class="heatmap-header">${["S","M","T","W","T","F","S"].map(d=>`<span>${d}</span>`).join("")}</div>
    <div class="heatmap-grid" id="heatgrid"></div>`;
  const first=new Date(y,m,1).getDay();
  const days=new Date(y,m+1,0).getDate();
  let cells="";
  for(let i=0;i<first;i++) cells+=`<div></div>`;
  let conquered=0;
  for(let d=1;d<=days;d++){
    const key=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const count=S.days[key]||0;
    let cls="heatmap-cell";
    if(count>=2) cls+=" active-2";
    else if(count>=1) cls+=" active-1";
    if(key===today()) cls+=" today";
    if(count>0) conquered++;
    cells+=`<div class="${cls}">${d}</div>`;
  }
  document.getElementById("heatgrid").innerHTML=cells;
}

function renderStatsGrid(){
  const totalDone=S.tasks.filter(t=>t.status==="completed").length;
  const totalFailed=S.tasks.filter(t=>t.status==="failed").length;
  const daysActive=Object.keys(S.days).length;
  document.getElementById("stats-grid").innerHTML=`
    <div class="stat-tile"><div class="stat-label">Total XP</div><div class="stat-num" style="color:var(--xp1)">${S.totalXP.toLocaleString()}</div></div>
    <div class="stat-tile"><div class="stat-label">Completed</div><div class="stat-num" style="color:var(--xp2)">${totalDone}</div></div>
    <div class="stat-tile"><div class="stat-label">Days active</div><div class="stat-num" style="color:var(--success)">${daysActive}</div></div>
    <div class="stat-tile"><div class="stat-label">Streak</div><div class="stat-num" style="color:var(--streak)">${S.streak.best}d</div></div>`;
}

function renderDataMgmt(){
  const hasKey=!!S.apiKey;
  document.getElementById("data-mgmt").innerHTML=`
    <div class="api-key-section">
      ${hasKey
        ?`<div class="api-key-status">
            <span class="api-key-dot"></span>
            <span class="api-key-text">API key saved</span>
            <button class="btn-ghost api-key-del" onclick="deleteApiKey()">Delete</button>
          </div>`
        :`<div class="api-key-row" id="api-key-row">
            <input type="password" id="api-key-input" class="api-key-input" placeholder="sk-or-..." autocomplete="off">
            <button class="btn-primary api-key-save" onclick="saveApiKey()">Save</button>
          </div>`
      }
    </div>
    <div class="data-mgmt-links">
      <a class="reset" href="#" onclick="exportData();return false">Export</a> \u00B7
      <a class="reset" href="#" onclick="document.getElementById('importFile').click();return false">Import</a> \u00B7
      <a class="reset" href="#" onclick="hardReset();return false">Reset</a>
    </div>
    <input type="file" id="importFile" class="hidden" accept="application/json,.json" onchange="importData(event)">`;
}
function saveApiKey(){
  const val=document.getElementById("api-key-input").value.trim();
  if(!val){toast("Enter a valid key.");return;}
  S.apiKey=val; dbSave(S); renderDataMgmt();
  toast("API key saved.");
}
function deleteApiKey(){
  if(!confirm("Delete API key?"))return;
  S.apiKey=""; dbSave(S); renderDataMgmt();
  toast("API key deleted.");
}

/* ---------- Reflect Tab ---------- */
let _reflectMood=null, _reflectEnergy=null;

const MOODS=[{v:1,e:"\u{1F61E}"},{v:2,e:"\u{1F615}"},{v:3,e:"\u{1F610}"},{v:4,e:"\u{1F642}"},{v:5,e:"\u{1F604}"}];
const ENERGY_MAP={
  0:['','transparent'],
  1:['Low','#EF4444'],
  2:['Low','#EF4444'],
  3:['Medium','#F59E0B'],
  4:['High','#00FF88'],
  5:['High','#00FF88']
};

function renderReflect(){
  const d=today();
  const entry=S.reflections.find(r=>r.date===d);
  const isSubmitted=entry&&entry.mood&&entry.energy;

  document.getElementById("reflect-masthead").innerHTML=
    `<div class="reflect-mast-left">
       <div class="reflect-title">Reflect</div>
       <div class="reflect-subtitle">How was today?</div>
     </div>
     <div class="reflect-mast-right">
       <span class="streak-icon">\u{1F525}</span>
       <span class="streak-num">${S.streak.current}d</span>
     </div>`;

  if(isSubmitted){
    renderReflectReadOnly(entry);
  } else {
    renderReflectForm(entry);
  }

  const hour=new Date().getHours();
  const notDone=!entry||!entry.mood||!entry.energy;
  const reflectIcon=document.querySelector('.nav-btn[data-v="reflect"] .ni');
  if(reflectIcon){
    if(hour>=20&&notDone) reflectIcon.classList.add("pulse");
    else reflectIcon.classList.remove("pulse");
  }
}

function renderReflectForm(entry){
  const mood=entry?entry.mood:_reflectMood;
  const energy=entry?entry.energy:_reflectEnergy;
  const note=entry?entry.note:"";

  const moodHtml=MOODS.map(m=>{
    const sel=mood===m.v;
    return `<button class="mood-btn ${sel?'selected':''}" data-value="${m.v}" onclick="selectMood(this,${m.v})">${m.e}</button>`;
  }).join("");

  const energyBars=[1,2,3,4,5].map(n=>{
    return `<div class="energy-bar" data-index="${n}" onclick="tapEnergy(${n})"><div class="energy-fill"></div></div>`;
  }).join("");

  const charCount=(note||"").length;
  let charCls="char-count";
  if(charCount>=140) charCls+=" limit";
  else if(charCount>=130) charCls+=" warn";

  document.getElementById("mood-selector").innerHTML=
    `<div class="reflect-label">Mood</div>
     <div class="mood-row">${moodHtml}</div>`;

  document.getElementById("energy-bars").innerHTML=
    `<div class="reflect-label">Energy</div>
     <div class="energy-row">${energyBars}</div>
     <div class="energy-label" id="energy-label"></div>`;

  document.getElementById("reflect-note").innerHTML=
    `<div class="reflect-label">Note <span class="optional">optional</span></div>
     <input type="text" class="reflect-note-input" id="reflect-input" placeholder="What mattered today?" maxlength="140"
       value="${escapeHtml(note||"")}" oninput="updateCharCount()">
     <div class="${charCls}">${charCount} / 140</div>`;

  document.getElementById("reflect-submit").innerHTML=
    `<button id="reflect-submit-btn" onclick="submitReflect()">Log today</button>`;

  if(energy) updateEnergyBars(energy);
  updateEnergyLabel();
}

function renderReflectReadOnly(entry){
  const moodHtml=MOODS.map(m=>{
    const sel=entry.mood===m.v;
    return `<button class="mood-btn read-only ${sel?'selected':''}" data-value="${m.v}">${m.e}</button>`;
  }).join("");

  const energyBars=[1,2,3,4,5].map(n=>{
    const filled=entry.energy>=n;
    const fillBg=filled?getEnergyColour(entry.energy):'none';
    return `<div class="energy-bar read-only ${filled?'filled':''}" data-index="${n}"><div class="energy-fill" style="transform:scaleY(${filled?1:0});background:${fillBg}"></div></div>`;
  }).join("");

  const noteHtml=entry.note
    ? `<div class="reflect-note-readonly">${escapeHtml(entry.note)}</div>`
    : `<div class="reflect-note-empty">\u2014</div>`;

  document.getElementById("mood-selector").innerHTML=
    `<div class="reflect-label">Mood</div>
     <div class="mood-row">${moodHtml}</div>`;

  document.getElementById("energy-bars").innerHTML=
    `<div class="reflect-label">Energy</div>
     <div class="energy-row">${energyBars}</div>
     <div class="energy-label" id="energy-label" style="color:${ENERGY_MAP[entry.energy][1]}">${ENERGY_MAP[entry.energy][0]}</div>`;

  document.getElementById("reflect-note").innerHTML=
    `<div class="reflect-label">Note <span class="optional">optional</span></div>
     ${noteHtml}`;

  document.getElementById("reflect-submit").innerHTML=
    `<div class="reflect-edit"><button onclick="editReflect()">Edit</button></div>`;
}

function selectMood(btn, value){
  document.querySelectorAll('.mood-btn').forEach(b=>{
    b.classList.remove('selected');
    b.style.transform='';
    b.style.transition='transform 0.15s ease, opacity 0.15s ease';
    b.style.opacity='0.3';
  });
  if(_reflectMood===value){
    _reflectMood=null;
    return;
  }
  _reflectMood=value;
  btn.style.transition='none';
  btn.style.transform='scale(1.35)';
  btn.style.opacity='1';
  setTimeout(()=>{
    btn.style.transition='transform 0.2s cubic-bezier(0.2,0.9,0.3,1.2), opacity 0.18s ease';
    btn.classList.add('selected');
    btn.style.transform='';
    btn.style.opacity='';
  },80);
}

function getEnergyColour(n){
  if(n<=2) return '#EF4444';
  if(n===3) return '#F59E0B';
  return '#00FF88';
}

function updateEnergyBars(selectedN){
  document.querySelectorAll('.energy-bar').forEach((bar,index)=>{
    const fill=bar.querySelector('.energy-fill');
    const barIndex=index+1;
    const isFilled=barIndex<=selectedN;
    if(isFilled){
      fill.style.background=getEnergyColour(selectedN);
      fill.style.transitionDelay=((barIndex-1)*30)+'ms';
      fill.style.transform='scaleY(1)';
      bar.style.borderColor=getEnergyColour(selectedN)+'40';
      bar.classList.add('filled');
    } else {
      fill.style.transitionDelay='0ms';
      fill.style.transform='scaleY(0)';
      bar.style.borderColor='rgba(255,255,255,0.10)';
      bar.classList.remove('filled');
    }
  });
}

function updateEnergyLabel(){
  const label=document.getElementById('energy-label');
  if(!label) return;
  const [text,colour]=ENERGY_MAP[_reflectEnergy||0];
  label.textContent=text;
  label.style.color=colour;
}

function tapEnergy(n){
  if(_reflectEnergy===n){
    _reflectEnergy=null;
    updateEnergyBars(0);
  } else {
    _reflectEnergy=n;
    updateEnergyBars(n);
  }
  updateEnergyLabel();
}

function updateCharCount(){
  const input=document.getElementById("reflect-input");
  const counter=document.querySelector(".char-count");
  if(!counter||!input) return;
  const len=input.value.length;
  counter.textContent=len+" / 140";
  counter.className="char-count";
  if(len>=140) counter.classList.add("limit");
  else if(len>=130) counter.classList.add("warn");
}

function editReflect(){
  const ref=S.reflections.find(r=>r.date===today());
  if(ref){
    _reflectMood=ref.mood;
    _reflectEnergy=ref.energy;
    S.reflections=S.reflections.filter(r=>r.date!==today());
    dbSave(S);
    renderReflect();
  }
}

function submitReflect(){
  const moodEl=document.querySelector(".mood-row");
  const energyEl=document.querySelector(".energy-row");
  let hasError=false;
  if(!_reflectMood){
    if(moodEl){ moodEl.classList.remove("shake-mood"); moodEl.offsetHeight; moodEl.classList.add("shake-mood"); }
    hasError=true;
  }
  if(!_reflectEnergy){
    if(energyEl){ energyEl.classList.remove("shake-energy"); energyEl.offsetHeight; energyEl.classList.add("shake-energy"); }
    hasError=true;
  }
  if(hasError) return;

  const note=(document.getElementById("reflect-input")?.value||"").slice(0,140);
  const d=today();
  let entry=S.reflections.find(r=>r.date===d);
  if(!entry){
    entry={date:d,mood:null,energy:null,note:"",xpAwarded:false};
    S.reflections.push(entry);
  }
  entry.mood=_reflectMood;
  entry.energy=_reflectEnergy;
  entry.note=note;
  if(!entry.xpAwarded){
    S.totalXP+=15;
    entry.xpAwarded=true;
  }
  dbSave(S);

  const btn=document.getElementById("reflect-submit-btn");
  if(btn){ btn.textContent="\u2713 Logged"; btn.classList.add("logged"); }

  const before=overallLevel().lv;
  renderXPRail();
  renderMasthead();
  flyXP(null,15);
  const after=overallLevel().lv;
  if(after>before) queueLevelUp("overall",null,after);
  flushLevelUps();

  setTimeout(()=>{
    renderReflect();
    toast("+15 XP reflection logged");
  },1500);
}

/* ---------- Analytics ---------- */
function renderAnalytics(){
  const body=document.getElementById("analytics-body");
  let html="";

  /* Section 1: Mood/Energy line graph */
  html+=`<div class="analytics-section"><div class="analytics-label">Last 7 days</div>`;
  const last7=[];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=fmt(d);
    const ref=S.reflections.find(r=>r.date===key);
    last7.push({date:key,day:d.toLocaleDateString(undefined,{weekday:'short'}),mood:ref?ref.mood:null,energy:ref?ref.energy:null});
  }
  const hasEnoughReflections=S.reflections.filter(r=>{
    const diff=daysBetween(r.date,today());
    return diff>=0&&diff<7;
  }).length>=2;

  if(hasEnoughReflections){
    const svgW=346, svgH=120, padX=10, padY=10;
    const plotW=svgW-padX*2, plotH=svgH-padY*2;
    let moodPath="", energyPath="", moodDots="", energyDots="";
    const moodPoints=[], energyPoints=[];
    last7.forEach((d,i)=>{
      const x=padX+(i/6)*plotW;
      if(d.mood!==null){ const y=padY+plotH-((d.mood-1)/4)*plotH; moodPoints.push({x,y}); }
      if(d.energy!==null){ const y=padY+plotH-((d.energy-1)/4)*plotH; energyPoints.push({x,y}); }
    });
    if(moodPoints.length>=2){
      moodPath="M"+moodPoints.map(p=>`${p.x},${p.y}`).join(" L");
      moodDots=moodPoints.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--xp2)"/>`).join("");
    }
    if(energyPoints.length>=2){
      energyPath="M"+energyPoints.map(p=>`${p.x},${p.y}`).join(" L");
      energyDots=energyPoints.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="var(--xp1)"/>`).join("");
    }
    const guides=[0,1,2,3,4].map(i=>{
      const y=padY+plotH-(i/4)*plotH;
      return `<line x1="${padX}" y1="${y}" x2="${svgW-padX}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    }).join("");
    html+=`<svg width="100%" viewBox="0 0 ${svgW} ${svgH}" style="display:block">
      ${guides}
      ${moodPath?`<path d="${moodPath}" fill="none" stroke="var(--xp2)" stroke-width="2" stroke-dasharray="500" stroke-dashoffset="500"><animate attributeName="stroke-dashoffset" to="0" dur="0.8s" fill="freeze"/></path>`:''}
      ${energyPath?`<path d="${energyPath}" fill="none" stroke="var(--xp1)" stroke-width="2" stroke-dasharray="500" stroke-dashoffset="500"><animate attributeName="stroke-dashoffset" to="0" dur="0.8s" begin="0.2s" fill="freeze"/></path>`:''}
      ${moodDots}${energyDots}
    </svg>
    <div class="analytics-legend">
      <span><span class="legend-dot" style="background:var(--xp2);display:inline-block;width:6px;height:6px;border-radius:50%"></span> Mood</span>
      <span><span class="legend-dot" style="background:var(--xp1);display:inline-block;width:6px;height:6px;border-radius:50%"></span> Energy</span>
    </div>`;
  } else {
    html+=`<div class="analytics-empty">Log a few days to see your trend.</div>`;
  }
  html+=`</div>`;

  /* Section 2: Daily completions bar chart */
  html+=`<div class="analytics-section"><div class="analytics-label">Daily completions</div>`;
  const last14=[];
  for(let i=13;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=fmt(d);
    last14.push({date:key,day:d.toLocaleDateString(undefined,{weekday:'narrow'})[0],count:S.days[key]||0});
  }
  const maxCount=Math.max(1,...last14.map(d=>d.count));
  const barSvgH=100, barPadX=10, barPlotH=80;
  const barW=(346-barPadX*2)/14-2;
  let barsHtml="";
  last14.forEach((d,i)=>{
    const x=barPadX+i*(barW+2);
    const h=d.count? Math.max(6, (d.count/maxCount)*barPlotH) : barPlotH;
    const y=barPlotH-h+10;
    let fill="rgba(255,255,255,0.04)";
    if(d.count>=5) fill="rgba(0,255,136,0.6)";
    else if(d.count>=3) fill="rgba(6,182,212,0.5)";
    else if(d.count>=1) fill="rgba(168,85,247,0.4)";
    const isToday=d.date===today();
    barsHtml+=`<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${fill}"
      ${isToday?'stroke="var(--d-legendary)" stroke-width="1.5"':''}
      transform="scaleY(0)" transform-origin="${x+barW/2} ${barPlotH+10}">
      <animateTransform attributeName="transform" type="scale" from="0 1" to="1 1" dur="0.3s" begin="${i*0.02}s" fill="freeze"/>
    </rect>`;
  });
  const dayLabels=last14.map((d,i)=>{
    const x=barPadX+i*(barW+2)+barW/2;
    return `<text x="${x}" y="${barSvgH}" text-anchor="middle" fill="var(--muted)" font-size="8">${d.day}</text>`;
  }).join("");
  html+=`<svg width="100%" viewBox="0 0 346 ${barSvgH}" style="display:block">
    ${barsHtml}${dayLabels}
  </svg></div>`;

  /* Section 3: Four circle graphs */
  const daysWithCompletion=Object.values(S.days).filter(c=>c>0).length;
  const consistency=daysWithCompletion/Math.max(1,30);

  const last30Reflections=S.reflections.filter(r=>{
    const diff=daysBetween(r.date,today());
    return diff>=0&&diff<30;
  });
  const avgMood=last30Reflections.length>=3?
    last30Reflections.reduce((s,r)=>s+r.mood,0)/last30Reflections.length:0;
  const moodRatio=last30Reflections.length>=3?avgMood/5:0;

  let topSkill=allSkills()[0], topXP=0;
  allSkills().forEach(s=>{ const xp=S.skills[s.id]?.xp||0; if(xp>topXP){ topXP=xp; topSkill=s; } });
  const topSkillLv=skillLevel(topSkill.id);
  const topSkillRatio=topSkillLv.need?topSkillLv.into/topSkillLv.need:1;

  const completed=S.tasks.filter(t=>t.status==="completed").length;
  const failed=S.tasks.filter(t=>t.status==="failed").length;
  const successRate=(completed+failed)>0?completed/(completed+failed):0;

  const circR=34, circC=2*Math.PI*circR;
  function circleSVG(ratio,color,center,label,dashed){
    return `<div class="circle-item">
      <svg class="circle-svg" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="${circR}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
        <circle cx="40" cy="40" r="${circR}" fill="none" stroke="${color}" stroke-width="6"
          stroke-linecap="round" stroke-dasharray="${dashed?'4 4':circC}" stroke-dashoffset="${dashed?circC:circC*(1-ratio)}"
          transform="rotate(-90 40 40)" style="transition:stroke-dashoffset 0.8s cubic-bezier(0.2,0.8,0.2,1)">
        </circle>
        <text x="40" y="40" text-anchor="middle" dominant-baseline="central" fill="var(--text)" font-size="14" font-weight="800">${center}</text>
      </svg>
      <div class="circle-label">${label}</div>
    </div>`;
  }
  html+=`<div class="analytics-section">
    <div class="circle-grid">
      ${circleSVG(consistency,'var(--streak)',Math.round(consistency*100)+'%','Consistency',false)}
      ${circleSVG(moodRatio,'var(--xp2)',last30Reflections.length>=3?avgMood.toFixed(1):'\u2014','Avg mood',last30Reflections.length<3)}
      ${circleSVG(topSkillRatio,topSkill.color,topSkill.icon,allSK()[topSkill.id]?.name||topSkill.name,false)}
      ${circleSVG(successRate,'var(--success)',(completed+failed)>0?Math.round(successRate*100)+'%':'\u2014','Success rate',(completed+failed)===0)}
    </div>
  </div>`;

  body.innerHTML=html;
}
function openAnalytics(){
  renderAnalytics();
  document.getElementById("analytics-panel").classList.add("open");
}
function closeAnalytics(){
  document.getElementById("analytics-panel").classList.remove("open");
}

function renderAll(){
  renderXPRail();
  renderMasthead();
  renderQuestBars();
  renderWarnStrip();
  renderTodayCount();
  renderFilterTabs();
  renderTasks();
  renderSkillTiles();
  renderPipeline();
  renderProjects();
  renderHeatmap();
  renderStatsGrid();
  renderDataMgmt();
  renderReflect();
  dbSave(S);
}

/* ---------- Task Modal ---------- */
function buildCSkill(){
  const el=document.getElementById("f-skill");
  const skills=allSkills();
  el.innerHTML=`<div class="cselect-selected">\u2014 select skill \u2014</div>
    <div class="cselect-options">${skills.map(s=>
      `<div class="cselect-opt" data-value="${s.id}"><span class="cselect-opt-icon">${s.icon}</span> ${s.name}</div>`
    ).join("")}</div>`;
  el.dataset.value="";
  initCSelect(el);
}
function initCSelect(el){
  el.querySelector(".cselect-selected").onclick=(e)=>{
    e.stopPropagation();
    document.querySelectorAll(".cselect.open").forEach(c=>{if(c!==el)c.classList.remove("open");});
    el.classList.toggle("open");
  };
  el.querySelectorAll(".cselect-opt").forEach(opt=>{
    opt.onclick=(e)=>{
      e.stopPropagation();
      el.dataset.value=opt.dataset.value;
      el.querySelector(".cselect-selected").innerHTML=opt.innerHTML;
      el.querySelectorAll(".cselect-opt").forEach(o=>o.classList.remove("selected"));
      opt.classList.add("selected");
      el.classList.remove("open");
      if(el.id==="f-skill") onSkillChange();
    };
  });
}
document.addEventListener("click",()=>{
  document.querySelectorAll(".cselect.open").forEach(c=>c.classList.remove("open"));
});
function openTask(){
  buildCSkill();
  buildDifSeg();
  document.getElementById("f-title").value="";
  document.getElementById("f-notes").value="";
  document.getElementById("f-funnel").dataset.value="";
  document.getElementById("f-funnel").querySelector(".cselect-selected").innerHTML="\u2014 none \u2014";
  document.getElementById("f-funnel").querySelectorAll(".cselect-opt").forEach(o=>o.classList.remove("selected"));
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
  const isJob=document.getElementById("f-skill").dataset.value==="jobhunt";
  document.getElementById("f-funnelwrap").classList.toggle("hidden",!isJob);
}
function saveTask(){
  const title=document.getElementById("f-title").value.trim();
  if(!title){ toast("Give your quest a name."); return; }
  const skill=document.getElementById("f-skill").dataset.value;
  const t={id:uid(),title,skill,difficulty:chosenDif,
    notes:document.getElementById("f-notes").value.trim(),
    funnel: skill==="jobhunt"?document.getElementById("f-funnel").dataset.value:"",
    status:"active",createdAt:today(),due:today()};
  S.tasks.unshift(t); dbSave(S);
  closeModal("taskModal");
  S.filter="active"; renderAll();
}
function openModal(id){ document.getElementById(id).classList.add("show"); }
function closeModal(id){ document.getElementById(id).classList.remove("show"); }

/* ---------- FX ---------- */
function flyXP(ev,amount){
  const x=ev?ev.clientX:innerWidth/2, y=ev?ev.clientY:innerHeight/2;
  const f=document.createElement("div"); f.className="float"; f.textContent="+"+amount+" XP";
  f.style.left=x+"px"; f.style.top=y+"px"; document.body.appendChild(f);
  setTimeout(()=>f.remove(),1000);
  const bar=document.getElementById("xp-fill")?.getBoundingClientRect();
  if(!bar) return;
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

/* ---------- NativeBridge ---------- */
function syncNative(){
  if(window.NativeBridge){
    try{
      NativeBridge.setStreak(S.streak.current);
      NativeBridge.setCompletedToday(S.days[today()]>0);
    }catch(e){}
  }
}

/* ---------- Nav ---------- */
let _currentView="today";
function goView(v){
  _currentView=v;
  document.querySelectorAll(".view").forEach(el=>{
    el.classList.toggle("active",el.id==="view-"+v);
  });
  document.querySelectorAll(".nav-btn").forEach(b=>{
    b.classList.toggle("active",b.dataset.v===v);
  });
  const fab=document.getElementById("fab");
  if(v==="today") fab.classList.remove("hidden");
  else fab.classList.add("hidden");
  const globalMast=document.getElementById("masthead");
  const globalXp=document.getElementById("mast-xp");
  if(v==="reflect"){
    if(globalMast) globalMast.style.display="none";
    if(globalXp) globalXp.style.display="none";
  } else {
    if(globalMast) globalMast.style.display="";
    if(globalXp) globalXp.style.display="";
  }
  window.scrollTo({top:0,behavior:"smooth"});
  if(v==="skills") renderSkillTiles();
  if(v==="map"){ renderHeatmap(); renderStatsGrid(); renderDataMgmt(); }
  if(v==="reflect") renderReflect();
}

function checkReflectPulse(){
  const h=new Date().getHours();
  const btn=document.querySelector('.nav-btn[data-v="reflect"]');
  if(!btn) return;
  if(h>=20){
    const todayReflection=S.reflections.find(r=>r.date===today());
    if(!todayReflection) btn.classList.add("pulse");
    else btn.classList.remove("pulse");
  } else {
    btn.classList.remove("pulse");
  }
}

/* ---------- Utils ---------- */
function uid(){ return Math.random().toString(36).slice(2,9); }
function escapeHtml(s){ return (s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function editName(){
  const n=prompt("Enter your name:",S.name);
  if(n&&n.trim()){ S.name=n.trim(); dbSave(S); renderMasthead(); toast("Name updated!"); }
}
function exportData(){ dbExport(S); }
function importData(ev){
  const file=ev.target.files[0]; if(!file) return;
  dbImport(file,(data,err)=>{
    if(err){ toast(err); return; }
    if(confirm("Replace everything on this device with the backup? Your current progress here will be overwritten.")){
      S=Object.assign(BLANK(),data); dbSave(S); ensureQuests(); renderAll(); goView("today");
      toast("Backup restored.");
    }
  });
  ev.target.value="";
}
function hardReset(){
  if(confirm("Wipe ALL progress and start over? This cannot be undone.")){
    if(confirm("Really sure? Export a backup first if you want to keep your data.")){
      dbReset(); S=BLANK(); dbSave(S); renderAll(); goView("today");
    }
  }
}

function firstRun(){
  if(S.createdAt===today() && S.totalXP===0 && S.tasks.length===0 && !localStorage.getItem("questlog_named")){
    const n=prompt("Welcome, adventurer. What's your name?");
    if(n&&n.trim()) S.name=n.trim();
    localStorage.setItem("questlog_named","1");
    dbSave(S);
  }
}

/* ---------- Boot ---------- */
document.getElementById("fab").onclick=openTask;
initCSelect(document.getElementById("f-funnel"));

document.getElementById("modal-cancel").onclick=()=>closeModal("taskModal");
document.getElementById("modal-save").onclick=saveTask;
document.querySelectorAll(".nav-btn").forEach(b=>{
  b.onclick=()=>goView(b.dataset.v);
});
document.getElementById("map-analytics-btn").innerHTML=`<button class="analytics-pill" onclick="openSkillModal()">\u2795 Add Skill</button> <button class="analytics-pill" onclick="openAnalytics()">\u{1F4CA} Analytics</button>`;
document.getElementById("analytics-header").innerHTML=`<button class="drill-back" onclick="closeAnalytics()">\u2190</button><span style="font-weight:800">Analytics</span>`;

ensureQuests();
firstRun();
goView("today");
renderAll();
syncNative();
checkReflectPulse();
setInterval(checkReflectPulse,60000);
