import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowRight, BookOpen, CheckCircle2, ChevronRight, Clock3, Database, FileText, FolderOpen, ListTree, LoaderCircle, Search, ShieldCheck} from 'lucide-react';
import './dashboard.css';

type WorkStatus = 'needs_materials' | 'ready_to_research' | 'queued' | 'running' | 'waiting_input' | 'succeeded' | 'failed' | 'cancelled';
type CaseSummary = {id:string; title:string; position:string; material_count:number; updated_at:string; work_status:WorkStatus};
const workStatuses:Record<WorkStatus,{label:string; tone:string; group:string}> = {
 needs_materials:{label:'待添加材料',tone:'neutral',group:'preparing'},
 ready_to_research:{label:'待开始研究',tone:'neutral',group:'preparing'},
 queued:{label:'等待执行',tone:'blue',group:'running'},
 running:{label:'研究中',tone:'blue',group:'running'},
 waiting_input:{label:'待您选择',tone:'amber',group:'attention'},
 succeeded:{label:'研究已完成',tone:'green',group:'completed'},
 failed:{label:'任务失败 · 待处理',tone:'red',group:'attention'},
 cancelled:{label:'任务已取消',tone:'neutral',group:'preparing'},
};
const groups = [
 {id:'preparing',label:'待开始 / 待继续'},
 {id:'running',label:'研究中 / 等待执行'},
 {id:'attention',label:'待您处理'},
 {id:'completed',label:'研究已完成'},
];
const number = (value?:number) => typeof value==='number' ? value.toLocaleString('zh-CN') : '—';

