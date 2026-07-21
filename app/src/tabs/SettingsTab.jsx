// Вкладка/раздел: SettingsTab (вынесено из App.jsx, session: decompose phase 3)
import { ALL_MOBILE_TAB_IDS, BUILD_ID, TAB_META } from '../lib/constants.js';
import { GAMIFY_DEFAULT, LEVEL_CAP, WEEKLY_XP } from '../lib/gamify.js';
import { MODULE_GROUPS } from '../lib/storage.js';
import { S } from '../lib/styles.js';
import { C } from '../lib/theme.js';
import { Select, SettingsDivider, SettingsSection, SubHead } from '../ui/primitives.jsx';

export function SettingsTab({hidden, toggleModule, defaults, setDefault, categories, accounts, mobileTabs, toggleMobileTab, soundOff, notifOff, maskNetWorth, maskDebts, maskOps, maskAllFinance, morningCfg, setSettingFlag, gamify=GAMIFY_DEFAULT, setGamify, requestNotifs, testNotif, showNotifDiag, notifMsg, deadlineCfg, showGoalDeadline=false, billsNotif=null}){
  const dlOn = !!(deadlineCfg && !deadlineCfg.off);
  const dlDays = (deadlineCfg && deadlineCfg.days && deadlineCfg.days.length) ? deadlineCfg.days : [3,1];
  const dlTime = (deadlineCfg && deadlineCfg.time) || '09:00';
  const msOn = !!(morningCfg && !morningCfg.off);
  const msTime = (morningCfg && morningCfg.time) || '08:00';
  const billsOn = !!(billsNotif && !billsNotif.off);
  const billsTime = (billsNotif && billsNotif.time) || '09:00';
  const billsLead = (billsNotif && billsNotif.leadDays!=null) ? billsNotif.leadDays : 1;
  const setBills = (patch) => setSettingFlag('billsNotif', {off:false, time:billsTime, leadDays:billsLead, ...(billsNotif||{}), ...patch});
  const setDl = (patch) => setSettingFlag('deadlineNotif', {off:false, days:dlDays, time:dlTime, ...(deadlineCfg||{}), ...patch});
  const toggleDlDay = (d) => { const has=dlDays.includes(d); const next=has?dlDays.filter(x=>x!==d):[...dlDays,d].sort((a,b)=>a-b); setDl({days:next}); };
  return (
    <div>
      <SettingsSection title="Уведомления и звук" icon="🔔">
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={!soundOff} onChange={()=>setSettingFlag('soundOff', !soundOff?true:false)} />
          <div style={{flex:1}}>Звук при получении достижения</div>
          <span style={{fontSize:11,color:C.dim}}>{soundOff?'выкл':'вкл'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={!notifOff} onChange={()=>setSettingFlag('notifOff', !notifOff?true:false)} />
          <div style={{flex:1}}>Уведомления на телефоне (привычки · напоминания)</div>
          <span style={{fontSize:11,color:C.dim}}>{notifOff?'выкл':'вкл'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block'}}>
          Время напоминания у привычек задаётся во вкладке «Привычки», у заметок-напоминаний — в редакторе. Работает в приложении на телефоне (не в браузере).
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>
          <button style={S.exportBtn} onClick={requestNotifs}>Разрешить уведомления</button>
          <button style={{...S.exportBtn,borderColor:C.amber,color:C.amber}} onClick={testNotif}>🔔 Тест (через 5 сек)</button>
          <button style={S.exportBtn} onClick={showNotifDiag}>Диагностика</button>
        </div>
        <div style={{marginTop:10,padding:'9px 11px',background:C.panelAlt,border:`1px solid ${C.border}`,borderRadius:8,fontSize:12.5,minHeight:20,wordBreak:'break-word',whiteSpace:'pre-wrap'}}>
          {notifMsg || 'Нажми кнопку выше — результат появится здесь (а не во всплывающем окне).'}
        </div>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block',fontSize:11}}>
          Если тест не приходит: (1) убедись, что стоит СВЕЖИЙ APK (см. номер сборки ниже); (2) в системных настройках приложения → «Уведомления» и «Будильники и напоминания» разрешены; (3) отключи экономию батареи для Life OS (частая причина на Xiaomi/Huawei/Samsung).
        </div>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block',fontSize:11}}>
          Сборка: <b style={{color:C.text}}>{BUILD_ID}</b> — прочитай этот номер на телефоне и сверь, что стоит свежая версия.
        </div>

        <SettingsDivider/>
        <SubHead>Дедлайны дел</SubHead>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={dlOn} onChange={()=> dlOn ? setSettingFlag('deadlineNotif', {...(deadlineCfg||{}), off:true}) : setDl({off:false})} />
          <div style={{flex:1}}>Напоминать о делах с дедлайном</div>
          <span style={{fontSize:11,color:C.dim}}>{dlOn?'вкл':'выкл'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block'}}>Для невыполненных дел (вкладка «Дела»), у которых задан дедлайн. Уведомление приходит в день дедлайна и заранее.</div>
        {dlOn && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:12,color:C.dim,marginBottom:6}}>Напоминать заранее (дней до дедлайна) + в сам день:</div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
              {[7,3,1].map(d=>{ const on=dlDays.includes(d); return (
                <div key={d} className="chip" onClick={()=>toggleDlDay(d)}
                  style={{background:on?C.amber:C.panelAlt,color:on?'#1A1200':C.dim,borderColor:on?C.amber:C.border}}>за {d} дн.</div>
              ); })}
              <span style={{fontSize:12,color:C.dim,marginLeft:8}}>время:</span>
              <input style={{...S.input,maxWidth:120}} type="time" value={dlTime} onChange={e=>setDl({time:e.target.value})} />
            </div>
          </div>
        )}

        <SettingsDivider/>
        <SubHead>Утренняя сводка</SubHead>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={msOn} onChange={()=> msOn ? setSettingFlag('morningSummary', {...(morningCfg||{}), off:true}) : setSettingFlag('morningSummary', {off:false, time:msTime})} />
          <div style={{flex:1}}>Уведомление утром со сводкой дня</div>
          <span style={{fontSize:11,color:C.dim}}>{msOn?'вкл':'выкл'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block'}}>Раз в день: сколько привычек, дедлайнов и напоминаний на сегодня.</div>
        {msOn && (
          <div style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}>
            <span style={{fontSize:12,color:C.dim}}>время:</span>
            <input style={{...S.input,maxWidth:120}} type="time" value={msTime} onChange={e=>setSettingFlag('morningSummary', {off:false, time:e.target.value})} />
          </div>
        )}

        <SettingsDivider/>
        <SubHead>Регулярные платежи</SubHead>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={billsOn} onChange={()=> billsOn ? setSettingFlag('billsNotif', {...(billsNotif||{}), off:true}) : setBills({off:false})} />
          <div style={{flex:1}}>Напоминать о регулярных платежах</div>
          <span style={{fontSize:11,color:C.dim}}>{billsOn?'вкл':'выкл'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block'}}>Ежемесячно для платежей, у которых включён 🔔 (Финансы → Операции → Регулярные платежи). Сам список платежей можно скрыть в разделе «Что показывать» ниже.</div>
        {billsOn && (
          <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginTop:10}}>
            <span style={{fontSize:12,color:C.dim}}>время:</span>
            <input style={{...S.input,maxWidth:120}} type="time" value={billsTime} onChange={e=>setBills({time:e.target.value})} />
            <span style={{fontSize:12,color:C.dim}}>за сколько дней:</span>
            <input style={{...S.input,width:64,minWidth:0,textAlign:'center',flex:'none'}} type="number" min="0" max="14"
              value={billsLead} onChange={e=>{ let v=parseInt(e.target.value,10); if(isNaN(v)) v=0; v=Math.max(0,Math.min(14,v)); setBills({leadDays:v}); }} />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Геймификация" icon="🎮">
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:10,display:'block'}}>
          Насколько сильно наказывают «провалы» и сколько даёт комбо. Показ квестов, испытания недели и анти-тегов включается в разделе «Что показывать» ниже.
        </div>
        {[
          {k:'antiXp',     label:'Анти-тег: снять XP',                 min:0, max:100},
          {k:'hpAnti',     label:'Анти-тег: снять здоровья (в день)',  min:0, max:50},
          {k:'hpHabit',    label:'Пропуск привычки: снять здоровья',   min:0, max:50},
          {k:'hpDeadline', label:'Просроченный дедлайн: снять здоровья',min:0, max:50},
          {k:'hpSurrender',label:'«Сдаться» привычкой: снять здоровья', min:0, max:50},
          {k:'impSurrender',label:'«Сдаться» привычкой: снять импульса',min:0, max:100},
          {k:'comboBonus', label:'Комбо: XP за день серии (× дни)',    min:0, max:50},
        ].map(row=>(
          <div key={row.k} className="row-hover" style={{...S.taskRow,alignItems:'center'}}>
            <div style={{flex:1,fontSize:13}}>{row.label}</div>
            <input style={{...S.input,width:74,minWidth:0,textAlign:'center',flex:'none'}} type="number" min={row.min} max={row.max}
              value={gamify[row.k]} onChange={e=>{ let v=parseInt(e.target.value,10); if(isNaN(v)) v=0; v=Math.max(row.min,Math.min(row.max,v)); setGamify && setGamify({[row.k]:v}); }} />
          </div>
        ))}
        <div style={{...S.dimSpan,marginLeft:0,marginTop:8,display:'block'}}>
          Здоровье пересчитывается при заходе: активный день +5, пустой день с невыполненными задачами −10, день отдыха (без задач) — без штрафа. Штрафы за анти-теги/привычки/дедлайны применяются на следующий день. Комбо-бонус — раз в день при первой активности.
        </div>
        <div style={{marginTop:10}}>
          <button style={S.exportBtn} onClick={()=>setGamify && setGamify({...GAMIFY_DEFAULT})}>Сбросить к значениям по умолчанию</button>
        </div>
      </SettingsSection>

      <SettingsSection title="Экран и персонализация" icon="🎨">
        <SubHead>Нижняя навигация (телефон)</SubHead>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:10,display:'block'}}>Выбери до 4 вкладок для нижней панели. Остальные — в кнопке «Ещё». Выбрано: {mobileTabs.length}/4.</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {ALL_MOBILE_TAB_IDS.map(id=>{ const on=mobileTabs.includes(id); const full=mobileTabs.length>=4; const m=TAB_META[id];
            return <div key={id} className="chip" onClick={()=>toggleMobileTab(id)}
              style={{background:on?C.amber:C.panelAlt,color:on?'#1A1200':(full?C.border:C.dim),borderColor:on?C.amber:C.border,opacity:(!on&&full)?0.5:1}}>
              {m.icon} {m.label}</div>;
          })}
        </div>

        <SettingsDivider/>
        <SubHead>Цели</SubHead>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={!!showGoalDeadline} onChange={()=>setSettingFlag('showGoalDeadline', !showGoalDeadline)} />
          <div style={{flex:1}}>Показывать поле дедлайна в целях</div>
          <span style={{fontSize:11,color:C.dim}}>{showGoalDeadline?'показано':'скрыто'}</span>
        </label>
        <div style={{...S.dimSpan,marginLeft:0,marginTop:6,display:'block'}}>Цели уже разбиты на неделю/месяц/год, поэтому поле выключено по умолчанию. Темп («нужно +N/день») всё равно считается по концу периода. Включи, если хочешь задавать конкретную дату.</div>

        <SettingsDivider/>
        <SubHead>Финансы · по умолчанию</SubHead>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:12,display:'block'}}>Эти значения подставляются автоматически при вводе новой операции.</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:12}}>
          <div>
            <div style={{fontSize:12,color:C.dim,marginBottom:5}}>Счёт по умолчанию</div>
            <Select value={defaults.account||''} onChange={v=>setDefault('account',v)}
              options={[{value:'',label:'— без счёта —'}, ...accounts.map(a=>({value:a.id,label:a.name}))]} />
          </div>
          <div>
            <div style={{fontSize:12,color:C.dim,marginBottom:5}}>Категория расхода</div>
            <Select value={defaults.expenseCat||''} onChange={v=>setDefault('expenseCat',v)}
              options={[{value:'',label:'— первая в списке —'}, ...categories.expense.map(c=>({value:c,label:c}))]} />
          </div>
          <div>
            <div style={{fontSize:12,color:C.dim,marginBottom:5}}>Категория дохода</div>
            <Select value={defaults.incomeCat||''} onChange={v=>setDefault('incomeCat',v)}
              options={[{value:'',label:'— первая в списке —'}, ...categories.income.map(c=>({value:c,label:c}))]} />
          </div>
        </div>

        <SettingsDivider/>
        <SubHead>Приватность · скрытие сумм</SubHead>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:8,display:'block',fontSize:11}}>Скрытые суммы заменяются на ••••••. Каждый тип — отдельно; синкуется между устройствами.</div>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
          <input type="checkbox" checked={!!maskAllFinance} onChange={()=>setSettingFlag('maskAllFinance', !maskAllFinance)} />
          <div style={{flex:1,fontWeight:600}}>Скрыть ВСЕ финансовые числа</div>
          <span style={{fontSize:11,color:C.dim}}>{maskAllFinance?'скрыто':'показано'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer', opacity:maskAllFinance?0.5:1}}>
          <input type="checkbox" checked={!!maskNetWorth} disabled={maskAllFinance} onChange={()=>setSettingFlag('maskNetWorth', !maskNetWorth)} />
          <div style={{flex:1}}>Чистые активы и балансы счетов</div>
          <span style={{fontSize:11,color:C.dim}}>{(maskAllFinance||maskNetWorth)?'скрыто':'показано'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer', opacity:maskAllFinance?0.5:1}}>
          <input type="checkbox" checked={!!maskDebts} disabled={maskAllFinance} onChange={()=>setSettingFlag('maskDebts', !maskDebts)} />
          <div style={{flex:1}}>Долги (суммы должников)</div>
          <span style={{fontSize:11,color:C.dim}}>{(maskAllFinance||maskDebts)?'скрыто':'показано'}</span>
        </label>
        <label className="row-hover" style={{...S.taskRow, cursor:'pointer', opacity:maskAllFinance?0.5:1}}>
          <input type="checkbox" checked={!!maskOps} disabled={maskAllFinance} onChange={()=>setSettingFlag('maskOps', !maskOps)} />
          <div style={{flex:1}}>Операции: доходы, расходы, планы, платежи</div>
          <span style={{fontSize:11,color:C.dim}}>{(maskAllFinance||maskOps)?'скрыто':'показано'}</span>
        </label>
      </SettingsSection>

      <SettingsSection title="Что показывать (модули и графики)" icon="📊">
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:8,display:'block'}}>Выключенные модули и графики скрываются из приложения. Настройка синхронизируется между устройствами.</div>
        {MODULE_GROUPS.map((g,gi)=>(
          <div key={g.group}>
            {gi>0 && <SettingsDivider/>}
            <SubHead>{g.group}</SubHead>
            {g.items.map(it=>(
              <label key={it.id} className="row-hover" style={{...S.taskRow, cursor:'pointer'}}>
                <input type="checkbox" checked={!hidden[it.id]} onChange={()=>toggleModule(it.id)} />
                <div style={{flex:1, color: hidden[it.id]?C.dim:C.text}}>{it.label}</div>
                <span style={{fontSize:11, color:C.dim}}>{hidden[it.id]?'скрыто':'показано'}</span>
              </label>
            ))}
          </div>
        ))}
      </SettingsSection>

      <SettingsSection title="О приложении" icon="ℹ️">
        <div style={{fontSize:14,fontWeight:700,marginBottom:4}}>Life OS</div>
        <div style={{...S.dimSpan,marginLeft:0,marginBottom:12,display:'block'}}>Персональный трекер жизни: планирование, привычки, цели, финансы и рефлексия в одном месте — с геймификацией, чтобы держать ритм.</div>

        <SubHead>Что умеет</SubHead>
        <div style={{fontSize:12.5,lineHeight:1.7,color:C.text}}>
          <div>📅 <b>Сегодня</b> — задачи дня (сложность→XP), ежедневные и многодневные дела, теги, оценка дня, сон, заметка. Перенос незакрытых задач и шаблоны наборов.</div>
          <div>🔁 <b>Привычки</b> — расписание, сгорающий стрик, заморозки, челленджи, напоминания, архив.</div>
          <div>🎯 <b>Цели</b> — год/месяц/неделя/день; ползунок/чек-лист/счётчик; периодизация с архивом; привязка задач к нескольким целям.</div>
          <div>🗂 <b>Дела</b> — эпики, статусы, важность/срочность, дедлайны, архив.</div>
          <div>📝 <b>Заметки</b> — заметки и напоминания (с повтором), закрепление, чек-листы.</div>
          <div>💰 <b>Финансы</b> — операции, счета, должники, планы по месяцам, бюджет-алерты с прогнозом, графики.</div>
          <div>📊 <b>Статистика</b> — итоги за период, дисциплин-грид, тренды, план/факт, анализ факторов оценки дня.</div>
          <div>🏅 <b>Геймификация</b> — XP и уровень (потолок {LEVEL_CAP}) с рангами, стрик, здоровье, ⚡импульс, 🔗комбо, 🎯задания дня, 🏆испытание недели, анти-теги, ~300 достижений.</div>
          <div>🔔 <b>Уведомления</b> — привычки, напоминания, дедлайны, утренняя сводка (на телефоне).</div>
          <div>☁ <b>Синхронизация и бэкап</b> — Firebase (вход Google), экспорт/импорт JSON и Excel, «Поделиться» на телефоне.</div>
        </div>

        <SettingsDivider/>
        <SubHead>Как считается уровень</SubHead>
        <div style={{fontSize:12.5,lineHeight:1.7,color:C.text}}>
          Уровень растёт от <b>XP</b> по плавной кривой с <b>потолком ур. {LEVEL_CAP}</b>: каждый следующий уровень чуть дороже предыдущего (~100 XP в начале … ~600 в конце). Крупные вехи дают <b>ранги</b> (Новобранец → … → Абсолют). XP даётся за: задачи (по сложности), ежедневные (±10), многодневные (+15), дела «Выполнено» (+15), привычки (±10), закрытие целей (+20), достижения (+5…+50), <b>задания дня</b>, <b>испытание недели</b> (+{WEEKLY_XP}) и <b>комбо</b> за серию активных дней. <b>Анти-теги</b> и откат действий XP снимают.
        </div>

        <SettingsDivider/>
        <div style={{fontSize:12,color:C.dim}}>Версия сборки: <b style={{color:C.text}}>{BUILD_ID}</b></div>
        <div style={{fontSize:11,color:C.dim,marginTop:4}}>Данные хранятся на устройстве (localStorage) и в облаке при входе. Полный бэкап — экспорт JSON.</div>
      </SettingsSection>
    </div>
  );
}
