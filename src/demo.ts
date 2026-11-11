/** Offline presentation data. Never reads or writes the original workspace. */
export const isDemo=new URLSearchParams(location.search).get('data')!=='live';
const KEY='caiyan-design-preview-v1';
const copy=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
const uid=(prefix:string)=>prefix+'-'+crypto.randomUUID().slice(0,8);
const now=()=>new Date().toISOString();
const date='2026-11-10T15:30:00.000Z';
const files=new Map<string,File>();
const options=()=>({query:'',mode:'semantic',limit:10,filters:{},date_from:null,date_to:null,province:'',court:'',cause:''});
const labels:Record<string,string>={province:'省份',city:'城市',court:'法院',cause:'案由',case_type:'案件类型',doc_type:'文书类型',procedure:'审理程序',court_level:'法院级别',case_level:'案例级别',judgment_year:'判决年份',judgment_date:'判决日期',published_at:'公开日期',accepted_at:'受理日期',title:'文书标题',case_number:'案号',outcome:'判决结果',laws:'关联法条',content:'文书内容'};
const judgments=[
  ['商品房逾期交付与合同解除纠纷','浙江省','杭州市','临溪区人民法院','商品房预售合同纠纷','2025-06-12','合同约定交付日期已经届满。买受人提交付款凭证及书面催告，双方对迟延原因与催告送达情况存在争议。'],
  ['商品房买卖合同违约责任纠纷','江苏省','南京市','澄江区人民法院','商品房预售合同纠纷','2025-06-18','当事人围绕合同交付条款、实际履行情况和损失证明发表意见。裁判材料分别记载了双方的主张及所提交的文件。'],
  ['房屋交付条件与通知送达纠纷','浙江省','宁波市','明湾区人民法院','房屋买卖合同纠纷','2025-06-21','本案争点涉及交付条件是否成就以及交付通知是否送达。现有文本列明合同、通知和签收记录，供研究者比较核对。'],
  ['住宅租赁合同履行纠纷','广东省','深圳市','云海区人民法院','房屋租赁合同纠纷','2025-06-23','双方对租赁期限、租金支付与房屋返还存在分歧。租赁合同与转账凭证是本示例的主要材料。'],
  ['建设工程价款结算纠纷','江苏省','苏州市','清川区人民法院','建设工程施工合同纠纷','2025-06-25','双方对工程范围及结算款项存在分歧。合同、工程签证、结算文件需要逐一对应核验。'],
  ['民间借贷与还款事实纠纷','浙江省','杭州市','临溪区人民法院','民间借贷纠纷','2025-06-28','当事人就借款交付与还款情况提交转账凭证和沟通记录。研究时需区分原始记录与事后说明。'],
].map((x,i)=>({document_id:'demo-judgment-'+(i+1),id:'demo-judgment-'+(i+1),title:x[0]+'（虚构示例）',province:x[1],city:x[2],court:x[3]+'（虚构）',cause:x[4],judgment_date:x[5],quote:x[6],content:'【界面体验专用 · 虚构文书，不是真实裁判】\n\n'+x[0]+'\n\n一、当事人陈述\n'+x[6]+'\n\n二、材料清单\n合同、付款记录、通知与往来函件。本示例不认定材料真实有效。\n\n三、研究提示\n请对照案情、来源与争点。这里展示原文阅读、引用定位及排除类案的交互方式，不构成真实裁判结论。',case_number:'演示案号-'+String(i+1).padStart(3,'0'),rank:i+1,source_row:i+1,section:'争点与材料（示例）',case_type:'民事',doc_type:'判决书',procedure:'一审',court_level:'基层法院',case_level:'普通案例',judgment_year:'2025',published_at:x[5],accepted_at:'2025-01-10',outcome:'示例结果，不能用于法律判断',laws:'法条须另行核验'}));

