import React, {useState, useEffect, useRef, createContext, useContext} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter, Routes, Route, NavLink, Link, useNavigate, useParams, useLocation, useSearchParams} from 'react-router-dom';
import {QueryClient, QueryClientProvider, useQuery, useQueryClient} from '@tanstack/react-query';
import {BookOpen, LayoutGrid, FolderOpen, Search, Settings2, ArrowRight, Plus, FileText, ShieldCheck, Clock3, X, Upload, Download, ChevronRight, Check, AlertCircle, LoaderCircle, LogOut, PanelLeft, PanelLeftClose, PanelLeftOpen, ListTree, Scale, PenLine, Database, RotateCcw, ExternalLink, CircleHelp, CheckCircle2, History, Paperclip, Activity, Building2, Trash2} from 'lucide-react';
import './styles.css';
import Dashboard from './WorkspaceDashboard';
import DesignControls from './DesignControls';
import {isDemo, demoApi, demoDownload, installDemoDownloads} from './demo';
import SearchFilters, {type FilterSelection} from './SearchFilters';
import EvidencePanel from './EvidencePanel';
import ResearchPanel from './ResearchPanel';
import ReferenceDocuments from './ReferenceDocuments';
import DocumentsPanel from './DocumentsPanel';
import {researchRunUrl} from './ResearchRunPanel';
import TimelinePanel, {type TimelineArtifact, type TimelineFactInput} from './TimelinePanel';
import SimilarCases from './SimilarCases';
import {DEFAULT_CASE_ANALYSIS_COUNT, defaultCaseIds} from './caseSelection';
import CaseDetailsForm, {CasePositionSelect, type CaseDetails} from './CaseDetailsForm';
import {useLayoutPreference} from './workspaceLayout';

let csrf='';
const qc = new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
async function api(path:string, method='GET', body?:any, headers:Record<string,string>={}) {
  if(isDemo)return demoApi(path,method,body,headers);
  const form=body instanceof FormData;
  const r=await fetch('/api/v1'+path,{method,credentials:'same-origin',headers:{...(form?{}:{'Content-Type':'application/json'}),'X-CSRF-Token':csrf,...(method==='POST'&&path.endsWith('/requests')?{'Idempotency-Key':crypto.randomUUID()}: {}),...headers},body:body===undefined?undefined:form?body:JSON.stringify(body)});
  if(!r.ok) {let error:any;try{error=(await r.json()).detail}catch{error='服务请求失败'};throw new Error(typeof error==='string'?error:JSON.stringify(error));}
  return r.json();
}
const AppContext=createContext<any>({});
function useApp(){return useContext(AppContext)}
const names:any={home:'工作台',cases:'我的案件',search:'类案检索',settings:'配置中心',overview:'案件概览',materials:'材料中心','similar-cases':'类案',timeline:'案情时间线',evidence:'证据分析',research:'结果与研究',documents:'文书草稿',tasks:'任务记录'};
const statusNames:any={queued:'等待执行',running:'执行中',waiting_input:'待您选择',succeeded:'已完成',failed:'执行失败',cancelled:'已取消',ready:'已解析',partial:'部分可读',needs_transcription:'需要补正文',passed:'检查通过'};
const fmt=(s:string)=>new Date(s).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
function Tag({children,tone='neutral'}:any){return <span className={'tag '+tone}>{children}</span>}
function Empty({icon:Icon=FileText,title,children}:any){return <div className="empty"><Icon size={32}/><h3>{title}</h3><div>{children}</div></div>}
function Loading(){return <div className="loading"><LoaderCircle className="spin" size={20}/> 正在读取工作区…</div>}
function usePanelFocus(ref:React.RefObject<HTMLElement|null>, firstField=false, returnTo?:HTMLElement){
 useEffect(()=>{
  const trigger=returnTo||(document.activeElement instanceof HTMLElement?document.activeElement:null);
  const panel=ref.current;
  const focusTarget=firstField?(panel?.querySelector<HTMLElement>('input, textarea, select')||panel):panel;
  focusTarget?.focus({preventScroll:true});
  panel?.scrollIntoView({block:'start'});
  return()=>{if(trigger?.isConnected){trigger.focus({preventScroll:true});trigger.scrollIntoView({block:'nearest'})}};
 },[ref,firstField,returnTo]);
}

function InlinePanel({id,title,children,onClose,busy=false}:any){
 const panel=useRef<HTMLElement>(null);
 usePanelFocus(panel,true);
 return <section ref={panel} id={id} tabIndex={-1} aria-label={title} aria-busy={busy} className="card inline-panel">
  <header><h2>{title}</h2><button type="button" aria-label="收起表单" className="text-button" disabled={busy} onClick={onClose}>收起<X size={16}/></button></header>
  {children}
 </section>;
}

function InlineNotice(){
 const {notice,dismissNotice}=useApp();
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(notice)ref.current?.scrollIntoView({block:'nearest'})},[notice]);
 if(!notice)return null;
 return <div ref={ref} role={notice.error?'alert':'status'} className={'inline-notice '+(notice.error?'error':'success')}>
  {notice.error?<AlertCircle size={18}/>:<CheckCircle2 size={18}/>}<span>{notice.message}</span>
  <button type="button" className="icon-button" aria-label="关闭提示" onClick={dismissNotice}><X size={16}/></button>
 </div>;
}

function App(){
 const me=useQuery({queryKey:['me'],queryFn:()=>api('/me')});
 const loc=useLocation();
 const [notice,setNotice]=useState<{message:string,error:boolean}|null>(null);
 const [sourceSelection,setSourceSelection]=useState<any>(null);
 useEffect(()=>{if(me.data)csrf=me.data.csrf},[me.data]);
 useEffect(()=>{setSourceSelection(null);setNotice(null)},[loc.pathname,me.data?.id]);
 function notify(message:string){setNotice({message,error:false})}
 async function act(fn:()=>Promise<any>){
  setNotice(null);
  try{return await fn()}catch(e){setNotice({message:(e as Error).message,error:true});return undefined}
 }
 function source(ref:any){
  if(!ref){setNotice({message:'未找到这条引用的来源。',error:true});return}
  setSourceSelection({ref,key:crypto.randomUUID(),trigger:document.activeElement});
 }
 if(me.isPending)return <Loading/>;
 return <AppContext.Provider value={{me:me.data,notice,notify,dismissNotice:()=>setNotice(null),act,source}}>
  {me.data?<Shell sourceSelection={sourceSelection} onCloseSource={()=>setSourceSelection(null)}/>:<Login/>}
 </AppContext.Provider>;
}

function Login(){const {act}=useApp();const [username,setUsername]=useState(isDemo?'示例用户':'admin');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);
return <div className="login-page"><div className="login-controls"><DesignControls/></div><div className="login-brand"><span className="brand-mark"><BookOpen size={25}/></span><span>裁研</span><small>法律研究工作台</small></div><div className="login-card"><span className="eyebrow">让每一份判断都有依据</span><h1>每一份判断，<br/>都有据可循。</h1><p>连接材料、事实与研究，让下一步更清晰。</p><InlineNotice/><form onSubmit={e=>{e.preventDefault();setBusy(true);act(async()=>{const u=await api('/auth/login','POST',{username,password});csrf=u.csrf;qc.setQueryData(['me'],u)}).finally(()=>setBusy(false))}}><label>本机账号<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label><label>密码<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:null}进入工作区 <ArrowRight size={17}/></button></form><p className="small muted">{isDemo?'无需真实账号信息，点击上方按钮进入示例。':'使用现有本地账号登录裁研工作区。'}</p></div><div className="login-foot"><ShieldCheck size={15}/> 本地材料 · 来源可查 · 律师复核</div></div>}

