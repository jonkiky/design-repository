import {useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {AlertCircle, ArrowRight, BookOpen, CheckCircle2, LoaderCircle, RotateCcw, Save, Search, Settings2, Undo2} from 'lucide-react';
import SearchFilters, {type FilterSelection} from './SearchFilters';
import SimilarCaseReader from './SimilarCaseReader';
import {wholeMonthRange, rangeDateLabel} from './monthRange';
import './similar-cases.css';

type Options = {query: string; mode: string; limit: number; filters: FilterSelection;
  date_from: string|null; date_to: string|null; province: string; court: string; cause: string};
type Props = {c: any; api: (path: string, method?: string, body?: any) => Promise<any>;
  act: (fn: () => Promise<any>) => Promise<any>; notify: (message: string) => void};
const modes: Record<string,string> = {semantic:'语义检索',hybrid:'语义 + 关键词',keyword:'关键词检索',lexical:'词面检索'};
const fmt = (value: string) => new Date(value).toLocaleString('zh-CN');
const signature = (options: Options) => JSON.stringify({query:options.query.trim(),mode:options.mode,limit:options.limit,
  province:options.province,court:options.court,cause:options.cause,date_from:options.date_from||null,date_to:options.date_to||null,
  filters: Object.fromEntries(Object.entries(options.filters).filter(([,v]) => v.length).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,[...v].sort()]))});

