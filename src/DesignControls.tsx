import {useEffect, useRef, useState} from 'react';
import {Check, CircleHelp, Monitor, Plug, X} from 'lucide-react';
import {isDemo} from './demo';

const styles=[{id:'harvey',name:'黑白',description:'纯粹黑白、沉静、专注'}, {id:'harvey-blue',name:'黑白蓝',description:'白底黑字、法蓝点缀'}, {id:'harvey-red',name:'黑白红',description:'白底黑字、绛红点缀'}, {id:'harvey-bright-blue',name:'蓝灰',description:'清亮蓝色、浅灰导航'}, {id:'ao',name:'深庭',description:'庄重、清晰、深绿'}, {id:'cooley',name:'珊瑚',description:'明快、开放、鲜明'}];
export default function DesignControls(){
  const [theme,setTheme]=useState(document.documentElement.dataset.theme||'harvey');
  const help=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    document.title='裁研 · '+styles.find(s=>s.id===theme)!.name+'工作台';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme==='ao'?'#103b31':theme==='cooley'?'#ef514b':'#ffffff');
  },[theme]);
  function choose(id:string){
    document.documentElement.dataset.theme=id;
    setTheme(id);
    try{localStorage.setItem('caiyan-design-theme',id)}catch{}
    const url=new URL(location.href);url.searchParams.set('theme',id);
    try{history.replaceState(history.state,'',url)}catch{}
  }
  function switchMode(){
    const url=new URL(location.href);url.searchParams.set('data',isDemo?'live':'demo');url.searchParams.set('theme',theme);
    location.href=url.toString();
  }
  return <div className="design-controls">
    <div className="style-switcher" role="group" aria-label="界面风格">
      {styles.map(s=><button type="button" key={s.id} data-style={s.id} aria-pressed={theme===s.id} aria-label={'切换为'+s.name+'风格'} title={s.name+' · '+s.description} onClick={()=>choose(s.id)}><i aria-hidden="true"/>{s.name}{theme===s.id&&<Check size={12}/>}</button>)}
    </div>
    <label className="compact-theme-picker"><span>风格</span><select aria-label="选择界面风格" value={theme} onChange={e=>choose(e.target.value)}>{styles.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <button className="design-mode" type="button" onClick={()=>help.current?.showModal()}><span className="mode-dot"/>{isDemo?'示例预览':'本地服务'}<CircleHelp size={14}/></button>
    <dialog className="design-help" ref={help} aria-labelledby="preview-title" onClick={e=>{if(e.target===help.current)help.current.close()}}>
      <header><span className="design-help-icon"><Monitor size={22}/></span><button className="icon-button" type="button" aria-label="关闭预览说明" onClick={()=>help.current?.close()}><X size={20}/></button></header>
      <p className="eyebrow">裁研 · 界面体验</p><h2 id="preview-title">六种风格，同一个工作空间。</h2>
      <p>顶部可随时切换黑白、黑白蓝、黑白红、蓝灰、深庭与珊瑚。页面、筛选条件、已选材料和未发送的消息都会保留。蓝灰搭配清亮蓝色和浅灰导航；各方案共享同一套案件工作流程。</p>
      <div className="design-help-note"><strong>{isDemo?'当前为本地示例预览':'当前连接原有本地服务'}</strong><p>{isDemo?'示例案件与裁判文书均为虚构。编辑会保存在本浏览器；研究、生成与配置测试使用明确标识的示例内容，不调用模型。文本可以本地读取，其他文件格式的解析请连接服务。':'使用原有账号、材料库、检索与模型工作流。案件操作会保存到原有服务。'}</p></div>
      {location.protocol==='file:'&&isDemo?<p className="small muted">连接原有服务：在本文件夹运行 python3 serve.py，然后打开 http://127.0.0.1:8878。</p>:<><p className="small muted">切换数据来源将重新加载页面，请先保存正在编辑的内容。{isDemo?'连接前请先启动原项目服务。':''}</p><button className="button primary" type="button" onClick={switchMode}><Plug size={16}/>{isDemo?'连接原有本地服务':'返回示例预览'}</button></>}
    </dialog>
  </div>;
}
