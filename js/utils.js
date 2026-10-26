/* Utilitários sem dependências externas. Todas as datas são locais. */
(function (A) {
    'use strict';
    const moedaIntl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const dois = n => String(n).padStart(2, '0');
    const digitos = valor => String(valor || '').replace(/\D/g, '');
    const hoje = () => dataISO(new Date());
    function dataISO(data) { return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`; }
    function parseData(iso) { const [a, m, d] = String(iso || '').split('-').map(Number); return new Date(a || 2000, (m || 1) - 1, d || 1); }
    function exibirData(iso) { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || ''))
        return '—'; const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; }
    function deslocarDia(iso, qtde) { const d = parseData(iso); d.setDate(d.getDate() + qtde); return dataISO(d); }
    function deslocarMes(iso, qtde) { const d = parseData((iso || hoje()).slice(0, 7) + '-01'); d.setMonth(d.getMonth() + qtde); return dataISO(d).slice(0, 7); }
    function dinheiro(valor) { return moedaIntl.format(Number(valor) || 0); }
    function numerico(valor) { return (Number(valor) || 0).toFixed(2).replace('.', ','); }
    function centavos(valor) { return Math.round((Number(valor) || 0) * 100); }
    function deCentavos(valor) { return valor / 100; }
    function somarValores(lista) { return deCentavos(lista.reduce((t, v) => t + centavos(v), 0)); }
    function lerMoeda(valor) { if (typeof valor === 'number')
        return Math.round(valor * 100) / 100; const texto = String(valor || '').trim().replace(/[^\d,.-]/g, ''); if (!texto)
        return 0; const normal = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto; return Math.round((Number(normal) || 0) * 100) / 100; }
    function mascaraMoeda(valor) { const n = digitos(valor).slice(0, 12); return numerico((Number(n) || 0) / 100); }
    function mascaraTelefone(valor) { const d = digitos(valor).slice(0, 11); if (!d)
        return ''; if (d.length < 3)
        return `(${d}`; if (d.length <= 6)
        return `(${d.slice(0, 2)}) ${d.slice(2)}`; return `(${d.slice(0, 2)}) ${d.slice(2, d.length === 11 ? 7 : 6)}-${d.slice(d.length === 11 ? 7 : 6)}`; }
    function id() { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`; }
    function escapar(valor) { return String(valor ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function horaMinutos(hora) { const [h, m] = String(hora || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0); }
    function dataHora() { return new Date().toISOString(); }
    function dataHoraVisivel(valor) { if (!valor)
        return '—'; return new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
    function nomeMes(anoMes) { return parseData(anoMes + '-01').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }); }
    function formatarDia(iso) { return parseData(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }); }
    function numeroWhatsapp(telefone) { let d = digitos(telefone); if (d.length === 10 || d.length === 11)
        d = '55' + d; return d; }
    function somaParcelas(parcelas) { return deCentavos((parcelas || []).reduce((s, p) => s + centavos(p.valor), 0)); }
    function totalServico(itens, desconto) { const centavosTotal = (itens || []).reduce((s, i) => s + centavos(i.precoUnit) * Number(i.qtd || 0), 0) - centavos(desconto); return Math.max(0, centavosTotal) / 100; }
    function inicioSemana(iso) { const d = parseData(iso); d.setDate(d.getDate() - d.getDay()); return dataISO(d); }
    // Valor por extenso em pt-BR até 999.999.999,99, sem dependências.
    function valorPorExtenso(valor) {
        const cent = Math.abs(centavos(valor));
        if (cent > 99999999999) return 'valor acima do limite';
        const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
        const especiais = ['dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
        const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
        const centenas = ['', 'cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
        function trio(n) {
            if (n === 100) return 'cem';
            const partes = []; const c = Math.floor(n / 100); let rest = n % 100;
            if (c) partes.push(centenas[c]);
            if (rest >= 10 && rest < 20) partes.push(especiais[rest - 10]);
            else { const d = Math.floor(rest / 10); rest %= 10; if (d) partes.push(dezenas[d]); if (rest) partes.push(unidades[rest]); }
            return partes.join(' e ');
        }
        function inteiro(n) {
            if (!n) return '';
            const grupos = [Math.floor(n / 1000000), Math.floor((n % 1000000) / 1000), n % 1000];
            const partes = [];
            if (grupos[0]) partes.push(trio(grupos[0]) + (grupos[0] === 1 ? ' milhão' : ' milhões'));
            if (grupos[1]) partes.push((grupos[1] === 1 ? '' : trio(grupos[1]) + ' ') + 'mil');
            if (grupos[2]) partes.push(trio(grupos[2]));
            if (partes.length < 2) return partes[0];
            const ultimo = grupos[2];
            const uniao = ultimo && (ultimo < 100 || ultimo % 100 === 0) ? ' e ' : ' ';
            return partes.slice(0, -1).join(', ') + uniao + partes[partes.length - 1];
        }
        const reais = Math.floor(cent / 100), centimos = cent % 100;
        const partes = [];
        if (reais) partes.push(inteiro(reais) + (reais >= 1000000 && reais % 1000000 === 0 ? ' de' : '') + (reais === 1 ? ' real' : ' reais'));
        if (centimos) partes.push(trio(centimos) + (centimos === 1 ? ' centavo' : ' centavos'));
        return partes.join(' e ') || 'zero reais';
    }
    A.utils = { dois, digitos, hoje, dataISO, parseData, exibirData, deslocarDia, deslocarMes, dinheiro, numerico, lerMoeda, mascaraMoeda, mascaraTelefone, id, escapar, horaMinutos, dataHora, dataHoraVisivel, nomeMes, formatarDia, numeroWhatsapp, centavos, deCentavos, somarValores, valorPorExtenso, somaParcelas, totalServico, inicioSemana };
})(window.AdmPro = window.AdmPro || {});
