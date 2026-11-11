import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowRight, BookOpen, FileText, LoaderCircle, Sparkles} from 'lucide-react';
import {defaultCaseIds, distinctCases} from './caseSelection';

const LIMIT=3;
const prompts=[
  {title:'类案对比',description:'比较事实、争点与裁判理由',text:'请结合所选材料，逐案比较本案与所选类案的关键事实、争议焦点、证据和裁判理由。说明相似与不同之处、可借鉴的观点及适用限制，并为每项判断标注来源。'},
  {title:'诉讼策略',description:'明确主张、路径与行动顺序',text:'请根据所选材料与类案，从本案代理立场提出诉讼策略。分别列出主要主张、备选路径、关键证据、对方可能的抗辩和下一步行动，说明依据与待核实事项。'},
  {title:'证据与补证',description:'找出证明缺口与补证方向',text:'请结合所选类案的证据认定，对照本次材料梳理待证明事实、已有证据、证明缺口和补证方向。说明每项证据的用途及获取途径，区分已提供材料与建议补充的材料，并标注来源。'},
  {title:'风险与抗辩',description:'检查不利事实与应对方案',text:'请基于所选材料与类案，分析本案不利事实、可能的抗辩及主要诉讼风险。逐项说明依据、应对思路与尚待核实的条件，避免对结果作无依据的判断。'},
  {title:'诉讼请求梳理',description:'核对请求、依据与支持材料',text:'请根据本次材料与所选类案梳理可研究的诉讼请求，列出各项请求的事实基础、可核对的依据、支持材料和待补充信息。对现有来源无法支持的内容明确标注待核实。'},
  {title:'研究摘要',description:'提炼结论与下一步核查清单',text:'请根据所选材料与类案整理一份简明研究摘要，包含核心争点、类案启示、已有依据、尚未解决的问题及下一步核查清单。区分材料事实与分析意见，并标注引用来源。'},
];
type Api=(path:string,method?:string,body?:any)=>Promise<any>;

export function useResearchScope(c:any,api:Api){
  const [caseSelection,setCaseSelection]=useState<{version:number;ids:string[]}|null>(null);
  const [materialSelection,setMaterialSelection]=useState<string[]|null>(null);
  const similar=useQuery({queryKey:['similar-cases',c.id],queryFn:()=>api('/cases/'+c.id+'/similar-cases'),refetchInterval:3000});
  const data=similar.data;
  const candidates=distinctCases<any>(data?.response?.items||[]);
  const caseIds=caseSelection?.ids??defaultCaseIds(candidates);
  const materials=c.materials.filter((m:any)=>m.kind!=='文书模板');
  const ready=materials.filter((m:any)=>m.status==='ready');
  const materialIds=materialSelection??ready.slice(0,LIMIT).map((m:any)=>m.id);
  const outdated=!!caseSelection&&caseSelection.version!==data?.version;
  const invalidMaterials=materialIds.some((id:string)=>!ready.some((m:any)=>m.id===id));
  const selectable=!!data?.response&&!data.needs_analysis&&!similar.isError;
  const valid=selectable&&!outdated&&!invalidMaterials&&caseIds.length>0&&caseIds.length<=LIMIT&&materialIds.length>0&&materialIds.length<=LIMIT;
  return {similar,data,candidates,caseIds,materials,materialIds,outdated,invalidMaterials,selectable,valid,
    setCaseSelection,setMaterialSelection,
    request:{material_ids:materialIds,research_selection:{similar_version:data?.version,doc_ids:caseIds}}};
}

