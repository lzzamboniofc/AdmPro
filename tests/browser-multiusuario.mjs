/* Smoke tests do app real em Chromium, com mock explícito do Supabase.
   Não usa credenciais de assinantes nem modifica o banco de staging. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixture=fs.readFileSync(path.join(root,'tests/mock-supabase-browser.js'),'utf8');
const mime={'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.html':'text/html','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\/+/,'')||'index.html';
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html')){res.writeHead(403);res.end();return}
  fs.readFile(file,(err,data)=>{
    if(err){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':(mime[path.extname(file)]||'application/octet-stream')+'; charset=utf-8'});
    res.end(data);
  });
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const origin='http://127.0.0.1:'+port+'/index.html';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failures=0;

async function abrir(perfil,width=1440){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await context.newPage(),erros=[];
  page.on('pageerror',e=>erros.push(e.message));
  await page.route('**/js/vendor/supabase.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:fixture}));
  await page.goto(origin+'?perfil='+perfil,{waitUntil:'load'});
  const pin=page.locator('#form-criar-pin');
  await Promise.race([
    pin.waitFor({state:'visible',timeout:12000}).catch(()=>{}),
    page.locator('#topbar:not([hidden])').waitFor({state:'visible',timeout:12000}).catch(()=>{})
  ]);
  if(await pin.isVisible()){
    await pin.locator('[name="pin"]').fill('1234');
    await pin.locator('[name="confirmacao"]').fill('1234');
    await pin.locator('[type="submit"]').click();
  }
  await page.locator('#topbar:not([hidden])').waitFor({timeout:12000});
  return {page,context,erros};
}
async function run(nome,fn){
  try{await fn();console.log('PASS: '+nome)}
  catch(e){failures++;console.error('FAIL: '+nome+'\n'+e.stack)}
}
try{
  await run('proprietário: primeiro acesso, equipe, horários, convite, agenda e celular',async()=>{
    const {page,context,erros}=await abrir('dono');
    try{
      await page.goto(origin+'?perfil=dono#/equipe');
      await page.locator('h1:has-text("Equipe e Profissionais")').waitFor();
      await page.locator('[data-novo-prof]').click();
      await page.locator('.sheet input[name="nome"]').fill('Camila');
      await page.locator('.sheet [data-add-ausencia]').click();
      assert.ok((await page.locator('#toast-root').innerText()).includes('data'),'Deve validar data ausente.');
      await page.locator('.sheet [name="ausenciaInicioData"]').fill('2027-05-01');
      await page.locator('.sheet [name="ausenciaFimData"]').fill('2027-05-10');
      await page.locator('.sheet [name="ausenciaTipo"]').selectOption('ferias');
      await page.locator('.sheet [data-add-ausencia]').click();
      assert.equal(await page.locator('.sheet [data-rm-ausencia]').count(),1);
      await page.locator('.sheet [type="submit"]').click();
      await page.locator('#lista-profissionais').getByText('Camila').waitFor();
      await page.waitForFunction(()=>window.__admproMock.rows.some(r=>r.colecao==='profissionais'&&r.dados.nome==='Camila'));
      const prof=await page.evaluate(()=>window.__admproMock.rows.find(r=>r.colecao==='profissionais'&&r.dados.nome==='Camila').dados);
      assert.equal(prof.ausencias[0].dataFim,'2027-05-10');
      assert.equal(prof.horariosSemana.length,7);

      await page.locator('[data-convidar]').click();
      await page.locator('.sheet [name="email"]').fill('convite@example.test');
      await page.locator('.sheet [name="papel"]').selectOption('profissional');
      await page.locator('.sheet [name="profissionalId"]').selectOption('prof-ana');
      await page.locator('.sheet [type="submit"]').click();
      await page.locator('#link-convite').waitFor();
      assert.ok((await page.locator('#link-convite').inputValue()).includes('convite='));

      await page.goto(origin+'?perfil=dono#/agenda');
      await page.locator('#agenda-profissional').waitFor();
      assert.ok(await page.locator('.agenda-coluna').count()>=2,'Agenda geral deve ter colunas.');
      await page.locator('#agenda-profissional').selectOption('prof-ana');
      await page.locator('.agenda-slot').first().waitFor();
      await page.setViewportSize({width:390,height:844});
      const dimension=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
      assert.ok(dimension.scroll<=dimension.width+2,
        'Rolagem horizontal no celular: '+JSON.stringify(dimension));
      assert.deepEqual(erros,[],'Erros JS durante navegação');
    }finally{await context.close()}
  });

  await run('profissional: PIN independente, agenda própria, rotas restritas',async()=>{
    const {page,context,erros}=await abrir('profissional',390);
    try{
      await page.goto(origin+'?perfil=profissional#/agenda');
      await page.locator('h1:has-text("Agenda")').waitFor();
      assert.equal(await page.locator('#agenda-profissional').count(),0,'Profissional não precisa do seletor global.');
      assert.equal(await page.locator('.agenda-item').count(),1,'Só pode consultar agendamentos próprios.');
      await page.goto(origin+'?perfil=profissional#/financeiro');
      await page.getByText('Acesso restrito').waitFor();
      await page.goto(origin+'?perfil=profissional#/equipe');
      await page.getByText('Acesso restrito').waitFor();
      assert.deepEqual(erros,[],'Erros JS durante navegação profissional');
    }finally{await context.close()}
  });

  await run('mesmo usuário: alterna empresa sem misturar clientes',async()=>{
    const {page,context,erros}=await abrir('duas');
    try{
      await page.goto(origin+'?perfil=duas#/empresas');
      await page.locator('[data-empresa]').first().waitFor();
      assert.equal(await page.locator('[data-empresa]').count(),2);
      await page.locator('[data-empresa="10000000-0000-4000-8000-000000000002"]').click();
      try {
        await page.locator('.topbar-nome:has-text("Estúdio Secundário")').waitFor({timeout:6000});
      } catch(err) {
        const estado=await page.evaluate(()=>({
          rota:location.hash,
          nomeConta:window.AdmPro.auth.conta?.nome_negocio,
          nomeConfig:window.AdmPro.storage.obter('config')?.nomeNegocio,
          titulo:document.querySelector('#conteudo')?.innerText.slice(0,500),
          sync:window.AdmPro.storage.estadoSync(),
          pin:!!document.querySelector('#form-criar-pin')
        }));
        console.error('DIAGNOSTICO TROCA EMPRESA:',JSON.stringify(estado));
        throw err;
      }
      const clientes=await page.evaluate(()=>window.AdmPro.storage.lista('clientes').map(c=>c.nome));
      assert.ok(clientes.includes('Cliente Secundário'));
      assert.ok(!clientes.includes('Cliente Ana'),'Cache não pode trazer clientes da outra empresa.');
      assert.deepEqual(erros,[],'Erros JS durante troca de empresa');
    }finally{await context.close()}
  });
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
if(failures)process.exitCode=1;