function material(id:string,name:string,text:string,kind='当事人提供材料'){
  return {id,logical_id:id,name,text,kind,version:1,status:'ready',characters:text.length,locations:[{label:'第 1 段',start:0,end:text.length}],warnings:[],created_at:date,content_hash:uid('hash')};
}
function sources(c:any,ids?:string[]){return c.materials.filter((m:any)=>!ids||ids.includes(m.id)).map((m:any,i:number)=>({id:'M'+(i+1),source_kind:'case_material',doc_id:m.id,name:m.name,location:'第 1 段',quote:m.text,start:0,end:m.text.length}));}
function judgmentSources(ids?:string[]){return judgments.filter(j=>!ids||ids.includes(j.document_id)).slice(0,3).map((j,i)=>({id:'J'+(i+1),source_kind:'judgment',doc_id:j.document_id,name:j.title,quote:j.quote,case_number:j.case_number,location:j.section}));}
function baseArtifact(c:any,kind:string,title:string,runId:string,sourceList?:any[]){
  return {id:uid('artifact'),case_id:c.id,kind,title,run_id:runId,version:1,parent_id:null,content_hash:uid('hash'),sources:sourceList||sources(c),body:'',structured:{},checks:{passed:true,issues:['界面示例内容，尚未经过真实模型分析或法律复核。']},review_status:'pending',stale:false,completeness:'limited',created_at:now()};
}
function makeArtifact(c:any,workflow:string,r:any,body:any={}){
  const parent=c.artifacts.find((a:any)=>a.id===(body.research_artifact_id||body.document_artifact_id||body.evidence_artifact_id));
  const refs=parent?.sources||[...sources(c,body.material_ids),...judgmentSources(body.research_selection?.doc_ids||body.evidence_selection?.doc_ids)];
  let a:any;
  if(workflow==='case.timeline'){
    a=baseArtifact(c,'timeline','案情时间线 · 示例',r.id,sources(c));
    a.structured.facts=c.materials.map((m:any,i:number)=>({id:uid('event'),date_text:['2024-03-18','2024-03-21','2025-09-08'][i]||'日期待核实',kind:['合同签订','款项支付','催告通知'][i]||'材料记载',description:m.text.replace('【虚构示例】',''),quote:m.text,material_id:m.id,source_ref:'M'+(i+1),status:'待复核'}));
    a.body='# 案情时间线（示例）\n'+a.structured.facts.map((f:any)=>f.date_text+' · '+f.description).join('\n');
  }else if(workflow==='evidence.gaps'){
    a=baseArtifact(c,'evidence','证据分析 · 示例',r.id,refs);
    a.evidence_view={existing_evidence:c.materials.filter((m:any)=>refs.some((s:any)=>s.doc_id===m.id)).map((m:any)=>({material_id:m.id,name:m.name,kind:m.kind,status:'仅演示材料关联',issues:['原件与记载待核对'],excerpts:refs.filter((s:any)=>s.doc_id===m.id).map((s:any)=>({source_id:s.id,quote:s.quote}))})),additional_evidence:[{issue:'交付与通知情况',evidence_needed:'交付通知及送达记录',why_needed:'演示如何将待核事项与补证工作关联。',obtain_from:'向当事人核实是否持有原件',next_step:'核对材料是否完整，再由律师判断其用途。',material_source_ids:refs.length?[refs[0].id]:[],source_ids:refs.slice(0,2).map((s:any)=>s.id)}],follow_up_details:[{question:'交付通知是否留有完整的送达记录？',why_matters:'用于展示补证问题与材料之间的联系。'},{question:'合同附件是否已经完整收集？',why_matters:'核对示例中的材料范围是否完整。'}],notices:['此处是预设示例内容，不是对当前材料的真实分析。']};
    a.body='# 证据分析（示例）\n\n已有材料：'+c.materials.map((m:any)=>m.name).join('、')+'\n\n待核：交付与送达记录、合同附件。';
  }else if(workflow==='evidence.followup'){
    a=baseArtifact(c,'evidence_answer','证据追问 · 示例',r.id,refs);
    a.structured={paragraphs:[{text:'示例回复：已记录您的追问“'+r.goal+'”。可以从来源入口核对材料，再补充相关原件。连接本地服务后将运行真实研究流程。',source_ids:refs.slice(0,1).map((s:any)=>s.id)}],limitations:['这是交互示例，不是模型生成的证据意见。']};
    a.body=a.structured.paragraphs[0].text;
  }else if(workflow==='document.generate'){
    const types:any={complaint:'民事起诉状',opinion:'代理意见',client:'客户情况说明',internal:'内部研究报告'};
    const name=types[body.document_type]||'民事起诉状';
    a=baseArtifact(c,'document',name+' · 示例草稿',r.id,refs);
    a.structured={document_type:body.document_type||'complaint',template:{id:body.document_template_id||'builtin:complaint',name},instructions:r.goal,material_ids:body.material_ids||c.materials.map((m:any)=>m.id),document_tasks:body.document_tasks||{},conversation:[...(parent?.structured.conversation||[]),{run_id:r.id,instructions:r.goal}]};
    a.body=parent?parent.body+'\n\n## 本次修改记录（示例）\n'+r.goal:'# '+name+'（界面示例）\n\n本文件是预设格式示例，未进行法律分析，不可直接提交。\n\n## 当事人\n原告：[待核实]\n被告：[待核实]\n\n## 研究目标\n'+c.claims+'\n\n## 事实与材料\n'+refs.filter((s:any)=>s.source_kind==='case_material').map((s:any)=>s.name+'：'+s.quote+' ['+s.id+']').join('\n\n')+'\n\n## 待核事项\n核对当事人身份、具体请求、合同原件及日期。\n\n起草要求：'+r.goal;
  }else{
    a=baseArtifact(c,'research','类案研究与行动清单 · 示例',r.id,refs);
    a.structured={conversation:parent?[...(parent.structured.conversation||[]),{question:r.goal,answer:'示例回复：已记录这个问题。请核对右侧来源；真实分析需要连接本地服务。'}]:[],refined_from:parent?.id};
    a.body='# 让研究回到材料与事实\n\n【预设示例 · 未调用模型】\n\n## 先核对三个问题\n1. 合同如何约定履行期限？\n2. 已经提供哪些付款与通知记录？\n3. 所选类案与本案的事实有何不同？\n\n## 已关联的研究依据\n'+refs.slice(0,4).map((s:any)=>s.name+' ['+s.id+']').join('\n')+'\n\n## 下一步行动\n逐一核对原文，补齐遗漏的材料；在证据分析中整理待核事项，在文书草稿中形成可审阅版本。\n\n本轮问题：'+r.goal;
  }
  if(parent){a.parent_id=parent.id;a.version=parent.version+1;}
  c.artifacts.unshift(a);r.research_artifact_id=a.kind==='research'?a.id:r.research_artifact_id;
  if(a.kind==='document')saveReference(c,a);
  return a;
}
function saveReference(c:any,a:any){
  const doc={id:uid('reference'),artifact_id:a.id,kind:a.kind,version:a.version,name:a.title+'_v'+a.version+'.docx',created_at:now(),analysis_created_at:a.created_at,answer_count:a.structured.conversation?.length||0,available:!a.stale&&a.checks.passed,review_status:a.review_status,stale:a.stale};
  c.reference_documents.unshift(doc);return doc;
}
function run(c:any,id:string,workflow:string,goal:string){return {id,case_id:c.id,goal,status:'succeeded',stage:'示例流程已完成',plan:[workflow],created_at:date,events:[{seq:1,created_at:date,type:'progress',payload:{stage:'示例：读取所选材料'}},{seq:2,created_at:date,type:'progress',payload:{stage:'示例：汇总与来源关联'}}],config_id:'示例配置一',model_calls:[],recovery_count:0,snapshot:{material_ids:c.materials.map((m:any)=>m.id),selected_doc_ids:judgments.slice(0,3).map(j=>j.document_id)}};}
function summary(c:any){
  const wait=c.runs.find((r:any)=>r.status==='waiting_input');
  const active=c.runs.find((r:any)=>['running','queued'].includes(r.status));
  return {...c,material_count:c.materials.length,waiting_count:c.runs.filter((r:any)=>r.status==='waiting_input').length,work_status:wait?'waiting_input':active?.status||c.runs[0]?.status||(c.materials.length?'ready_to_research':'needs_materials')};
}
function initialState(){
  const cases=[['demo-housing','云栖花园 · 逾期交付纠纷','原告代理律师','核对合同履行与通知情况，整理材料和诉讼研究方向。'],['demo-rental','青禾公寓 · 租赁合同纠纷','被告代理律师','核实租金结算与房屋返还的材料。'],['demo-construction','远山工程 · 工程款结算','原告代理律师','整理工程范围与结算文件。'],['demo-property','星河物业 · 服务合同纠纷','我方当事人代理律师','准备物业服务合同及费用明细。']].map(([id,title,position,claims],i)=>({id,title,position,claims,owner_id:'design-user',research_date:'2026-11-10',revision:1,source_revision:1,created_at:date,updated_at:new Date(Date.parse(date)-i*3600000).toISOString(),materials:i<3?[
    material(id+'-contract','合同与补充约定.txt','【虚构示例】2024年3月18日，双方签订合同。约定的履行期限与附件内容需要结合合同原件核对。'),
    material(id+'-payment','付款记录.txt','【虚构示例】2024年3月21日，当事人提供一份付款记录。具体金额、收款主体及款项用途待核实。'),
    material(id+'-notice','通知与往来函件.txt','【虚构示例】2025年9月8日，当事人发送一封履约催告函。送达凭证与后续回复尚待补齐。')]:[],artifacts:[] as any[],runs:[] as any[],reference_documents:[] as any[],selected_doc_ids:[] as string[],similar_cases:{needs_analysis:false,count:3,analyzed_at:date}}));
  for(const c of cases.slice(0,2)){
    for(const workflow of ['case.timeline','evidence.gaps','case.assess','document.generate']){
      const r=run(c,c.id+'-'+workflow,workflow,workflow==='case.assess'?'请梳理本案争点、研究依据与下一步行动。':'整理案件研究资料（示例）');
      c.runs.unshift(r);makeArtifact(c,workflow,r);
    }
  }
  cases[0].runs.unshift({...run(cases[0],'demo-waiting','case.timeline','继续整理材料与事实'),status:'waiting_input',stage:'等待您确认研究任务',wait_payload:{kind:'workflow',question:'希望先推进哪一项研究？',options:['case.timeline','evidence.gaps','case.assess','document.generate']}});
  const similar:any={};
  cases.forEach(c=>{similar[c.id]={version:1,options:options(),analyzed_options:options(),response:{items:copy(judgments.slice(0,3)),candidate_count:3,elapsed_ms:0,retrieval_mode:'semantic',warnings:['以下为虚构文书，仅用于界面预览。'],applied_filters:options()},count:3,needs_analysis:false,readable_material_count:c.materials.length,analyzed_source_revision:1,analyzed_at:date,updated_at:date,suggested_query:c.claims,query_warnings:['示例描述来自虚构案件目标。'],excluded_items:[],excluded_from_current_count:0};});
  return {schema:1,cases,similar,configs:[{id:'config-1',version:1,created_at:date,content:{audience:'内部律师',length:'标准',tone:'清晰、审慎、依据充分',opening:'以下为研究工作记录，请结合材料原文复核。',prompt:'区分材料记载、研究判断与待核事项。',skill:'逐项关联来源，保留材料引用。',model:'本地批准模型'}}],tests:{} as any,loggedIn:true};
}
let state:any;
try{state=JSON.parse(localStorage.getItem(KEY)||'null');if(state?.schema!==1)state=null}catch{}
if(!state){
  state=initialState();
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}
}
for(const c of state.cases)for(const r of c.runs){if(r.wait_payload?.kind==='workflow_selection')r.wait_payload.kind='workflow';}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{throw new Error('浏览器存储空间不足，修改未能持久保存。请先导出资料。')}}
function findCase(id:string){const c=state.cases.find((c:any)=>c.id===id);if(!c)throw new Error('案件不存在或已删除。');return c;}
function findArtifact(id:string){for(const c of state.cases){const a=c.artifacts.find((a:any)=>a.id===id);if(a)return {c,a};}throw new Error('成果不存在或已删除。');}
function findMaterial(id:string){for(const c of state.cases){const m=c.materials.find((m:any)=>m.id===id);if(m)return {c,m};}throw new Error('材料不存在或已撤回。');}
function stale(c:any){c.revision++;c.source_revision++;c.updated_at=now();c.artifacts.forEach((a:any)=>a.stale=true);c.reference_documents.forEach((d:any)=>d.stale=true);state.similar[c.id].needs_analysis=true;c.similar_cases.needs_analysis=true;}
function assertVersion(c:any,headers:any){if(headers['If-Match']&&Number(headers['If-Match'])!==c.revision)throw new Error('案件已更新，请重新读取后保存。');}
function settle(){for(const c of state.cases)for(const r of c.runs){if(r.status==='running'&&r.finishAt<Date.now()){r.status='succeeded';r.stage='示例流程已完成 · 未调用模型';makeArtifact(c,r.plan[0],r,r.input);delete r.finishAt;persist();}}}
function search(body:any,ignoreField=''){
  let items=judgments.filter(j=>Object.entries(body.filters||{}).every(([k,v]:any)=>k===ignoreField||!v.length||v.includes(String((j as any)[k]||'未载明'))));
  if(body.date_from)items=items.filter(j=>j.judgment_date>=body.date_from);
  if(body.date_to)items=items.filter(j=>j.judgment_date<=body.date_to);
  if(body.query?.trim()){
    const words=body.query.trim().split(/[\s，。、]+/).filter(Boolean);
    items=items.filter(j=>words.some((w:string)=>(j.title+j.content+j.cause+j.case_number+j.court).includes(w)));
  }
  return {items:copy(items.slice(0,body.limit||20)).map((j,i)=>({...j,rank:i+1})),candidate_count:items.length,elapsed_ms:0,retrieval_mode:body.mode==='case_number'?'exact':body.mode||'keyword',degraded:false,warnings:['本地示例采用文本匹配；语义模型与真实语料请连接原有服务。'],applied_filters:{...options(),...body}};
}
function facets(body:any){
  const matching=search({...body,query:'',limit:100}).items;
  const relevant=search({...body,query:'',limit:100},body.field).items;
  const choices=(key:string,all:any[])=>Array.from(new Set(all.map(j=>String(j[key]||'未载明')))).map(label=>({value_id:label,label,count:all.filter(j=>String(j[key]||'未载明')===label).length,characters:label.length,is_missing:label==='未载明'?1:0}));
  const opts=body.field?choices(body.field,relevant).filter(o=>!body.text||o.label.includes(body.text)):[];
  const start=body.offset||0,limit=body.limit||50;
  return {fields:Object.entries(labels).map(([key,label])=>({key,label,kind:'text',distinct_values:choices(key,judgments).length,missing_documents:0})),matching_documents:matching.length,selected:Object.fromEntries(Object.entries(body.filters||{}).map(([key,values]:any)=>[key,choices(key,judgments).filter(o=>values.includes(o.value_id))])),options:opts.slice(start,start+limit),total_options:opts.length,has_more:start+limit<opts.length,next_offset:start+limit<opts.length?start+limit:null};
}
export async function demoApi(path:string,method='GET',body:any={},headers:Record<string,string>={}){
  settle();body??={};const p=path.split('?')[0].split('/').filter(Boolean);let result:any;
  if(path==='/me')return state.loggedIn?{id:'design-user',name:'林律师',role:'admin',csrf:'preview-only'}:null;
  if(path==='/auth/login'){state.loggedIn=true;persist();return {id:'design-user',name:'林律师',role:'admin',csrf:'preview-only'};}
  if(path==='/auth/logout'){state.loggedIn=false;persist();return {ok:true};}
  if(!state.loggedIn)throw new Error('请先进入示例工作区。');
  if(path==='/health')return {corpus:{documents:judgments.length,passages:judgments.length},services:{}};
  if(path==='/search')return search(body);
  if(path==='/search/facets')return facets(body);
  if(p[0]==='judgments'){const j=judgments.find(j=>j.document_id===p[1]);if(!j)throw new Error('示例文书不存在');return copy(j);}
  if(path==='/law-sources')return [];
  if(path==='/document-templates')return Object.entries({complaint:'民事起诉状',opinion:'代理意见',client:'客户情况说明',internal:'内部研究报告'}).map(([id,name])=>({id:'builtin:'+id,name,description:'界面演示模板，请核实正式文书要求。',text:'# '+name+'\n\n## 当事人\n{{当事人身份}}\n\n## 请求事项\n{{研究目标}}\n\n## 事实与理由\n{{材料与来源}}\n\n## 材料清单\n{{证据目录}}',sections:['当事人','请求事项','事实与理由','材料清单']}));
  if(p[0]==='cases'){
    if(p.length===1){
      if(method==='GET')return copy(state.cases.map(summary));
      const c={id:uid('case'),...body,owner_id:'design-user',revision:1,source_revision:1,created_at:now(),updated_at:now(),materials:[],artifacts:[],runs:[],reference_documents:[],selected_doc_ids:[],similar_cases:{count:0,needs_analysis:false,analyzed_at:null}};
      state.cases.unshift(c);state.similar[c.id]={version:0,options:options(),analyzed_options:options(),response:null,count:0,needs_analysis:false,readable_material_count:0,analyzed_source_revision:1,analyzed_at:null,suggested_query:c.claims,query_warnings:[],excluded_items:[],excluded_from_current_count:0};result=c;
    }else{
      const c=findCase(p[1]);
      if(p.length===2){
        if(method==='GET')return copy(summary(c));
        assertVersion(c,headers);
        if(method==='DELETE'){state.cases=state.cases.filter((x:any)=>x.id!==c.id);delete state.similar[c.id];result={id:c.id,status:'deleted'};}
        else{Object.assign(c,body);stale(c);result=summary(c);}
      }else if(p[2]==='materials'){
        let name=body.name,text=body.text,kind=body.kind||'当事人提供材料',file:File|undefined;
        if(body instanceof FormData){file=body.get('file') as File;if(file.size>20*1024*1024)throw new Error('文件超过 20 MiB。');name=file.name;kind=String(body.get('kind')||kind);text=/\.(txt|md)$/i.test(name)?await file.text():'';}
        const m=material(uid('material'),name,text||'',kind);
        if(file&&!text){m.status='partial';m.warnings=['示例预览仅保存文件信息；请连接本地服务解析此格式。'];m.locations=[];}
        if(file)files.set(m.id,file);c.materials.unshift(m);stale(c);result=m;
      }else if(p[2]==='similar-cases'){
        const data=state.similar[c.id];data.readable_material_count=c.materials.filter((m:any)=>m.status==='ready').length;data.suggested_query=c.claims;
        if(method==='GET')return copy(data);
        if(body.version!==data.version)throw new Error('类案列表已更新，请重新读取。');
        if(p[4]==='relevance'){
          const id=decodeURIComponent(p[3]);
          if(!body.relevant){const item=data.response?.items.find((x:any)=>x.document_id===id);if(item){data.excluded_items.push({item,in_current_results:true});data.response.items=data.response.items.filter((x:any)=>x.document_id!==id);}}
          else{const entry=data.excluded_items.find((x:any)=>x.item.document_id===id);if(entry?.in_current_results)data.response.items.push(entry.item);data.excluded_items=data.excluded_items.filter((x:any)=>x.item.document_id!==id);data.response?.items.sort((a:any,b:any)=>a.rank-b.rank);}
        }else{
          data.options=body.options;
          if(p[3]==='analyze'){
            data.response=search({...body.options,query:body.options.query||''});
            data.excluded_items.forEach((e:any)=>e.in_current_results=data.response.items.some((i:any)=>i.document_id===e.item.document_id));
            data.response.items=data.response.items.filter((i:any)=>!data.excluded_items.some((e:any)=>e.item.document_id===i.document_id));
            data.analyzed_options=copy(body.options);data.analyzed_source_revision=c.source_revision;data.analyzed_at=now();data.needs_analysis=false;
          }else data.needs_analysis=!!data.response&&JSON.stringify(data.options)!==JSON.stringify(data.analyzed_options);
        }
        data.version++;data.updated_at=now();data.count=data.response?.items.length||0;data.excluded_from_current_count=data.excluded_items.filter((e:any)=>e.in_current_results).length;c.similar_cases={count:data.count,needs_analysis:data.needs_analysis,analyzed_at:data.analyzed_at};result=data;
      }else if(p[2]==='research-selections'){c.selected_doc_ids=body.doc_ids;result={ok:true};}
      else if(p[2]==='requests'){
        const workflow=body.workflow||'case.assess';
        const r:any=run(c,uid('run'),workflow,body.goal);r.status='running';r.stage='正在播放示例研究流程 · 未调用模型';r.finishAt=Date.now()+800;r.created_at=now();r.input=copy(body);r.evidence_artifact_id=body.evidence_artifact_id;
        r.snapshot={material_ids:body.material_ids||c.materials.map((m:any)=>m.id),selected_doc_ids:body.research_selection?.doc_ids||body.evidence_selection?.doc_ids||judgments.slice(0,3).map(j=>j.document_id)};
        c.runs.unshift(r);c.updated_at=now();result=r;
      }else if(p[2]==='feedback'){
        const a=c.artifacts.find((a:any)=>a.id===body.target_id);if(!a)throw new Error('成果不存在');a.checks.passed=false;a.checks.issues.push(body.note);c.reference_documents.filter((d:any)=>d.artifact_id===a.id).forEach((d:any)=>d.available=false);result={ok:true};
      }
    }
  }else if(p[0]==='materials'){
    const {c,m}=findMaterial(p[1]);if(method==='GET')return copy(m);
    c.materials=c.materials.filter((x:any)=>x.id!==m.id);stale(c);c.runs.filter((r:any)=>['queued','running','waiting_input'].includes(r.status)).forEach((r:any)=>r.status='cancelled');
    c.artifacts.filter((a:any)=>a.sources.some((s:any)=>s.doc_id===m.id)).forEach((a:any)=>{a.checks.passed=false;a.checks.issues.push('来源材料已撤回。')});
    c.reference_documents.forEach((d:any)=>{const a=c.artifacts.find((a:any)=>a.id===d.artifact_id);d.available=!!a?.checks.passed});result={ok:true};
  }else if(p[0]==='artifacts'){
    const {c,a}=findArtifact(p[1]);
    if(p[2]==='versions'){
      if(body.content_hash!==a.content_hash)throw new Error('成果已发生变化，请重新读取。');
      if(c.artifacts.some((x:any)=>x.parent_id===a.id))throw new Error('已有更新版本，请载入最新版本。');
      const next={...copy(a),id:uid('artifact'),parent_id:a.id,version:a.version+1,content_hash:uid('hash'),review_status:'pending',created_at:now()};
      if(body.facts){next.structured.facts=body.facts.map((f:any)=>{const original=a.structured.facts.find((x:any)=>x.id===f.id&&x.source_ref===f.source_ref);return {...f,quote:original?.quote||'',edited:true}});next.body='# 案情时间线（示例）\n'+body.facts.map((f:any)=>f.date_text+' · '+f.description).join('\n');}
      if(body.body)next.body=body.body;c.artifacts.unshift(next);if(a.kind==='document')saveReference(c,next);result=next;
    }else if(p[2]==='reviews'){
      if(body.content_hash!==a.content_hash||a.stale||!a.checks.passed)throw new Error('请核对当前可用版本后再复核。');a.review_status='reviewed';c.reference_documents.filter((d:any)=>d.artifact_id===a.id).forEach((d:any)=>d.review_status='reviewed');result={ok:true};
    }else if(p[2]==='reference-documents'){
      if(a.stale||!a.checks.passed)throw new Error('来源已变化或检查未通过，请更新后再导出。');result=saveReference(c,a);
    }else return copy(a);
  }else if(p[0]==='reference-documents'){
    for(const c of state.cases){const doc=c.reference_documents.find((d:any)=>d.id===p[1]);if(doc){if(method==='DELETE')c.reference_documents=c.reference_documents.filter((d:any)=>d.id!==p[1]);result=doc;break;}}
  }else if(p[0]==='runs'){
    let c:any,r:any;for(const item of state.cases){const found=item.runs.find((r:any)=>r.id===p[1]);if(found){c=item;r=found;break;}}
    if(!r)throw new Error('任务不存在或已取消。');
    if(method==='POST'){
      if(p[2]==='cancel'){r.status='cancelled';r.stage='示例任务已取消';}
      else{r.status='running';r.stage='正在继续示例流程';r.input||={};r.finishAt=Date.now()+800;r.recovery_count++;if(p[2]==='resume'){const answer=body.answer?.workflow||body.answer;if(typeof answer==='string'&&['case.timeline','case.assess','evidence.gaps','document.generate'].includes(answer))r.plan=[answer];}}
      result=r;
    }else if(p[2]==='document')return {agents:c.materials.map((m:any,i:number)=>({rank:i+1,material_id:m.id,name:m.name,status:r.status==='running'?'running':'succeeded',sources:sources(c),result:r.status==='running'?null:{characters_read:m.characters,findings:[{section:'材料整理（示例）',summary:m.text,source_ids:[]}]}}))};
    else if(p[2]==='research'||p[2]==='evidence'){
      const candidates=judgments.filter(j=>r.snapshot.selected_doc_ids.includes(j.document_id));
      return {run_status:r.status,stage:r.stage,batch:{status:r.status,total:candidates.length,completed:r.status==='succeeded'?candidates.length:0,selection_mode:'filtered_demo',candidates,agents:candidates.map((j,i)=>({doc_id:j.document_id,rank:i+1,status:r.status==='running'?'running':'succeeded',sources:judgmentSources([j.document_id]),coverage:{partial:false,included_characters:j.content.length,total_characters:j.content.length},result:r.status==='running'?null:{findings:[{id:'finding-'+i,issue:'事实与材料的对应关系（示例）',facts:j.quote,reasoning:'预设内容，仅演示逐案分析与来源回看。',outcome:'请核对原文',evidence:'合同与往来记录',treatment:'待核实',fact:'材料与争点的联系',source_ids:['J1']}],limits:['此为虚构示例，不是实际模型分析。']}}))}};
    }else return copy(r);
  }else if(p[0]==='admin'){
    if(p[2]==='tests'){if(method==='GET')return copy(state.tests[p[3]]);result={id:uid('config-test'),status:'passed',result:{output:{text:'【固定示例输出 · 未调用模型】\n已展示当前文风配置。真实配置测试需要连接本地服务。'}}};state.tests[result.id]=result;}
    else if(p[2]==='publish'){if(!body.reviewed||!state.tests[body.test_id])throw new Error('请先试运行并确认输出。');result={id:uid('config'),version:state.configs[0].version+1,content:body.content,created_at:now()};state.configs.unshift(result);}
    else return copy(state.configs);
  }
  if(result===undefined)throw new Error('此操作需要连接原有本地服务。');
  persist();return copy(result);
}

