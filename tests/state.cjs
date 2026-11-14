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
print(json.dumps({'nodes':p.nodes,'cases':cases}))
`,htmlPath],{encoding:'utf8'}));
class Node {
 constructor(tag,attrs={}) {
  this.tag=tag;this.attrs={...attrs};this.id=attrs.id;this.textContent='';this.value=attrs.value||'';
  this.hidden='hidden' in attrs;this.open=false;this.disabled=false;this.children=[];this.events={};
  this.min=attrs.min||'';this.max=attrs.max||'';this.step=attrs.step||'';
  this.dataset={total:attrs['data-total'],heads:attrs['data-heads']};
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
 set innerHTML(markup){this.children=Array.from(markup.matchAll(/<span class="coin"><\/span>/g),()=>new Node('span',{class:'coin'}))}
}
const ids=new Map(),choices=[];
for(const item of fixture.nodes){const el=new Node(item.tag,item.attrs);if(el.id){assert.ok(!ids.has(el.id),'duplicate id');ids.set(el.id,el)}if(item.attrs['data-total'])choices.push(el)}
const document={activeElement:null,getElementById:id=>{assert.ok(ids.has(id),`missing #${id}`);return ids.get(id)},querySelectorAll:selector=>{assert.equal(selector,'.choice');return choices}};
const html=fs.readFileSync(htmlPath,'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInNewContext(script,{document,Event:class{constructor(type){this.type=type}}},{timeout:1000});
const el=id=>ids.get(id);
assert.equal(el('puzzle').hidden,true);el('coinStart').click();assert.equal(el('puzzle').hidden,false);
for(const choice of choices){
 choice.click();const h=Number(choice.dataset.heads);
 assert.equal(el('hint').hidden,true);assert.equal(el('experiment').hidden,true);
 el('hintBtn').click();assert.equal(el('hint').hidden,false);assert.match(el('hintHeading').textContent,/ヒント1/);
 assert.equal(el('hintPrev').disabled,true);
 assert.ok(!el('hintText').textContent.includes(`${h}枚を`),'first hint must not give the extraction step');
 el('hintNext').click();assert.match(el('hintHeading').textContent,/ヒント2/);
 el('hintNext').click();assert.match(el('hintText').textContent,new RegExp(`${h}枚`));assert.equal(el('hintNext').disabled,true);
 el('hintPrev').click();assert.match(el('hintHeading').textContent,/ヒント2/);
 el('try').click();assert.equal(el('experiment').hidden,false);
 for(const c of fixture.cases.filter(c=>c.total===Number(choice.dataset.total))){
  el('range').value=String(c.n);el('range').dispatchEvent({type:'input'});
  assert.equal(Number(el('left').textContent),c.before);assert.equal(Number(el('right').textContent),c.remaining);
  const coins=[...el('coins').children];const faces=coins.map(x=>x.textContent);
  el('flip').click();assert.equal(el('answer').hidden,false);
  assert.equal(Number(el('left').textContent),c.after);assert.equal(Number(el('right').textContent),c.remaining);
  coins.forEach((coin,i)=>{assert.equal(el('coins').children[i],coin);assert.equal(coin.textContent,faces[i]==='表'?'裏':'表')});
  el('checkAnswer').click();assert.match(el('checkResult').textContent,/整数/);
  for(const invalid of ['-1','0.5',String(c.heads+1)]){
   el('checkTails').value=invalid;el('checkRemaining').value=String(c.remaining);el('checkAnswer').click();assert.match(el('checkResult').textContent,/整数/);
  }
  el('checkTails').value=String(c.after===0?1:0);el('checkAnswer').click();assert.match(el('checkResult').textContent,/もう一度/);
  el('checkTails').value=String(c.after);el('checkRemaining').value=String(c.remaining);el('checkAnswer').click();assert.match(el('checkResult').textContent,/一致/);
  el('flip').click();assert.equal(el('answer').hidden,true);assert.equal(el('checkTails').value,'');assert.equal(el('checkResult').textContent,'');
  assert.deepEqual(coins.map(x=>x.textContent),faces);
 }
 el('reset').click();assert.equal(document.activeElement.id,'range');assert.equal(el('hint').hidden,true);assert.match(el('hintHeading').textContent,/ヒント1/);
 el('back').click();assert.equal(el('experiment').hidden,true);assert.equal(document.activeElement.id,'problemTitle');
}
assert.match(html,/次に進むと、解き方の手順/);
assert.match(html,/同じ考え方を、枚数を変えて/);
assert.match(html,/見ても触っても/);
assert.equal((html.match(/<script>/g)||[]).length,1);
console.log(`PASS: ${fixture.cases.length} Python-derived configurations; stable coin identity and reversal; 3-stage hints; answer validation; reset/back. Simulated DOM only.`);