export default function Dashboard({api}:{api:(path:string)=>Promise<any>}) {
 const cases=useQuery<CaseSummary[]>({queryKey:['cases'],queryFn:()=>api('/cases'),refetchInterval:5000});
 const health=useQuery({queryKey:['health'],queryFn:()=>api('/health'),refetchInterval:60000});
 const caseList=cases.isError?undefined:cases.data;
 const corpus=health.isError?undefined:health.data?.corpus;
 const counts=groups.map(group=>({...group,count:caseList?.filter(c=>workStatuses[c.work_status]?.group===group.id).length}));
 const attention=counts.find(group=>group.id==='attention')?.count;
 const metrics=[
  {label:'裁判文书',value:corpus?.documents,unit:'份',icon:Database,tone:'blue',hint:'已接入的裁判文书',pending:health.isPending},
  {label:'原文片段',value:corpus?.passages,unit:'段',icon:BookOpen,tone:'teal',hint:'可回看、核对的原文依据',pending:health.isPending},
  {label:'我的案件',value:caseList?.length,unit:'件',icon:FolderOpen,tone:'violet',hint:'集中管理材料与研究成果',pending:cases.isPending},
  {label:'待处理案件',value:attention,unit:'件',icon:Clock3,tone:'amber',hint:'需要您选择或处理失败任务',pending:cases.isPending},
 ];
 return <div className="page home dashboard">
  <div className="page-heading">
   <div><p className="muted greeting">欢迎回到裁研工作区</p><h1>案情有序，研究有据。</h1><p className="dashboard-intro">管理案件材料，梳理事实与证据，让类案研究与文书起草有据可循。</p></div>
   <span className="date-label">{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</span>
  </div>

  <section className="dashboard-metrics" aria-label="工作区数据概览">
   {metrics.map(({label,value,unit,icon:Icon,tone,hint,pending})=><article key={label} className="card dashboard-metric" aria-label={label} aria-busy={pending}>
    <div className="metric-heading"><span>{label}</span><span className={'metric-icon '+tone}><Icon size={19}/></span></div>
    <div className="metric-value"><strong>{number(value)}</strong><span>{unit}</span></div>
    <p>{pending?'正在读取…':value===undefined?'暂无法读取数据':hint}</p>
   </article>)}
  </section>
  {health.isError&&<div className="dashboard-notice" role="alert">研究资源统计暂时无法读取。<button className="text-button" disabled={health.isFetching} onClick={()=>health.refetch()}>重新读取</button></div>}
  {corpus&&<p className="dashboard-data-note"><Database size={13}/>统计范围为当前已接入的研究样本，可在类案检索中筛选并回看原文。</p>}

  <section className="dashboard-start" aria-labelledby="dashboard-start-title">
   <div className="section-heading"><div><h2 id="dashboard-start-title">从这里开始</h2><p className="muted">围绕手头的案件推进工作，或先查找值得参考的类案。</p></div></div>
   <div className="dashboard-entry-grid">
    <Link to="/cases" className="dashboard-entry cases-entry" aria-label="进入我的案件">
     <span className="entry-icon"><FolderOpen size={25}/></span>
     <div className="entry-copy"><span className="entry-kicker">把案件工作放在一起</span><h3>我的案件</h3><p>建立案件、上传材料，梳理案情与证据，逐步形成研究成果和文书草稿。</p>
      <div className="entry-features"><span><FileText size={14}/>材料归档</span><span><ListTree size={14}/>事实与证据</span><span><CheckCircle2 size={14}/>文书复核</span></div>
      <span className="entry-action">进入我的案件 <ArrowRight size={17}/></span>
     </div>
    </Link>
    <Link to="/search" className="dashboard-entry search-entry" aria-label="开始类案检索">
     <span className="entry-icon"><Search size={25}/></span>
     <div className="entry-copy"><span className="entry-kicker">为研究找到参考依据</span><h3>类案检索</h3><p>用案情描述、关键词或案号查找相关裁判，结合筛选条件，回到原文核对。</p>
      <div className="entry-features"><span><Search size={14}/>多种检索方式</span><span><ListTree size={14}/>条件筛选</span><span><BookOpen size={14}/>原文溯源</span></div>
      <span className="entry-action">开始类案检索 <ArrowRight size={17}/></span>
     </div>
    </Link>
   </div>
  </section>

  <section className="dashboard-progress" aria-labelledby="dashboard-progress-title">
   <div className="section-heading"><div><h2 id="dashboard-progress-title">案件进展</h2><p className="muted">掌握研究状态，接着上次的工作继续。</p></div><Link to="/cases">查看全部案件 <ArrowRight size={15}/></Link></div>
   {cases.isPending?<div className="card dashboard-loading" role="status"><LoaderCircle className="spin" size={20}/>正在读取案件进展…</div>
    :cases.isError?<div className="card dashboard-error" role="alert"><p>案件进展暂时无法读取，请重新尝试。</p><button className="button" disabled={cases.isFetching} onClick={()=>cases.refetch()}>重新读取案件</button></div>
    :caseList?.length?<div className="dashboard-progress-grid">
     <div className="card dashboard-recent"><div className="recent-heading"><h3>最近办理</h3><span>按案件更新时间排序</span></div>
      {caseList.slice(0,4).map(c=>{
       const status=workStatuses[c.work_status];
       return <Link key={c.id} to={'/cases/'+c.id+'/overview'} className="dashboard-case">
        <span className="dashboard-case-icon"><FolderOpen size={20}/></span>
        <div className="dashboard-case-copy"><h3>{c.title}</h3><p><span>{c.material_count} 份材料</span><span>更新于 {new Date(c.updated_at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span></p></div>
        <span className={'tag '+(status?.tone||'neutral')}>{status?.label||'状态待更新'}</span><ChevronRight size={16}/>
       </Link>;
      })}
     </div>
     <aside className="card dashboard-status" aria-label="案件状态分布"><div className="status-heading"><h3>办理概况</h3><span>{number(caseList.length)} 件案件</span></div><p>按当前研究进度汇总</p>
      <div className="status-bar" aria-hidden="true">{counts.filter(group=>group.count).map(group=><span key={group.id} className={group.id} style={{flex:group.count}}/>)}</div>
      <ul>{counts.map(group=><li key={group.id}><span><i className={group.id}/>{group.label}</span><strong>{number(group.count)}<small> 件</small></strong></li>)}</ul>
      <div className="status-caption"><ShieldCheck size={16}/><span>材料、研究过程与每一版成果，都保存在对应案件中。</span></div>
     </aside>
    </div>:<div className="card dashboard-empty"><span className="entry-icon"><FolderOpen size={28}/></span><div><h3>从您的第一个案件开始</h3><p>前往「我的案件」建立工作空间，添加材料后即可开展研究。</p></div><Link className="button primary" to="/cases">前往我的案件 <ArrowRight size={16}/></Link></div>}
  </section>
  <div className="page-foot"><ShieldCheck size={14}/>研究辅助成果须经律师复核；每条来源均可回看。</div>
 </div>;
}
