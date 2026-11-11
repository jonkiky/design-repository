import {useState} from 'react';
import {AlertCircle, Check, LoaderCircle} from 'lucide-react';

const positionGroups = [
  {label: '通用立场', options: ['我方当事人代理律师', '原告代理律师', '被告代理律师', '第三人代理律师']},
  {label: '房屋买卖', options: ['购房人代理律师', '买方代理律师', '卖方代理律师', '开发商代理律师']},
  {label: '房屋租赁', options: ['承租人代理律师', '出租人代理律师']},
];

export function CasePositionSelect({value, onChange, disabled = false, existingPosition}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  existingPosition?: string;
}) {
  const legacyPosition = existingPosition ?? value;
  const hasLegacyPosition = legacyPosition && !positionGroups.some(group => group.options.includes(legacyPosition));
  return <select required value={value} disabled={disabled} onChange={event => onChange(event.target.value)}>
    <option value="" disabled>请选择代理立场</option>
    {hasLegacyPosition && <option value={legacyPosition}>{legacyPosition}（原有立场）</option>}
    {positionGroups.map(group => <optgroup key={group.label} label={group.label}>
      {group.options.map(position => <option key={position} value={position}>{position}</option>)}
    </optgroup>)}
  </select>;
}

export type CaseDetails = {title: string; position: string; claims: string; research_date: string};
type CaseOverview = CaseDetails & {revision: number; runs: {status: string}[]; artifacts: unknown[]};
type Draft = {original: CaseDetails; values: CaseDetails; revision: number};

function details(c: CaseOverview): CaseDetails {
  return {title: c.title, position: c.position, claims: c.claims, research_date: c.research_date};
}

export default function CaseDetailsForm({c, onSave, onCancel}: {
  c: CaseOverview;
  onSave: (values: CaseDetails, revision: number) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const values = draft?.values ?? details(c);
  const dirty = !!draft && (Object.keys(values) as (keyof CaseDetails)[]).some(key => values[key] !== draft.original[key]);
  const conflict = !!draft && draft.revision !== c.revision;
  const valid = !!values.title.trim() && !!values.position.trim() && !!values.claims.trim() && !!values.research_date;
  const activeRun = c.runs.some(run => ['queued', 'running', 'waiting_input'].includes(run.status));

  function change(key: keyof CaseDetails, value: string) {
    setError('');
    // Freeze the revision when editing starts; background polling must not replace a draft.
    setDraft(previous => {
      const current = previous ?? {original: details(c), values: details(c), revision: c.revision};
      return {...current, values: {...current.values, [key]: value}};
    });
  }

  function reset() {
    setDraft(null);
    setError('');
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || !dirty || !valid || busy || conflict) return;
    setBusy(true);
    setError('');
    try {
      await onSave({...values, title: values.title.trim(), claims: values.claims.trim()}, draft.revision);
      setDraft(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return <form className="case-details-form" onSubmit={save} aria-label="案件信息与研究目标" aria-busy={busy}>
    <div className="case-details-fields">
      <label>案件名称<input required maxLength={160} value={values.title} disabled={busy} onChange={event => change('title', event.target.value)}/></label>
      <label>代理立场<CasePositionSelect value={values.position} existingPosition={draft?.original.position ?? c.position} disabled={busy} onChange={value => change('position', value)}/></label>
    </div>
    <label>当前诉求与研究目标<textarea required maxLength={2000} rows={4} value={values.claims} disabled={busy} onChange={event => change('claims', event.target.value)} placeholder="描述需要研究的争议和希望实现的目标"/></label>
    <label>研究时点<input type="date" required value={values.research_date} disabled={busy} onChange={event => change('research_date', event.target.value)}/></label>
    {conflict && !busy && <div className="case-edit-message" role="alert"><AlertCircle size={16}/><span>案件已更新，您的修改仍保留。请先复制需要保留的内容，再点击“重新载入”读取最新信息。</span></div>}
    {error && <div className="case-edit-message error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
    {dirty && (activeRun || c.artifacts.length > 0) && <p className="case-edit-impact">{activeRun && '保存将停止进行中或待选择的任务。'}{c.artifacts.length > 0 && '已有成果将标记为资料已变化，需基于新信息重新生成并复核。'}</p>}
    <footer className="case-details-actions">
      <span className="small muted" role="status">{busy ? '正在保存…' : dirty ? '有未保存的修改' : '修改后点击保存'}</span>
      <div>
        {onCancel && <button type="button" className="button" disabled={busy} onClick={onCancel}>取消</button>}
        {(!onCancel || conflict) && <button type="button" className="button" disabled={busy || (!dirty && !conflict)} onClick={reset}>{conflict ? '重新载入' : '取消修改'}</button>}
        <button type="submit" className="button primary" disabled={busy || !dirty || !valid || conflict}>{busy ? <LoaderCircle className="spin" size={15}/> : <Check size={15}/>}保存修改</button>
      </div>
    </footer>
  </form>;
}
