"""Verify the preview's proxy against an isolated copy of the actual API.

Creates temporary fictional records only. Does not use existing credentials,
case data, search services, workers, or generation models.
"""
import http.cookiejar
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

root=Path(__file__).resolve().parents[1]
app=root.parent/'chatbot-system-poc-1106'
def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1',0));return s.getsockname()[1]
api_port,preview_port=free_port(),free_port()
data=Path(tempfile.mkdtemp(prefix='caiyan-design-live-'))
logs=(data/'server.log').open('w')
env={**os.environ,'CAIYAN_DATA_DIR':str(data),'LITELLM_LOCAL_MODEL_COST_MAP':'True'}
api=subprocess.Popen([str(app/'.venv/bin/python'),'-m','uvicorn','backend.app.main:app','--host','127.0.0.1','--port',str(api_port),'--no-access-log'],cwd=app,env=env,stdout=logs,stderr=logs)
proxy=subprocess.Popen(['python3',str(root/'serve.py'),'--port',str(preview_port),'--backend-port',str(api_port)],stdout=logs,stderr=logs)
base=f'http://127.0.0.1:{preview_port}'
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,method='GET',body=None,headers=None):
    req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),method=method,headers={'Content-Type':'application/json',**(headers or {})})
    with client.open(req,timeout=10) as response:
        return response.status,response.read()
try:
    for attempt in range(150):
        if api.poll() is not None or proxy.poll() is not None:raise RuntimeError('A verification server stopped. See temporary server.log.')
        try:
            if request('/api/v1/me')[0]==200:break
        except urllib.error.HTTPError as error:
            if error.code==401:break
        except (OSError,urllib.error.URLError):pass
        time.sleep(.1)
    credential=json.loads((data/'local-credentials.json').read_text())
    status,raw=request('/api/v1/auth/login','POST',{'username':credential.get('username','admin'),'password':credential['password']},{'Origin':base})
    me=json.loads(raw);headers={'Origin':base,'X-CSRF-Token':me['csrf']}
    assert status==200 and len(list(jar))>0
    status,raw=request('/api/v1/cases','POST',{'title':'设计连接验收 · 虚构案件','claims':'仅验证接口与样式预览连接','position':'原告代理律师','research_date':'2026-11-10'},headers)
    c=json.loads(raw);assert status in (200,201)
    status,raw=request('/api/v1/cases/'+c['id']+'/materials/text','POST',{'name':'虚构材料.txt','text':'这是一份用于设计接口验收的虚构文本。','kind':'律师整理记录'},headers)
    m=json.loads(raw);assert status in (200,201) and m['status']=='ready'
    status,raw=request('/api/v1/materials/'+m['id']);assert json.loads(raw)['text']=='这是一份用于设计接口验收的虚构文本。'
    status,raw=request('/api/v1/materials/'+m['id']+'/download');assert status==200 and raw
    status,raw=request('/api/v1/cases/'+c['id']);current=json.loads(raw)
    status,raw=request('/api/v1/cases/'+c['id'],'PATCH',{'title':'已编辑的验收案件','claims':current['claims'],'position':current['position'],'research_date':current['research_date']},{**headers,'If-Match':str(current['revision'])})
    assert status==200
    try:request('/api/v1/cases','POST',{'title':'应被拒绝','claims':'跨来源写入'},{**headers,'Origin':'http://untrusted.invalid'})
    except urllib.error.HTTPError as error:assert error.code==403
    else:raise AssertionError('Cross-origin writes must be rejected')
    try:request('/api/v1/cases','POST',{'title':'应被拒绝','claims':'缺少会话校验'},{'Origin':base})
    except urllib.error.HTTPError as error:assert error.code==403
    else:raise AssertionError('CSRF must remain enforced')
    status,raw=request('/api/v1/auth/logout','POST',{},headers);assert status==200
    print(json.dumps({'passed':9,'scope':'real API with isolated temporary data','verified':['login cookies','same-origin proxy','case creation','text material ingestion','source reading','original download','case editing','CSRF and origin rejection','logout'],'existing_workspace':'unchanged'},ensure_ascii=False,indent=2))
finally:
    for process in (proxy,api):
        process.terminate()
        try:process.wait(timeout=8)
        except subprocess.TimeoutExpired:process.kill();process.wait()
    logs.close()
