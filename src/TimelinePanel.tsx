import {useEffect, useRef, useState, type ReactNode} from 'react';
import {AlertCircle, ArrowDown, ArrowUp, Check, ListTree, LoaderCircle, Paperclip, PenLine, Plus, Trash2} from 'lucide-react';
import './timeline.css';
import TimelineEventType from './TimelineEventType';

export type TimelineFactInput = {id: string; date_text: string; kind: string; description: string; source_ref?: string; material_id: string};
type Fact = TimelineFactInput & {quote: string; status?: string; edited?: boolean};
type Source = {id: string; name: string; quote: string; source_kind: string; doc_id: string};
type SourceLink = Pick<Source, 'name' | 'source_kind' | 'doc_id'> & Partial<Source>;
type Material = {id: string; name: string; version: number; status: string; characters: number};
export type TimelineArtifact = {
  id: string; content_hash: string; version: number; sources: Source[];
  structured: {facts?: Fact[]};
};
type Draft = {artifact: TimelineArtifact; original: TimelineFactInput[]; facts: TimelineFactInput[]};

function editableFacts(artifact: TimelineArtifact): TimelineFactInput[] {
  return (artifact.structured.facts ?? []).map(fact => ({
    id: fact.id, date_text: fact.date_text || '', kind: fact.kind || '待核实',
    description: fact.description ?? fact.quote, source_ref: fact.source_ref,
    material_id: fact.material_id || artifact.sources.find(item => item.id === fact.source_ref)?.doc_id || '',
  }));
}

