const { chromium } = require('playwright');
const fs = require('fs');
const median = a => { const s=[...a].sort((x,y)=>x-y); return s[Math.floor(s.length/2)]; };
async function once(browser, url){
  const ctx = await browser.newContext({viewport:{width:1280,height:800}});
  const page = await ctx.newPage();
  const c = await ctx.newCDPSession(page);
  await c.send('Network.enable');
  await c.send('Network.setCacheDisabled',{cacheDisabled:true});
  await c.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:(1.6*1024*1024)/8,uploadThroughput:(750*1024)/8});
  let bytes=0; const files={}; const urls={};
  c.on('Network.responseReceived',e=>{urls[e.requestId]=e.response.url;});
  c.on('Network.loadingFinished',e=>{bytes+=e.encodedDataLength||0; const u=urls[e.requestId]; if(u&&!u.startsWith('data:')) files[u.split('/').pop()||'index.html']=e.encodedDataLength;});
  await page.goto(url,{waitUntil:'load'});
  await page.waitForTimeout(400);
  const t = await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const f=performance.getEntriesByType('paint').find(p=>p.name==='first-contentful-paint');return{dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),fcp:f?Math.round(f.startTime):null}});
  await ctx.close();
  return {bytes,files,...t};
}
(async()=>{
  const browser = await chromium.launch();
  const out={};
  for (const [k,url] of [['antes','http://localhost:8091/index.html'],['depois','http://localhost:8092/index.html']]){
    const runs=[]; for(let i=0;i<7;i++) runs.push(await once(browser,url));
    out[k]={bytes:median(runs.map(r=>r.bytes)),dcl:median(runs.map(r=>r.dcl)),load:median(runs.map(r=>r.load)),fcp:median(runs.map(r=>r.fcp)),files:runs[0].files,requests:Object.keys(runs[0].files).length,runs:runs.length};
  }
  await browser.close();
  fs.writeFileSync('relatorios/metricas.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();
