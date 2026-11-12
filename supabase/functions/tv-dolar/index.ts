// Dólar comercial (USD-BRL) para o dash da TV. Fonte: AwesomeAPI (economia.awesomeapi.com.br).
// Guarda a última cotação em memória por 2 minutos para não bater na API a cada TV/PC aberto.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
let cache: { em: number; dados: unknown } | null = null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!cache || Date.now() - cache.em > 120_000) {
      const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      const j = await r.json();
      const u = j.USDBRL;
      if (!u || !u.bid) throw new Error("cotação indisponível");
      cache = {
        em: Date.now(),
        dados: {
          valor: Number(u.bid),
          variacao_pct: Number(u.pctChange),
          atualizado_em: new Date(Number(u.timestamp) * 1000).toISOString(),
        },
      };
    }
    return new Response(JSON.stringify(cache.dados), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