export default function TimelinePanel({artifact, materials, eventTypes, status, source, onSave}: {
  artifact?: TimelineArtifact;
  materials: Material[];
  eventTypes: string[];
  status: ReactNode;
  source: (reference: SourceLink) => void;
  onSave: (artifact: TimelineArtifact, facts: TimelineFactInput[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addedTypes, setAddedTypes] = useState<string[]>([]);
  const form = useRef<HTMLFormElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const dirty = !!draft && JSON.stringify(draft.facts) !== JSON.stringify(draft.original);
  const conflict = !!draft && (draft.artifact.id !== artifact?.id || draft.artifact.content_hash !== artifact?.content_hash);
  const sources = (draft?.artifact ?? artifact)?.sources.filter(item => item.source_kind === 'case_material') ?? [];
  const valid = !!draft?.facts.length && draft.facts.every(fact => fact.kind.trim() && fact.description.trim() && materials.some(item => item.id === fact.material_id));
  const editing = !!draft;

  useEffect(() => {if (editing) form.current?.querySelector('input')?.focus({preventScroll: true});}, [editing]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {event.preventDefault(); event.returnValue = '';};
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function start() {
    if (!artifact) return;
    const facts = editableFacts(artifact);
    setDraft({artifact, original: facts, facts});
    setAddedTypes([]);
    setError('');
  }
  function cancel() {
    setDraft(null);
    setError('');
    requestAnimationFrame(() => editButton.current?.focus({preventScroll: true}));
  }
  function change(id: string, key: keyof TimelineFactInput, value: string) {
    setError('');
    setDraft(current => current && ({...current, facts: current.facts.map(fact => fact.id === id ? {...fact, [key]: value} : fact)}));
  }
  function changeMaterial(id: string, materialId: string) {
    setError('');
    setDraft(current => current && ({...current, facts: current.facts.map(fact => {
      if (fact.id !== id) return fact;
      const original = current.original.find(item => item.id === id && item.material_id === materialId);
      return {...fact, material_id: materialId, source_ref: original?.source_ref};
    })}));
  }
  function move(index: number, offset: number) {
    setDraft(current => {
      if (!current || index + offset < 0 || index + offset >= current.facts.length) return current;
      const facts = [...current.facts];
      [facts[index], facts[index + offset]] = [facts[index + offset], facts[index]];
      return {...current, facts};
    });
  }
  function add() {
    const id = 'fact_' + crypto.randomUUID();
    setDraft(current => current && ({...current, facts: [...current.facts, {id, date_text: '', kind: '待核实', description: '', material_id: ''}]}));
    requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[data-event-id="${id}"] input`)?.focus());
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy || !dirty || !valid || conflict) return;
    setBusy(true);
    setError('');
    try {
      await onSave(draft.artifact, draft.facts);
      cancel();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。');
    } finally {setBusy(false);}
  }

  return <section className="timeline-panel" aria-label="案情与时间线">
    <div className="section-heading">
      <div><h2>案情与时间线</h2><p className="muted">保留原文日期精度，区分约定、实际履行与待核事项。</p></div>
      {artifact?.structured.facts && !editing && materials.length > 0 && <button ref={editButton} className="button" onClick={start}><PenLine size={16}/>编辑时间线</button>}
    </div>
    {status}
    {draft ? <form ref={form} onSubmit={save} aria-label="编辑案情时间线" aria-busy={busy}>
      <p className="small muted">可修改日期、类型和事件内容，新增、删除或调整顺序。保存为新版本，材料原文仍可核对。</p>
      <div className="timeline-edit-toolbar">
        <span role="status">{busy ? '正在保存…' : dirty ? '有未保存的修改' : '修改后点击保存'}<small>共 {draft.facts.length} 条事件 · 基于 v{draft.artifact.version}</small></span>
        <div className="timeline-edit-actions">
          <button type="button" className="button" disabled={busy || draft.facts.length >= 500} onClick={add}><Plus size={15}/>新增事件</button>
          <button type="button" className="button" disabled={busy} onClick={cancel}>取消修改</button>
          <button type="submit" className="button primary" disabled={busy || !dirty || !valid || conflict}>{busy ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>}保存修改</button>
        </div>
      </div>
      {conflict && !busy && <div className="notice warning" role="alert"><AlertCircle size={17}/><span>时间线已有新版本，您的修改仍保留。请先复制需要保留的内容，取消修改后重新编辑最新版本。</span></div>}
      {error && <div className="notice warning" role="alert"><AlertCircle size={17}/><span>{error}</span></div>}
      {!draft.facts.length && <div className="empty"><ListTree size={28}/><p>请新增事件，至少保留一条后再保存。</p></div>}
      <div className="timeline">
        {draft.facts.map((fact, index) => {
          const reference = sources.find(item => item.id === fact.source_ref);
          const material = materials.find(item => item.id === fact.material_id);
          return <div className="timeline-item" key={fact.id} data-event-id={fact.id}>
            <span className="timeline-dot"/>
            <fieldset className="card timeline-editor-card" disabled={busy}>
              <legend>事件 {index + 1}</legend>
              <div className="timeline-event-actions">
                <button type="button" className="text-button" disabled={index === 0} aria-label={`上移事件 ${index + 1}`} title="上移" onClick={() => move(index, -1)}><ArrowUp size={16}/></button>
                <button type="button" className="text-button" disabled={index === draft.facts.length - 1} aria-label={`下移事件 ${index + 1}`} title="下移" onClick={() => move(index, 1)}><ArrowDown size={16}/></button>
                <button type="button" className="text-button danger" aria-label={`删除事件 ${index + 1}`} onClick={() => setDraft(current => current && ({...current, facts: current.facts.filter(item => item.id !== fact.id)}))}><Trash2 size={15}/>删除</button>
              </div>
              <div className="two-cols">
                <label>日期或时间<input aria-label={`事件 ${index + 1} 日期或时间`} value={fact.date_text} maxLength={120} placeholder="如：2025年6月、日期待核实" onChange={event => change(fact.id, 'date_text', event.target.value)}/></label>
                <TimelineEventType label={`事件 ${index + 1} 类型`} value={fact.kind} options={[...eventTypes, ...addedTypes]}
                  onChange={value => change(fact.id, 'kind', value)} onAdd={value => setAddedTypes(current => [...new Set([...current, value])])}/>
              </div>
              <label>事件内容<textarea aria-label={`事件 ${index + 1} 内容`} value={fact.description} required maxLength={5000} rows={4} onChange={event => change(fact.id, 'description', event.target.value)}/></label>
              <label>材料来源<select aria-label={`事件 ${index + 1} 材料来源`} required value={fact.material_id} onChange={event => changeMaterial(fact.id, event.target.value)}>
                <option value="" disabled>请选择材料中心中的材料</option>
                {fact.material_id && !material && <option value={fact.material_id} disabled>{reference?.name || '原材料'}（已失效，请重新选择）</option>}
                {materials.map(item => <option value={item.id} key={item.id}>{item.name} · v{item.version}{item.status === 'needs_transcription' ? '（需补正文）' : item.status === 'partial' ? '（部分可读）' : ''}</option>)}
              </select></label>
              <p className="small muted timeline-material-help">可选择本案材料中心已上传或录入的材料。</p>
              {material && <div className="timeline-material-actions"><button type="button" className="text-button" onClick={() => source(reference || {source_kind: 'case_material', doc_id: material.id, name: material.name})}><Paperclip size={14}/>查看材料：{material.name}</button><a className="text-link" href={'/api/v1/materials/' + material.id + '/download'}>下载原件</a></div>}
              {material?.status === 'needs_transcription' && <p className="small muted">此材料尚无可读正文，可下载原件核对或在材料中心补正文。</p>}
              {reference?.quote && <details className="timeline-original"><summary>查看原有引用片段</summary><p>{reference.quote}</p></details>}
            </fieldset>
          </div>;
        })}
      </div>
    </form> : artifact ? <>
      <p className="small muted timeline-version">共 {artifact.structured.facts?.length ?? 0} 条事件 · v{artifact.version}</p>
      <div className="timeline">{artifact.structured.facts?.map(fact => {
        const reference = artifact.sources.find(item => item.id === fact.source_ref);
        return <div className="timeline-item" key={fact.id}>
          <span className="timeline-dot"/>
          <div className="timeline-date">{fact.date_text || '日期未载明'}<span className="tag neutral">{fact.kind}</span></div>
          <div className="card timeline-card"><p>{fact.description ?? fact.quote}</p><div><span className="tag neutral">{fact.edited ? '人工整理 · 待核实' : '材料记载 · 待核实'}</span>{reference && <button type="button" className="text-button" onClick={() => source(reference)}><Paperclip size={14}/>{reference.name}</button>}</div>
            {fact.edited && reference?.quote && <details className="timeline-original"><summary>查看材料原文</summary><p>{reference.quote}</p></details>}
          </div>
        </div>;
      })}</div>
    </> : <div className="empty"><ListTree size={32}/><h3>尚未形成这项成果</h3><div>先添加材料，再开始整理。</div></div>}
  </section>;
}
