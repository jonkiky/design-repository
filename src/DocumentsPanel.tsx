import {useEffect, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link, useSearchParams} from 'react-router-dom';
import {AlertCircle, ArrowRight, Check, Download, FileText, LoaderCircle, PenLine, RotateCcw, Upload} from 'lucide-react';
import './documents.css';
import {isDemo, demoDownload} from './demo';

type Props={c:any;api:(path:string,method?:string,body?:any,headers?:Record<string,string>)=>Promise<any>;refresh:()=>Promise<unknown>;
  source:(s:any)=>void;notify:(message:string)=>void;renderBody:(a:any)=>ReactNode;renderStatus:(a:any)=>ReactNode;renderSources:(a:any)=>ReactNode};
const labels:Record<string,string>={complaint:'民事起诉状',opinion:'代理意见',client:'客户情况说明',internal:'内部研究报告'};
const statuses:Record<string,string>={queued:'等待阅读',running:'阅读中',succeeded:'已完成',failed:'阅读失败',unavailable:'来源已撤回'};

export default function DocumentsPanel({c,api,refresh,source,notify,renderBody,renderStatus,renderSources}:Props){
  const [params,setParams]=useSearchParams();
  const templates=useQuery({queryKey:['document-templates'],queryFn:()=>api('/document-templates')});
  const [kind,setKind]=useState('complaint');
  const [template,setTemplate]=useState('builtin:complaint');
  const [instructions,setInstructions]=useState('');
  const [revision,setRevision]=useState('');
  const [chosen,setChosen]=useState<string[]|null>(null);
  const [tasks,setTasks]=useState<Record<string,string>>({});
  const [selected,setSelected]=useState(params.get('artifact')||'');
  const [editing,setEditing]=useState(false);
  const [body,setBody]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const artifacts=c.artifacts.filter((a:any)=>a.kind==='document');
  const a=artifacts.find((item:any)=>item.id===selected)||artifacts[0];
  const available=c.materials.filter((m:any)=>m.kind!=='文书模板'&&m.id!==template);
  const ids=(chosen??available.filter((m:any)=>m.status==='ready').map((m:any)=>m.id)).filter((id:string)=>available.some((m:any)=>m.id===id));
  const readyTemplates=c.materials.filter((m:any)=>m.status==='ready');
  const documentRuns=c.runs.filter((r:any)=>r.plan.includes('document.generate'));
  const focused=documentRuns.find((r:any)=>r.id===params.get('run'))||documentRuns[0];
  const runArtifact=artifacts.find((item:any)=>item.run_id===focused?.id);
  const running=documentRuns.some((r:any)=>['queued','running'].includes(r.status));
  const file=c.reference_documents?.find((d:any)=>d.artifact_id===a?.id&&d.available);
  const count=ids.reduce((sum:number,id:string)=>sum+(available.find((m:any)=>m.id===id)?.characters||0),0);
  const selectedTemplate=templates.data?.find((t:any)=>t.id===template);
  useEffect(()=>{setEditing(false);setConfirmed(false);setRevision('')},[a?.id,a?.content_hash]);
  useEffect(()=>{if(params.get('artifact'))setSelected(params.get('artifact')!)},[params]);
  useEffect(()=>{if(params.get('run')&&runArtifact&&!editing)setSelected(runArtifact.id)},[params,runArtifact?.id,editing]);
  // A refresh may bring new versions; an open manual edit is never overwritten.
  const newer=!!a&&artifacts.some((x:any)=>x.parent_id===a.id);
  async function act(fn:()=>Promise<void>){
    if(busy)return;setBusy(true);setError('');
    try{await fn()}catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function generate(parent?:any){
    await act(async()=>{
      const input=parent?{document_artifact_id:parent.id,document_content_hash:parent.content_hash,
        document_type:parent.structured.document_type||kind,document_template_id:parent.structured.template?.id||template,
        material_ids:parent.structured.material_ids||ids,document_tasks:parent.structured.document_tasks||tasks,goal:revision.trim()}
        :{document_type:kind,document_template_id:template,material_ids:ids,
          document_tasks:Object.fromEntries(ids.filter((id:string)=>tasks[id]?.trim()).map((id:string)=>[id,tasks[id].trim()])),
          goal:instructions.trim()||'根据所选模板与案件材料起草'+labels[kind]};
      const run=await api('/cases/'+c.id+'/requests','POST',{...input,workflow:'document.generate'});
      setParams({run:run.id});await refresh();
      notify(parent?'修改要求已保存，完成后会保留为新版本。':'已开始阅读材料，文书与 Word 将自动保存。');
    });
  }
  async function upload(file:File){
    await act(async()=>{const form=new FormData();form.append('file',file);form.append('kind','文书模板');
      const result=await api('/cases/'+c.id+'/materials','POST',form);await refresh();
      if(result.status!=='ready')throw new Error('模板已保存至材料中心，请补齐可读正文后选择。');
      setTemplate(result.id);setChosen(null);notify('模板已保存至材料中心并选中。');
    });
  }
  function download(url:string){if(isDemo){demoDownload(url);return}const link=document.createElement('a');link.href=url;link.click()}
  return <div className="documents-workspace">
    <div className="section-heading"><div><h2>文书草稿</h2><p className="muted">选择模板与参考材料，在此起草、继续修改、复核和下载。每一版自动保存到材料中心。</p></div><Link className="text-button" to={'/cases/'+c.id+'/materials'}>材料中心 <ArrowRight size={15}/></Link></div>
    <form className="card document-composer" onSubmit={e=>{e.preventDefault();generate()}}>
      <div className="document-step"><span>1</span><h3>选定文书模板</h3></div>
      <div className="two-cols"><label>文书类型<select aria-label="文书类型" value={kind} disabled={busy} onChange={e=>{setKind(e.target.value);if(template.startsWith('builtin:'))setTemplate('builtin:'+e.target.value)}}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>文书模板<select aria-label="文书模板" value={template} disabled={busy} onChange={e=>{setTemplate(e.target.value);setChosen(null)}}>
          <optgroup label="内置起草模板"><option value={'builtin:'+kind}>{labels[kind]} · 内置模板</option></optgroup>
          <optgroup label="材料中心中的文件">{readyTemplates.map((m:any)=><option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
        </select></label></div>
      <div className="document-template-actions"><label className={'button upload-label'+(busy?' disabled':'')}><Upload size={15}/>上传模板<input aria-label="上传文书模板" type="file" accept=".docx,.pdf,.txt,.md" disabled={busy||running} onChange={e=>{if(e.target.files?.[0])upload(e.target.files[0]);e.target.value=''}}/></label>
        {!template.startsWith('builtin:')&&<button type="button" className="text-button" onClick={()=>source({source_kind:'case_material',doc_id:template})}>查看模板原文</button>}
        <span className="small muted">可使用 Word、PDF 或文本模板。模板与案件事实分别选择。</span></div>
      {selectedTemplate&&<details><summary>查看模板结构</summary><pre className="template-preview">{selectedTemplate.text}</pre></details>}
      {!template.startsWith('builtin:')&&<p className="small muted">Word 的标题样式、文本的“## 标题”或 {'{{填写项}}'} 用于确定章节；Word 填写项模板可保留原表格与段落布局。</p>}
      {templates.isError&&<div role="alert">模板说明暂时无法读取。<button type="button" className="text-button" onClick={()=>templates.refetch()}>重试</button></div>}
      <div className="document-step"><span>2</span><h3>选择参考材料与阅读重点</h3></div>
      <div className="document-materials">{available.map((m:any)=><div className="document-material" key={m.id}>
        <label className="checkline"><input type="checkbox" disabled={busy||m.status!=='ready'} checked={ids.includes(m.id)} onChange={e=>setChosen(e.target.checked?[...ids,m.id]:ids.filter((id:string)=>id!==m.id))}/><span>{m.name}<small className="muted">{m.characters} 字 · {m.status==='ready'?'可读取':'需补正文'}</small></span></label>
        <button type="button" className="text-button" onClick={()=>source({source_kind:'case_material',doc_id:m.id})}>查看原文</button>
        {ids.includes(m.id)&&<input className="material-focus" aria-label={'阅读重点：'+m.name} maxLength={600} value={tasks[m.id]||''} onChange={e=>setTasks({...tasks,[m.id]:e.target.value})} placeholder="阅读重点（可选），例如合同金额、付款记录、履行期限"/>}
      </div>)}{!available.length&&<p className="muted">请先在材料中心添加本案参考材料。</p>}</div>
      <p className="small muted">已选 {ids.length} 份 / {count.toLocaleString()} 字 · 各份材料独立查找，收齐后按模板汇总。</p>
      <div className="document-step"><span>3</span><h3>补充起草要求</h3></div>
      <label>起草要求<textarea aria-label="文书起草要求" maxLength={3000} rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="例如：从原告立场起草，重点说明交付期限与付款情况；缺失身份信息保留待补充。"/></label>
      <div className="goal-footer"><span className="small muted">正文引用可打开原文核对；生成后可继续提出修改要求。</span><button className="button primary" disabled={busy||running||!ids.length||ids.length>20||count>60000}>{busy?<LoaderCircle size={16} className="spin"/>:<PenLine size={16}/>}起草文书</button></div>
    </form>
    {error&&<div className="notice warning" role="alert"><AlertCircle size={17}/>{error}</div>}
    {focused&&focused.status!=='waiting_input'&&<DocumentRun c={c} run={focused} api={api} refresh={refresh} source={source}/>}
    {a?<>
      <div className="section-heading"><h3>审阅文书</h3><span className="small muted">{file?'Word 已保存到材料中心':'此版本尚未保存 Word'}</span></div>
      <div className="document-toolbar"><select aria-label="选择文书版本" value={a.id} disabled={editing||busy} onChange={e=>{setSelected(e.target.value);setParams({artifact:e.target.value})}}>{artifacts.map((x:any)=><option key={x.id} value={x.id}>{x.title} · v{x.version} · {new Date(x.created_at).toLocaleString('zh-CN')}</option>)}</select>
        <button type="button" className="button" disabled={busy||(!editing&&(a.stale||newer))} onClick={()=>{setBody(a.body);setEditing(!editing)}}><PenLine size={15}/>{editing?'取消编辑':'编辑正文'}</button>
        {editing&&<button type="button" className="button primary" disabled={busy||!body.trim()} onClick={()=>act(async()=>{const next=await api('/artifacts/'+a.id+'/versions','POST',{body,content_hash:a.content_hash});setSelected(next.id);setParams({artifact:next.id});setEditing(false);await refresh();notify('新版本与 Word 已保存，复核状态已重置。')})}>保存新版本</button>}
      </div>
      {newer&&<div className="notice warning" role="status">此文书已有更新版本。请在版本列表中选择最新版后继续修改。</div>}
      {renderStatus(a)}
      <div className="document-grid"><div className="card report">{editing?<textarea className="document-editor" aria-label="编辑文书正文" value={body} onChange={e=>setBody(e.target.value)}/>:renderBody(a)}</div>
        <aside className="review-sidebar"><div className="card review-card"><FileText size={24}/><h3>复核与下载</h3><p>逐段核对材料原文与待补事项。可下载 Word 草稿进行审阅。</p>
          <label className="checkline"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>我已复核当前版本及其来源</label>
          <button className="button secondary" disabled={busy||!confirmed||a.stale||!a.checks.passed||editing} onClick={()=>act(async()=>{await api('/artifacts/'+a.id+'/reviews','POST',{content_hash:a.content_hash,confirmed:true});await refresh();notify('当前版本复核已记录。')})}><Check size={16}/>记录复核</button>
          <button className="button primary" disabled={busy||editing||!a.checks.passed||(!file&&a.stale)} onClick={()=>act(async()=>{let saved=file;if(!saved){saved=await api('/artifacts/'+a.id+'/reference-documents','POST',{content_hash:a.content_hash,include_answers:false,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone},{'Idempotency-Key':crypto.randomUUID()});await refresh()}download('/api/v1/reference-documents/'+saved.id+'/download')})}><Download size={16}/>下载 Word{a.review_status==='reviewed'?'':' 草稿'}</button>
          <button className="text-button" disabled={a.review_status!=='reviewed'||a.stale||editing} onClick={()=>download('/api/v1/artifacts/'+a.id+'/export')}>导出 Markdown</button>
        </div>{renderSources(a)}
        {a.structured.template&&<div className="card document-template-note"><h4>本版模板</h4><p>{a.structured.template.name}</p><p className="small muted">{a.structured.instructions}</p>{a.structured.template.source&&<button className="text-button" onClick={()=>source(a.structured.template.source)}>核对模板</button>}</div>}</aside>
      </div>
      <form className="card document-revision" onSubmit={e=>{e.preventDefault();generate(a)}}><h3>继续修改这份文书</h3><p className="small muted">以当前 v{a.version} 正文为基础，重新核对原材料并保存新版本。也可直接编辑正文。</p><label>修改要求<textarea aria-label="文书修改要求" maxLength={3000} rows={3} value={revision} onChange={e=>setRevision(e.target.value)} placeholder="例如：保留诉讼请求，将事实与理由按时间顺序重写，并补上每笔付款的来源。"/></label><button className="button primary" disabled={busy||running||editing||newer||a.stale||!a.sources.length||revision.trim().length<2}><PenLine size={16}/>按要求修改文书</button></form>
      {!!a.structured.conversation?.length&&<details className="card document-history"><summary>起草与修改要求 · {a.structured.conversation.length} 次</summary>{a.structured.conversation.map((turn:any,i:number)=><p key={turn.run_id||i}>{i+1}. {turn.instructions}</p>)}</details>}
    </>:<div className="empty"><FileText size={30}/><h3>按模板形成第一份文书</h3><p>选定材料与起草要求后，文书会在此显示并自动保存到材料中心。</p></div>}
  </div>;
}

function DocumentRun({c,run,api,refresh,source}:any){
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const q=useQuery({queryKey:['document-progress',run.id,run.status],queryFn:()=>api('/runs/'+run.id+'/document'),refetchInterval:['queued','running'].includes(run.status)?2500:false});
  async function control(action:string){setBusy(true);setError('');try{await api('/runs/'+run.id+'/'+action,'POST');await refresh();await q.refetch()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const active=['queued','running'].includes(run.status);
  return <section className="card document-progress" aria-label="文书生成进展" aria-live="polite"><div className="section-heading"><h3>{active?<LoaderCircle size={17} className="spin"/>:<FileText size={17}/>} {run.stage}</h3><Link className="text-button" to={'/cases/'+c.id+'/tasks#run-'+run.id}>执行记录 <ArrowRight size={14}/></Link></div>
    <p className="small muted">{run.goal}</p>
    <div className="document-agent-list">{q.data?.agents.map((agent:any)=><details key={agent.material_id}><summary><span>{agent.rank}. {agent.name}</span><span className={'tag '+(agent.status==='failed'?'red':agent.status==='succeeded'?'green':'blue')}>{statuses[agent.status]}</span></summary>
      {agent.error&&<p role="alert">{agent.error}</p>}{agent.result?.findings.map((finding:any,i:number)=><p key={i}><strong>{finding.section}：</strong>{finding.summary} {finding.source_ids.map((id:string)=><button key={id} className="citation" onClick={()=>source(agent.sources.find((s:any)=>s.id===id))}>[{id}]</button>)}</p>)}{agent.result&&<p className="small muted">已读取全文 {agent.result.characters_read} 字</p>}</details>)}</div>
    {(run.error||error||q.isError)&&<div className="notice warning" role="alert">{error||run.error||q.error?.message}</div>}
    <div className="inline">{q.isError&&<button className="text-button" onClick={()=>q.refetch()}>重新读取进展</button>}{run.status==='failed'&&<button disabled={busy} className="button" onClick={()=>control('retry')}><RotateCcw size={15}/>恢复原任务</button>}{active&&<button disabled={busy} className="text-button danger" onClick={()=>control('cancel')}>取消任务</button>}</div>
  </section>;
}
