import {useEffect, useRef, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {AlertCircle, ArrowRight, CheckCircle2, CircleHelp, Clock3, LoaderCircle, RotateCcw} from 'lucide-react';
import {DEFAULT_CASE_ANALYSIS_COUNT, defaultCaseIds} from './caseSelection';
import './research.css';

type Candidate = {document_id:string; title:string; case_number:string; court:string; quote?:string};
export type ResearchRun = {
  id:string; goal:string; status:string; stage:string; error?:string; plan:string[]; created_at:string;
  wait_payload?:{kind:string; question:string; candidates?:Candidate[]; options?:string[]; default_doc_ids?:string[]};
};
type Props = {
  cid:string; run:ResearchRun; focused:boolean;
  workspace?:'research'|'documents';
  api:(path:string,method?:string,body?:any)=>Promise<any>;
  refresh:()=>Promise<unknown>; source:(ref:any)=>void;
};
const activeStatuses = ['queued','running','waiting_input'];
const labels:Record<string,string> = {
  queued:'等待执行', running:'研究中', waiting_input:'待您选择',
  succeeded:'已完成', failed:'执行失败', cancelled:'已取消',
};
const workflows:Record<string,string> = {
  'case.timeline':'时间线', 'evidence.gaps':'证据分析', 'case.assess':'类案研究', 'document.generate':'文书草稿',
};

// The main workspace shows current research. Older paused tasks are opened
// explicitly from task history; document tasks belong in the document workspace.
export function researchRuns(runs:ResearchRun[], focusedId:string|null) {
  const focused=runs.find(run=>run.id===focusedId);
  if(focused)return [focused];
  return runs.filter(run=>!run.plan.includes('document.generate')&&
    (run.plan.includes('case.assess')||run.plan.includes('research.followup'))&&
    ['queued','running'].includes(run.status));
}

export function researchRunUrl(cid:string, runId:string) {
  return '/cases/'+cid+'/research?run='+encodeURIComponent(runId);
}

export default function ResearchRunPanel({cid,run,focused,api,refresh,source,workspace='research'}:Props) {
  const navigate=useNavigate();
  const ref=useRef<HTMLElement>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(focused) {
      ref.current?.focus({preventScroll:true});
      ref.current?.scrollIntoView({block:'nearest'});
    }
  },[focused,run.id]);
  useEffect(()=>setError(''),[run.status]);
  async function submit(action:string,body?:any) {
    if(busy)return;
    setBusy(true);setError('');
    try {
      await api('/runs/'+run.id+'/'+action,'POST',body);
      await refresh();
    } catch(e) {setError((e as Error).message)}
    finally {setBusy(false)}
  }
  async function restart() {
    if(busy)return;
    setBusy(true);setError('');
    try {
      const next=await api('/cases/'+cid+'/requests','POST',{goal:run.goal});
      await refresh();
      navigate(researchRunUrl(cid,next.id));
    } catch(e) {setError((e as Error).message)}
    finally {setBusy(false)}
  }
  const active=activeStatuses.includes(run.status);
  const waiting=run.status==='waiting_input';
  const tone=waiting?'amber':run.status==='failed'?'red':run.status==='succeeded'?'green':'blue';
  const Icon=waiting?CircleHelp:run.status==='running'?LoaderCircle:run.status==='succeeded'?CheckCircle2:Clock3;
  const resultTab=run.plan.includes('document.generate')?'documents':run.plan.some(step=>step==='case.assess'||step==='research.followup')?'research':run.plan.some(step=>step==='evidence.gaps'||step==='evidence.followup')?'evidence':'timeline';
  return <section ref={ref} tabIndex={-1} className={'card research-run'+(waiting?' needs-input':'')}
    aria-label={'研究进展：'+run.goal} data-run-id={run.id} aria-busy={busy}>
    <header className="research-run-heading">
      <span className={'run-icon '+run.status}><Icon size={20} className={run.status==='running'?'spin':''}/></span>
      <div><span className="eyebrow">{waiting?'待处理任务':'本轮研究'}</span><h3>{run.goal}</h3></div>
      <span className={'tag '+tone}>{labels[run.status]||run.status}</span>
    </header>
    <p className="research-stage" role="status">{run.stage}</p>
    {['queued','running'].includes(run.status)&&<p className="small muted">研究在后台继续，本页会自动更新。需要您选择类案时，会在这里显示。</p>}
    {run.error&&<div className="notice warning"><AlertCircle size={16}/><span>{run.error}</span></div>}
    {waiting&&<ResearchQuestion key={JSON.stringify(run.wait_payload)} run={run} busy={busy} source={source}
      onAnswer={answer=>submit('resume',{answer})}/>}
    {error&&<div className="notice warning" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
    {['failed','cancelled'].includes(run.status)&&<p className="small muted">可恢复原任务，或在对话框发送新问题。</p>}
    <footer className="research-run-actions">
      <Link className="text-button" to={'/cases/'+cid+'/tasks#run-'+run.id}>查看执行记录 <ArrowRight size={14}/></Link>
      {run.status==='succeeded'&&resultTab!=='research'&&<Link className="text-button" to={'/cases/'+cid+'/'+resultTab}>查看成果 <ArrowRight size={14}/></Link>}
      {run.status==='failed'&&<button type="button" className="text-button" disabled={busy} onClick={()=>submit('retry')}><RotateCcw size={14}/>恢复原任务</button>}
      {['failed','cancelled'].includes(run.status)&&workspace==='research'&&<button type="button" className="text-button" disabled={busy} onClick={restart}><RotateCcw size={14}/>基于当前材料重试</button>}
      {active&&<button type="button" className="text-button danger" disabled={busy} onClick={()=>submit('cancel')}>取消任务</button>}
    </footer>
  </section>;
}

