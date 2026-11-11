import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useLocation, useNavigate} from 'react-router-dom';
import {ArrowUp, CheckCircle2, Download, FileText, LoaderCircle, Maximize2, MessageSquare, Minimize2, PanelRightClose, PanelRightOpen, Plus, Scale} from 'lucide-react';
import ResearchRunPanel, {researchRunUrl} from './ResearchRunPanel';
import ResearchSetup, {ResearchPrompts, useResearchScope} from './ResearchSetup';
import {useLayoutPreference} from './workspaceLayout';
import './research.css';

type Props={c:any;focusedRunId?:string|null;api:(path:string,method?:string,body?:any)=>Promise<any>;refresh:()=>Promise<unknown>;
  source:(ref:any)=>void;render:(a:any)=>ReactNode;status:(a:any)=>ReactNode;
  citations:(ids:string[],sources:any[])=>ReactNode;exportWord:(a:any,save:boolean)=>Promise<void>};
const labels:Record<string,string>={queued:'等待分析',running:'正在分析',succeeded:'分析完成',failed:'分析失败'};
const active=(run:any)=>['queued','running'].includes(run?.status);
function ancestors(artifact:any,versions:any[]){
  const chain:any[]=[];
  while(artifact&&!chain.some(a=>a.id===artifact.id)){
    chain.push(artifact);artifact=versions.find(a=>a.id===artifact.parent_id);
  }
  return chain;
}

