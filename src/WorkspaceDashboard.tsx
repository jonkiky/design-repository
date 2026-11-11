import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, Clock3, Database, FileText, FolderOpen, ListTree, Plus, Search, ShieldCheck, Sparkles} from 'lucide-react';
import {isDemo} from './demo';

const statuses:Record<string,{label:string;tone:string;group:string}>={
  needs_materials:{label:'待添加材料',tone:'neutral',group:'prepare'},ready_to_research:{label:'待开始研究',tone:'neutral',group:'prepare'},
  queued:{label:'等待执行',tone:'blue',group:'running'},running:{label:'研究中',tone:'blue',group:'running'},
  waiting_input:{label:'待您选择',tone:'amber',group:'attention'},failed:{label:'待处理',tone:'red',group:'attention'},
  succeeded:{label:'已完成研究',tone:'green',group:'complete'},cancelled:{label:'已取消',tone:'neutral',group:'prepare'},
};
const groups=[['prepare','准备与整理'],['running','正在研究'],['attention','需要处理'],['complete','研究完成']];
export default function WorkspaceDashboard({api}:{api:(path:string)=>Promise<any>}){
  const cases=useQuery<any[]>({queryKey:['cases'],queryFn:()=>api('/cases'),refetchInterval:5000});
  const health=useQuery({queryKey:['health'],queryFn:()=>api('/health'),refetchInterval:60000});
  const list=cases.data||[];const corpus=health.data?.corpus;
  const attention=list.filter(c=>statuses[c.work_status]?.group==='attention');
  const latest=list[0];
  const counts=groups.map(([id,label])=>({id,label,count:list.filter(c=>statuses[c.work_status]?.group===id).length}));
  const metrics=[{title:'裁判文书',value:corpus?.documents,unit:'份',note:isDemo?'用于体验的虚构研究样本':'当前接入的研究样本',icon:Database},
    {title:'原文片段',value:corpus?.passages,unit:'段',note:'让每条引用有迹可循',icon:BookOpen},
    {title:'我的案件',value:cases.data?.length,unit:'件',note:'材料与成果，集中管理',icon:FolderOpen},
    {title:'待处理案件',value:cases.data?attention.length:undefined,unit:'件',note:'需要您的选择与确认',icon:Clock3}];
  return <div className="page studio-dashboard">
    <section className="studio-hero">
      <div className="hero-copy"><div className="hero-kicker"><span/>您的法律研究工作空间</div><h1>让复杂案情，<br/><em>有据可循。</em></h1><p>从第一份材料，到下一步判断。<br className="mobile-break"/>在裁研，专注每一次研究。</p>
        <div className="hero-actions"><Link className="button primary" to="/cases?new=1"><Plus size={17}/>新建案件</Link><Link className="hero-secondary" to="/search">检索参考类案<ArrowUpRight size={18}/></Link></div>
      </div>
      <div className="hero-aside"><span className="hero-date">{new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</span>
        <div className="hero-art" aria-hidden="true"><i/><i/><i/><span>研</span><b/><b/></div><span className="hero-art-caption">材料 · 事实 · 依据 · 判断</span>
      </div>
    </section>
    <section className="studio-metrics" aria-label="工作区数据概览">{metrics.map(({title,value,unit,note,icon:Icon},i)=><article key={title} className="studio-metric" aria-label={title}>
      <div className="studio-metric-title"><span>{title}</span><Icon size={17}/></div><div className="studio-metric-value"><strong>{typeof value==='number'?value.toLocaleString('zh-CN'):'—'}</strong><small>{unit}</small>{i===3&&!!value&&<span className="metric-attention">待关注</span>}</div><p>{note}</p>
    </article>)}</section>
    {(cases.isError||health.isError)&&<div className="notice warning" role="alert">部分工作区数据暂时无法读取。<button className="text-button" onClick={()=>{cases.refetch();health.refetch()}}>重新读取</button></div>}
    <div className="studio-work-grid">
      <section className="studio-recent" aria-labelledby="recent-cases-title"><div className="studio-section-title"><div><span className="section-index">01</span><h2 id="recent-cases-title">继续手头的工作</h2></div><Link to="/cases">全部案件<ArrowUpRight size={16}/></Link></div>
        <div className="studio-case-list">{cases.isPending?<p className="studio-empty">正在读取案件…</p>:cases.isError?<p className="studio-empty">案件暂时无法读取，请使用上方入口重新读取。</p>:list.length?list.slice(0,4).map((c,i)=><Link className="studio-case" to={'/cases/'+c.id+'/overview'} key={c.id}><span className="studio-case-no">{String(i+1).padStart(2,'0')}</span><div><h3>{c.title}</h3><p>{c.position} <span>·</span> {c.material_count} 份材料 <span>·</span> {new Date(c.updated_at).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})} 更新</p></div><span className={'tag '+(statuses[c.work_status]?.tone||'neutral')}>{statuses[c.work_status]?.label||'待开始'}</span><ArrowUpRight size={19}/></Link>):<div className="studio-empty"><FolderOpen size={28}/><h3>为第一个案件建立空间</h3><p>添加材料，开始一段有依据的研究。</p><Link className="button" to="/cases?new=1">新建案件<Plus size={15}/></Link></div>}</div>
      </section>
      <aside className="studio-attention" aria-label="案件研究进展"><div className="studio-section-title"><div><span className="section-index">02</span><h2>工作进展</h2></div><span className="live-label"><i/>实时更新</span></div>
        <div className="progress-summary"><strong>{cases.data?counts.find(c=>c.id==='complete')?.count||0:'—'}<small>/{cases.data?list.length:'—'}</small></strong><span>案件已完成研究</span></div>
        <div className="progress-segments" aria-hidden="true">{counts.map(c=><span className={c.id} key={c.id} style={{flex:Math.max(c.count,.08)}}/>)}</div>
        <div className="studio-status-list">{counts.map(c=><div key={c.id}><span><i className={c.id}/>{c.label}</span><strong>{cases.data?c.count.toString().padStart(2,'0'):'—'}</strong></div>)}</div>
        {attention[0]?<Link className="attention-link" to={'/cases/'+attention[0].id+'/tasks'}><Clock3 size={16}/><span>{attention.length} 件案件等待处理</span><ArrowRight size={16}/></Link>:<div className="attention-link"><CheckCircle2 size={16}/>{cases.isPending?'正在读取案件进展…':cases.isError?'案件进展暂时无法读取':'当前没有待处理事项'}</div>}
      </aside>
    </div>
    <section className="studio-tools" aria-label="研究工具"><div className="studio-section-title"><div><span className="section-index">03</span><h2>把研究向前推进</h2></div><span>从资料到成果，每一步相互关联</span></div>
      <div className="studio-tool-grid">{[
        {title:'类案检索',desc:'从事实和争点出发，寻找裁判依据',to:'/search',icon:Search,num:'01'},
        {title:'案情时间线',desc:'串联关键节点，回看每一份材料',to:latest?'/cases/'+latest.id+'/timeline':'/cases',icon:ListTree,num:'02'},
        {title:'结果与研究',desc:'与研究助手讨论，让判断更清晰',to:latest?'/cases/'+latest.id+'/research':'/cases',icon:Sparkles,num:'03'},
        {title:'文书起草',desc:'依据材料成稿，在复核中不断完善',to:latest?'/cases/'+latest.id+'/documents':'/cases',icon:FileText,num:'04'},
      ].map(({title,desc,to,icon:Icon,num})=><Link className="studio-tool" key={title} to={to}><div><Icon size={22}/><ArrowUpRight size={18}/></div><h3>{title}</h3><p>{desc}</p><span>{num}</span></Link>)}</div>
    </section>
    <footer className="studio-footer"><span><ShieldCheck size={14}/>材料有序 · 来源可查 · 判断由您</span><span>{isDemo?'设计体验 · 所有示例均为虚构':'本地研究工作空间'}</span></footer>
  </div>;
}