export default function SimilarCases({c,api,act,notify}: Props) {
  const qc = useQueryClient();
  const path = '/cases/'+c.id+'/similar-cases';
  const key = ['similar-cases',c.id];
  const q = useQuery({queryKey:key, queryFn:()=>api(path), refetchInterval:3000});
  const [draft,setDraft] = useState<Options|null>(null);
  const [editVersion,setEditVersion] = useState<number|null>(null);
  const [busy,setBusy] = useState<'save'|'analyze'|null>(null);
  const [expanded,setExpanded] = useState(false);
  const [reader,setReader] = useState<{item:any;trigger:HTMLElement|null}|null>(null);
  const [relevanceBusy,setRelevanceBusy] = useState<string|null>(null);
  const [relevanceNotice,setRelevanceNotice] = useState<{id:string;message:string;error:boolean}|null>(null);
  const resultsHeading = useRef<HTMLDivElement>(null);
  if(q.isPending) return <div className="loading"><LoaderCircle className="spin" size={20}/>正在读取类案…</div>;
  if(q.isError) return <div className="notice warning" role="alert">{q.error.message}<button className="text-button" onClick={()=>q.refetch()}>重试</button></div>;
  const data = q.data;
  const options: Options = wholeMonthRange(draft || data.options);
  const expandedToMonths = options.date_from !== (draft || data.options).date_from || options.date_to !== (draft || data.options).date_to;
  const dirty = signature(options) !== signature(data.options);
  const result = data.response;
  const exclusions = data.excluded_items || [];
  const readerExclusion = exclusions.find((entry:any)=>entry.item.document_id===reader?.item.document_id);
  const sourceStale = !!result && data.analyzed_source_revision !== c.source_revision;
  const optionsStale = !!result && signature(options) !== signature(data.analyzed_options);
  const invalid = !!(options.date_from && options.date_to && options.date_from > options.date_to)
    || (!!options.query.trim() && options.query.trim().length < 2);
  const filterCount = Object.values(options.filters).reduce((n,v)=>n+v.length,0) + Number(!!options.date_from) + Number(!!options.date_to);
  function change(patch: Partial<Options>) {
    setEditVersion(previous=>previous ?? data.version);
    setDraft(previous=>({...previous || data.options,...patch}));
  }
  function openReader(item:any) {
    setRelevanceNotice(null);
    setReader({item,trigger:document.activeElement instanceof HTMLElement?document.activeElement:null});
  }
  async function changeRelevance(item:any,relevant:boolean) {
    if(busy||relevanceBusy) return;
    setRelevanceBusy(item.document_id);setRelevanceNotice(null);
    try {
      const saved=await api(path+'/'+encodeURIComponent(item.document_id)+'/relevance','PUT',{relevant,version:data.version});
      await qc.cancelQueries({queryKey:key});
      qc.setQueryData(key,saved);
      // Keep local filter edits, without accepting edits made by another page.
      setEditVersion(previous=>previous===data.version?saved.version:previous);
      qc.invalidateQueries({queryKey:['case',c.id]});
      qc.invalidateQueries({queryKey:['cases']});
      const restored=saved.response?.items.some((entry:any)=>entry.document_id===item.document_id);
      setRelevanceNotice({id:item.document_id,error:false,message:!relevant?'已移出类案，并标记为与本案不相关。':restored?'已恢复到本案类案列表。':'已取消移出标记，重新分析时可再次检索该案例。'});
    } catch(error) {
      setRelevanceNotice({id:item.document_id,error:true,message:(error as Error).message});
    } finally {
      setRelevanceBusy(null);
      qc.invalidateQueries({queryKey:key});
    }
  }
  async function save(analyze: boolean) {
    if(busy || relevanceBusy || invalid) return;
    setBusy(analyze?'analyze':'save');
    await act(async()=>{
      const saved = await api(path+(analyze?'/analyze':''),analyze?'POST':'PUT',
        {options,version:editVersion ?? data.version});
      await qc.cancelQueries({queryKey:key});
      qc.setQueryData(key,saved);
      setDraft(null);setEditVersion(null);
      qc.invalidateQueries({queryKey:['case',c.id]});
      qc.invalidateQueries({queryKey:['cases']});
      notify(analyze ? saved.needs_analysis ? '结果已保存，但案件资料在分析期间发生变化，请重新分析。' : `分析完成，已保存 ${saved.count} 条类案及本次筛选条件。`
        : '检索条件已保存，可稍后继续编辑或点击分析。');
    });
    setBusy(null);
    qc.invalidateQueries({queryKey:key});
  }
  return <section className="similar-cases" aria-label="本案类案" onKeyDown={event=>{if(event.key==='Escape'&&reader){event.stopPropagation();setReader(null)}}}>
    <div className="section-heading similar-heading"><div><h2>类案</h2><p className="muted">从案件概览和可读材料中查找相似裁判文书，保留结果与检索条件。</p></div>
      <span className={'tag '+(sourceStale||optionsStale?'amber':result?'green':'neutral')}>
        {sourceStale||optionsStale?'需重新分析':result?'已保存结果':'尚未分析'}</span></div>
    {(sourceStale||optionsStale) && <div className="notice warning similar-stale" role="status"><AlertCircle size={18}/><div><strong>类案需重新分析</strong>
      <p>{sourceStale?'材料中心或案件概览已更新。':''}{optionsStale?'检索条件已变化。':''}下方保留上次分析结果，点击“重新分析”后更新。</p></div></div>}
    <form className="card similar-form" onSubmit={event=>{event.preventDefault();save(true)}}>
      <fieldset disabled={!!busy||!!relevanceBusy}>
        <div className="similar-context"><span><BookOpen size={17}/>案件概览 + {data.readable_material_count} 份可读材料</span><span>点击分析后检索并自动保存</span></div>
        <label>检索描述 <span className="muted small">可编辑；留空时根据最新案件资料生成</span>
          <textarea rows={3} maxLength={1500} aria-label="类案检索描述" placeholder="使用本案的案件概览与材料摘录，也可在此输入需要关注的事实、争点或情形。"
            value={options.query} onChange={e=>change({query:e.target.value})}/></label>
        <details className="similar-query"><summary>查看{options.query?'自定义':'自动生成的'}检索描述</summary><p>{options.query || data.suggested_query}</p>
          {!options.query && data.query_warnings.map((warning: string)=><p className="muted" key={warning}>{warning}</p>)}</details>
        <div className="similar-options"><label>检索方式<select aria-label="类案检索方式" value={options.mode} onChange={e=>change({mode:e.target.value})}>
          <option value="semantic">语义检索（默认）</option><option value="hybrid">语义 + 关键词</option><option value="keyword">关键词检索</option></select></label>
          <label>结果数量<select aria-label="类案结果数量" value={options.limit} onChange={e=>change({limit:Number(e.target.value)})}>
            {[5,10,20].map(value=><option key={value} value={value}>{value} 条</option>)}</select></label>
          <button type="button" className="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}><Settings2 size={15}/>筛选条件{filterCount>0&&<span className="filter-badge">{filterCount}</span>}</button>
        </div>
        <SearchFilters expanded={expanded} monthPrecision filters={options.filters} dateFrom={options.date_from||''} dateTo={options.date_to||''} api={api}
          onChange={filters=>change({filters})} onDates={(from,to)=>change({date_from:from||null,date_to:to||null})}/>
        {expandedToMonths && <p className="small muted" role="status">原有日期范围已按整月展开，请保存条件或重新分析。</p>}
        {invalid && <p className="warning" role="alert">请检查日期区间，检索描述需至少两个字符或留空。</p>}
        <div className="similar-actions"><span className="small muted" role="status">{dirty?'有未保存的条件':data.updated_at?'条件已保存 · '+fmt(data.updated_at):'默认语义检索 · 可先调整条件'}</span>
          <div><button type="button" className="text-button" disabled={!draft} onClick={()=>{setDraft(null);setEditVersion(null)}}>载入已保存条件</button>
            <button type="button" className="button" disabled={invalid||(!dirty&&data.version>0)} onClick={()=>save(false)}><Save size={15}/>{busy==='save'?'正在保存…':'保存条件'}</button>
            <button type="submit" className="button primary" disabled={invalid}>{busy==='analyze'?<LoaderCircle className="spin" size={16}/>:result?<RotateCcw size={16}/>:<Search size={16}/>}{busy==='analyze'?'正在分析…':result?'重新分析':'分析类案'}</button></div>
        </div>
      </fieldset>
    </form>
    {busy==='analyze' && <div role="status" className="notice"><LoaderCircle className="spin" size={17}/>正在检索类案，完成后自动保存结果与条件。</div>}
    <div className={'similar-review-layout '+(reader?'reader-open':'')}><div className="similar-results-column">
    {result ? <>
      <div ref={resultsHeading} tabIndex={-1} className="search-summary similar-summary"><strong>类案列表 · {result.items.length} 条</strong><span>{fmt(data.analyzed_at)} 分析 · 已保存</span><span className={'tag '+(result.degraded?'amber':'blue')}>{modes[result.retrieval_mode]||result.retrieval_mode}</span></div>
      <details className="similar-query saved-query"><summary>查看上次分析使用的检索描述与范围</summary><p>{result.applied_filters.query}</p><p className="muted">{modes[result.applied_filters.mode]} · 最多 {result.applied_filters.limit} 条 · {Object.values(result.applied_filters.filters as FilterSelection).reduce((n,v)=>n+v.length,0)} 项筛选值 · 判决时间 {rangeDateLabel(result.applied_filters.date_from)} 至 {rangeDateLabel(result.applied_filters.date_to, true)}</p>
        <button type="button" className="text-button" disabled={!!busy} onClick={()=>{setDraft(data.analyzed_options);setEditVersion(data.version);setExpanded(true)}}>载入上次分析条件继续编辑</button></details>
      {result.warnings.map((warning: string)=><div className="notice warning" key={warning}><AlertCircle size={16}/>{warning}</div>)}
      {result.items.map((item: any)=><article className={'card search-result '+(reader?.item.document_id===item.document_id?'is-reading':'')} key={item.document_id}>
        <div className="result-header"><span className="result-number">{String(item.rank).padStart(2,'0')}</span><div><h3><button type="button" className="text-button" aria-expanded={reader?.item.document_id===item.document_id} aria-controls="similar-case-reader" onClick={()=>openReader(item)}>{item.title}</button></h3><div className="case-meta"><span>{item.case_number}</span><span>{item.court}</span><span>{item.judgment_date}</span></div></div></div>
        <blockquote>{item.quote}</blockquote><div className="result-footer"><span className="tag">{item.cause||'案由未载明'}</span><span>{item.section}</span><button type="button" className="text-button" aria-expanded={reader?.item.document_id===item.document_id} aria-controls="similar-case-reader" onClick={()=>openReader(item)}>核对全文<ArrowRight size={14}/></button></div>
      </article>)}
      {!result.items.length && <div className="empty"><Search size={32}/><h3>{data.excluded_from_current_count?'本轮类案已全部移出':'当前条件下未找到类案'}</h3><p>{data.excluded_from_current_count?'可在下方查看已移出的类案并撤销，或调整条件重新分析。':'本次空结果与条件已保存。可修改筛选条件后重新分析。'}</p></div>}
      <p className="small muted similar-foot"><CheckCircle2 size={14}/>结果与条件已保存在本案，可离开后继续查看。类案为研究线索，请核对原文。</p>
    </> : <div className="empty similar-empty"><Search size={32}/><h3>点击“分析类案”，查找本案的参考案例</h3><p>默认使用语义检索。可按地区、法院、案由或时间等条件缩小范围。</p><p className="small muted">分析完成后，类案将列在这里，并与筛选条件一同保存。</p></div>}
    {exclusions.length>0&&<details className="card similar-excluded"><summary>已移出的类案 · {exclusions.length} 条</summary><p>已标记为与本案不相关，重新分析时会继续排除。您可以查看原文或撤销移出。</p>
      {exclusions.map((entry:any)=><div className="similar-excluded-item" key={entry.item.document_id}><div><button type="button" className="text-button" onClick={()=>openReader(entry.item)}>{entry.item.title}</button><small>{entry.item.case_number} · 与本案不相关</small></div>
        <button type="button" className="text-button" disabled={!!busy||!!relevanceBusy} onClick={()=>changeRelevance(entry.item,true)}>{relevanceBusy===entry.item.document_id?<LoaderCircle className="spin" size={14}/>:<Undo2 size={14}/>}{entry.in_current_results?'撤销移出':'取消移出标记'}</button>
      </div>)}
    </details>}
    {relevanceNotice&&relevanceNotice.id!==reader?.item.document_id&&<div className={'similar-relevance-notice '+(relevanceNotice.error?'error':'')} role={relevanceNotice.error?'alert':'status'}>{relevanceNotice.message}</div>}
    </div>
    {reader&&<SimilarCaseReader key={reader.item.document_id} item={reader.item} api={api} trigger={reader.trigger} fallback={resultsHeading}
      excluded={!!readerExclusion} canRestoreToList={!!readerExclusion?.in_current_results} saving={relevanceBusy===reader.item.document_id} disabled={!!busy||!!relevanceBusy}
      error={relevanceNotice?.id===reader.item.document_id&&relevanceNotice.error?relevanceNotice.message:''}
      message={relevanceNotice?.id===reader.item.document_id&&!relevanceNotice.error?relevanceNotice.message:''}
      onClose={()=>setReader(null)} onRelevance={relevant=>changeRelevance(reader.item,relevant)}/>}
    </div>
  </section>;
}