export default function ResearchPanel({c,focusedRunId,api,refresh,source,render,status,citations,exportWord}:Props){
  const navigate=useNavigate();
  const location=useLocation();
  const fresh=new URLSearchParams(location.search).get('new')==='1';
  const versions=c.artifacts.filter((a:any)=>a.kind==='research');
  const [version,setVersion]=useState('');
  const [question,setQuestion]=useState('');
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [sourcesCollapsed,setSourcesCollapsed]=useLayoutPreference('caiyan.research.sourcesCollapsed');
  const [expanded,setExpanded]=useState(false);
  const [expandedSourcesCollapsed,setExpandedSourcesCollapsed]=useState(true);
  const panelCollapsed=expanded?expandedSourcesCollapsed:sourcesCollapsed;
  const setPanelCollapsed=expanded?setExpandedSourcesCollapsed:setSourcesCollapsed;
  const workspace=useRef<HTMLDivElement>(null);
  const input=useRef<HTMLTextAreaElement>(null);
  const messages=useRef<HTMLDivElement>(null);
  const scope=useResearchScope(c,api);
  const requested=c.runs.find((r:any)=>r.id===focusedRunId);
  const current=requested||(!fresh?c.runs.find((r:any)=>r.status!=='waiting_input'&&r.plan?.some((p:string)=>['case.assess','research.followup'].includes(p))):undefined);
  const chosen=versions.find((a:any)=>a.id===version);
  // A new/failed run must never silently display another conversation's report.
  const a=chosen||(!fresh&&(current
    ?versions.find((a:any)=>ancestors(a,versions).some(v=>v.run_id===current.id))||versions.find((a:any)=>a.id===current.research_artifact_id)
    :versions[0]));
  const chain=a?ancestors(a,versions):[];
  const first=chain[chain.length-1];
  const origin=c.runs.find((r:any)=>r.id===first?.run_id)||(current?.plan?.includes('case.assess')?current:undefined);
  const chatRun=a?c.runs.find((r:any)=>r.research_artifact_id===a.id):undefined;
  const running=c.runs.some((r:any)=>active(r)&&r.plan?.some((p:string)=>['case.assess','research.followup'].includes(p)));
  const progress=useQuery({queryKey:['research-progress',origin?.id],enabled:!!origin?.id,
    queryFn:()=>api('/runs/'+origin.id+'/research'),refetchInterval:active(origin)?1500:false});
  const batch=progress.data?.batch;
  const fixedInput=useQuery({queryKey:['research-input',origin?.id],enabled:!!origin?.id&&!a,
    queryFn:()=>api('/runs/'+origin.id)});
  const frozen=fixedInput.data?.snapshot;
  const sourceRefs=a?.sources||[
    ...(frozen?.material_ids||[]).map((id:string)=>({source_kind:'case_material',doc_id:id,name:c.materials.find((m:any)=>m.id===id)?.name||'本轮材料'})),
    ...(frozen?.selected_doc_ids||[]).map((id:string)=>{
      const item=(batch?.candidates||scope.candidates).find((i:any)=>i.document_id===id);
      return {source_kind:'judgment',doc_id:id,name:item?.title||'选定类案',case_number:item?.case_number};
    }),
  ];
  const turnRun=chosen?c.runs.find((r:any)=>r.id===a.run_id):current;
  const showRun=turnRun&&(!!focusedRunId||active(turnRun)||turnRun.status==='failed');
  const canSend=question.trim().length>=2&&!busy&&!running&&current?.status!=='waiting_input'&&
    (a?!a.stale&&a.checks.passed:scope.valid);
  useEffect(()=>{setVersion('');setError('')},[focusedRunId,fresh]);
  useEffect(()=>{if(progress.data?.run_status==='succeeded')void refresh()},[origin?.id,progress.data?.run_status]);
  useEffect(()=>{if(origin&&['succeeded','failed','cancelled'].includes(origin.status))void progress.refetch()},[origin?.id,origin?.status]);
  useEffect(()=>{messages.current?.scrollTo({top:messages.current.scrollHeight,behavior:'smooth'})},[a?.id,current?.id,current?.status]);
  useEffect(()=>{
    if(!expanded)return;
    const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    workspace.current?.focus({preventScroll:true});
    function keyboard(event:KeyboardEvent){
      if(event.isComposing||event.defaultPrevented)return;
      const sourcePanel=document.querySelector<HTMLElement>('.workspace-source');
      if(event.key==='Escape'){
        event.preventDefault();
        if(sourcePanel)sourcePanel.querySelector<HTMLButtonElement>('[aria-label="关闭来源"]')?.click();
        else setExpanded(false);
      }
      if(event.key==='Tab'){
        const surface=sourcePanel||workspace.current;
        const focusable=Array.from(surface?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')||[])
          .filter(node=>node.getClientRects().length&&getComputedStyle(node).visibility!=='hidden');
        const first=focusable[0],last=focusable.at(-1);
        if(!first){event.preventDefault();surface?.focus();return}
        if(event.shiftKey&&(document.activeElement===first||!focusable.includes(document.activeElement as HTMLElement))){event.preventDefault();last?.focus()}
        else if(!event.shiftKey&&(document.activeElement===last||!focusable.includes(document.activeElement as HTMLElement))){event.preventDefault();first.focus()}
      }
    }
    window.addEventListener('keydown',keyboard);
    return ()=>{
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',keyboard);
      if(trigger?.isConnected)trigger.focus({preventScroll:true});
    };
  },[expanded]);
  async function act(key:string,fn:()=>Promise<void>){
    if(busy)return;
    setBusy(key);setError('');
    try{await fn();await refresh()}catch(e){setError((e as Error).message)}finally{setBusy('')}
  }
  function newChat(){setVersion('');setQuestion('');setError('');navigate('/cases/'+c.id+'/research?new=1');input.current?.focus()}
  function send(){
    if(!canSend)return;
    void act('send',async()=>{
      const body=a?{workflow:'research.followup',goal:question.trim(),research_artifact_id:a.id}
        :{workflow:'case.assess',goal:question.trim(),...scope.request};
      const run=await api('/cases/'+c.id+'/requests','POST',body);
      setQuestion('');setVersion('');navigate(researchRunUrl(c.id,run.id));
    });
  }
  return <div ref={workspace} tabIndex={expanded?-1:undefined} role={expanded?'region':undefined} aria-label={expanded?'全屏研究工作区':undefined} className={'research-chat-workspace'+(panelCollapsed?' sources-collapsed':'')+(expanded?' is-fullscreen':'')}>
    <section className="card research-conversation" aria-label="研究对话">
      <header className="research-conversation-header"><div><MessageSquare size={19}/><strong>与 AI 讨论本案</strong></div><div className="research-chat-actions">
        <button type="button" className="text-button research-new-chat" aria-label="新对话" title="新对话" disabled={!!busy||running} onClick={newChat}><Plus size={16}/><span>新对话</span></button>
        <button type="button" className="icon-button" aria-label={panelCollapsed?'展开研究过程与来源':'收起研究过程与来源'} title={panelCollapsed?'展开研究过程与来源':'收起研究过程与来源'} aria-expanded={!panelCollapsed} aria-controls="research-process-sources" onClick={()=>setPanelCollapsed(!panelCollapsed)}>{panelCollapsed?<PanelRightOpen size={18}/>:<PanelRightClose size={18}/>}</button>
        <button type="button" className="icon-button research-expand" aria-label={expanded?'退出全屏聊天':'全屏聊天'} title={expanded?'退出全屏聊天（Esc）':'全屏聊天'} aria-pressed={expanded} onClick={()=>{if(!expanded)setExpandedSourcesCollapsed(true);setExpanded(!expanded)}}>{expanded?<Minimize2 size={17}/>:<Maximize2 size={17}/>}<span>{expanded?'还原':'全屏'}</span></button>
      </div></header>
      <div ref={messages} className="research-messages" role="log" aria-label="研究对话记录" aria-live="polite">
        {!a&&!current?<div className="research-welcome"><span className="research-welcome-icon"><Scale size={28}/></span><h3>您想先讨论什么？</h3><p>结合所选材料与类案，比较争点、核对证据，或一起梳理下一步。<br/>研究过程和来源可在右侧查看。</p><ResearchPrompts disabled={!!busy||running} onSelect={text=>{setQuestion(text);input.current?.focus({preventScroll:true})}}/></div>:<>
          {(origin||current)&&<article className="research-message user"><span className="research-speaker">您</span><div>{origin?.goal||current.goal}</div></article>}
          {a&&<>
            <article className="research-message assistant"><span className="research-speaker">裁研 AI</span><div className="research-answer">
              {(a.structured.conversation||[]).length?<details className="research-original"><summary>查看首次研究回复</summary>{render(first)}</details>:render(a)}
            </div></article>
            {(a.structured.conversation||[]).map((turn:any,i:number)=><div key={i} className="research-chat-turn">
              <article className="research-message user"><span className="research-speaker">您</span><div>{turn.question}</div></article>
              <article className="research-message assistant"><span className="research-speaker">裁研 AI</span><div className="research-answer"><p>{turn.answer}</p>{i===a.structured.conversation.length-1&&<details className="research-revised" open><summary>查看更新后的完整研究</summary>{render(a)}</details>}</div></article>
            </div>)}
            <div className="research-result-tools"><div className="section-heading"><strong>研究记录</strong><select aria-label="选择研究版本" value={a.id} onChange={e=>setVersion(e.target.value)}>{versions.map((v:any)=><option key={v.id} value={v.id}>v{v.version} · {new Date(v.created_at).toLocaleString('zh-CN')}{v.structured.refined_from?' · 追问完善':''}</option>)}</select></div>{status(a)}
              <div className="research-export"><button type="button" className="button" disabled={!!busy||running||a.stale||!a.checks.passed} onClick={()=>act('save',()=>exportWord(a,true))}><FileText size={15}/>{busy==='save'?'正在保存…':'保存 Word 到材料中心'}</button><button type="button" className="button" disabled={!!busy||running||a.stale||!a.checks.passed} onClick={()=>act('download',()=>exportWord(a,false))}><Download size={15}/>{busy==='download'?'正在生成…':'下载 Word 供审阅'}</button><Link to={'/cases/'+c.id+'/materials'}>查看材料中心</Link></div>
            </div>
          </>}
          {chatRun&&chatRun.status!=='succeeded'&&<article className="research-message user"><span className="research-speaker">您</span><div>{chatRun.goal}</div></article>}
          {(active(current)||active(chatRun))&&<article className="research-message assistant"><span className="research-speaker">裁研 AI</span><div role="status" className="research-thinking"><LoaderCircle size={17} className="spin"/><span>{a?'正在结合本轮来源回答…':'正在阅读所选材料与类案…'}<small>{a?'回答完成后会保留对话并更新研究记录。':'逐案分析完成后，将在这里回复。'}</small></span></div></article>}
          {current?.status==='waiting_input'&&<p className="notice">请在研究过程面板中完成选择，再继续本轮对话。</p>}
          {(current?.status==='failed'||chatRun?.status==='failed')&&<div className="notice warning research-chat-error" role="alert"><strong>本次回答未完成</strong><p>{chatRun?.error||current?.error}</p><span>可在研究过程面板恢复原任务；已完成的逐案分析会保留。</span></div>}
          {current?.status==='cancelled'&&<p className="notice">本轮研究已取消，可发送新问题开始研究。</p>}
        </>}
      </div>
      <form className="research-composer" onSubmit={e=>{e.preventDefault();send()}}>
        {error&&<p className="notice warning" role="alert">{error}</p>}
        {a?.stale&&<p className="notice warning">资料已变化，请开启新对话，使用当前材料重新研究。</p>}
        <label className="research-input-label" htmlFor="research-message-input">研究消息</label>
        <textarea id="research-message-input" ref={input} rows={3} value={question} maxLength={3000} onChange={e=>setQuestion(e.target.value)} placeholder={a?'继续提问，例如：这个类案的观点适用于本案吗？':'输入问题，和 AI 一起研究本案…'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send()}}}/>
        <div className="research-composer-footer"><span>{a?'依据本轮来源继续讨论':`${scope.caseIds.length} 个类案 · ${scope.materialIds.length} 份材料`}{!a&&!scope.valid?' · 请在来源面板确认选择':''}<small>回车发送 · 组合键换行</small></span><button className="button primary" type="submit" disabled={!canSend}>{busy==='send'?<LoaderCircle size={16} className="spin"/>:<ArrowUp size={17}/>}发送</button></div>
      </form>
    </section>
    {panelCollapsed&&<aside className="research-sidebar-rail" aria-label="已收起的研究过程与来源"><button type="button" aria-label="展开研究侧栏" title="展开研究过程与来源" aria-expanded={false} aria-controls="research-process-sources" onClick={()=>setPanelCollapsed(false)}><PanelRightOpen size={19}/><span className="research-rail-label">研究过程与来源</span>{batch&&<span className="research-rail-count" aria-label={`已完成 ${batch.completed} / ${batch.total} 个类案`}>{batch.completed}/{batch.total}</span>}{['waiting_input','failed'].includes(current?.status)&&<span className="research-rail-attention" role="status">待处理</span>}</button></aside>}
    <aside id="research-process-sources" className="research-sidebar" aria-label="研究过程与来源" hidden={panelCollapsed}>
      <div className="research-sidebar-title"><Scale size={17}/><strong>研究过程与来源</strong><button type="button" className="icon-button" aria-label="收起研究侧栏" title="收起研究过程与来源" aria-expanded={true} aria-controls="research-process-sources" onClick={()=>setPanelCollapsed(true)}><PanelRightClose size={17}/></button></div>
      {showRun&&<ResearchRunPanel key={turnRun.id} cid={c.id} run={turnRun} focused={false} api={api} refresh={refresh} source={source}/>}
      {progress.error&&<p className="notice warning" role="alert">{(progress.error as Error).message}<button type="button" className="text-button" onClick={()=>progress.refetch()}>重新加载进度</button></p>}
      <section className="card research-progress" aria-label="类案研究进度" data-run-id={origin?.id}>
        <div className="section-heading"><h3>{batch?.status==='succeeded'?<CheckCircle2 size={17}/>:<Scale size={17}/>}逐案研究</h3></div>
        {batch?<><p className="small muted" role="status">已完成 {batch.completed} / {batch.total} 个类案{batch.status==='synthesizing'?' · 正在综合研究':''}</p><div className="evidence-progress-track" aria-hidden="true"><span style={{width:`${batch.total?100*batch.completed/batch.total:0}%`}}/></div>
          {batch.agents.map((agent:any)=>{
            const item=batch.candidates.find((i:any)=>i.document_id===agent.doc_id);
            return <article key={agent.doc_id} className="evidence-agent"><div className="evidence-agent-line"><span className="evidence-agent-number">{agent.rank}</span><div><button type="button" className="text-button" onClick={()=>source({source_kind:'judgment',doc_id:agent.doc_id,name:item?.title})}>{item?.title||'类案 '+agent.rank}</button><p>{item?.case_number} · {item?.court}</p></div><span className={'tag '+(agent.status==='succeeded'?'green':agent.status==='failed'?'red':'blue')}>{labels[agent.status]}</span></div>
              {agent.error&&<p className="small danger">{agent.error}</p>}{agent.result&&<details className="evidence-agent-result"><summary>查看逐案研究 · {agent.result.findings.length} 项</summary><p className="small muted">{agent.coverage?.partial?'原文节选':'本篇全文'} · {agent.coverage?.included_characters} / {agent.coverage?.total_characters} 字</p>{agent.result.findings.map((f:any)=><div className="evidence-finding" key={f.id}><strong>{f.issue}</strong><p>事实：{f.facts}</p><p>裁判理由：{f.reasoning}</p><p>裁判结果：{f.outcome}</p>{citations(f.source_ids,agent.sources)}</div>)}{agent.result.limits.map((s:string,i:number)=><p className="small muted" key={i}>{s}</p>)}</details>}
            </article>;
          })}</>:<p className="small muted">{current?'正在准备本轮来源。进度将在这里更新。':'发送问题后，依次查看逐案分析、来源核查和综合回复的进展。'}</p>}
      </section>
      {a||active(current)||current?.status==='waiting_input'?<section className="card research-pinned-sources" aria-label="本轮研究依据"><h3>本轮研究依据</h3><p className="small muted">本轮来源已固定；更换材料或类案可开启新对话。</p>{fixedInput.isError&&<p className="notice warning" role="alert">本轮来源暂时无法读取。<button type="button" className="text-button" onClick={()=>fixedInput.refetch()}>重试</button></p>}{Array.from(new Map<string,any>(sourceRefs.filter((s:any)=>s.source_kind!=='law').map((s:any)=>[s.doc_id,s])).values()).map(s=><button type="button" className="research-pinned-source" key={s.doc_id} onClick={()=>source(s)}><FileText size={15}/><span>{s.name}<small>{s.source_kind==='judgment'?s.case_number:'本案材料'} · 核对原文</small></span></button>)}</section>
        :<ResearchSetup c={c} scope={scope} source={source} disabled={!!busy||running}/>}
    </aside>
  </div>;
}