function Shell({sourceSelection,onCloseSource}:any){
 const {me,act}=useApp();
 const loc=useLocation();
 const [menu,setMenu]=useState(false);
 const [navigationCollapsed,setNavigationCollapsed]=useLayoutPreference('caiyan.navigation.collapsed');
 const cases=useQuery({queryKey:['cases'],queryFn:()=>api('/cases')});
 const section=loc.pathname.split('/').filter(Boolean).at(-1)||'home';
 useEffect(()=>{setMenu(false);window.scrollTo(0,0)},[loc.pathname]);
 const navigation=<aside id="workspace-navigation" aria-label="工作区导航" className={'sidebar '+(menu?'open':'')}><Link to="/" className="brand" aria-label="裁研工作台" title="裁研工作台"><span className="brand-mark"><BookOpen size={23}/></span><span className="brand-copy">裁研<small>法律研究工作台</small></span></Link><div className="workspace-label"><i/>律师个人工作空间</div><div className="nav-label">工作空间</div><nav><NavLink to="/" end aria-label="工作台" title="工作台" onClick={()=>setMenu(false)}><LayoutGrid size={18}/><span className="navigation-text">工作台</span></NavLink><NavLink to="/cases" aria-label="我的案件" title="我的案件" onClick={()=>setMenu(false)}><FolderOpen size={18}/><span className="navigation-text">我的案件</span><span className="count">{cases.data?.length||0}</span></NavLink><NavLink to="/search" aria-label="类案检索" title="类案检索" onClick={()=>setMenu(false)}><Search size={18}/><span className="navigation-text">类案检索</span></NavLink></nav><CaseNavigation/><div className="sidebar-bottom"><div className="sidebar-note"><ShieldCheck size={18}/><strong>每一份判断，都能回到依据。</strong><p>让材料、事实和研究结论<br/>在同一个案件中保持关联。</p></div>{me.role==='admin'&&<NavLink aria-label="配置中心" title="配置中心" onClick={()=>setMenu(false)} className="settings-link" to="/settings"><Settings2 size={18}/><span className="navigation-text">配置中心</span><Tag>管理</Tag></NavLink>}<div className="profile"><span className="avatar" title={me.name}>律</span><div>{me.name}<small>{isDemo?'示例工作区':'本地工作区'} · {me.role==='admin'?'管理员':'律师'}</small></div><button aria-label="退出登录" title="退出登录" className="icon-button" onClick={()=>act(async()=>{await api('/auth/logout','POST');csrf='';qc.clear();qc.setQueryData(['me'],null)})}><LogOut size={16}/></button></div></div></aside>;
 return <><a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus()}}>跳到主要内容</a><div className={'shell'+(navigationCollapsed?' navigation-collapsed':'')}><div className="main-shell">
  <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="菜单" aria-expanded={menu} aria-controls="workspace-navigation" onClick={()=>setMenu(!menu)}><PanelLeft size={19}/></button><button type="button" className="icon-button navigation-toggle" aria-label={navigationCollapsed?'展开左侧导航':'收起左侧导航'} title={navigationCollapsed?'展开左侧导航':'收起左侧导航'} aria-expanded={!navigationCollapsed} aria-controls="workspace-navigation" onClick={()=>setNavigationCollapsed(!navigationCollapsed)}>{navigationCollapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</button><span>工作空间</span><ChevronRight size={14}/><strong>{names[section]||'案件工作区'}</strong></div><div className="topbar-right"><DesignControls/></div></header>
  {navigation}
  <main id="main-content" tabIndex={-1}>
   <div className="workspace-feedback"><InlineNotice/></div>
   {sourceSelection&&<div className="workspace-source"><SourcePanel key={sourceSelection.key} reference={sourceSelection.ref} trigger={sourceSelection.trigger} onClose={onCloseSource}/></div>}
   <Routes><Route path="/" element={<Home/>}/><Route path="/cases" element={<Cases/>}/><Route path="/cases/:caseId/:tab" element={<CasePage/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="*" element={<Home/>}/></Routes>
  </main>
 </div></div></>;
}


function CaseNavigation(){
 const loc=useLocation();
 const cid=loc.pathname.startsWith('/cases/')?loc.pathname.split('/')[2]:null;
 if(!cid)return null;
 const sections=[['overview','案件概览',LayoutGrid],['materials','材料中心',FolderOpen],['similar-cases','本案类案',Search],['timeline','案情时间线',ListTree],['evidence','证据分析',Scale],['research','结果与研究',BookOpen],['documents','文书草稿',PenLine],['tasks','任务记录',Clock3]] as const;
 return <div className="case-navigation"><div className="nav-label">当前案件</div><nav aria-label="案件功能导航">{sections.map(([key,title,Icon])=><NavLink key={key} to={'/cases/'+cid+'/'+key} title={title} aria-label={title}><Icon size={17}/><span className="navigation-text">{title}</span></NavLink>)}</nav></div>;
}

function NewCase({close}:any){const {act}=useApp();const nav=useNavigate();const [f,setF]=useState({title:'',position:'我方当事人代理律师',claims:'',research_date:new Date().toISOString().slice(0,10)});const [busy,setBusy]=useState(false);
return <InlinePanel id="new-case-panel" title="建立案件工作空间" onClose={close}><form onSubmit={e=>{e.preventDefault();setBusy(true);act(async()=>{const c=await api('/cases','POST',f);qc.invalidateQueries({queryKey:['cases']});close();nav('/cases/'+c.id+'/materials')}).finally(()=>setBusy(false))}}><p className="muted">明确代理立场与目标，后续材料和成果将保存在这个案件中。</p><label>案件名称<input required maxLength={160} placeholder="例如：某小区商品房买卖合同纠纷" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></label><label>代理立场<CasePositionSelect value={f.position} onChange={position=>setF({...f,position})}/></label><label>当前诉求与研究目标<textarea required maxLength={2000} rows={3} placeholder="描述需要研究的争议和希望实现的目标" value={f.claims} onChange={e=>setF({...f,claims:e.target.value})}/></label><label>研究时点<input type="date" required value={f.research_date} onChange={e=>setF({...f,research_date:e.target.value})}/></label><footer><button type="button" className="button" onClick={close}>取消</button><button className="button primary" disabled={busy}>建立并添加材料<ArrowRight size={16}/></button></footer></form></InlinePanel>}

function Home(){return <Dashboard api={api}/>;}

type CaseListItem = CaseDetails & {
 id:string; owner_id:string; revision:number; material_count:number; waiting_count:number; updated_at:string;
 similar_cases?:{needs_analysis:boolean; analyzed_at:string|null; count:number};
};

async function saveCaseDetails(id:string, values:CaseDetails, revision:number){
 const updated=await api('/cases/'+id,'PATCH',values,{'If-Match':String(revision)});
 await qc.cancelQueries({queryKey:['case',id]});
 qc.setQueryData(['case',id],(previous:any)=>({...previous,...updated}));
 await Promise.all([
  qc.invalidateQueries({queryKey:['case',id]}),
  qc.invalidateQueries({queryKey:['cases']})
 ]);
}

function EditCase({id,close}:{id:string;close:()=>void}){
 const {notify}=useApp();
 const [busy,setBusy]=useState(false);
 const q=useQuery({queryKey:['case',id],queryFn:()=>api('/cases/'+id),refetchInterval:3000});
 async function save(values:CaseDetails,revision:number){
  setBusy(true);
  try{
   await saveCaseDetails(id,values,revision);
   close();
   notify('案件信息已保存。');
  }finally{setBusy(false)}
 }
 if(q.isPending)return <Loading/>;
 return <InlinePanel id="edit-case-panel" title="编辑案件" onClose={close} busy={busy}>
  {q.isError?<div className="case-edit-message error" role="alert"><span>{q.error.message}</span><button type="button" className="text-button" onClick={()=>q.refetch()}>重试</button></div>:
   <CaseDetailsForm c={q.data} onSave={save} onCancel={close}/>}
 </InlinePanel>;
}

function DeleteCase({c,close}:{c:CaseListItem;close:()=>void}){
 const {notify}=useApp();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function remove(){
  if(busy)return;
  setBusy(true);
  setError('');
  try{
   await api('/cases/'+c.id,'DELETE',undefined,{'If-Match':String(c.revision)});
   await Promise.all([qc.cancelQueries({queryKey:['cases']}),qc.cancelQueries({queryKey:['case',c.id]})]);
   qc.setQueryData<CaseListItem[]>(['cases'],previous=>previous?.filter(item=>item.id!==c.id));
   qc.removeQueries({queryKey:['case',c.id]});
   await qc.invalidateQueries({queryKey:['cases']});
   close();
   notify('案件“'+c.title+'”已删除。');
  }catch(cause){
   setError(cause instanceof Error?cause.message:'删除失败，请重试。');
   await qc.invalidateQueries({queryKey:['cases']});
  }finally{setBusy(false)}
 }
 return <InlinePanel id="delete-case-panel" title="删除案件" onClose={close} busy={busy}>
  <div className="case-delete-summary"><span className="case-delete-icon"><Trash2 size={22}/></span><div><h3>确定删除“{c.title}”？</h3><p>删除后，该案件及其 {c.material_count} 份材料、研究成果和任务记录将无法在工作区查看，进行中的任务也会停止。当前不支持恢复。</p></div></div>
  {error&&<div className="case-edit-message error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
  <footer><button type="button" className="button" disabled={busy} onClick={close}>取消</button><button type="button" className="button danger-solid" disabled={busy} onClick={remove}>{busy?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>}确认删除</button></footer>
 </InlinePanel>;
}

function CaseCard({c,onEdit,onDelete,disabled}:{c:CaseListItem;onEdit:()=>void;onDelete?:()=>void;disabled:boolean}){
 return <article className="card case-card" aria-label={c.title}>
  <Link className="case-card-link" to={'/cases/'+c.id+'/overview'}>
   <div className="case-card-title"><span className="case-icon"><Building2 size={23}/></span><div><h3>{c.title}</h3><p>{c.position}</p></div><ChevronRight size={18}/></div>
   <div className="case-meta"><span><FileText size={14}/>{c.material_count||0} 份材料</span><span><Clock3 size={14}/>{fmt(c.updated_at)}</span>{c.waiting_count>0&&<Tag tone="amber">{c.waiting_count} 项待选择</Tag>}{c.similar_cases?.needs_analysis?<Tag tone="amber">类案需重新分析</Tag>:c.similar_cases?.analyzed_at&&<Tag tone="blue">{c.similar_cases.count} 条类案</Tag>}</div>
   <p className="case-card-claims small muted">{c.claims}</p>
  </Link>
  <div className="case-card-foot"><div className="case-card-actions">
   <button type="button" className="text-button" disabled={disabled} aria-controls="edit-case-panel" onClick={onEdit}><PenLine size={15}/>编辑案件</button>
   {onDelete&&<button type="button" className="text-button danger" disabled={disabled} aria-controls="delete-case-panel" onClick={onDelete}><Trash2 size={15}/>删除案件</button>}
  </div><Link className="continue" to={'/cases/'+c.id+'/overview'}>继续办理 <ArrowRight size={15}/></Link></div>
 </article>;
}

function Cases(){
 const [designParams]=useSearchParams();
 const {me}=useApp();
 const [creating,setCreating]=useState(designParams.get('new')==='1');
 const [action,setAction]=useState<{kind:'edit'|'delete';c:CaseListItem}|null>(null);
 const [term,setTerm]=useState('');
 const q=useQuery<CaseListItem[]>({queryKey:['cases'],queryFn:()=>api('/cases')});
 const filtered=q.data?.filter(c=>c.title.includes(term));
 const panelOpen=creating||!!action;
 return <div className="page">
  <div className="page-heading"><div><span className="eyebrow">案件 · 资料 · 研究</span><h1>我的案件</h1><p className="muted">围绕案件保存材料、研究过程与每一版成果。</p></div><button className="button primary" disabled={panelOpen} aria-expanded={creating} aria-controls="new-case-panel" onClick={()=>setCreating(true)}><Plus size={16}/>新建案件</button></div>
  {creating&&<NewCase close={()=>setCreating(false)}/>}
  {action?.kind==='edit'&&<EditCase key={action.c.id} id={action.c.id} close={()=>setAction(null)}/>}
  {action?.kind==='delete'&&<DeleteCase key={action.c.id} c={action.c} close={()=>setAction(null)}/>}
  <div className="searchbox"><Search size={17}/><input aria-label="按案件名称搜索" placeholder="按案件名称搜索" value={term} onChange={e=>setTerm(e.target.value)}/></div>
  {q.isPending?<Loading/>:q.isError?<Empty title="案件列表读取失败"><p>{q.error.message}</p><button className="button" onClick={()=>q.refetch()}>重试</button></Empty>:<>
   <div className="case-grid">{filtered?.map(c=><CaseCard key={c.id} c={c} disabled={panelOpen} onEdit={()=>setAction({kind:'edit',c})} onDelete={c.owner_id===me.id?()=>setAction({kind:'delete',c}):undefined}/>)}</div>
   {!q.data.length?<Empty icon={FolderOpen} title="还没有案件"><button className="button secondary" disabled={panelOpen} aria-expanded={creating} aria-controls="new-case-panel" onClick={()=>setCreating(true)}>建立第一个案件</button></Empty>:!filtered?.length&&<Empty icon={Search} title="没有匹配的案件">请尝试其他案件名称。</Empty>}
  </>}
 </div>;
}

function CasePage(){const {act,notify,source}=useApp();const {caseId,tab}=useParams();const q=useQuery({queryKey:['case',caseId],queryFn:()=>api('/cases/'+caseId),refetchInterval:3000});if(q.isPending)return <Loading/>;if(q.error)return <Empty title={q.error.message}/>;const c=q.data;return <div className="page case-page" key={caseId}><div className="case-heading"><div><Link className="back" to="/cases">我的案件 <ChevronRight size={13}/></Link><h1>{c.title}</h1><div className="case-meta"><span className="case-position-summary"><span>代理立场：</span><strong>{c.position||'待选择'}</strong></span><span>研究时点 {c.research_date}</span><Tag>资料 v{c.revision}</Tag></div></div><button className="button" onClick={()=>qc.invalidateQueries({queryKey:['case',caseId]})}><RotateCcw size={15}/>刷新</button></div><nav className="tabs">{['overview','materials','similar-cases','timeline','evidence','research','documents','tasks'].map(t=><NavLink key={t} to={'/cases/'+caseId+'/'+t}>{names[t]}{t==='materials'&&<small>{c.materials.length}</small>}{t==='similar-cases'&&(c.similar_cases?.needs_analysis?<small className="similar-tab-stale">需重新分析</small>:c.similar_cases?.analyzed_at&&<small>{c.similar_cases.count}</small>)}{((t==='research'&&c.runs.some((r:any)=>r.status==='waiting_input'&&!r.plan.includes('document.generate')))||(t==='documents'&&c.runs.some((r:any)=>r.status==='waiting_input'&&r.plan.includes('document.generate'))))&&<i aria-label="有待处理的选择"/>}</NavLink>)}</nav>{tab!=='similar-cases'&&c.similar_cases?.needs_analysis&&<div className="notice warning similar-stale" role="status"><AlertCircle size={17}/><span>类案需重新分析：案件资料或检索条件已变化，已保存结果仍可查看。</span><Link to={'/cases/'+caseId+'/similar-cases'}>前往类案<ArrowRight size={14}/></Link></div>}<div className="tab-content">{tab==='overview'?<Overview c={c}/>:tab==='materials'?<Materials c={c}/>:tab==='similar-cases'?<SimilarCases key={caseId} c={c} api={api} act={act} notify={notify}/>:tab==='research'?<Research c={c}/>:tab==='documents'?<Documents c={c}/>:tab==='tasks'?<Tasks c={c}/>:<Structured c={c} kind={tab==='evidence'?'evidence':'timeline'}/>}</div></div>}

function GoalBox({c,initial='',workflow}:any){const {act}=useApp();const nav=useNavigate();const [goal,setGoal]=useState(initial);const [busy,setBusy]=useState(false);const [materialIds,setMaterialIds]=useState<string[]|null>(null);const materials=c.materials.filter((m:any)=>m.kind!=='文书模板');return <div className="card goal-box"><div className="section-heading"><h3><PenLine size={17}/> 继续研究这个案件</h3><span className="small muted">目标明确后直接开始</span></div><textarea aria-label="案件研究目标" value={goal} onChange={e=>setGoal(e.target.value)} placeholder="描述本轮目标，或直接说：起草一份民事起诉状 / 整理代理意见" rows={2}/><details><summary>本次材料范围 · {materialIds?.length??materials.filter((m:any)=>m.status==='ready').length} 份</summary>{materials.map((m:any)=><label className="checkline" key={m.id}><input type="checkbox" disabled={m.status!=='ready'} checked={materialIds?materialIds.includes(m.id):m.status==='ready'} onChange={e=>{const selected=materialIds??materials.filter((m:any)=>m.status==='ready').map((m:any)=>m.id);setMaterialIds(e.target.checked?[...selected,m.id]:selected.filter((id:string)=>id!==m.id))}}/>{m.name}<span className="muted">{m.characters} 字</span></label>)}</details><div className="goal-footer"><span className="small muted">最多 20 份材料 / 60,000 字；新任务固定当前材料与配置版本。</span><button className="button primary" disabled={busy||!goal.trim()} onClick={()=>{setBusy(true);act(async()=>{const run=await api('/cases/'+c.id+'/requests','POST',{goal,workflow,material_ids:materialIds});await qc.invalidateQueries({queryKey:['case',c.id]});nav(run.plan?.includes('document.generate')?'/cases/'+c.id+'/documents?run='+run.id:workflow==='evidence.gaps'?'/cases/'+c.id+'/evidence':researchRunUrl(c.id,run.id))}).finally(()=>setBusy(false))}}>{busy?<LoaderCircle className="spin" size={16}/>:<ArrowRight size={16}/>}开始任务</button></div></div>}

function Overview({c}:any){
 const {notify}=useApp();
 const latest=c.runs[0];
 async function saveDetails(values:CaseDetails,revision:number){
  await saveCaseDetails(c.id,values,revision);
  notify('案件信息已保存。');
 }
 return <><div className="overview-grid"><div className="card overview-main"><span className="eyebrow">本案研究目标</span><h2>当前研究目标</h2><CaseDetailsForm key={c.id} c={c} onSave={saveDetails}/><div className="overview-counts"><div><strong>{c.materials.length}</strong><span>案件材料</span></div><div><strong>{c.artifacts.length}</strong><span>已保存成果</span></div><div><strong>{c.runs.length}</strong><span>任务记录</span></div></div></div><div className="card overview-side"><h3>接下来可以做</h3>{[['materials','上传和核对原始材料'],['timeline','梳理关键事实与时间线'],['similar-cases','分析并查看本案类案'],['documents','起草文书并复核导出']].map(([p,t])=><Link key={p} to={'/cases/'+c.id+'/'+p}><span>{t}</span><ArrowRight size={15}/></Link>)}</div></div>{latest&&<div className="notice"><Activity size={17}/><span>最近任务：{latest.goal}</span><Tag tone={latest.status==='failed'?'red':'blue'}>{statusNames[latest.status]}</Tag><Link to={latest.status==='waiting_input'?(latest.plan.includes('document.generate')?'/cases/'+c.id+'/documents?run='+latest.id:researchRunUrl(c.id,latest.id)):'/cases/'+c.id+'/tasks#run-'+latest.id}>{latest.status==='waiting_input'?'继续研究':'查看进度'}</Link></div>}<div className="section-heading"><h2>最近成果</h2></div>{c.artifacts.slice(0,6).map((a:any)=><Link className="artifact-row" key={a.id} to={'/cases/'+c.id+'/'+(a.kind==='document'?'documents':a.kind==='research'?'research':a.kind==='evidence_answer'?'evidence':a.kind)}><span className="row-icon"><FileText size={18}/></span><div><strong>{a.title}</strong><small>{fmt(a.created_at)} · v{a.version}</small></div><Tag tone={a.stale?'amber':a.review_status==='reviewed'?'green':'neutral'}>{a.stale?'资料已变化':a.review_status==='reviewed'?'已复核':'待复核'}</Tag><ChevronRight size={16}/></Link>)}</>}

type MaterialDeletionTarget = {id:string;logical_id:string;name:string};

function DeleteMaterial({caseId,material,close}:{caseId:string;material:MaterialDeletionTarget;close:()=>void}){
 const {notify}=useApp();
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 async function remove(){
  if(busy)return;
  setBusy(true);setError('');
  try{
   await api('/materials/'+material.id,'DELETE');
   await qc.cancelQueries({queryKey:['case',caseId]});
   qc.setQueryData(['case',caseId],(previous:any)=>previous?{...previous,materials:previous.materials.filter((m:MaterialDeletionTarget)=>m.logical_id!==material.logical_id)}:previous);
   await Promise.all([
    qc.invalidateQueries({queryKey:['case',caseId]}),
    qc.invalidateQueries({queryKey:['cases']}),
    qc.resetQueries({queryKey:['source'],predicate:query=>query.queryKey[1]==='/materials/'+material.id||(query.state.data as MaterialDeletionTarget|undefined)?.logical_id===material.logical_id})
   ]);
   close();
   notify('材料“'+material.name+'”已删除。');
  }catch(cause){
   setError(cause instanceof Error?cause.message:'删除失败，请重试。');
  }finally{setBusy(false)}
 }
 return <InlinePanel id="delete-material-panel" title="删除案件材料" onClose={close} busy={busy}>
  <div className="case-delete-summary"><span className="case-delete-icon"><Trash2 size={22}/></span><div><h3>确定删除“{material.name}”？</h3><p>该材料及其历史版本将无法查看或下载，引用它的成果会停止展示和导出。当前进行中或等待选择的任务会停止，后续研究请使用更新后的材料重新开始。</p></div></div>
  {error&&<div className="case-edit-message error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
  <footer><button type="button" className="button" disabled={busy} onClick={close}>取消</button><button type="button" className="button danger-solid" disabled={busy} onClick={remove}>{busy?<LoaderCircle className="spin" size={16}/>:<Trash2 size={16}/>} {busy?'正在删除…':'确认删除材料'}</button></footer>
 </InlinePanel>;
}

function Materials({c}:any){
 const {act,source,notify}=useApp();
 const [editing,setEditing]=useState(false);
 const [f,setF]=useState({name:'',text:'',kind:'当事人提供材料'});
 const [busy,setBusy]=useState(false);
 const [saving,setSaving]=useState(false);
 const [filter,setFilter]=useState('');
 const [deleting,setDeleting]=useState<MaterialDeletionTarget|null>(null);
 const filtered=c.materials.filter((m:any)=>m.name.includes(filter));
 async function upload(file:File){
  setBusy(true);
  await act(async()=>{
   const form=new FormData();form.append('file',file);
   const r=await api('/cases/'+c.id+'/materials','POST',form);
   notify(r.status==='ready'?'材料已上传并解析，已保存原件与来源位置。':'材料已保存，请查看解析提示。');
   qc.invalidateQueries({queryKey:['case',c.id]});qc.invalidateQueries({queryKey:['cases']});
  });
  setBusy(false);
 }
 async function saveText(e:React.FormEvent){
  e.preventDefault();setSaving(true);
  await act(async()=>{
   await api('/cases/'+c.id+'/materials/text','POST',f);
   setEditing(false);setF({name:'',text:'',kind:'当事人提供材料'});
   qc.invalidateQueries({queryKey:['case',c.id]});qc.invalidateQueries({queryKey:['cases']});
   notify('材料已保存，可在下方材料列表中核对原文。');
  });
  setSaving(false);
 }
 return <>
  <ReferenceDocuments documents={c.reference_documents||[]} api={api} refresh={()=>qc.invalidateQueries({queryKey:['case',c.id]})}/>
  <div className="section-heading"><div><h2>案件材料</h2><p className="muted">保存原件与定位。材料新增或删除后，相关成果需重新核对。</p></div><button className="button" disabled={!!deleting} aria-expanded={editing} aria-controls="material-editor" onClick={()=>setEditing(!editing)}><Plus size={16}/>{editing?'收起录入':'录入文本'}</button></div>
  {deleting&&<DeleteMaterial key={deleting.id} caseId={c.id} material={deleting} close={()=>setDeleting(null)}/>}
  {editing&&<InlinePanel id="material-editor" title="录入案件材料" onClose={()=>setEditing(false)}>
   <form onSubmit={saveText}>
    <div className="two-cols"><label>材料名称<input required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label><label>来源性质<select value={f.kind} onChange={e=>setF({...f,kind:e.target.value})}><option>当事人提供材料</option><option>当事人陈述</option><option>律师整理记录</option></select></label></div>
    <label>原文<textarea required rows={10} maxLength={60000} value={f.text} onChange={e=>setF({...f,text:e.target.value})}/></label>
    <footer><button type="button" className="button" onClick={()=>setEditing(false)}>取消</button><button className="button primary" disabled={saving||!!deleting}>{saving?'正在保存…':'保存材料'}</button></footer>
   </form>
  </InlinePanel>}
  <label className={'upload-zone '+(busy?'busy':'')}><Upload size={27}/><strong>{busy?'正在上传并解析…':'选择文件，添加到本案'}</strong><span>TXT、Markdown、DOCX、文本型 PDF · 单文件最多 20 MiB</span><input aria-label="上传案件材料" type="file" disabled={busy||!!deleting} accept=".txt,.md,.docx,.pdf" onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value=''}}/></label>
  <div className="notice subtle"><CircleHelp size={16}/><span>扫描件暂不支持 OCR。PDF 空白或未解析页会单独提示；DOCX 定位至段落和表格单元格。</span></div>
  <div className="searchbox"><Search size={16}/><input aria-label="搜索材料名称" placeholder="搜索材料名称" value={filter} onChange={e=>setFilter(e.target.value)}/></div>
  <div className="card table-wrap"><table><thead><tr><th>材料名称</th><th>状态</th><th>可读范围</th><th>版本</th><th>操作</th></tr></thead><tbody>{filtered.map((m:any)=><tr key={m.id}><td><button className="text-button file-name" onClick={()=>source({source_kind:'case_material',doc_id:m.id,name:m.name})}><FileText size={18}/>{m.name}</button>{m.warnings.map((w:string)=><small className="warning" key={w}>{w}</small>)}</td><td><Tag tone={m.status==='ready'?'green':'amber'}>{statusNames[m.status]}</Tag></td><td>{m.characters.toLocaleString()} 字 / {m.locations.length} 个位置</td><td>v{m.version}</td><td><div className="material-actions"><a className="text-link" href={'/api/v1/materials/'+m.id+'/download'}>原件</a><button type="button" className="text-button danger" disabled={busy||saving||!!deleting} aria-label={'删除材料 '+m.name} aria-expanded={deleting?.id===m.id} aria-controls="delete-material-panel" onClick={()=>setDeleting(m)}><Trash2 size={15}/>删除</button></div></td></tr>)}</tbody></table>{!c.materials.length?<Empty title="尚未添加材料">上传文件或直接录入正文，即可开始整理案情。</Empty>:!filtered.length&&<Empty icon={Search} title="没有匹配的材料">请尝试其他材料名称。</Empty>}</div>
 </>;
}

function CitationText({text,sources}:any){const {source}=useApp();return <>{String(text).split(/(\[(?:M|J|L)[A-Za-z0-9_]+\])/g).map((s,i)=>{const ref=sources?.find((x:any)=>'['+x.id+']'===s);return ref?<button key={i} className="citation" onClick={()=>source(ref)}>{s}</button>:<React.Fragment key={i}>{s}</React.Fragment>})}</>}
function Markdown({body,sources=[]}:any){return <div className="markdown">{body.split('\n').map((line:string,i:number)=>line.startsWith('# ')?<h2 key={i}>{line.slice(2)}</h2>:line.startsWith('## ')?<h3 key={i}>{line.slice(3)}</h3>:line.startsWith('### ')?<h4 key={i}>{line.slice(4)}</h4>:line.trim()?<p key={i}><CitationText text={line.replace(/\*\*/g,'')} sources={sources}/></p>:<div className="paragraph-space" key={i}/>)}</div>}
function ArtifactStatus({a}:any){const {act,notify}=useApp();const [rejecting,setRejecting]=useState(false);const [note,setNote]=useState('');return <><div className="artifact-status"><Tag tone={a.checks.passed?'green':'red'}>{a.checks.passed?'来源程序检查通过':'检查不通过'}</Tag><Tag tone="amber">{a.completeness==='limited'?'有限结果 · 条件待核':'完整结果'}</Tag><Tag tone={a.stale?'red':a.review_status==='reviewed'?'green':'neutral'}>{a.stale?'资料已变化 · 请更新':a.review_status==='reviewed'?'已复核':'待律师复核'}</Tag><span className="small muted">{fmt(a.created_at)}</span><button className="text-button danger" onClick={()=>setRejecting(!rejecting)}>标记内容问题</button></div>{rejecting&&<div className="card"><label>内容问题说明<textarea aria-label="内容问题说明" value={note} onChange={e=>setNote(e.target.value)} placeholder="说明事实、引用或推论中的问题"/></label><button className="button" disabled={!note.trim()} onClick={()=>act(async()=>{await api('/cases/'+a.case_id+'/feedback','POST',{target_id:a.id,rating:'unsupported',note});qc.invalidateQueries({queryKey:['case',a.case_id]});setRejecting(false);notify('此版本已停止复核、导出和研究复用。请修订为新版本。')})}>记录问题并阻止导出</button></div>}{a.checks.issues?.map((message:string)=><div className="notice warning" key={message}>{message}</div>)}</>}

function Structured({c,kind}:any){
 const a=c.artifacts.find((item:any)=>item.kind===kind);
 const {source,notify}=useApp();
 async function saveTimeline(artifact:TimelineArtifact,facts:TimelineFactInput[]){
  const updated=await api('/artifacts/'+artifact.id+'/versions','POST',{content_hash:artifact.content_hash,facts});
  await qc.cancelQueries({queryKey:['case',c.id]});
  qc.setQueryData(['case',c.id],(previous:any)=>previous?{...previous,artifacts:[updated,...previous.artifacts.filter((item:any)=>item.id!==updated.id)]}:previous);
  await qc.invalidateQueries({queryKey:['case',c.id]});
  notify('时间线已保存为 v'+updated.version+'，原版本和材料原文已保留。');
 }
 if(kind==='evidence')return <><div className="section-heading"><div><h2>证据分析与待核事项</h2><p className="muted">逐案提取证据、核对法院评价，再对照本案材料提出取证建议。</p></div></div><EvidencePanel c={c} artifact={a} api={api} source={source} refresh={()=>qc.invalidateQueries({queryKey:['case',c.id]})} status={a?<ArtifactStatus a={a}/>:null} citations={(ids,sources)=><CitationText text={ids.map(id=>'['+id+']').join(' ')} sources={sources}/>}/></>;
 return <><TimelinePanel key={c.id} artifact={a} materials={c.materials} eventTypes={c.artifacts.filter((item:any)=>item.kind==='timeline').flatMap((item:any)=>(item.structured.facts||[]).map((fact:any)=>fact.kind))} status={a?<ArtifactStatus a={a}/>:null} source={source} onSave={saveTimeline}/><GoalBox c={c} initial="按时间顺序整理本案，保留原文依据和待核实事项。" workflow="case.timeline"/></>;
}

function SearchPage(){return <div className="page"><div className="page-heading"><div><span className="eyebrow">检索 · 比较 · 溯源</span><h1>类案检索</h1><p className="muted">自然语言、关键词或案号。每一条结果，都能回到原文核对。</p></div></div><SearchPanel/></div>}
function SearchPanel({c}:any){const {act,source,notify}=useApp();const [req,setReq]=useState({query:'',mode:'hybrid',filters:{} as FilterSelection,date_from:'',date_to:''});const [result,setResult]=useState<any>(null);const [busy,setBusy]=useState(false);const [selection,setSelected]=useState<string[]|null>(c?.selected_doc_ids?.length?c.selected_doc_ids:null);const selected=selection??(c?defaultCaseIds(result?.items||[]):[]);const [showFilters,setShowFilters]=useState(false);const searchVersion=useRef(0);
function resetSearch(){searchVersion.current++;setBusy(false);setResult(null)}
async function search(){if(req.date_from&&req.date_to&&req.date_from>req.date_to){notify('起始日期不得晚于结束日期');return}const version=++searchVersion.current;setBusy(true);await act(async()=>{const data=await api('/search','POST',{...req,date_from:req.date_from||null,date_to:req.date_to||null});if(version===searchVersion.current)setResult(data)});if(version===searchVersion.current)setBusy(false)}
return <>{c&&<div className="card research-selection-summary"><div className="section-heading"><strong>已选 {selected.length} / 5 个类案</strong><button className="text-button" disabled={!selected.length} type="button" onClick={()=>setSelected([])}>清空选择</button></div><p className="small muted">默认选择前 {DEFAULT_CASE_ANALYSIS_COUNT} 个不同类案，可调整为 1–5 个；未指定时使用当前类案列表或检索排名前 {DEFAULT_CASE_ANALYSIS_COUNT} 项。</p>{selected.map(id=><div className="research-selected" key={id}><button className="text-button" type="button" onClick={()=>source({source_kind:'judgment',doc_id:id,name:'已选类案'})}>{result?.items.find((i:any)=>i.document_id===id)?.title||id}</button><button type="button" className="text-button danger" aria-label={'移除类案 '+id} onClick={()=>setSelected(selected.filter(x=>x!==id))}>移除</button></div>)}<button className="button secondary" disabled={selected.length>5} type="button" onClick={()=>act(async()=>{await api('/cases/'+c.id+'/research-selections','PUT',{doc_ids:selected});qc.invalidateQueries({queryKey:['case',c.id]});notify('已保存本轮研究选案。')})}>保存选案（最多 5 个）</button></div>}<form className="card search-panel" onSubmit={e=>{e.preventDefault();search()}}><div className="search-input-line"><Search size={21}/><input aria-label="类案检索问题" value={req.query} onChange={e=>{setReq({...req,query:e.target.value});resetSearch()}} placeholder="描述争议事实、证据或输入完整案号" required minLength={2}/><button className="button primary" disabled={busy}>{busy?<LoaderCircle className="spin" size={16}/>:null}{busy?'检索中…':'检索类案'}</button></div><div className="search-options"><select aria-label="检索方式" value={req.mode} onChange={e=>{setReq({...req,mode:e.target.value});resetSearch()}}><option value="hybrid">语义 + 关键词</option><option value="keyword">精确关键词</option><option value="case_number">完整案号</option></select><button type="button" className="text-button" onClick={()=>setShowFilters(!showFilters)}><Settings2 size={15}/>筛选条件{Object.keys(req.filters).length>0&&<span className="filter-badge">{Object.keys(req.filters).length}</span>}</button><span>{isDemo?'6 份虚构文书 · 本地示例':'2025 年 6 月来源 · 50,000 份文书'}</span></div><SearchFilters expanded={showFilters} filters={req.filters} dateFrom={req.date_from} dateTo={req.date_to} api={api} onChange={filters=>{setReq(previous=>({...previous,filters}));resetSearch()}} onDates={(date_from,date_to)=>{setReq(previous=>({...previous,date_from,date_to}));resetSearch()}}/></form>{result&&<><div className="search-summary"><strong>{result.candidate_count} 条候选文书</strong><span>已按文书去重 · {result.elapsed_ms} ms</span><Tag tone={result.degraded?'amber':'blue'}>{result.retrieval_mode==='hybrid'?'混合检索':result.retrieval_mode==='exact'?'案号匹配':'词面检索'}</Tag></div>{result.warnings.map((s:string)=><div className="notice warning" key={s}><AlertCircle size={16}/>{s}</div>)}{result.items.map((item:any)=><div className="card search-result" key={item.document_id}><div className="result-header"><span className="result-number">{String(item.rank).padStart(2,'0')}</span><div><h3><button className="text-button" onClick={()=>source({source_kind:'judgment',doc_id:item.document_id,name:item.title,quote:item.quote})}>{item.title}</button></h3><div className="case-meta"><span>{item.case_number}</span><span>{item.court}</span><span>{item.judgment_date}</span></div></div>{c&&<label className="checkline"><input type="checkbox" checked={selected.includes(item.document_id)} disabled={!selected.includes(item.document_id)&&selected.length>=5} onChange={e=>setSelected(e.target.checked?[...selected,item.document_id]:selected.filter(x=>x!==item.document_id))}/>选入研究</label>}</div><blockquote>{item.quote}</blockquote><div className="result-footer"><Tag>{item.cause||'案由未载明'}</Tag><span>{item.section} · 来源行 {item.source_row}</span><button className="text-button" onClick={()=>source({source_kind:'judgment',doc_id:item.document_id,name:item.title,quote:item.quote})}>核对全文 <ArrowRight size={14}/></button></div></div>)}{!result.items.length&&<Empty icon={Search} title="当前条件下未找到结果">筛选条件没有自动放宽。可修改条件后重新检索。</Empty>}{c&&<div className="sticky-actions"><span>已选 {selected.length} / 5 个类案</span><button className="button primary" disabled={selected.length>5} onClick={()=>act(async()=>{await api('/cases/'+c.id+'/research-selections','PUT',{doc_ids:selected});qc.invalidateQueries({queryKey:['case',c.id]});notify('已保存研究来源。新的研究任务将使用这些案例。')})}>保存选案</button></div>}</>}{!result&&<div className="search-hint"><Database size={22}/><div><strong>检索到的是研究线索</strong><p>请打开原文核对事实、争点与裁判理由。无结果不会自动放宽您的筛选条件。</p></div></div>}</>}

function Research({c}:any){
 const {source,notify}=useApp();
 const location=useLocation();
 const focusedId=new URLSearchParams(location.search).get('run');
 const refresh=()=>Promise.all([qc.invalidateQueries({queryKey:['case',c.id]}),qc.invalidateQueries({queryKey:['cases']})]);
 async function exportWord(a:any,save:boolean){
  if(isDemo){const doc=await api('/artifacts/'+a.id+'/reference-documents','POST',{content_hash:a.content_hash});if(save)notify('示例研究文档已保存到材料中心。');else demoDownload('/api/v1/reference-documents/'+doc.id+'/download');return;}
  const response=await fetch('/api/v1/artifacts/'+a.id+'/reference-documents',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({content_hash:a.content_hash,include_answers:true,save_to_materials:save,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone})});
  if(!response.ok)throw new Error((await response.json()).detail||'文档生成失败');
  if(save){await response.json();notify('当前研究报告与追问记录已保存到材料中心。')}
  else{const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');link.href=url;link.download='类案研究与诉讼策略_v'+a.version+'.docx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 }
 return <>
  <div className="section-heading research-heading"><div><h2>结果与研究</h2><p className="muted">与 AI 连续讨论本案，查看有来源的回复和研究进展。</p></div>
   <Link className="text-button" to={'/cases/'+c.id+'/tasks'}>查看任务记录 <ArrowRight size={14}/></Link>
  </div>
  <ResearchPanel key={c.id} c={c} focusedRunId={focusedId} api={api} source={source} refresh={refresh} exportWord={exportWord} render={a=><><Markdown body={a.body} sources={a.sources}/><Sources sources={a.sources}/></>} status={a=><ArtifactStatus a={a}/>} citations={(ids,sources)=><CitationText text={ids.map(id=>'['+id+']').join(' ')} sources={sources}/>}/>
 </>;
}
function Sources({sources}:any){const {source}=useApp();return <details className="source-list"><summary>来源索引 · {sources.length} 条</summary>{sources.map((s:any)=><button className="source-item" key={s.id} onClick={()=>source(s)}><span className="citation">[{s.id}]</span><span>{s.name}<small>{s.location} · {s.source_kind==='judgment'?'公共裁判文书':s.source_kind==='law'?'法源快照':'本案材料'}</small></span><ChevronRight size={14}/></button>)}</details>}

function Documents({c}:any){
 const {notify,source}=useApp();
 return <DocumentsPanel c={c} api={api} notify={notify} source={source}
   refresh={()=>qc.invalidateQueries({queryKey:['case',c.id]})}
   renderBody={a=><Markdown body={a.body} sources={a.sources}/>}
   renderStatus={a=><ArtifactStatus a={a}/>}
   renderSources={a=><Sources sources={a.sources}/>}/>;
}

function Tasks({c}:any){
 const [open,setOpen]=useState('');
 const {hash}=useLocation();
 useEffect(()=>{if(hash)document.getElementById(hash.slice(1))?.scrollIntoView({block:'nearest'})},[hash]);
 return <>
  <div className="section-heading"><div><h2>任务记录</h2><p className="muted">记录后台长时间任务的进度、状态与执行详情。研究交互在“结果与研究”中处理，文书起草与修改在“文书草稿”中完成。</p></div></div>
  {!c.runs.length?<Empty icon={Activity} title="尚无任务"><Link to={'/cases/'+c.id+'/research'}>前往结果与研究 <ArrowRight size={14}/></Link></Empty>:c.runs.map((r:any)=><article className="card run-card" id={'run-'+r.id} key={r.id} aria-label={'任务记录：'+r.goal}>
   <div className="run-header"><span className={'run-icon '+r.status}>{r.status==='running'?<LoaderCircle className="spin" size={21}/>:r.status==='succeeded'?<CheckCircle2 size={21}/>:r.status==='waiting_input'?<CircleHelp size={21}/>:<Clock3 size={21}/>}</span><div><h3>{r.goal}</h3><span className="small muted">{fmt(r.created_at)} · {r.stage}</span></div><Tag tone={r.status==='failed'?'red':r.status==='waiting_input'?'amber':r.status==='succeeded'?'green':'blue'}>{statusNames[r.status]}</Tag></div>
   <div className="run-plan">{r.plan?.map((p:string,i:number)=><React.Fragment key={p}>{i>0&&<ChevronRight size={13}/>}<span>{({'case.timeline':'整理事实','evidence.gaps':'分析证据','evidence.followup':'核查补充证据','case.assess':'研究路径','research.followup':'继续研究','document.generate':'起草文书'} as any)[p]||p}</span></React.Fragment>)}</div>
   {r.error&&<div className="notice warning"><AlertCircle size={16}/>{r.error}</div>}
   {r.status==='waiting_input'&&<div className="notice warning run-attention" role="status"><CircleHelp size={16}/><p>等待您在“{r.plan.includes('document.generate')?'文书草稿':'结果与研究'}”中{r.wait_payload?.kind==='case_selection'?'选择类案并继续分析':'选择下一步研究内容'}。</p></div>}
   <div className="run-actions"><Link className="text-button" to={r.plan.includes('document.generate')?'/cases/'+c.id+'/documents?run='+r.id:researchRunUrl(c.id,r.id)}>{r.plan.includes('document.generate')?'打开文书草稿':r.status==='waiting_input'?'前往结果与研究继续':'打开结果与研究'} <ArrowRight size={14}/></Link><button type="button" className="text-button" aria-expanded={open===r.id} aria-controls={'details-'+r.id} onClick={()=>setOpen(open===r.id?'':r.id)}>执行详情 <ChevronRight size={14}/></button></div>
   {open===r.id&&<div id={'details-'+r.id}><RunDetail id={r.id}/></div>}
  </article>)}
 </>;
}
function RunDetail({id}:any){const q=useQuery({queryKey:['run',id],queryFn:()=>api('/runs/'+id),refetchInterval:3000});useEffect(()=>{if(isDemo)return;const s=new EventSource('/api/v1/runs/'+id+'/events');s.addEventListener('progress',()=>qc.invalidateQueries({queryKey:['run',id]}));return()=>s.close()},[id]);return <div className="run-detail">{q.data?.events.map((e:any)=><div key={e.seq}><span>{fmt(e.created_at)}</span><span>{e.payload.stage||e.payload.error||e.type}</span></div>)}<p className="small muted">配置 {q.data?.config_id} · 恢复次数 {q.data?.recovery_count} · 模型调用 {q.data?.model_calls.length}</p></div>}
function SettingsPage(){const {act,notify}=useApp();const q=useQuery({queryKey:['configs'],queryFn:()=>api('/admin/configurations')});const [f,setF]=useState<any>(null);const [tid,setTid]=useState('');const [tested,setTested]=useState('');const [reviewed,setReviewed]=useState(false);const test=useQuery({queryKey:['config-test',tid],queryFn:()=>api('/admin/configurations/tests/'+tid),enabled:!!tid,refetchInterval:(q:any)=>['queued','running'].includes(q.state.data?.status)?2000:false});useEffect(()=>{if(q.data&&!f)setF(q.data[0].content)},[q.data]);if(!f)return <Loading/>;const valid=test.data?.status==='passed'&&tested===JSON.stringify(f);const update=(key:string,value:string)=>{setF({...f,[key]:value});setReviewed(false)};return <div className="page"><div className="page-heading"><div><span className="eyebrow">有依据的专业表达</span><h1>写作配置</h1><p className="muted">调整表达方式。来源检查、权限与流程规则始终由程序执行。</p></div><Tag tone="blue">当前发布 v{q.data?.[0].version}</Tag></div><div className="settings-grid"><div className="card settings-form"><h2>文风与内容组织</h2><div className="two-cols"><label>默认读者<select value={f.audience} onChange={e=>update('audience',e.target.value)}><option>客户</option><option>内部律师</option></select></label><label>内容详略<select value={f.length} onChange={e=>update('length',e.target.value)}><option>简洁</option><option>标准</option><option>详细</option></select></label></div><label>表达方式<input value={f.tone} onChange={e=>update('tone',e.target.value)}/></label><label>开头说明<textarea rows={2} value={f.opening} onChange={e=>update('opening',e.target.value)}/></label><label>写作提示词<textarea rows={5} value={f.prompt} onChange={e=>update('prompt',e.target.value)}/></label><label>写作技能<textarea rows={5} value={f.skill} onChange={e=>update('skill',e.target.value)}/></label><div className="config-model"><span>批准模型</span><code>{f.model}</code></div><button className="button secondary" disabled={['queued','running'].includes(test.data?.status)} onClick={()=>act(async()=>{const t=await api('/admin/configurations/tests','POST',f);setTid(t.id);setTested(JSON.stringify(f));setReviewed(false)})}><Activity size={16}/>运行固定样例</button></div><div><div className="card settings-preview"><h2>试运行与发布</h2><p className="muted">{isDemo?'示例预览展示固定输出，不调用模型。配置修改后需要重新试运行。':'使用真实模型运行固定样例，验证金额与待核事项。配置修改后旧测试自动失效。'}</p>{test.data?<><Tag tone={valid?'green':'amber'}>{test.data.status==='queued'?'等待执行':test.data.status==='running'?'正在试运行':valid?'试运行通过':tested!==JSON.stringify(f)?'内容已变化，请重新测试':'测试未通过'}</Tag><div className="preview-output">{test.data.result?.output?.text||test.data.result?.error||'等待模型结果…'}</div></>:<Empty icon={Activity} title="尚未试运行"/>}<label className="checkline"><input type="checkbox" checked={reviewed} disabled={!valid} onChange={e=>setReviewed(e.target.checked)}/>已比较输出并确认保留事实与限定</label><button className="button primary" disabled={!valid||!reviewed} onClick={()=>act(async()=>{await api('/admin/configurations/publish','POST',{content:f,test_id:tid,base_version:q.data[0].version,reviewed});qc.invalidateQueries({queryKey:['configs']});notify('新配置已发布。已开始的任务继续使用其原版本。');setReviewed(false)})}>发布新版本<ArrowRight size={16}/></button></div><div className="card history-card"><h3><History size={18}/>发布历史</h3>{q.data?.map((v:any)=><div className="version-row" key={v.id}><span><strong>v{v.version}</strong><small>{fmt(v.created_at)}</small></span><button className="text-button" onClick={()=>{setF(v.content);setTid('');setReviewed(false);notify('已载入历史内容。重新试运行后可发布为新版本。')}}>载入此版</button></div>)}</div><div className="notice subtle"><ShieldCheck size={18}/><span>核查规则尚未获得法律审核。证据分析显示为工作建议，不发布为法定要求。</span></div></div></div></div>}

function SourcePanel({reference:s,trigger,onClose}:any){
 const panel=useRef<HTMLElement>(null);
 usePanelFocus(panel,false,trigger);
 const path=s.source_kind==='case_material'?'/materials/'+s.doc_id:s.source_kind==='judgment'?'/judgments/'+s.doc_id:'/law-sources';
 const q=useQuery({queryKey:['source',path],queryFn:()=>api(path)});
 let body='',title=s.name||'来源原文',sub='';
 if(q.data){
  const d=q.data;
  if(s.source_kind==='law'){
   const law=d.find((x:any)=>x.id===s.id);
   body=law?.text||s.quote||'';title=law?.title||title;
   sub='官方条文快照 · 适用性与时效待律师核对';
  }else{
   body=d.text||d.content||'';title=d.name||d.title||title;
   sub=s.source_kind==='judgment'?[d.case_number,d.court,d.judgment_date].filter(Boolean).join(' · '):'材料版本 v'+d.version+' · '+(s.location||'原文');
  }
 }
 const quote=s.quote;
 const exactStart=quote&&Number.isInteger(s.start)&&s.start>=0&&body.slice(s.start,s.start+quote.length)===quote?s.start:-1;
 const start=quote?(exactStart>=0?exactStart:body.indexOf(quote)):-1;
 return <section ref={panel} tabIndex={-1} className="card source-panel" aria-label="来源原文" aria-busy={q.isPending}>
  <header><span><BookOpen size={18}/>来源核对</span><button className="button" aria-label="关闭来源" onClick={onClose}>收起原文<X size={16}/></button></header>
  {q.isPending?<Loading/>:q.isError?<div className="source-error" role="alert"><AlertCircle size={20}/><div><h3>来源暂时无法读取</h3><p>{q.error.message}</p><button className="button" disabled={q.isFetching} onClick={()=>q.refetch()}>{q.isFetching?'正在重试…':'重试读取'}</button></div></div>:<>
   <div className="source-title"><Tag tone="blue">{s.source_kind==='judgment'?(isDemo?'虚构文书示例':'真实裁判文书'):s.source_kind==='law'?'法源快照':'案件材料'}</Tag><h2>{title}</h2><p>{sub}</p>{s.source_kind==='judgment'&&<p className="small muted">本地完整原文可核对；此数据未提供已验证的公开发布网址。</p>}{s.url&&<a href={s.url} rel="noreferrer">官方来源<ExternalLink size={14}/></a>}</div>
   {quote&&<div className="quote-card"><span className="eyebrow">引用片段</span><p>{quote}</p></div>}
   <div className="source-fulltext" tabIndex={0} aria-label="来源全文">{start<0?body:<>{body.slice(0,start)}<mark>{quote}</mark>{body.slice(start+quote.length)}</>}</div>
  </>}
 </section>;
}

installDemoDownloads();
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={qc}><HashRouter><App/></HashRouter></QueryClientProvider></React.StrictMode>);
