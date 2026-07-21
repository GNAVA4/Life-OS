// Вкладка/раздел: StatsTab (вынесено из App.jsx, session: decompose phase 3)
import { useMemo, useState } from 'react';
import { axisColor, baseChartOpts, gridColor } from '../lib/charts.js';
import { daysAgoStr, isoWeek, monthLabelRu, shiftMonth, todayStr } from '../lib/dates.js';
import { maskMoney } from '../lib/format.js';
import { vis } from '../lib/storage.js';
import { S } from '../lib/styles.js';
import { C, PIE_COLORS } from '../lib/theme.js';
import { ChartCanvas } from '../ui/ChartCanvas.jsx';

export function StatsTab({days, finance, budgets, incomePlans, habits=[], finMask={}, study=[], unlocked={}}){
  const mo = n => maskMoney(finMask.ops, n);   // приватность: скрытие сумм в статистике
  const [range,setRange] = useState('30');
  const [analysisTarget,setAnalysisTarget] = useState('rating'); // что анализируем: оценка/задачи/сон
  const [openDetail,setOpenDetail] = useState({}); // раскрытые детальные разделы (tags/habits/anti)
  const rangeDays = range==='7'?7 : range==='30'?30 : range==='90'?90 : range==='year'?365 : 1000;
  const rangeLabel = range==='7'?'7 дней' : range==='30'?'30 дней' : range==='90'?'90 дней' : range==='year'?'год' : 'всё время';

  // 📊 Итоги за выбранный диапазон (session 025; объединено с бывшим «Обзором» — реагируют на верхний
  // селектор 7/30/90/год/всё). Авто-сводка достижений периода из ДАТИРОВАННЫХ данных. Видимость каждой
  // плитки настраивается в «Что показывать → Итоги» (модули recap.*).
  const recap = useMemo(()=>{
    const start = daysAgoStr(rangeDays-1);
    const inP = ds => ds>=start;
    let tasksDone=0, perfect=0, activeDays=0, habitChecks=0, antiCount=0; const ratings=[], sleeps=[]; const wd=[0,0,0,0,0,0,0]; let bestDay={date:null,n:0};
    Object.entries(days).forEach(([ds,e])=>{ if(!inP(ds)) return;
      const done=(e.tasks||[]).filter(t=>t.done).length + Object.values(e.dailyCompletions||{}).filter(Boolean).length;
      tasksDone+=done;
      const tot=(e.tasks||[]).length; if(tot>=3 && (e.tasks||[]).every(t=>t.done)) perfect++;
      if(done>0 || (e.tags||[]).length>0 || e.rating!=null || (e.note&&e.note.trim()) || e.sleepHours!=null) activeDays++;
      if(e.rating!=null) ratings.push(e.rating);
      if(e.sleepHours!=null) sleeps.push(e.sleepHours);
      antiCount += (e.antiTags||[]).length;
      wd[new Date(ds+'T00:00:00').getDay()] += done;
      if(done>bestDay.n) bestDay={date:ds,n:done};
    });
    habits.forEach(h=>{ Object.keys(h.log||{}).forEach(ds=>{ if(inP(ds)) habitChecks++; }); });
    let exp=0, inc=0; const catExp={};
    finance.transactions.forEach(t=>{ if(t.exclude || !inP(t.date)) return; if(t.type==='expense'){ exp+=t.amount; catExp[t.category]=(catExp[t.category]||0)+t.amount; } else inc+=t.amount; });
    const topCat=Object.entries(catExp).sort((a,b)=>b[1]-a[1])[0]||null;
    const studyDone=study.filter(s=>s.status==='Выполнено' && s.completedAt && inP(s.completedAt)).length;
    const achCount=Object.values(unlocked).filter(d=>inP(d)).length;
    const avg=a=>a.length?Math.round(a.reduce((s,x)=>s+x,0)/a.length*10)/10:null;
    const WD=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
    return { tasksDone, perfect, activeDays, habitChecks, antiCount, avgRating:avg(ratings), avgSleep:avg(sleeps),
      exp, inc, topCat, studyDone, achCount, bestDay, bestWd: wd.some(x=>x>0)?WD[wd.indexOf(Math.max(...wd))]:null };
  }, [days, finance, habits, study, unlocked, rangeDays]);

  // 🔬 Детальный анализ корреляций (session 020; расширен session 025): выбираем ЦЕЛЬ (оценка дня /
  // выполнено задач / сон) и смотрим, что с ней связано — агрегатные факторы + детальный разбор
  // по КОНКРЕТНЫМ тегам, привычкам и анти-тегам (бинарная точечно-бисериальная корреляция).
  const TARGETS = [
    {key:'rating',    label:'Оценка дня',      get:(e)=>e.rating!=null?e.rating:null},
    {key:'tasksDone', label:'Выполнено задач', get:(e)=>(e.tasks||[]).filter(t=>t.done).length},
    {key:'sleep',     label:'Часы сна',        get:(e)=>e.sleepHours!=null?e.sleepHours:null},
  ];
  const analysisData = useMemo(()=>{
    const rows=[];
    for(let i=0;i<rangeDays;i++){ const ds=daysAgoStr(i); const e=days[ds]; if(!e) continue;
      const tgt = (TARGETS.find(t=>t.key===analysisTarget)||TARGETS[0]).get(e);
      if(tgt==null) continue;
      rows.push({ target:tgt, sleep:e.sleepHours, tasksDone:(e.tasks||[]).filter(t=>t.done).length,
        tasksPlanned:(e.tasks||[]).length, habitsDone: habits.reduce((n,h)=> n + (h.log && h.log[ds]?1:0), 0),
        antiCount:(e.antiTags||[]).length, tagSet:new Set(e.tags||[]), antiSet:new Set(e.antiTags||[]),
        habitSet:new Set(habits.filter(h=>h.log && h.log[ds]).map(h=>h.id)) });
    }
    const pearson = (getX) => {
      const xs=[], ys=[]; rows.forEach(r=>{ const x=getX(r); if(x!=null){ xs.push(x); ys.push(r.target); } });
      const n=xs.length; if(n<4) return {n, r:null};
      const mean=a=>a.reduce((s,x)=>s+x,0)/a.length; const mx=mean(xs), my=mean(ys);
      let num=0,dx=0,dy=0; for(let i=0;i<n;i++){ const a=xs[i]-mx,b=ys[i]-my; num+=a*b; dx+=a*a; dy+=b*b; }
      return {n, r:(dx&&dy)?Math.round(num/Math.sqrt(dx*dy)*100)/100:0};
    };
    const aggDefs=[
      {key:'sleep', label:'😴 Сон', get:r=>r.sleep, skip:analysisTarget==='sleep'},
      {key:'tasksDone', label:'✅ Задач выполнено', get:r=>r.tasksDone, skip:analysisTarget==='tasksDone'},
      {key:'tasksPlanned', label:'📋 Задач запланировано', get:r=>r.tasksPlanned},
      {key:'habitsDone', label:'🔁 Привычек отмечено', get:r=>r.habitsDone},
      {key:'tags', label:'🏷 Тегов за день', get:r=>r.tagSet.size},
      {key:'anti', label:'🚫 Анти-тегов за день', get:r=>r.antiCount},
    ].filter(d=>!d.skip);
    const aggregate = aggDefs.map(d=>({key:d.key,label:d.label,...pearson(d.get)})).filter(f=>f.r!=null).sort((a,b)=>Math.abs(b.r||0)-Math.abs(a.r||0));
    // детально по элементам: только с достаточной вариацией (встречался ≥3 раз, но не каждый день)
    const detail = (names, presentFn) => names.map(name=>{
      const present = rows.filter(r=>presentFn(r,name)).length;
      if(present<3 || present===rows.length) return null;
      return {name, present, ...pearson(r=>presentFn(r,name)?1:0)};
    }).filter(x=>x&&x.r!=null).sort((a,b)=>Math.abs(b.r||0)-Math.abs(a.r||0));
    const allTags=[...new Set(rows.flatMap(r=>[...r.tagSet]))];
    const allAnti=[...new Set(rows.flatMap(r=>[...r.antiSet]))];
    const habitById = {}; habits.forEach(h=>habitById[h.id]=h.name);
    return {
      count: rows.length, aggregate,
      tagsDetail: detail(allTags, (r,t)=>r.tagSet.has(t)),
      antiDetail: detail(allAnti, (r,t)=>r.antiSet.has(t)),
      habitsDetail: detail(habits.map(h=>h.id), (r,id)=>r.habitSet.has(id)).map(x=>({...x, name:habitById[x.name]||x.name})),
    };
  }, [days, habits, rangeDays, analysisTarget]);
  const corrStrength = (r) => { const a=Math.abs(r); return a<0.2?'почти нет':a<0.4?'слабая':a<0.6?'заметная':a<0.8?'сильная':'очень сильная'; };

  const [pfMonth,setPfMonth] = useState(todayStr().slice(0,7));

  const heatWeeks = Math.min(52, Math.ceil(rangeDays/7));

  const heatmapDays = useMemo(()=>{ const arr=[]; for(let i=heatWeeks*7-1;i>=0;i--){ const ds=daysAgoStr(i); const e=days[ds];
    const c=(e?.tasks||[]).filter(t=>t.done).length + Object.values(e?.dailyCompletions||{}).filter(Boolean).length; arr.push({date:ds,doneCount:c}); } return arr; }, [days, heatWeeks]);
  const weeks = []; for(let i=0;i<heatmapDays.length;i+=7) weeks.push(heatmapDays.slice(i,i+7));
  const cellColor = n => n===0?C.panelAlt : n===1?'#5A4A26' : n===2?'#8A6B2C' : n===3?'#C68F2E' : C.amber;

  const grouping = (range==='year'||range==='all') ? 'month' : (range==='90'?'week':'day');
  const weeklyStats = useMemo(()=>{
    const map={};
    Object.entries(days).forEach(([ds,e])=>{
      const key = grouping==='month' ? ds.slice(0,7) : grouping==='week' ? isoWeek(ds) : ds;
      if(!map[key]) map[key]={key, planned:0, done:0};
      map[key].planned += (e.tasks||[]).length; map[key].done += (e.tasks||[]).filter(t=>t.done).length;
    });
    return Object.values(map).sort((a,b)=>a.key>b.key?1:-1).slice(-16);
  }, [days, grouping]);

  const trend = (field, n=14) => { const arr=[]; for(let i=n-1;i>=0;i--){ const ds=daysAgoStr(i); const e=days[ds]; arr.push({date:ds.slice(5), v: e && e[field]!=null ? e[field] : null}); } return arr; };
  const sleepTrend = trend('sleepHours'); const ratingTrend = trend('rating');

  const monthlyFinance = useMemo(()=>{
    const map={};
    finance.transactions.forEach(t=>{ if(t.exclude) return; const key=t.date.slice(0,7); if(!map[key]) map[key]={key,income:0,expense:0};
      if(t.type==='income') map[key].income+=t.amount; else map[key].expense+=t.amount; });
    return Object.values(map).sort((a,b)=>a.key>b.key?1:-1).slice(-12);
  }, [finance.transactions]);

  // накопительный баланс операций за выбранный период (перенесён из Финансы→Операции, session 015)
  const balanceTrend = useMemo(()=>{
    const sorted=[...finance.transactions].sort((a,b)=>a.date>b.date?1:-1); let running=0; const byDate={};
    sorted.forEach(t=>{ if(!t.exclude){ running += t.type==='income'?t.amount:-t.amount; byDate[t.date]=running; } });
    const n = Math.min(rangeDays, 365); const labels=[], data=[]; let last=0;
    for(let i=n-1;i>=0;i--){ const ds=daysAgoStr(i); if(byDate[ds]!==undefined) last=byDate[ds]; labels.push(ds.slice(5)); data.push(last); }
    return {labels, data};
  }, [finance.transactions, rangeDays]);

  const rangeStart = daysAgoStr(rangeDays-1);
  const catBreakdown = useMemo(()=>{
    const inc={}, exp={};
    finance.transactions.forEach(t=>{ if(t.exclude || t.date<rangeStart) return;
      if(t.type==='income') inc[t.category]=(inc[t.category]||0)+t.amount; else exp[t.category]=(exp[t.category]||0)+t.amount; });
    return {inc, exp};
  }, [finance.transactions, rangeStart]);
  const tagFreq = useMemo(()=>{ const map={}; Object.entries(days).forEach(([ds,e])=>{ if(ds<rangeStart) return; (e.tags||[]).forEach(tg=>{ map[tg]=(map[tg]||0)+1; }); });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]); }, [days, rangeStart]);
  const antiTagFreq = useMemo(()=>{ const map={}; Object.entries(days).forEach(([ds,e])=>{ if(ds<rangeStart) return; (e.antiTags||[]).forEach(tg=>{ map[tg]=(map[tg]||0)+1; }); });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]); }, [days, rangeStart]);

  // план/факт по выбранному месяцу (история планов помесячная)
  const pfTx = finance.transactions.filter(t=>t.date.slice(0,7)===pfMonth && !t.exclude);
  const pfExp={}, pfInc={}; pfTx.forEach(t=>{ const m=t.type==='expense'?pfExp:pfInc; m[t.category]=(m[t.category]||0)+t.amount; });
  const pfBud=(budgets||{})[pfMonth]||{}; const pfIncPlan=(incomePlans||{})[pfMonth]||{};
  const planFactRows = (actual, plan, kind) => {
    const cats=[...new Set([...Object.keys(plan), ...Object.keys(actual)])];
    if(cats.length===0) return <div style={S.emptyState}>Нет данных за месяц</div>;
    return cats.map(c=>{ const a=actual[c]||0; const p=plan[c]; const ratio=p?Math.min(100,(a/p)*100):0;
      const barColor = kind==='expense' ? (p&&a>p?C.red:(p&&a/p>0.7?C.amber:C.green)) : (p?(a>=p?C.green:a/p>0.5?C.amber:C.dim):C.dim);
      return (
        <div key={c} style={{marginBottom:8}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}><span>{c}</span><span style={{color:C.dim}}>{mo(a)}{p?` / ${mo(p)}`:''}</span></div>
          {p ? <div style={{height:5,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',width:`${ratio}%`,background:barColor}}/></div>
             : <div style={{fontSize:10.5,color:C.dim}}>план не задан</div>}
        </div>
      ); });
  };

  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
        {[{id:'7',label:'7д'},{id:'30',label:'30д'},{id:'90',label:'90д'},{id:'year',label:'Год'},{id:'all',label:'Всё время'}].map(r=>(
          <div key={r.id} className="chip" onClick={()=>setRange(r.id)} style={{background:range===r.id?C.amber:C.panelAlt,color:range===r.id?'#1A1200':C.dim,borderColor:range===r.id?C.amber:C.border}}>{r.label}</div>
        ))}
      </div>

      {vis('stats.recap') && (
      <div style={{...S.panel, borderColor:C.amber}}>
        <div style={{...S.panelTitle,color:C.amber}}>📊 Итоги · {rangeLabel}</div>
        <div className="grid3" style={{...S.grid3,gap:10}}>
          {vis('recap.tasks')  && <div style={S.statCard}><div style={S.statVal}>{recap.tasksDone}</div><div style={S.dimSpan}>задач выполнено</div></div>}
          {vis('recap.perfect')&& <div style={S.statCard}><div style={S.statVal}>{recap.perfect}</div><div style={S.dimSpan}>идеальных дней</div></div>}
          {vis('recap.active') && <div style={S.statCard}><div style={S.statVal}>{recap.activeDays}</div><div style={S.dimSpan}>активных дней</div></div>}
          {vis('recap.habits') && <div style={S.statCard}><div style={S.statVal}>{recap.habitChecks}</div><div style={S.dimSpan}>привычек отмечено</div></div>}
          {vis('recap.ach')    && <div style={S.statCard}><div style={S.statVal}>{recap.achCount}</div><div style={S.dimSpan}>достижений открыто</div></div>}
          {vis('recap.study')  && <div style={S.statCard}><div style={S.statVal}>{recap.studyDone}</div><div style={S.dimSpan}>дел закрыто</div></div>}
          {vis('recap.rating') && <div style={S.statCard}><div style={S.statVal}>{recap.avgRating!=null?recap.avgRating:'–'}</div><div style={S.dimSpan}>средняя оценка</div></div>}
          {vis('recap.sleep')  && <div style={S.statCard}><div style={S.statVal}>{recap.avgSleep!=null?`${recap.avgSleep}ч`:'–'}</div><div style={S.dimSpan}>средний сон</div></div>}
          {vis('recap.anti')   && <div style={S.statCard}><div style={{...S.statVal,color:recap.antiCount?C.red:C.dim}}>{recap.antiCount}</div><div style={S.dimSpan}>анти-тегов</div></div>}
          {vis('recap.exp')    && <div style={S.statCard}><div style={{...S.statVal,color:C.red}}>{mo(recap.exp)}</div><div style={S.dimSpan}>расход</div></div>}
          {vis('recap.inc')    && <div style={S.statCard}><div style={{...S.statVal,color:C.green}}>{mo(recap.inc)}</div><div style={S.dimSpan}>доход</div></div>}
          {vis('recap.net')    && <div style={S.statCard}><div style={{...S.statVal,color:C.green}}>{recap.inc-recap.exp>=0?'+':''}{mo(recap.inc-recap.exp)}</div><div style={S.dimSpan}>чистыми</div></div>}
        </div>
        {vis('recap.highlights') && (
        <div style={{fontSize:11.5,color:C.dim,marginTop:10,lineHeight:1.6}}>
          {recap.bestDay.date && <>🏅 Лучший день: <b style={{color:C.text}}>{recap.bestDay.date}</b> — {recap.bestDay.n} задач<br/></>}
          {recap.bestWd && <>📅 Продуктивнее всего по: <b style={{color:C.text}}>{recap.bestWd}</b><br/></>}
          {recap.topCat && <>💸 Больше всего трат: <b style={{color:C.text}}>{recap.topCat[0]}</b> — {mo(recap.topCat[1])}</>}
          {recap.tasksDone===0 && recap.activeDays===0 && <span style={S.emptyState}>За период пока пусто — заполняй дни, и здесь появится сводка.</span>}
        </div>
        )}
      </div>
      )}

      {vis('stats.analysis') && (() => {
        const tgtLabel = (TARGETS.find(t=>t.key===analysisTarget)||TARGETS[0]).label;
        const bar = (r) => (
          <div style={{position:'relative',height:6,background:C.panelAlt,borderRadius:3,overflow:'hidden'}}>
            <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:1,background:C.border}}/>
            <div style={{position:'absolute',top:0,bottom:0,background:r>=0?C.green:C.red,
              left: r>=0?'50%':`${50-Math.abs(r)*50}%`, width:`${Math.abs(r)*50}%`}}/>
          </div>
        );
        const detailSection = (id, title, list) => (
          <div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
            <div style={{...S.panelTitle,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',marginBottom:openDetail[id]?8:0}}
              onClick={()=>setOpenDetail(o=>({...o,[id]:!o[id]}))}>
              <span style={{marginRight:6}}>{openDetail[id]?'▼':'▶'}</span>{title} <span style={S.dimSpan}>{list.length}</span>
            </div>
            {openDetail[id] && (list.length===0
              ? <div style={S.emptyState}>Мало данных (нужно, чтобы элемент встречался в части дней)</div>
              : list.map(f=>(
                <div key={f.name} style={{marginBottom:9}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3,gap:8}}>
                    <span style={{minWidth:0,overflowWrap:'anywhere'}}>{f.name}</span>
                    <span style={{color:f.r>=0?C.green:C.red,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>r={f.r>0?'+':''}{f.r} · {f.present}д</span>
                  </div>
                  {bar(f.r)}
                </div>
              )))}
          </div>
        );
        return (
        <div style={S.panel}>
          <div style={S.panelTitle}>🔬 Анализ корреляций · {rangeLabel}</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
            <span style={{fontSize:11.5,color:C.dim,alignSelf:'center'}}>цель:</span>
            {TARGETS.map(t=>(
              <div key={t.key} className="chip" onClick={()=>setAnalysisTarget(t.key)}
                style={{background:analysisTarget===t.key?C.amber:C.panelAlt,color:analysisTarget===t.key?'#1A1200':C.dim,borderColor:analysisTarget===t.key?C.amber:C.border,padding:'3px 10px',fontSize:11}}>{t.label}</div>
            ))}
          </div>
          <div style={{...S.dimSpan,marginLeft:0,marginBottom:10,display:'block'}}>Корреляция (Пирсон) между «{tgtLabel}» и факторами. Ближе к ±1 — сильнее связь; знак = направление. Нужно ≥4 дня с данными. Разделы ниже — по конкретным тегам/привычкам (тыкни, чтобы раскрыть).</div>
          {analysisData.aggregate.length===0
            ? <div style={S.emptyState}>Мало данных за период — заполняй дни почаще.</div>
            : analysisData.aggregate.map(f=>(
              <div key={f.key} style={{marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,marginBottom:3,gap:8}}>
                  <span>{f.label}</span>
                  <span style={{color:C.dim,fontFamily:"'JetBrains Mono',monospace",flexShrink:0}}>r={f.r>0?'+':''}{f.r} · {corrStrength(f.r)} · {f.n} дн.</span>
                </div>
                {bar(f.r)}
              </div>
            ))}
          {detailSection('tags', '🏷 По тегам', analysisData.tagsDetail)}
          {detailSection('habits', '🔁 По привычкам', analysisData.habitsDetail)}
          {detailSection('anti', '🚫 По анти-тегам', analysisData.antiDetail)}
        </div>
        );
      })()}

      {vis('stats.heatmap') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Дисциплин-грид</div>
        <div style={{display:'flex',gap:3,marginTop:8,overflowX:'auto'}}>
          {weeks.map((week,wi)=><div key={wi} style={{display:'flex',flexDirection:'column',gap:3}}>{week.map(d=><div key={d.date} title={`${d.date}: ${d.doneCount}`} style={{width:11,height:11,borderRadius:2,background:cellColor(d.doneCount)}}/>)}</div>)}
        </div>
      </div>
      )}

      <div className="grid2" style={S.grid2}>
        {vis('stats.tasks') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Выполнение задач</div>
          <ChartCanvas type="bar" data={{labels:weeklyStats.map(w=>w.key.slice(5)), datasets:[
            {label:'Запланировано', data:weeklyStats.map(w=>w.planned), backgroundColor:C.border},
            {label:'Выполнено', data:weeklyStats.map(w=>w.done), backgroundColor:C.amber},
          ]}} options={baseChartOpts({plugins:{legend:{display:true, labels:{color:C.dim,font:{size:10}}}}})} />
        </div>
        )}
        {vis('stats.rating') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Оценка дня</div>
          <ChartCanvas type="line" data={{labels:ratingTrend.map(r=>r.date), datasets:[{data:ratingTrend.map(r=>r.v), borderColor:C.purple, backgroundColor:'transparent', spanGaps:true, tension:.3}]}} options={baseChartOpts({scales:{x:{ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}},y:{min:0,max:10,ticks:{color:axisColor,font:{size:10}},grid:{color:gridColor}}}})} />
        </div>
        )}
      </div>

      <div className="grid2" style={S.grid2}>
        {vis('stats.sleep') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Сон</div>
          <ChartCanvas type="line" data={{labels:sleepTrend.map(r=>r.date), datasets:[{data:sleepTrend.map(r=>r.v), borderColor:C.cyan, backgroundColor:'transparent', spanGaps:true, tension:.3}]}} options={baseChartOpts()} />
        </div>
        )}
        {vis('stats.monthly') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Доход/расход по месяцам</div>
          <ChartCanvas type="bar" data={{labels:monthlyFinance.map(m=>m.key), datasets:[
            {label:'Доход', data:monthlyFinance.map(m=>m.income), backgroundColor:C.green},
            {label:'Расход', data:monthlyFinance.map(m=>m.expense), backgroundColor:C.red},
          ]}} options={baseChartOpts({plugins:{legend:{display:true, labels:{color:C.dim,font:{size:10}}}}})} />
        </div>
        )}
      </div>

      <div className="grid2" style={S.grid2}>
        {vis('stats.net') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Чистый доход по месяцам</div>
          <ChartCanvas type="bar" data={{labels:monthlyFinance.map(m=>m.key), datasets:[
            {label:'Чистыми', data:monthlyFinance.map(m=>m.income-m.expense), backgroundColor:monthlyFinance.map(m=>m.income-m.expense>=0?C.green:C.red)},
          ]}} options={baseChartOpts()} />
        </div>
        )}
        {vis('stats.savings') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Норма сбережений · %</div>
          <ChartCanvas type="line" data={{labels:monthlyFinance.map(m=>m.key), datasets:[{data:monthlyFinance.map(m=>m.income>0?Math.round((m.income-m.expense)/m.income*100):0), borderColor:C.amber, backgroundColor:'transparent', tension:.3}]}} options={baseChartOpts()} />
        </div>
        )}
      </div>

      {vis('stats.balanceLine') && (
      <div style={S.panel}>
        <div style={S.panelTitle}>Баланс операций во времени · период</div>
        <ChartCanvas type="line" data={{labels:balanceTrend.labels, datasets:[{data:balanceTrend.data, borderColor:C.amber, backgroundColor:'transparent', tension:.3}]}} options={baseChartOpts()} height={220} />
      </div>
      )}

      <div className="grid2" style={S.grid2}>
        {vis('stats.incomeCat') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Доходы по категориям · период</div>
          {Object.keys(catBreakdown.inc).length===0 ? <div style={S.emptyState}>Нет доходов за период</div> :
            <ChartCanvas type="pie" data={{labels:Object.keys(catBreakdown.inc), datasets:[{data:Object.values(catBreakdown.inc), backgroundColor:PIE_COLORS}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220}/>}
        </div>
        )}
        {vis('stats.expenseCat') && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Расходы по категориям · период</div>
          {Object.keys(catBreakdown.exp).length===0 ? <div style={S.emptyState}>Нет расходов за период</div> :
            <ChartCanvas type="pie" data={{labels:Object.keys(catBreakdown.exp), datasets:[{data:Object.values(catBreakdown.exp), backgroundColor:PIE_COLORS}]}} options={{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:C.dim,font:{size:11}}}}}} height={220}/>}
        </div>
        )}
      </div>

      {vis('stats.tagFreq') && tagFreq.length>0 && (
        <div style={S.panel}>
          <div style={S.panelTitle}>Частота тегов · период</div>
          <ChartCanvas type="bar" data={{labels:tagFreq.map(t=>t[0]), datasets:[{label:'дней', data:tagFreq.map(t=>t[1]), backgroundColor:C.cyan}]}} options={baseChartOpts()} />
        </div>
      )}

      {vis('stats.antiTagFreq') && antiTagFreq.length>0 && (
        <div style={S.panel}>
          <div style={{...S.panelTitle,color:C.red}}>🚫 Частота анти-тегов · период</div>
          <ChartCanvas type="bar" data={{labels:antiTagFreq.map(t=>t[0]), datasets:[{label:'дней', data:antiTagFreq.map(t=>t[1]), backgroundColor:C.red}]}} options={baseChartOpts()} />
        </div>
      )}

      {vis('stats.planfact') && (
        <div style={S.panel}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10,flexWrap:'wrap',gap:8}}>
            <div style={{...S.panelTitle,marginBottom:0}}>План / факт по месяцу</div>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button style={S.navArrow} onClick={()=>setPfMonth(shiftMonth(pfMonth,-1))}>◀</button>
              <span style={{fontSize:12,color:C.dim,minWidth:120,textAlign:'center',textTransform:'capitalize'}}>{monthLabelRu(pfMonth)}</span>
              <button style={S.navArrow} onClick={()=>setPfMonth(shiftMonth(pfMonth,1))} disabled={pfMonth>=todayStr().slice(0,7)}>▶</button>
            </div>
          </div>
          <div className="grid2" style={S.grid2}>
            <div>
              <div style={{fontSize:12.5,fontWeight:700,color:C.dim,marginBottom:8}}>Расходы</div>
              {planFactRows(pfExp, pfBud, 'expense')}
            </div>
            <div>
              <div style={{fontSize:12.5,fontWeight:700,color:C.dim,marginBottom:8}}>Доходы</div>
              {planFactRows(pfInc, pfIncPlan, 'income')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
