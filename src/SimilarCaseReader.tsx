import {useEffect, useRef, type RefObject} from 'react';
import {createPortal} from 'react-dom';
import {useQuery} from '@tanstack/react-query';
import {AlertCircle, BookOpen, CheckCircle2, CircleMinus, LoaderCircle, Undo2, X} from 'lucide-react';

type Props = {
 item:any; api:(path:string)=>Promise<any>; excluded:boolean; canRestoreToList:boolean;
 saving:boolean; disabled:boolean; error:string; message:string;
 trigger:HTMLElement|null; fallback:RefObject<HTMLElement|null>;
 onClose:()=>void; onRelevance:(relevant:boolean)=>void;
};

export default function SimilarCaseReader({item,api,excluded,canRestoreToList,saving,disabled,error,message,trigger,fallback,onClose,onRelevance}:Props) {
 const panel=useRef<HTMLElement>(null);
 const path='/judgments/'+encodeURIComponent(item.document_id);
 const q=useQuery({queryKey:['source',path],queryFn:()=>api(path)});
 useEffect(()=>{
  panel.current?.focus({preventScroll:true});
  return ()=>{
   const target=trigger?.isConnected?trigger:fallback.current;
   target?.focus({preventScroll:true});
  };
 },[trigger,fallback]);
 const judgment=q.data;
 const body=judgment?.text||judgment?.content||'';
 const quote=item.quote||'';
 const start=quote?body.indexOf(quote):-1;
 return createPortal(<div className="similar-reader-layer"><aside id="similar-case-reader" ref={panel} className="similar-reader" aria-label="类案全文核对" tabIndex={-1}>
  <header className="similar-reader-header"><span><BookOpen size={16}/>核对全文{excluded&&<span className="tag amber">已移出 · 不相关</span>}</span><button type="button" className="icon-button" onClick={onClose} aria-label="关闭全文侧栏"><X size={19}/></button></header>
  <div className="similar-reader-scroll" aria-busy={q.isPending} tabIndex={0}>
   <div className="similar-reader-title">
    <h3>{judgment?.title||item.title}</h3><p>{[judgment?.case_number||item.case_number,judgment?.court||item.court,judgment?.judgment_date||item.judgment_date].filter(Boolean).join(' · ')}</p>
   </div>
   {q.isPending?<div className="similar-reader-loading" role="status"><LoaderCircle className="spin" size={20}/>正在读取裁判全文…</div>
    :q.isError?<div className="similar-reader-error" role="alert"><AlertCircle size={20}/><div><strong>全文暂时无法读取</strong><p>{q.error.message}</p><button type="button" className="button" disabled={q.isFetching} onClick={()=>q.refetch()}>重新读取全文</button></div></div>
    :<>{quote&&<details className="similar-reader-quote"><summary>查看检索片段</summary><p>{quote}</p></details>}
     <div className="similar-reader-fulltext" role="region" aria-label="裁判文书全文">{body?(start<0?body:<>{body.slice(0,start)}<mark>{quote}</mark>{body.slice(start+quote.length)}</>):'该文书暂无可读取的正文。'}</div>
    </>}
  </div>
  <footer className="similar-reader-actions">
   {error&&<div className="similar-relevance-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
   {message&&!error&&<div className="similar-relevance-message" role="status"><CheckCircle2 size={16}/><span>{message}</span></div>}
   {!error&&!message&&<p>{excluded?'已标记为不相关，重新分析时继续排除。':'与本案不相关的类案可移出。'}</p>}
   <button type="button" className={'button '+(excluded?'secondary':'reader-remove')} disabled={disabled} onClick={()=>onRelevance(excluded)}>
    {saving?<LoaderCircle className="spin" size={16}/>:excluded?<Undo2 size={16}/>:<CircleMinus size={16}/>}
    {saving?'正在保存…':excluded?(canRestoreToList?'撤销移出':'取消移出标记'):'移出类案（不相关）'}
   </button>
  </footer>
 </aside></div>,document.body);
}