function ResearchQuestion({run,busy,source,onAnswer}:{run:ResearchRun;busy:boolean;source:Props['source'];onAnswer:(answer:any)=>Promise<void>}) {
  const [selected,setSelected]=useState<string[]>(()=>run.wait_payload?.default_doc_ids??defaultCaseIds(run.wait_payload?.candidates||[]));
  const wait=run.wait_payload;
  if(!wait)return <p className="notice">正在读取待选择内容…</p>;
  return <div className="waiting research-question">
    <h4><CircleHelp size={18}/>{wait.question}</h4>
    {wait.kind==='case_selection'?<>
      <p className="small muted">默认选择前 {DEFAULT_CASE_ANALYSIS_COUNT} 个不同类案，可核对原文后调整，最多 5 份。未选择类案也可继续，结果会标明资料限制。</p>
      {wait.candidates?.map(item=><div className="candidate" key={item.document_id}>
        <label className="checkline"><input type="checkbox" checked={selected.includes(item.document_id)}
          disabled={busy||(!selected.includes(item.document_id)&&selected.length>=5)}
          onChange={e=>setSelected(e.target.checked?[...selected,item.document_id]:selected.filter(id=>id!==item.document_id))}/>
          <span><strong>{item.title}</strong><small>{item.case_number} · {item.court}</small></span></label>
        <button type="button" className="text-button" onClick={()=>source({source_kind:'judgment',doc_id:item.document_id,name:item.title,quote:item.quote})}>查看原文</button>
      </div>)}
      {!wait.candidates?.length&&<p className="small muted">本轮未检索到候选类案，可继续形成有限研究。</p>}
      <button type="button" className="button primary" disabled={busy} onClick={()=>onAnswer({doc_ids:selected})}>
        {busy?<LoaderCircle size={16} className="spin"/>:<ArrowRight size={16}/>}
        {selected.length?'使用选定的 '+selected.length+' 份案例继续':'不选案例，继续有限研究'}
      </button>
    </>:wait.kind==='workflow'?<div className="inline">
      {wait.options?.map(workflow=><button type="button" key={workflow} className="button" disabled={busy}
        onClick={()=>onAnswer({workflow})}>{workflows[workflow]||workflow}</button>)}
    </div>:<p role="alert">暂不支持此待选择内容，请刷新页面后重试。</p>}
  </div>;
}
