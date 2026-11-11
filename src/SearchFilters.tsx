import {useEffect, useId, useRef, useState} from 'react';
import {keepPreviousData, useInfiniteQuery, useQuery} from '@tanstack/react-query';
import {Check, ChevronDown, LoaderCircle, Search, X} from 'lucide-react';
import {monthBoundary} from './monthRange';

export type FilterSelection = Record<string, string[]>;
type Choice = {value_id: string; label: string; count?: number; characters: number; is_missing: number};
type Field = {key: string; label: string; kind: string; distinct_values: number; missing_documents: number};
type Facets = {fields: Field[]; matching_documents: number; selected: Record<string, Choice[]>;
  options: Choice[]; total_options: number; has_more: boolean; next_offset: number|null};
type Props = {
  expanded: boolean; filters: FilterSelection; dateFrom: string; dateTo: string;
  monthPrecision?: boolean;
  onChange: (filters: FilterSelection) => void; onDates: (from: string, to: string) => void;
  api: (path: string, method?: string, body?: any) => Promise<any>;
};
const order = ['province','city','court','cause','case_type','doc_type','procedure','court_level',
  'case_level','judgment_year','judgment_date','published_at','accepted_at','title','case_number','outcome','laws','content'];

export default function SearchFilters({expanded, filters, dateFrom, dateTo, onChange, onDates, api, monthPrecision = false}: Props) {
  const [open, setOpen] = useState<string|null>(null);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [labels, setLabels] = useState<Record<string, Choice>>({});
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const context = {filters, date_from: dateFrom || null, date_to: dateTo || null};
  const invalidDates = !!(dateFrom && dateTo && dateFrom > dateTo);
  const summary = useQuery<Facets>({queryKey: ['filter-summary', context],
    queryFn: () => api('/search/facets', 'POST', context), enabled: expanded && !invalidDates, staleTime: 60000, placeholderData: keepPreviousData});
  const choices = useInfiniteQuery<Facets>({
    queryKey: ['filter-options', context, open, debounced], initialPageParam: 0,
    queryFn: ({pageParam}) => api('/search/facets', 'POST', {...context, field: open, text: debounced, offset: pageParam, limit: 50}),
    getNextPageParam: page => page.next_offset ?? undefined,
    enabled: expanded && !!open && !invalidDates, staleTime: 60000,
    placeholderData: (previous, query) => query?.queryKey[2] === open && query?.queryKey[3] === debounced ? previous : undefined,
  });
  const dates = useQuery<Choice[]>({queryKey: ['filter-date-range'], enabled: expanded && !monthPrecision, staleTime: Infinity,
    queryFn: async () => {
      const all: Choice[] = []; let offset: number|null = 0;
      while (offset !== null) {
        const page: Facets = await api('/search/facets', 'POST', {field: 'judgment_date', offset, limit: 100});
        all.push(...page.options.filter(o => !o.is_missing)); offset = page.next_offset;
      }
      return all;
    }});
  useEffect(() => {const timer = setTimeout(() => setDebounced(term), 250); return () => clearTimeout(timer)}, [term]);
  useEffect(() => {if (!expanded) setOpen(null)}, [expanded]);
  useEffect(() => {
    if (summary.data) setLabels(previous => {
      const next = {...previous};
      for (const [key, options] of Object.entries(summary.data.selected))
        for (const option of options) next[key+option.value_id] = option;
      return next;
    });
  }, [summary.data]);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!(event.target as HTMLElement).closest('[data-facet-popup], [data-facet-trigger]')) setOpen(null);
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  function toggle(field: string, option: Choice) {
    const selected = filters[field] || [];
    setLabels(previous => ({...previous, [field+option.value_id]: option}));
    const next = {...filters, [field]: selected.includes(option.value_id)
      ? selected.filter(value => value !== option.value_id) : [...selected, option.value_id]};
    if (!next[field].length) delete next[field];
    onChange(next);
  }
  function closePopup(field: string) {
    setOpen(null);
    root.current?.querySelector<HTMLButtonElement>(`[data-field="${field}"]`)?.focus();
  }
  const fields = [...(summary.data?.fields || [])].sort((a,b) => order.indexOf(a.key)-order.indexOf(b.key));
  const totalSelected = Object.values(filters).reduce((sum, values) => sum+values.length, 0);
  if (!expanded) return null;
  return <div className="facets" ref={root}>
    <div className="facets-heading"><div><strong>组合筛选 <span className="tag blue">全部 18 个字段</span></strong>
      <p>同一字段多选满足任一项，跨字段同时满足。选项随其他条件联动。</p></div>
      <button type="button" className="text-button" disabled={!totalSelected && !dateFrom && !dateTo}
        onClick={() => {onChange({}); onDates('',''); setOpen(null)}}>清空筛选</button></div>
    <div className="facet-scope" role="status" aria-live="polite">
      {invalidDates ? (monthPrecision ? '起始月份不得晚于结束月份' : '起始日期不得晚于结束日期') : summary.isFetching ? <><LoaderCircle size={14} className="spin"/>正在计算条件范围…</> :
        summary.data ? <><span className="dot"/><strong>{summary.data.matching_documents.toLocaleString()} 份文书</strong><span>满足筛选条件 · 尚未计入检索词</span></> : null}
    </div>
    {summary.error && <div role="alert" className="notice warning">筛选选项读取失败：{summary.error.message}
      <button type="button" className="text-button" onClick={() => summary.refetch()}>重试</button></div>}
    {totalSelected > 0 && <div className="filter-chips" aria-label="已选筛选条件">
      {fields.flatMap(field => (filters[field.key] || []).map(value => {
        const option = labels[field.key+value] || {value_id:value,label:'正在读取…',characters:0,is_missing:0};
        return <button type="button" key={field.key+value} className="filter-chip" title={option.label}
          aria-label={`移除${field.label}：${option.label}`} onClick={() => toggle(field.key,option)}>
          <span>{field.label}：{option.label}</span><X size={12}/></button>;
      }))}
    </div>}
    <div className="facets-grid">
      {fields.map(field => {
        const selected = filters[field.key] || [];
        const active = open === field.key;
        const options = choices.data?.pages.flatMap(page => page.options) || [];
        const firstLabel = labels[field.key+(selected[0] || '')]?.label;
        return <div className={'facet-field '+(active?'is-open':'')} key={field.key}>
          <span className="facet-label" id={id+'label'+field.key}>{field.label}<small title="全库去重选项数，包含空值。下拉选项按当前组合更新。">全库 {field.distinct_values.toLocaleString()} 种</small></span>
          <button type="button" data-facet-trigger data-field={field.key}
            className={'facet-trigger '+(selected.length?'has-selection':'')}
            aria-label={`${field.label}筛选`} aria-haspopup="dialog" aria-expanded={active} aria-controls={id+field.key}
            onClick={() => {setOpen(active?null:field.key); setTerm(''); setDebounced('')}}>
            <span>{selected.length ? (selected.length > 1 ? `已选 ${selected.length} 项` : firstLabel || '已选 1 项') : '全部'}</span>
            <ChevronDown size={14}/></button>
          {active && <div className="facet-popup" id={id+field.key} data-facet-popup role="dialog" aria-label={`${field.label}筛选选项`}
            onKeyDown={event => {if (event.key === 'Escape') {event.preventDefault();closePopup(field.key)}}}>
            <div className="facet-popup-heading"><strong>{field.label} · 可多选</strong><button type="button" className="icon-button"
              aria-label={`关闭${field.label}选项`} onClick={() => closePopup(field.key)}><X size={16}/></button></div>
            <div className="facet-option-search"><Search size={14}/><input autoFocus type="search" aria-label={`${field.label}选项搜索`}
              placeholder={field.kind==='text'?'搜索完整字段内容':'搜索选项'} maxLength={200} value={term}
              onKeyDown={event => {if(event.key==='Enter') event.preventDefault()}}
              onChange={event => setTerm(event.target.value)}/></div>
            <p className="facet-help">{field.kind==='text'?'按完整字段值精确筛选；长文本显示摘要。':'按字段原值精确筛选；空值可单独选择。'}数量按其他条件计算。</p>
            {selected.length > 0 && <div className="facet-selected"><span>已选 {selected.length} / 50 项</span>
              <button type="button" className="text-button" onClick={() => {const next={...filters};delete next[field.key];onChange(next)}}>清除此字段</button></div>}
            <div className="facet-option-list" role="group" aria-label={`${field.label}可选值`} aria-busy={choices.isFetching}>
              {(choices.isPending || term !== debounced) ? <div className="facet-empty"><LoaderCircle size={16} className="spin"/>正在读取选项…</div> :
                choices.error ? <div className="facet-empty" role="alert">{choices.error.message}<button type="button" className="text-button" onClick={()=>choices.refetch()}>重试</button></div> :
                !options.length ? <div className="facet-empty">没有匹配选项。可修改搜索词或清除其他条件。</div> :
                options.map(option => <label className="facet-option" key={option.value_id} title={option.label}>
                  <input type="checkbox" checked={selected.includes(option.value_id)}
                    disabled={!selected.includes(option.value_id) && selected.length >= 50}
                    onChange={() => toggle(field.key, option)}/>
                  <span className="facet-option-copy"><span>{option.label}</span>{option.characters>180 && <small>{option.characters.toLocaleString()} 字 · 选中后可从检索结果核对全文</small>}</span>
                  <span className="facet-count">{option.count?.toLocaleString()}</span>
                </label>)}
              {choices.hasNextPage && term===debounced && <button type="button" className="facet-more" disabled={choices.isFetchingNextPage}
                onClick={() => choices.fetchNextPage()}>{choices.isFetchingNextPage?'正在加载…':'加载更多选项'}</button>}
            </div>
            <div className="facet-popup-footer"><span>已显示 {options.length} / {choices.data?.pages[0].total_options ?? '—'} 种</span>
              <button type="button" className="text-button" onClick={() => closePopup(field.key)}><Check size={13}/>完成</button></div>
          </div>}
        </div>;
      })}
    </div>
    <details className="facet-date-range"><summary>判决时间区间（可选）{(dateFrom||dateTo)&&` · ${(monthPrecision ? dateFrom.slice(0,7) : dateFrom)||'不限'} 至 ${(monthPrecision ? dateTo.slice(0,7) : dateTo)||'不限'}`}</summary>
      {monthPrecision ? <>
        <div><label>起始月份<input type="month" aria-label="判决起始月份" min="0001-01" max="9999-12" value={dateFrom.slice(0,7)}
          onChange={event => onDates(monthBoundary(event.target.value), dateTo)}/></label>
          <label>结束月份<input type="month" aria-label="判决结束月份" min="0001-01" max="9999-12" value={dateTo.slice(0,7)}
            onChange={event => onDates(dateFrom, monthBoundary(event.target.value, true))}/></label></div>
        <p className="facet-month-help">按整月筛选，包含起止月份；留空表示不限。</p>
      </> : <><div><label>判决时间从<select aria-label="判决时间从" value={dateFrom} onChange={event => onDates(event.target.value,dateTo)}>
        <option value="">不限</option>{dates.data?.map(option => <option key={option.value_id} value={option.label}>{option.label}</option>)}</select></label>
        <label>判决时间至<select aria-label="判决时间至" value={dateTo} onChange={event => onDates(dateFrom,event.target.value)}>
          <option value="">不限</option>{dates.data?.map(option => <option key={option.value_id} value={option.label}>{option.label}</option>)}</select></label></div>
      {dates.error && <p role="alert">日期选项读取失败：{dates.error.message}</p>}</>}
    </details>
  </div>;
}
