// Dependency-free execution of the page script with a simulated DOM.
// This checks state and arithmetic, not browser rendering or accessibility behavior.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const path = require('node:path');
const htmlPath = path.resolve(__dirname,'../index.html');
const fixture = JSON.parse(execFileSync('python3',['-c',String.raw`
from html.parser import HTMLParser
import json,sys
class Parser(HTMLParser):
 def __init__(self): super().__init__(); self.nodes=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a or 'choice' in a.get('class','').split(): self.nodes.append({'tag':tag,'attrs':a})
p=Parser();p.feed(open(sys.argv[1]).read())
cases=[]
for t,h in [(100,10),(200,16),(50,5)]:
 for n in range(h+1):
  selected=[1]*n+[0]*(h-n)
  rest=[1]*(h-n)+[0]*(t-2*h+n)
  flipped=[1-v for v in selected]
  cases.append(dict(total=t,heads=h,n=n,before=sum(selected),after=sum(flipped),remaining=sum(rest)))
strategies=[]
for k in range(1,100):
 for mode in ['a','b','none','both']:
  values=list(range(max(0,10-(100-k)),min(10,k)+1))
  def outcome(x): return {'a':k-x if mode in ['a','both'] else x,'b':(100-k)-(10-x) if mode in ['b','both'] else 10-x}
  sample=values[len(values)//2]
  counter=next((x for x in values if outcome(x)['a']!=outcome(x)['b']),None)
  strategies.append(dict(k=k,mode=mode,sample=sample,result=outcome(sample),guaranteed=counter is None,counter=counter,counterResult=None if counter is None else outcome(counter)))
print(json.dumps({'nodes':p.nodes,'cases':cases,'strategies':strategies}))
`,htmlPath],{encoding:'utf8'}));
class Node {
 constructor(tag,attrs={}) {
  this.tag=tag;this.attrs={...attrs};this.id=attrs.id;this.textContent='';this.value=attrs.value||'';
  this.hidden='hidden' in attrs;this.open=false;this.disabled=false;this.children=[];this.events={};
  this.min=attrs.min||'';this.max=attrs.max||'';this.step=attrs.step||'';
  this.dataset={total:attrs['data-total'],heads:attrs['data-heads'],mode:attrs['data-mode']};
  const classes=new Set((attrs.class||'').split(/\s+/));
  this.classList={toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)};
 }
 addEventListener(type,fn){(this.events[type]??=[]).push(fn)}
 dispatchEvent(e){for(const fn of this.events[e.type]||[])fn(e)}
 click(){if(!this.disabled)this.dispatchEvent({type:'click'})}
 setAttribute(k,v){this.attrs[k]=v}
 focus(){document.activeElement=this}
 scrollIntoView(){}
 checkValidity(){const n=Number(this.value);return this.value!==''&&Number.isInteger(n)&&n>=Number(this.min)&&n<=Number(this.max)}
 set innerHTML(markup){this.children=Array.from(markup.matchAll(/<(span|button)(?: type="button")? class="([^"]+)">([^<]*)<\/\1>/g),match=>{const n=new Node(match[1],{class:match[2]});n.textContent=match[3];return n})}
}
const ids=new Map(),choices=[];
for(const item of fixture.nodes){const el=new Node(item.tag,item.attrs);if(el.id){assert.ok(!ids.has(el.id),'duplicate id');ids.set(el.id,el)}if(item.attrs['data-total'])choices.push(el)}
const document={activeElement:null,getElementById:id=>{assert.ok(ids.has(id),`missing #${id}`);return ids.get(id)},querySelectorAll:selector=>{if(selector==='.choice')return choices;assert.equal(selector,'.strategy-action');return [...ids.values()].filter(n=>n.dataset.mode)}};
const html=fs.readFileSync(htmlPath,'utf8');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const deterministicMath=Object.create(Math);deterministicMath.random=()=>0.5;
for(const script of scripts)vm.runInNewContext(script,{document,Math:deterministicMath,Event:class{constructor(type){this.type=type}}},{timeout:1000});
const el=id=>ids.get(id);
assert.equal(el('puzzle').hidden,true);el('coinStart').click();assert.equal(el('puzzle').hidden,true);assert.equal(document.activeElement.id,'problemHeading');el('start').click();assert.equal(el('puzzle').hidden,false);
assert.equal(el('experiment').hidden,true);assert.equal(el('range').value,'3');
assert.equal(choices[0].attrs['aria-pressed'],'true');
el('hintBtn').click();assert.equal(el('hint').hidden,false);assert.match(el('hintHeading').textContent,/ヒント1/);
assert.equal(el('hintPrev').disabled,true);
el('hintNext').click();assert.match(el('hintHeading').textContent,/ヒント2/);
el('hintNext').click();assert.match(el('hintText').textContent,/10枚/);assert.equal(el('hintNext').disabled,true);
for(const choice of choices){
 el('try').click();assert.equal(el('experiment').hidden,false);assert.equal(el('thinkingPanel').hidden,true);
 choice.click();const h=Number(choice.dataset.heads);
 assert.equal(el('experiment').hidden,false);assert.equal(el('variantSettings').open,false);
 assert.match(el('verificationSetup').textContent,new RegExp(`${choice.dataset.total}枚`));
 for(const c of fixture.cases.filter(c=>c.total===Number(choice.dataset.total))){
  el('range').value=String(c.n);el('range').dispatchEvent({type:'input'});
  assert.equal(Number(el('left').textContent),c.before);assert.equal(Number(el('right').textContent),c.remaining);
  const coins=[...el('coins').children];const faces=coins.map(x=>x.textContent);
  assert.equal(el('solutionKey').hidden,true);el('flip').click();assert.equal(el('answer').hidden,false);assert.equal(el('solutionKey').hidden,false);assert.match(el('solutionSteps').textContent,new RegExp(`最初の表は${h}枚`));
  assert.equal(Number(el('left').textContent),c.after);assert.equal(Number(el('right').textContent),c.remaining);
  coins.forEach((coin,i)=>{assert.equal(el('coins').children[i],coin);assert.equal(coin.textContent,faces[i]==='表'?'裏':'表')});
  assert.equal(el('checkStage').textContent,'裏返す前');
  assert.equal(Number(el('checkOtherCount').textContent),c.remaining);
  const checkCoins=[...el('checkPicked').children];const checkFaces=checkCoins.map(x=>x.textContent);
  assert.equal(checkFaces.filter(x=>x==='表').length,c.before);
  assert.equal(checkCoins.filter(x=>x.classList.contains('was-tail')).length,c.after);
  assert.equal(el('checkReset').hidden,true);
  el('checkFlip').click();assert.match(el('checkResult').textContent,/そろいます/);
  assert.equal(el('checkStage').textContent,'裏返した後');
  assert.equal(el('checkFlip').disabled,true);assert.equal(el('checkReset').hidden,false);
  assert.equal(checkCoins.filter(x=>x.textContent==='表').length,c.after);
  assert.equal(Number(el('checkOtherCount').textContent),c.remaining);
  checkCoins.forEach((coin,i)=>{assert.equal(el('checkPicked').children[i],coin);assert.equal(coin.textContent,checkFaces[i]==='表'?'裏':'表')});
  assert.equal(el('checkPickedGroup').classList.contains('matched'),true);
  el('checkReset').click();assert.equal(el('checkStage').textContent,'裏返す前');
  assert.equal(el('checkFlip').disabled,false);assert.equal(el('checkPickedGroup').classList.contains('matched'),false);
  assert.deepEqual(checkCoins.map(x=>x.textContent),checkFaces);
  el('checkFlip').click();
  el('flip').click();assert.equal(el('answer').hidden,true);assert.equal(el('checkStage').textContent,'裏返す前');assert.equal(el('checkResult').textContent,'');
  assert.deepEqual(coins.map(x=>x.textContent),faces);
 }
 el('reset').click();assert.equal(document.activeElement.id,'selected-coin-0');assert.equal(el('hint').hidden,true);assert.match(el('hintHeading').textContent,/ヒント1/);
 el('back').click();assert.equal(el('experiment').hidden,true);assert.equal(el('thinkingPanel').hidden,false);assert.equal(choices[0].attrs['aria-pressed'],'true');assert.equal(document.activeElement.id,'problemTitle');
}
// Arbitrary taps must keep each coin's state and location, not regroup the heads.
choices[0].click();el('try').click();el('range').value='0';el('range').dispatchEvent({type:'input'});
const tapped=el('coins').children;const selected=[7,1,9,3];
selected.forEach(i=>tapped[i].click());
const example=fixture.cases.find(c=>c.total===100&&c.n===4);
assert.equal(Number(el('left').textContent),example.before);assert.equal(Number(el('right').textContent),example.remaining);
assert.equal(el('leftLabel').textContent,`選んだ${example.heads}枚中`);
assert.equal(el('rightLabel').textContent,`残り${example.total-example.heads}枚中`);
const arbitraryFaces=tapped.map(x=>x.textContent);
tapped.forEach((coin,i)=>assert.equal(coin.textContent,selected.includes(i)?'表':'裏'));
el('flip').click();assert.equal(Number(el('left').textContent),example.after);
tapped.forEach((coin,i)=>{assert.equal(coin.textContent,arbitraryFaces[i]==='表'?'裏':'表');assert.equal(coin.disabled,true)});
el('checkFlip').click();assert.deepEqual(el('checkPicked').children.map(x=>x.textContent),tapped.map(x=>x.textContent));
el('flip').click();assert.deepEqual(tapped.map(x=>x.textContent),arbitraryFaces);
tapped[7].click();tapped[7].click();assert.deepEqual(tapped.map(x=>x.textContent),arbitraryFaces);
assert.match(html,/ここから先は、解き方の手順/);
assert.ok(html.indexOf('<div class="choices"')>html.indexOf('<div id="experiment"'));assert.match(html,/100枚のコインがあります。表向きは10枚、裏向きは90枚/);
assert.match(html,/触っても/);
assert.equal(scripts.length,2);
// Strategy challenge: all possible split sizes and all supported flip operations.
el('start').click();assert.equal(el('strategyCount').value,'');
const actionNodes=[...ids.values()].filter(n=>n.dataset.mode);
assert.ok(actionNodes.every(n=>n.attrs['aria-pressed']==='false'));
assert.equal(el('strategyResultPanel').hidden,true);
for(const value of ['', '0','100','2.5','abc']){el('strategyCount').value=value;el('strategyCount').dispatchEvent({type:'input'});el('strategyRun').click();assert.match(el('strategyError').textContent,/1から99/);assert.equal(el('strategyResultPanel').hidden,true)}
el('strategyCount').value='50';el('strategyCount').dispatchEvent({type:'input'});el('strategyRun').click();assert.match(el('strategyError').textContent,/選んで/);
for(const p of fixture.strategies){
 el('strategyCount').value=String(p.k);el('strategyCount').dispatchEvent({type:'input'});
 actionNodes.find(n=>n.dataset.mode===p.mode).click();
 assert.equal(el('strategyCoinsA').children.length,0);assert.equal(el('strategyResultPanel').hidden,true);
 el('strategyRun').click();assert.equal(el('strategyResultPanel').hidden,false);assert.equal(el('strategyProof').hidden,true);
 assert.equal(el('strategyCoinsA').children.filter(n=>n.textContent==='表').length,p.result.a);
 assert.equal(el('strategyCoinsB').children.filter(n=>n.textContent==='表').length,p.result.b);
 if(p.k===50&&p.mode==='none')assert.match(el('strategyOutcome').textContent,/この配置では成功/);
 el('strategyVerify').click();assert.equal(el('strategyProof').hidden,false);
 assert.equal(el('strategyProof').classList.contains('verified'),p.guaranteed);
 assert.equal(el('strategyExplain').hidden,!p.guaranteed);
 if(!p.guaranteed){assert.match(el('strategyProofText').textContent,/反例/);assert.equal(el('strategyCoinsA').children.filter(n=>n.textContent==='表').length,p.counterResult.a);assert.equal(el('strategyCoinsB').children.filter(n=>n.textContent==='表').length,p.counterResult.b);assert.equal(el('strategyProofRetry').hidden,false);el('strategyProofRetry').click();assert.equal(el('strategyResultPanel').hidden,true);assert.equal(el('strategyCount').value,String(p.k));assert.equal(document.activeElement.id,'strategyCount');el('strategyRun').click()}
 else {assert.match(el('strategyProofText').textContent,/どの配置でも表の枚数がそろいます/);assert.equal(el('strategyProofRetry').hidden,true)}
 el('strategyAnother').click();assert.equal(el('strategyProof').hidden,true);assert.equal(el('strategyExplain').hidden,true);
 el('strategyRetry').click();assert.equal(el('strategyResultPanel').hidden,true);assert.equal(el('strategyCount').value,String(p.k));assert.equal(document.activeElement.id,'strategyCount');assert.equal(actionNodes.find(n=>n.dataset.mode===p.mode).attrs['aria-pressed'],'true');assert.match(el('strategyEditNote').textContent,/前の作戦を残して/);
}
const solutions=fixture.strategies.filter(p=>p.guaranteed).map(p=>[p.k,p.mode]);assert.deepEqual(solutions,[[10,'a'],[90,'b']]);
assert.ok(html.indexOf('id="coinStart"')<html.indexOf('id="problemHeading"'));assert.match(html,/A組とB組のコインの枚数は、同じでなくても/);assert.match(html,/A組とB組を合わせると必ず100枚/);
el('strategyCount').value='10';el('strategyCount').dispatchEvent({type:'input'});el('strategyActionA').click();el('strategyRun').click();el('strategyVerify').click();el('strategyExplain').click();assert.equal(el('experiment').hidden,false);assert.equal(el('thinkingPanel').hidden,true);
assert.match(el('strategyBridgeNote').textContent,/A組の10枚/);
el('start').click();el('strategyCount').value='90';el('strategyCount').dispatchEvent({type:'input'});el('strategyActionB').click();el('strategyRun').click();el('strategyVerify').click();el('strategyExplain').click();assert.match(el('strategyBridgeNote').textContent,/B組の10枚/);
el('start').click();assert.equal(el('strategyCount').value,'');assert.equal(el('strategyResultPanel').hidden,true);assert.equal(el('experiment').hidden,true);assert.equal(el('strategyBridgeNote').hidden,true);
console.log(`PASS: ${fixture.cases.length} explanation configurations and ${fixture.strategies.length} Python-derived strategy cases; all split sizes/actions; lucky success vs guarantee; counterexamples; resets; explanation transition. Simulated DOM only.`);
