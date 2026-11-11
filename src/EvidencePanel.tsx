import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {ArrowRight, CheckCircle2, FileSearch, FileText, LoaderCircle, MessageSquare, RotateCcw, Scale, Send} from 'lucide-react';
import ReferenceDocuments from './ReferenceDocuments';
import {DEFAULT_CASE_ANALYSIS_COUNT, defaultCaseIds, distinctCases} from './caseSelection';
import './evidence.css';

type Props = {c:any; artifact:any; api:(path:string,method?:string,body?:any,headers?:Record<string,string>)=>Promise<any>;
  source:(ref:any)=>void; refresh:()=>void; status:ReactNode;
  citations:(ids:string[],sources:any[])=>ReactNode};
const statusLabel:Record<string,string>={queued:'等待分析',running:'正在分析',succeeded:'分析完成',failed:'分析失败',cancelled:'已取消'};
const fmt=(value:string)=>new Date(value).toLocaleString('zh-CN');
export default function EvidencePanel({c,artifact,api,source,refresh,status,citations}:Props){
  const latest=c.runs.find((r:any)=>r.plan?.includes('evidence.gaps'));
  const runId=latest?.id || artifact?.run_id;
  const [selection,setSelection]=useState<{version:number;ids:string[]}|null>(null);
  const [materialIds,setMaterialIds]=useState<string[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [asking,setAsking]=useState(false);
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState('');
  const [chatError,setChatError]=useState('');
  const [exportError,setExportError]=useState('');
  const [notice,setNotice]=useState('');
  const [question,setQuestion]=useState('');
  const questionInput=useRef<HTMLTextAreaElement>(null);
  const similar=useQuery({queryKey:['similar-cases',c.id],queryFn:()=>api('/cases/'+c.id+'/similar-cases'),refetchInterval:3000});
  const progress=useQuery({queryKey:['evidence-progress',runId],enabled:!!runId,
    queryFn:()=>api('/runs/'+runId+'/evidence'),
    refetchInterval:query=>['queued','running'].includes(query.state.data?.run_status)?1500:false});
  const batch=progress.data?.batch;
  const running=['queued','running'].includes(latest?.status)||['queued','running'].includes(progress.data?.run_status);
  const candidates=distinctCases(similar.data?.response?.items||[]);
  const version=similar.data?.version;
  const selected=selection&&selection.version===version?selection.ids:defaultCaseIds(candidates);
  const changed=selection!==null&&selection.version!==version;
  const scope=materialIds??c.materials.filter((m:any)=>m.status==='ready'&&m.kind!=='文书模板').map((m:any)=>m.id);
  const scopeChars=c.materials.filter((m:any)=>scope.includes(m.id)).reduce((n:number,m:any)=>n+m.characters,0);
  const invalidScope=!scope.length||scope.length>20||scopeChars>60000;
  const ready=!!similar.data?.response&&!similar.data.needs_analysis&&candidates.length>0;
  const view=artifact?.evidence_view;
  const questions=(view?.follow_up_details||view?.follow_up_questions?.map((question:string)=>({question,why_matters:''}))||[]).slice(0,10);
  const chatRuns=c.runs.filter((r:any)=>r.evidence_artifact_id===artifact?.id).slice().reverse();
  const chatRunning=chatRuns.some((r:any)=>['queued','running'].includes(r.status));
  const usable=artifact&&!artifact.stale&&artifact.checks.passed;
  useEffect(()=>{setQuestion('');setChatError('');setExportError('');setNotice('')},[artifact?.id]);
  useEffect(()=>{if(progress.data?.run_status==='succeeded')refresh()},[progress.data?.run_status]);
  async function start(){
    setBusy(true);setError('');
    try{
      await api('/cases/'+c.id+'/requests','POST',{
        goal:'根据本案诉求，对选定类案逐案分析证据，汇总已有证据、建议补充的证据及原因，并提出至多十个待核问题。',
        workflow:'evidence.gaps',material_ids:scope,evidence_selection:{similar_version:version,doc_ids:selected}});
      refresh();
    }catch(e){setError((e as Error).message);similar.refetch()}finally{setBusy(false)}
  }
  async function retry(id:string,chat=false){
    const setFailure=chat?setChatError:setError;
    setFailure('');
    try{await api('/runs/'+id+'/retry','POST');await progress.refetch();refresh()}catch(e){setFailure((e as Error).message)}
  }
  async function ask(event:React.FormEvent){
    event.preventDefault();setAsking(true);setChatError('');
    try{await api('/cases/'+c.id+'/requests','POST',{goal:question.trim(),workflow:'evidence.followup',evidence_artifact_id:artifact.id});setQuestion('');refresh()}
    catch(e){setChatError((e as Error).message)}finally{setAsking(false)}
  }
  async function exportWord(){
    setExporting(true);setExportError('');setNotice('');
    try{
      await api('/artifacts/'+artifact.id+'/reference-documents','POST',{content_hash:artifact.content_hash,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}, {'Idempotency-Key':crypto.randomUUID()});
      setNotice('Word 已保存到材料中心的“文书与研究文档”，可在下方下载。');refresh();
    }catch(e){setExportError((e as Error).message)}finally{setExporting(false)}
  }
  function openCase(item:any,agent?:any){source({source_kind:'judgment',doc_id:item.document_id,name:item.title,quote:agent?.sources?.[0]?.quote||item.quote||''})}
  function chooseQuestion(text:string){setQuestion(text);questionInput.current?.focus();questionInput.current?.scrollIntoView({behavior:'smooth',block:'center'})}
  return <div className="evidence-workspace">
    <ol className="evidence-steps" aria-label="证据分析步骤">
      {['选择类案','逐案分析','汇总证据与待核问题','继续追问与保存'].map((label,i)=><li key={label} className={(i===0||i===1&&(running||batch?.status==='succeeded')||i>=2&&artifact)?'active':''}><span>{i+1}</span>{label}</li>)}
    </ol>
    <section className="card evidence-coordinator" aria-label="选择分析类案">
      <div className="evidence-coordinator-heading"><div><span className="eyebrow">第一步 · 选择类案</span>
        <h2><Scale size={20}/>先选类案，再逐案分析</h2>
        <p>来自“类案”页已筛选并保留的结果，默认选择前 {DEFAULT_CASE_ANALYSIS_COUNT} 个不同案件。可重新选择，每轮最少 1 个、最多 5 个。</p></div>
        <Link className="button" to={'/cases/'+c.id+'/similar-cases'}>前往类案调整筛选<ArrowRight size={15}/></Link></div>
      {similar.isPending?<p role="status">正在读取已筛选类案…</p>:similar.isError?<div role="alert" className="notice warning">{similar.error.message}<button className="text-button" onClick={()=>similar.refetch()}>重试</button></div>:<>
        {!ready&&<div className="notice warning" role="status">{similar.data?.needs_analysis?'类案条件或案件资料已变化，请先在“类案”页重新分析。':similar.data?.response?'当前筛选结果没有可选类案，请调整筛选条件。':'请先在“类案”页设置筛选条件并完成分析。'}</div>}
        {!!candidates.length&&<>
          <div className="evidence-selection-meta"><span>筛选结果 {candidates.length} 个案件 · {similar.data?.analyzed_at&&fmt(similar.data.analyzed_at)}</span><strong aria-live="polite">已选 {selected.length} / 5</strong></div>
          {changed&&<p className="small warning" role="status">类案列表已更新，已恢复默认选择，请核对本轮范围。</p>}
          <div className="evidence-candidates" role="group" aria-label="本轮分析类案">{candidates.map((item:any,i:number)=><div key={item.document_id} className={'evidence-candidate '+(selected.includes(item.document_id)?'selected':'')}>
            <label className="checkline"><input type="checkbox" aria-label={'选择类案 '+item.title} checked={selected.includes(item.document_id)}
              disabled={!ready||running||busy||(!selected.includes(item.document_id)&&selected.length>=5)}
              onChange={e=>setSelection({version,ids:e.target.checked?[...selected,item.document_id]:selected.filter(id=>id!==item.document_id)})}/>
              <span><strong>{i+1}. {item.title}</strong><small>{item.case_number} · {item.court} · {item.judgment_date}</small></span></label>
            <button type="button" className="text-button" onClick={()=>openCase(item)}>核对原文</button></div>)}</div>
          <div className="evidence-selection-footer"><span className="small muted">{selected.length===5?'已达上限，取消一项后可更换类案。':selected.length===0?'至少选择 1 个类案后才能开始。':'可继续选择，最多 5 个类案。'}</span>
            <button className="text-button" disabled={running||busy||!ready} onClick={()=>setSelection({version,ids:defaultCaseIds(candidates)})}>恢复默认选择</button></div>
        </>}
      </>}
      <details className="evidence-material-scope"><summary>本轮材料范围 · {scope.length} 份</summary>
        {c.materials.filter((m:any)=>m.kind!=='文书模板').map((m:any)=><label className="checkline" key={m.id}><input type="checkbox" disabled={running||busy||m.status!=='ready'} checked={scope.includes(m.id)} onChange={e=>setMaterialIds(e.target.checked?[...scope,m.id]:scope.filter((id:string)=>id!==m.id))}/>{m.name}<span className="muted">{m.status==='ready'?`${m.characters.toLocaleString()} 字`:'尚未完整解析'}</span></label>)}
        <p className="small muted">最多 20 份可读材料、60,000 字。请核对本轮范围。</p>
      </details>
      {invalidScope&&<p className="small warning">请选择 1–20 份可读材料，合计不超过 60,000 字。</p>}
      {(error||progress.error)&&<div role="alert" className="notice warning">{error||(progress.error as Error)?.message}</div>}
      <button type="button" className="button primary evidence-start" disabled={busy||running||invalidScope||!ready||!selected.length||selected.length>5} onClick={start}>
        {busy||running?<LoaderCircle size={16} className="spin"/>:<ArrowRight size={16}/>}{running?'本轮分析中…':runId?`使用选定 ${selected.length} 个类案重新分析`:`开始分析 ${selected.length} 个类案`}</button>
    </section>
    {runId&&<section className="card evidence-coordinator" aria-label="类案证据分析进度" data-run-id={runId}>
      <span className="eyebrow">第二步 · 逐案分析</span><h2>逐案分析后汇总</h2>
      <p className="small muted">逐个保留证据分析和原文依据；全部选定类案完成后形成综合建议。重新分析保留历史成果。</p>
      <div className="evidence-stage" role="status" aria-live="polite">
        {running?<LoaderCircle size={16} className="spin"/>:batch?.status==='succeeded'?<CheckCircle2 size={16}/>:<FileSearch size={16}/>}
        <strong>{progress.data?.stage||latest?.stage||'读取分析进度…'}</strong>{batch&&<span>逐案响应 {batch.completed} / {batch.total}</span>}</div>
      {progress.data?.error&&<div className="notice warning">{progress.data.error}
        {progress.data.run_status==='failed'&&<button type="button" className="text-button" onClick={()=>retry(runId)}><RotateCcw size={14}/>恢复未完成分析</button>}</div>}
      {batch&&<>
        <div className="evidence-progress-track" aria-hidden="true"><span style={{width:`${batch.total?batch.completed/batch.total*100:0}%`}}/></div>
        <div className="evidence-agent-list">{batch.agents.map((agent:any)=>{
          const item=batch.candidates.find((x:any)=>x.document_id===agent.doc_id);
          return <article className="evidence-agent" key={agent.doc_id}>
            <div className="evidence-agent-line"><span className="evidence-agent-number">{agent.rank}</span>
              <div><button type="button" className="text-button" onClick={()=>openCase(item,agent)}>{item.title}</button><p>{item.case_number} · {item.court}</p></div>
              <span className={'tag '+(agent.status==='succeeded'?'green':agent.status==='failed'?'red':'blue')}>{statusLabel[agent.status]||agent.status}</span></div>
            {agent.error&&<p className="small danger">{agent.error}</p>}
            {agent.result&&<details className="evidence-agent-result"><summary>查看本案证据分析 · {agent.result.findings.length} 项</summary>
              <p className="small muted">{agent.coverage.partial?'分析原文节选':'已纳入本篇全文'} · {agent.coverage.included_characters.toLocaleString()} / {agent.coverage.total_characters.toLocaleString()} 字</p>
              {agent.result.findings.map((f:any)=><div key={f.id} className="evidence-finding"><strong>{f.evidence}</strong><span className="tag">初步判断 · {f.treatment}</span>
                <p>证明目的（待核对）：{f.fact}</p><p>模型解读（待核对）：{f.reasoning}</p>{f.treatment_quote&&<p>证据评价原文：{f.treatment_quote}</p>}
                {f.admission_note&&<p className="small muted">{f.admission_note}</p>}{citations(f.source_ids,agent.sources)}</div>)}
            </details>}
          </article>;
        })}</div>
        <p className="small muted">{batch.selection_mode?.startsWith('filtered')?'本轮使用“类案”页筛选后选定的案例。':'历史分析采用当时的选案范围。'}共 {batch.total} 个类案。</p>
      </>}
    </section>}
    {artifact&&<>
      <div className="section-heading evidence-summary-heading"><div><span className="eyebrow">第三步 · 综合证据</span><h2>综合证据分析</h2></div>
        {artifact.run_id!==runId&&<span className="tag amber">上一轮成果 · 当前轮尚未完成</span>}</div>
      {status}
      <section className="card evidence-existing" aria-label="已有证据与材料"><div className="section-heading"><h3>已有证据与材料</h3><span className="tag green">{view?.existing_evidence?.length||0} 份材料</span></div>
        <p className="small muted">以下为本轮已提供的材料及关联记载；材料中提及的证据仍需核对原件。</p>
        {view?.existing_evidence?.map((entry:any)=><article className="evidence-existing-item" key={entry.material_id}>
          <button className="text-button file-name" onClick={()=>source({source_kind:'case_material',doc_id:entry.material_id,name:entry.name})}><FileText size={17}/>{entry.name}</button>
          <p className="small muted">{entry.kind&&entry.kind+' · '}{entry.status}</p>
          {entry.issues?.length>0&&<p>关联核验事项：{entry.issues.join('；')}</p>}
          <details><summary>查看已有材料记载 · {entry.excerpts.length} 条</summary>{entry.excerpts.map((excerpt:any)=><blockquote key={excerpt.source_id}>{excerpt.quote}{citations([excerpt.source_id],artifact.sources)}</blockquote>)}</details>
        </article>)}
        {!view?.existing_evidence?.length&&<p className="muted">本轮未关联可展示的本案材料摘录，请核对分析范围。</p>}
      </section>
      <div className="section-heading"><h3>建议补充或核对的证据</h3><span className="small muted">具体材料、补证原因与获取渠道</span></div>
      <div className="evidence-grid">{view?.additional_evidence?.map((item:any,i:number)=><article className="card evidence-card" key={i}>
        <div className="section-heading"><span className="number">{String(i+1).padStart(2,'0')}</span><span className="tag amber">待补充或核对</span></div>
        <h3>{item.issue}</h3><p><strong>建议证据</strong> {item.evidence_needed}</p><p><strong>为何需要</strong> {item.why_needed}</p>
        {item.obtain_from&&<p><strong>获取渠道</strong> {item.obtain_from}</p>}
        <div className="next-step"><strong>下一步</strong><p>{item.next_step}</p></div>
        {!!item.material_source_ids.length&&<p>已有材料关联 {citations(item.material_source_ids,artifact.sources)}</p>}
        <div>{citations(item.source_ids.filter((id:string)=>!item.material_source_ids.includes(id)),artifact.sources)}</div>
      </article>)}</div>
      {questions.length>0&&<section className="card evidence-questions" aria-label="待核问题"><div className="section-heading"><h3>待核问题</h3><span className="tag">{questions.length} / 10</span></div>
        <ol>{questions.map((item:{question:string;why_matters:string},i:number)=><li key={i}><button type="button" onClick={()=>chooseQuestion(item.question)}>{item.question}<MessageSquare size={14}/></button>
          {item.why_matters&&<p className="evidence-question-reason">为何重要：{item.why_matters}</p>}</li>)}</ol>
      </section>}
      {view?.notices?.length>0&&<details className="evidence-limit-notes"><summary>分析范围说明</summary>{view.notices.map((text:string,i:number)=><p key={i}>{text}</p>)}</details>}
      <section className="card evidence-chat" aria-label="继续追问证据"><span className="eyebrow">第四步 · 继续追问</span><h2><MessageSquare size={19}/>继续追问证据</h2>
        <p className="small muted">围绕本轮证据、补证理由或证明目的继续提问。问答自动保留，回答可回到原文依据。</p>
        {!usable&&<div className="notice warning">本轮分析已过期或检查未通过，请重新分析后继续追问及生成文档。</div>}
        <div className="evidence-conversation" aria-live="polite">{chatRuns.map((run:any)=>{
          const answer=c.artifacts.find((a:any)=>a.kind==='evidence_answer'&&a.run_id===run.id);
          return <article className="evidence-chat-turn" key={run.id}><div className="evidence-chat-question"><strong>我的追问</strong><p>{run.goal}</p><time>{fmt(run.created_at)}</time></div>
            <div className="evidence-chat-answer">{answer?.checks.passed?<><strong>证据分析回答</strong>{answer.structured.paragraphs?.map((p:any,i:number)=><p key={i}>{p.text} {citations(p.source_ids,answer.sources)}</p>)}{answer.structured.limitations?.map((text:string,i:number)=><p className="small muted" key={i}>{text}</p>)}</>:answer?<p className="warning">此回答已停止展示，请核对来源与内容问题。</p>:<p><span>{statusLabel[run.status]||run.status}</span>{['queued','running'].includes(run.status)&&<LoaderCircle size={14} className="spin"/>}{run.error&&<span className="warning"> · {run.error}</span>}{run.status==='failed'&&<button className="text-button" onClick={()=>retry(run.id,true)}>重试回答</button>}</p>}</div>
          </article>;
        })}</div>
        <form onSubmit={ask}><label htmlFor="evidence-question">证据相关问题<textarea ref={questionInput} id="evidence-question" rows={3} maxLength={3000} value={question} disabled={!usable} onChange={e=>setQuestion(e.target.value)} placeholder="例如：为什么需要这份材料？现有聊天记录能说明什么，还应补充哪些原件？"/></label>
          {chatError&&<div className="notice warning" role="alert">{chatError}</div>}
          <div className="evidence-chat-footer"><span className="small muted">{chatRunning?'正在生成回答，完成后可继续提问。':'回答基于本轮分析及相关原文。'}</span><button className="button primary" disabled={!usable||asking||chatRunning||question.trim().length<2}>{asking||chatRunning?<LoaderCircle className="spin" size={15}/>:<Send size={15}/>}提交追问</button></div>
        </form>
      </section>
      <section className="card evidence-export" aria-label="生成证据参考文档"><div><h3><FileText size={19}/>保存为 Word 参考文档</h3><p className="small muted">包含已有证据与材料、补证清单（证据、获取渠道、为何需要）和待核问题。按生成时间归档到案件材料。</p></div>
        <button type="button" className="button primary" disabled={!usable||exporting} onClick={exportWord}>{exporting?<LoaderCircle size={16} className="spin"/>:<FileText size={16}/>}生成 Word 并保存</button>
        {exportError&&<div className="notice warning" role="alert">{exportError}</div>}{notice&&<p role="status" className="notice">{notice}<Link to={'/cases/'+c.id+'/materials'}>查看案件材料</Link></p>}
      </section>
    </>}
    <ReferenceDocuments documents={(c.reference_documents||[]).filter((d:any)=>d.kind==='evidence')} api={api} refresh={async()=>{refresh()}} compact/>
  </div>;
}
