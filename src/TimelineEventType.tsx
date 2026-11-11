import {useEffect, useId, useRef, useState} from 'react';
import {Check, ChevronDown, Plus} from 'lucide-react';

export const timelineEventTypes = ['当事人信息', '合同', '约定时间', '付款', '金额', '履行情况', '通知', '催告', '协商', '诉讼程序', '诉求', '已知不利事实', '待核实'];

export default function TimelineEventType({label, value, options, onChange, onAdd}: {
  label: string; value: string; options: string[];
  onChange: (value: string) => void; onAdd: (value: string) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const choices = [...new Set([...timelineEventTypes, ...options].map(item => item.trim()).filter(Boolean))];
  const filtered = choices.filter(item => item.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const custom = query.trim() && !choices.includes(query.trim()) ? query.trim() : '';
  const available = [...filtered, ...(custom ? [custom] : [])];

  useEffect(() => {if (open && active >= 0) list.current?.children[active]?.scrollIntoView({block: 'nearest'});}, [open, active]);

  function choose(kind: string) {
    onChange(kind);
    if (!choices.includes(kind)) onAdd(kind);
    setOpen(false);
    setActive(-1);
    setQuery('');
  }

  return <div className="timeline-kind-field" onBlur={event => {if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}>
    <label htmlFor={id}>事件类型</label>
    <div className="timeline-kind-control">
      <input ref={input} id={id} role="combobox" aria-label={label} aria-expanded={open} aria-controls={id + '-options'}
        aria-autocomplete="list" aria-activedescendant={open && active >= 0 && available[active] ? id + '-option-' + active : undefined}
        aria-describedby={id + '-help'} autoComplete="off" required maxLength={80} value={value}
        placeholder="选择或输入事件类型"
        onFocus={() => {setOpen(true); setQuery(''); setActive(-1);}}
        onChange={event => {onChange(event.target.value); setQuery(event.target.value); setOpen(true); setActive(-1);}}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') {event.preventDefault(); setOpen(false); setActive(-1);}
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            setActive(previous => event.key === 'ArrowDown' ? Math.min(previous + 1, available.length - 1) : Math.max(previous - 1, 0));
          }
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            const selected = available[active] || (custom ? custom : filtered.length === 1 ? filtered[0] : value.trim());
            if (selected) choose(selected);
          }
        }}/>
      <button type="button" className="timeline-kind-toggle" aria-label={`展开${label}选项`} aria-expanded={open}
        onMouseDown={event => event.preventDefault()} onClick={() => {
          if (open) setOpen(false);
          else {input.current?.focus(); setQuery(''); setActive(-1); setOpen(true);}
        }}><ChevronDown size={16}/></button>
      {open && <div ref={list} id={id + '-options'} className="timeline-kind-options" role="listbox" aria-label={`${label}选项`}>
        {available.map((kind, index) => <button type="button" role="option" aria-selected={kind === value.trim()}
          id={id + '-option-' + index} key={kind} tabIndex={-1} className={active === index ? 'active' : ''}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(kind)}>
          {custom && index === filtered.length ? <><Plus size={15}/>添加“{kind}”</> : <><span>{kind}</span>{kind === value.trim() && <Check size={14}/>}</>}
        </button>)}
      </div>}
    </div>
    <small id={id + '-help'}>选择预设类型，或输入后添加自定义类型。</small>
  </div>;
}
