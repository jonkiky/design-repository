import {useState} from 'react';
import {Download, FileText, Trash2} from 'lucide-react';
import {Link, useParams} from 'react-router-dom';

export default function ReferenceDocuments({documents,api,refresh,compact=false}:{documents:any[];api:(path:string,method?:string)=>Promise<any>;refresh:()=>Promise<unknown>;compact?:boolean}){
  const {caseId}=useParams();
  const [deleting,setDeleting]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function remove(id:string){
    setBusy(true);setError('');
    try{await api('/reference-documents/'+id,'DELETE');setDeleting('');await refresh()}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  if(compact&&!documents.length)return null;
  return <section className="reference-documents" aria-label={compact?'生成的参考文档':'文书与研究文档'}>
    <div className="section-heading"><div><h2>{compact?'生成的参考文档':'文书与研究文档'}</h2><p className="muted">按版本保存的 Word 文书与研究资料，可返回对应成果继续复核和修改。</p></div><span className="tag">{documents.length} 份</span></div>
    {error&&<p role="alert" className="notice warning">{error}</p>}
    {!documents.length?<p className="muted">在“文书草稿”起草后会自动保存，也可从证据分析或结果与研究保存 Word。</p>:documents.map(doc=><article className="card reference-document" key={doc.id}>
      <div className="section-heading"><div><h3><FileText size={18}/>{doc.name}</h3><p className="small muted">{doc.kind==='document'?'文书草稿':doc.kind==='research'?'研究报告':'证据分析'} · v{doc.version} · {new Date(doc.created_at).toLocaleString('zh-CN')}{doc.kind!=='document'&&<> · {doc.answer_count} 次追问</>}</p></div><div className="inline">
        {doc.kind==='document'&&<Link className="button" to={'/cases/'+caseId+'/documents?artifact='+doc.artifact_id}>查看与修改文书</Link>}
        {doc.available?<a className="button" href={'/api/v1/reference-documents/'+doc.id+'/download'}><Download size={15}/>下载 Word</a>:<span className="tag red">来源不可用</span>}
        <button className="text-button danger" type="button" disabled={busy} onClick={()=>{setDeleting(doc.id);setError('')}}><Trash2 size={15}/>删除文档</button>
      </div></div>
      <p className="small muted">对应{doc.kind==='document'?'文书':'分析'}时间 {new Date(doc.analysis_created_at).toLocaleString('zh-CN')}{doc.kind==='document'&&<> · {doc.review_status==='reviewed'?'已复核':'待复核'}</>}</p>
      {doc.stale&&<p className="small muted">这是历史资料范围的文档，请核对当前材料后使用。</p>}
      {deleting===doc.id&&<div className="notice warning" role="group" aria-label="确认删除文档"><span>删除“{doc.name}”？研究成果与对话记录仍会保留。</span><button type="button" className="button" disabled={busy} onClick={()=>setDeleting('')}>取消</button><button type="button" className="button danger-solid" disabled={busy} onClick={()=>remove(doc.id)}>{busy?'正在删除…':'确认删除文档'}</button></div>}
    </article>)}
  </section>;
}
