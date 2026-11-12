// Dólar do dia (USD-BRL) para o dash da TV.
// Tenta, em ordem: AwesomeAPI (comercial, ao vivo) -> Banco Central PTAX -> open.er-api.com.
// Guarda a última cotação em memória por 2 minutos para não bater nas APIs a cada TV/PC aberto.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
type Cotacao = { valor: number; variacao_pct: number | null; fonte: string; atualizado_em: string };
let cache: { em: number; dados: Cotacao } | null = null;

async function getJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "dash-tv-todo/1.0", Accept: "application/json" } });
  if (!r.ok) throw new Error(`${url.split("/")[2]} respondeu ${r.status}`);
  return await r.json();
}

async function awesome(): Promise<Cotacao> {
  const j = await getJson("https://economia.awesomeapi.com.br/json/last/USD-BRL");
  const u = j.USDBRL;
  if (!u || !u.bid) throw new Error("awesomeapi sem cotação");
  return {
    valor: Number(u.bid),
    variacao_pct: Number(u.pctChange),
    fonte: "comercial",
    atualizado_em: new Date(Number(u.timestamp) * 1000).toISOString(),
  };
}

function mdY(d: Date) {
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}-${d.getUTCFullYear()}`;
}
async function ptax(): Promise<Cotacao> {
  const fim = new Date();
  const ini = new Date(fim.getTime() - 10 * 86400000);
  const url = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/" +
    "CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
    `?@dataInicial='${mdY(ini)}'&@dataFinalCotacao='${mdY(fim)}'&$format=json`;
  const j = await getJson(url);
  const v = (j.value ?? []) as { cotacaoVenda: number; dataHoraCotacao: string }[];
  if (!v.length) throw new Error("ptax sem cotação");
  const ult = v[v.length - 1], ant = v.length > 1 ? v[v.length - 2] : null;
  return {
    valor: ult.cotacaoVenda,
    variacao_pct: ant ? ((ult.cotacaoVenda - ant.cotacaoVenda) / ant.cotacaoVenda) * 100 : null,
    fonte: "ptax",
    atualizado_em: new Date(ult.dataHoraCotacao.replace(" ", "T") + "-03:00").toISOString(),
  };
}

async function erApi(): Promise<Cotacao> {
  const j = await getJson("https://open.er-api.com/v6/latest/USD");
  if (!j.rates?.BRL) throw new Error("er-api sem cotação");
  return { valor: j.rates.BRL, variacao_pct: null, fonte: "referência", atualizado_em: new Date(j.time_last_update_unix * 1000).toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (cache && Date.now() - cache.em < 120_000) {
    return new Response(JSON.stringify(cache.dados), { headers: { ...cors, "Content-Type": "application/json" } });
  }
  const erros: string[] = [];
  for (const fonte of [awesome, ptax, erApi]) {
    try {
      const dados = await fonte();
      cache = { em: Date.now(), dados };
      return new Response(JSON.stringify(dados), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      console.error("tv-dolar:", msg);
      erros.push(msg);
    }
  }
  return new Response(JSON.stringify({ erro: erros.join(" | ") }), {
    status: 500,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