type Props={c:any;source:(ref:any)=>void;disabled:boolean;scope:ReturnType<typeof useResearchScope>};
export default function ResearchSetup({c,source,disabled,scope}:Props){
  const {similar,data,candidates,caseIds,materials,materialIds,outdated,invalidMaterials,selectable,setCaseSelection,setMaterialSelection}=scope;
  return (
    <section className="card research-start" aria-label="开始类案研究">
      <div className="section-heading"><div><h3><BookOpen size={19}/>选择研究依据</h3><p className="muted">类案与本案材料各选最多 3 项，作为 AI 分析与引用的依据。</p></div></div>
      <div className="research-scope-grid">
        <section className="research-scope" aria-labelledby="research-cases-title">
          <header><h4 id="research-cases-title"><BookOpen size={16}/>类案</h4><span className="tag blue" role="status">已选 {caseIds.length} / {LIMIT}</span></header>
          <div className="research-scope-caption"><span>来自本案类案列表</span><Link to={'/cases/'+c.id+'/similar-cases'}>管理类案 <ArrowRight size={12}/></Link></div>
          {similar.isPending?<p className="research-scope-empty" role="status"><LoaderCircle size={16} className="spin"/>正在读取类案…</p>:similar.isError?<div className="notice warning" role="alert">{similar.error.message}<button type="button" className="text-button" onClick={()=>similar.refetch()}>重新加载</button></div>:!data?.response?<p className="research-scope-empty">请先在<Link to={'/cases/'+c.id+'/similar-cases'}>类案页</Link>分析并保存参考案例。</p>:<>
            {data.needs_analysis&&<p className="notice warning" role="alert">类案依据或筛选条件已变化，请在类案页重新分析。</p>}
            {outdated&&<div className="notice warning" role="alert">类案列表已更新，请重新确认选择。<button type="button" className="text-button" disabled={disabled} onClick={()=>setCaseSelection(null)}>使用当前列表重新选择</button></div>}
            <div className="research-scope-list">{candidates.map(item=>{
              const checked=caseIds.includes(item.document_id);
              return <div className={'research-source-row'+(checked?' is-selected':'')} key={item.document_id}>
                <label className="checkline"><input type="checkbox" checked={checked} disabled={disabled||!selectable||(!checked&&caseIds.length>=LIMIT)} onChange={e=>setCaseSelection({version:data.version,ids:e.target.checked?[...caseIds,item.document_id]:caseIds.filter(id=>id!==item.document_id)})}/><span><strong>{item.title}</strong><small>{item.case_number} · {item.court}</small></span></label>
                <button type="button" className="text-button" aria-label={'查看类案原文：'+item.title} onClick={()=>source({source_kind:'judgment',doc_id:item.document_id,name:item.title,quote:item.quote})}>原文</button>
              </div>;
            })}</div>
            {!candidates.length&&<p className="research-scope-empty">当前没有可选类案，请在类案页调整条件后重新分析。</p>}
          </>}
          <p className="research-scope-hint">{caseIds.length>=LIMIT?'已选满 3 个，可取消后更换。':'最多选择 3 个不同类案。'}</p>
        </section>
        <section className="research-scope" aria-labelledby="research-materials-title">
          <header><h4 id="research-materials-title"><FileText size={16}/>本次材料范围</h4><span className="tag blue" role="status">已选 {materialIds.length} / {LIMIT}</span></header>
          <div className="research-scope-caption"><span>选择本轮需要分析的材料</span><Link to={'/cases/'+c.id+'/materials'}>材料中心 <ArrowRight size={12}/></Link></div>
          <div className="research-scope-list">{materials.map((m:any)=>{
            const checked=materialIds.includes(m.id);
            return <div className={'research-source-row'+(checked?' is-selected':'')} key={m.id}>
              <label className="checkline"><input type="checkbox" checked={checked} disabled={disabled||(!checked&&(m.status!=='ready'||materialIds.length>=LIMIT))} onChange={e=>setMaterialSelection(e.target.checked?[...materialIds,m.id]:materialIds.filter((id:string)=>id!==m.id))}/><span><strong>{m.name}</strong><small>{m.status==='ready'?`${m.characters.toLocaleString()} 字 · 可用于研究`:'尚未完整读取'}</small></span></label>
              <button type="button" className="text-button" aria-label={'查看材料原文：'+m.name} onClick={()=>source({source_kind:'case_material',doc_id:m.id,name:m.name})}>原文</button>
            </div>;
          })}</div>
          {!materials.length&&<p className="research-scope-empty">请在<Link to={'/cases/'+c.id+'/materials'}>材料中心</Link>上传或录入本案材料。</p>}
          {invalidMaterials&&<p className="notice warning" role="alert">所选材料已变化，请重新确认。<button type="button" className="text-button" onClick={()=>setMaterialSelection(null)}>重新选择材料</button></p>}
          <p className="research-scope-hint">{materialIds.length>=LIMIT?'已选满 3 份，可取消后更换。':'最多选择 3 份可读材料。'}</p>
        </section>
      </div>
    </section>
  );
}

export function ResearchPrompts({disabled,onSelect}:{disabled:boolean;onSelect:(text:string)=>void}){
  return <section className="research-prompts" aria-label="常用提示词">
    <h3><Sparkles size={16}/>从一个问题开始</h3>
    <div className="research-prompt-list">{prompts.map(prompt=><button type="button" key={prompt.title} className="research-prompt" disabled={disabled} onClick={()=>onSelect(prompt.text)}><span><strong>{prompt.title}</strong><small>{prompt.description}</small></span><ArrowRight size={15}/></button>)}</div>
  </section>;
}