function escapeXML(s:string){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));}
/** Minimal valid OOXML package; stored ZIP, UTF-8 text, no remote dependencies. */
function wordBlob(text:string){
  const parts:Record<string,string>={
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+text.split('\n').map(t=>'<w:p><w:r><w:t xml:space="preserve">'+escapeXML(t)+'</w:t></w:r></w:p>').join('')+'<w:sectPr/></w:body></w:document>'};
  const encoder=new TextEncoder(), chunks:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
  const crc=(bytes:Uint8Array)=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  for(const [name,content] of Object.entries(parts)){
    const n=encoder.encode(name),b=encoder.encode(content),sum=crc(b),local=new Uint8Array(30+n.length),v=new DataView(local.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,b.length,true);v.setUint32(22,b.length,true);v.setUint16(26,n.length,true);local.set(n,30);chunks.push(local,b);
    const dir=new Uint8Array(46+n.length),d=new DataView(dir.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,sum,true);d.setUint32(20,b.length,true);d.setUint32(24,b.length,true);d.setUint16(28,n.length,true);d.setUint32(42,offset,true);dir.set(n,46);central.push(dir);offset+=local.length+b.length;
  }
  const length=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,length,true);e.setUint32(16,offset,true);
  return new Blob([...chunks,...central,end] as BlobPart[],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function saveBlob(blob:Blob,name:string){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export function demoDownload(path:string){
  const p=path.replace('/api/v1','').split('/').filter(Boolean);
  if(p[0]==='materials'){const {m}=findMaterial(p[1]);if(files.has(m.id))saveBlob(files.get(m.id)!,m.name);else if(m.status==='partial')throw new Error('刷新后需要重新添加文件，才能下载原件。');else saveBlob(new Blob([m.text],{type:'text/plain;charset=utf-8'}),m.name);return;}
  if(p[0]==='artifacts'){const {a}=findArtifact(p[1]);if(a.review_status!=='reviewed'||a.stale||!a.checks.passed)throw new Error('请先复核可用的当前版本。');saveBlob(new Blob([a.body],{type:'text/markdown;charset=utf-8'}),a.title+'.md');return;}
  for(const c of state.cases){const doc=c.reference_documents.find((d:any)=>d.id===p[1]);if(doc){const a=c.artifacts.find((a:any)=>a.id===doc.artifact_id);if(!doc.available||!a?.checks.passed)throw new Error('来源已撤回，此文档不可导出。');saveBlob(wordBlob(a.body),doc.name);return;}}
  throw new Error('没有找到可下载的文档。');
}
export function installDemoDownloads(){
  if(!isDemo)return;
  document.addEventListener('click',event=>{const link=(event.target as Element)?.closest?.('a');const href=link?.getAttribute('href')||'';if(href.startsWith('/api/v1/')){event.preventDefault();try{demoDownload(href)}catch(error){const el=document.createElement('div');el.className='download-notice';el.setAttribute('role','alert');el.textContent=(error as Error).message;document.body.append(el);setTimeout(()=>el.remove(),7000);}}});
}
export const demoInternals={getState:()=>copy(state),judgments:copy(judgments),wordBlob};
